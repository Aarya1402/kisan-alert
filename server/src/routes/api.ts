import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { query, one } from '../db/pool.js';
import { LANGS, asr, translate, tts, Lang } from '../lib/language.js';
import { recommendCrop } from '../services/crop.js';
import { evaluatePlot, raiseAlert } from '../services/advisory.js';
import { forecast } from '../services/weather.js';
import { diagnoseImage, diagnoseVoice } from '../services/health.js';
import { createTicket, checkOutbreak } from '../services/tickets.js';
import { dispatch } from '../services/telephony.js';
import { ivrStep } from '../services/ivr.js';

export const api = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const wrap = (fn: any) => (req: any, res: any) =>
  Promise.resolve(fn(req, res)).catch((e) => { console.error(e); res.status(500).json({ error: String(e.message || e) }); });

// ---------- meta ----------
api.get('/health', (_req, res) => res.json({ ok: true, service: 'kisan-alert', time: new Date().toISOString() }));
api.get('/langs', (_req, res) => res.json(LANGS));

// ---------- farmers ----------
const farmerSchema = z.object({
  name: z.string().min(1), phone: z.string().min(5),
  language: z.enum(['hi', 'te', 'mr', 'en']).default('hi'),
  village: z.string().min(1), block: z.string().min(1), district: z.string().min(1),
  land_size_ha: z.number().positive().default(1),
  soil_type: z.string().default('loamy'),
  lat: z.number().optional(), lng: z.number().optional(),
  // optional first plot with Soil Health Card values
  n: z.number().optional(), p: z.number().optional(), k: z.number().optional(),
  ph: z.number().optional(), groundwater_m: z.number().optional(),
  soil_moisture: z.number().optional(), current_crop: z.string().optional(),
});

api.get('/farmers', wrap(async (_req: any, res: any) => {
  const rows = await query(`
    SELECT f.*, ST_Y(f.geom) AS lat, ST_X(f.geom) AS lng,
      (SELECT count(*) FROM alerts a WHERE a.farmer_id=f.id AND a.severity='critical') AS critical_alerts,
      (SELECT count(*) FROM tickets t WHERE t.farmer_id=f.id AND t.status!='resolved') AS open_tickets
    FROM farmers f ORDER BY f.id`);
  res.json(rows);
}));

api.get('/farmers/:id', wrap(async (req: any, res: any) => {
  const id = Number(req.params.id);
  const farmer = await one(`SELECT *, ST_Y(geom) AS lat, ST_X(geom) AS lng FROM farmers WHERE id=$1`, [id]);
  if (!farmer) return res.status(404).json({ error: 'not found' });
  const plots = await query(`SELECT * FROM plots WHERE farmer_id=$1 ORDER BY id`, [id]);
  const alerts = await query(`SELECT * FROM alerts WHERE farmer_id=$1 ORDER BY created_at DESC LIMIT 20`, [id]);
  const messages = await query(`SELECT * FROM messages WHERE farmer_id=$1 ORDER BY created_at DESC LIMIT 30`, [id]);
  const tickets = await query(`SELECT * FROM tickets WHERE farmer_id=$1 ORDER BY created_at DESC`, [id]);
  const recs = await query(`SELECT * FROM recommendations WHERE farmer_id=$1 ORDER BY created_at DESC LIMIT 5`, [id]);
  res.json({ farmer, plots, alerts, messages, tickets, recommendations: recs });
}));

api.post('/farmers', wrap(async (req: any, res: any) => {
  const b = farmerSchema.parse(req.body);
  const farmer = await one<any>(
    `INSERT INTO farmers (name, phone, language, village, block, district, land_size_ha, soil_type, geom)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, ST_SetSRID(ST_MakePoint($9,$10),4326)) RETURNING *`,
    [b.name, b.phone, b.language, b.village, b.block, b.district, b.land_size_ha, b.soil_type, b.lng ?? null, b.lat ?? null]
  );
  const plot = await one<any>(
    `INSERT INTO plots (farmer_id, label, area_ha, n, p, k, ph, groundwater_m, soil_moisture, current_crop, geom)
     VALUES ($1,'Plot 1',$2,$3,$4,$5,$6,$7,$8,$9, ST_SetSRID(ST_MakePoint($10,$11),4326)) RETURNING *`,
    [farmer.id, b.land_size_ha, b.n ?? 60, b.p ?? 40, b.k ?? 40, b.ph ?? 6.5, b.groundwater_m ?? 8,
     b.soil_moisture ?? 25, b.current_crop ?? null, b.lng ?? null, b.lat ?? null]
  );
  await dispatch(farmer, 'sms', `Welcome ${farmer.name}! You are registered with Kisan Alert. Call this number anytime for crop advice in your language.`, { kind: 'welcome' });
  res.status(201).json({ farmer, plot });
}));

// ---------- language gateway ----------
api.post('/language/asr', wrap(async (req: any, res: any) => {
  const { text, lang } = req.body;
  res.json(asr(text || '', (lang || 'hi') as Lang));
}));
api.post('/language/translate', wrap(async (req: any, res: any) => {
  const { text, from, to, phraseKey } = req.body;
  res.json({ text: translate(text || '', from || 'en', (to || 'hi') as Lang, phraseKey) });
}));
api.post('/language/tts', wrap(async (req: any, res: any) => {
  const { text, lang } = req.body;
  res.json(tts(text || '', (lang || 'hi') as Lang));
}));

// ---------- Module 1: crop recommendation ----------
api.post('/crop/recommend', wrap(async (req: any, res: any) => {
  const { farmerId, plotId } = req.body;
  let inputs = req.body.inputs;
  let farmer: any = null, plot: any = null, lang: Lang = 'en';
  if (farmerId) {
    farmer = await one(`SELECT * FROM farmers WHERE id=$1`, [farmerId]);
    plot = plotId ? await one(`SELECT * FROM plots WHERE id=$1`, [plotId])
      : await one(`SELECT * FROM plots WHERE farmer_id=$1 ORDER BY id LIMIT 1`, [farmerId]);
    lang = (farmer?.language || 'en') as Lang;
    if (!inputs && plot) {
      const fc = await forecast(farmer.block);
      const avgRain = fc.reduce((a, d) => a + d.rainfall_mm, 0);
      inputs = {
        n: Number(plot.n ?? 60), p: Number(plot.p ?? 40), k: Number(plot.k ?? 40),
        temp: Number(fc[0]?.temp_c ?? 27), humidity: Number(fc[0]?.humidity ?? 70),
        ph: Number(plot.ph ?? 6.5), rainfall: avgRain,
        groundwater_m: Number(plot.groundwater_m ?? 8), soil_moisture: Number(plot.soil_moisture ?? 25),
      };
    }
  }
  if (!inputs) return res.status(400).json({ error: 'Provide inputs or a farmerId with a plot' });
  const result = recommendCrop(inputs, lang === 'en' ? 'en' : lang);
  if (farmer) {
    await one(
      `INSERT INTO recommendations (farmer_id, plot_id, crop, score, alternatives, explanation, features)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [farmer.id, plot?.id ?? null, result.best.key, result.best.score, JSON.stringify(result.alternatives), result.explanation, JSON.stringify(inputs)]
    );
    await dispatch(farmer, 'sms', `Kisan Alert crop advice: grow ${result.best.name}. ${result.reasons[0]}`, { kind: 'recommendation' });
  }
  res.json(result);
}));

// ---------- Module 2: advisory & alerts ----------
api.get('/weather/:block/forecast', wrap(async (req: any, res: any) => {
  res.json(await forecast(req.params.block, req.query.dry === '1'));
}));

api.get('/alerts', wrap(async (_req: any, res: any) => {
  res.json(await query(`
    SELECT a.*, f.name AS farmer_name, f.village FROM alerts a
    LEFT JOIN farmers f ON f.id=a.farmer_id ORDER BY a.created_at DESC LIMIT 100`));
}));

// Evaluate rules for one farmer (or all) and raise + dispatch breached alerts.
api.post('/advisory/run', wrap(async (req: any, res: any) => {
  const farmerId = req.body.farmerId;
  const dry = req.body.dry !== false; // default demo-dry so alerts are visible
  const farmers = farmerId
    ? await query(`SELECT * FROM farmers WHERE id=$1`, [farmerId])
    : await query(`SELECT * FROM farmers`);
  const raised: any[] = [];
  for (const f of farmers) {
    const plot = await one<any>(`SELECT * FROM plots WHERE farmer_id=$1 ORDER BY id LIMIT 1`, [f.id]);
    const detected = await evaluatePlot(
      { id: plot?.id ?? 0, farmer_id: f.id, block: f.block, soil_moisture: plot?.soil_moisture, current_crop: plot?.current_crop },
      { dry }
    );
    for (const d of detected) {
      const channel = d.severity === 'critical' ? 'ivr' : 'sms';
      const row = await raiseAlert(f, f.block, d, channel);
      raised.push(row);
    }
  }
  res.json({ raised: raised.length, alerts: raised });
}));

api.post('/alerts/:id/ack', wrap(async (req: any, res: any) => {
  res.json(await one(`UPDATE alerts SET acknowledged=true WHERE id=$1 RETURNING *`, [req.params.id]));
}));

// ---------- sensors (simulated ESP32 feed) ----------
api.post('/plots/:id/sensor', wrap(async (req: any, res: any) => {
  const { soil_moisture, temp_c, source } = req.body;
  const row = await one(
    `INSERT INTO sensor_readings (plot_id, soil_moisture, temp_c, source) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, soil_moisture, temp_c ?? null, source ?? 'sim']
  );
  await one(`UPDATE plots SET soil_moisture=$1 WHERE id=$2`, [soil_moisture, req.params.id]);
  res.json(row);
}));
api.get('/plots/:id/sensors', wrap(async (req: any, res: any) => {
  res.json(await query(`SELECT * FROM sensor_readings WHERE plot_id=$1 ORDER BY ts DESC LIMIT 50`, [req.params.id]));
}));

// ---------- Module 3: crop health diagnosis ----------
api.post('/health/diagnose/image', upload.single('image'), wrap(async (req: any, res: any) => {
  const farmerId = Number(req.body.farmerId);
  const farmer = await one<any>(`SELECT * FROM farmers WHERE id=$1`, [farmerId]);
  if (!farmer) return res.status(400).json({ error: 'farmerId required' });
  const plot = await one<any>(`SELECT * FROM plots WHERE farmer_id=$1 ORDER BY id LIMIT 1`, [farmerId]);
  const buf: Buffer = req.file?.buffer ?? Buffer.alloc(0);
  const dx = diagnoseImage(buf, req.file?.originalname || req.body.hint || '');
  const result = await persistDiagnosis(farmer, plot, dx, 'image');
  res.json(result);
}));

api.post('/health/diagnose/voice', wrap(async (req: any, res: any) => {
  const farmerId = Number(req.body.farmerId);
  const farmer = await one<any>(`SELECT * FROM farmers WHERE id=$1`, [farmerId]);
  if (!farmer) return res.status(400).json({ error: 'farmerId required' });
  const plot = await one<any>(`SELECT * FROM plots WHERE farmer_id=$1 ORDER BY id LIMIT 1`, [farmerId]);
  const dx = diagnoseVoice(req.body.transcript || '');
  const result = await persistDiagnosis(farmer, plot, dx, 'voice', req.body.transcript);
  res.json(result);
}));

async function persistDiagnosis(farmer: any, plot: any, dx: any, inputType: string, transcript?: string) {
  const diag = await one<any>(
    `INSERT INTO diagnoses (farmer_id, plot_id, input_type, crop, disease, confidence, severity, advice, transcript, escalated)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [farmer.id, plot?.id ?? null, inputType, dx.crop, dx.disease, dx.confidence, dx.severity, dx.advice, transcript ?? null, dx.escalate]
  );
  let ticket: any = null, outbreak: any = null;
  if (dx.escalate) {
    ticket = await createTicket({
      farmer, diagnosisId: diag.id, category: 'crop_health',
      summary: `${inputType} diagnosis: ${dx.disease} (conf ${dx.confidence})`,
      aiDiagnosis: dx.disease, aiConfidence: dx.confidence,
      priority: dx.severity === 'high' ? 'high' : 'normal',
    });
    outbreak = await checkOutbreak(farmer.block, dx.diseaseKey);
  } else {
    await dispatch(farmer, 'sms', `Kisan Alert diagnosis: ${dx.disease}. ${dx.advice}`, { kind: 'diagnosis' });
  }
  return { diagnosis: dx, record: diag, ticket, outbreak,
    spoken: dx.escalate
      ? `I think this may be ${dx.disease}, but please also show your RSK officer. Ticket ${ticket?.code} created.`
      : dx.advice };
}

// ---------- tickets / RSK dashboard ----------
api.get('/tickets', wrap(async (req: any, res: any) => {
  const status = req.query.status;
  const rows = await query(`
    SELECT t.*, f.name AS farmer_name, f.phone, f.village, f.block, f.language,
           e.name AS expert_name, e.center
    FROM tickets t
    JOIN farmers f ON f.id=t.farmer_id
    LEFT JOIN experts e ON e.id=t.expert_id
    ${status ? 'WHERE t.status=$1' : ''}
    ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, t.created_at DESC`,
    status ? [status] : []);
  res.json(rows);
}));

api.get('/tickets/:id', wrap(async (req: any, res: any) => {
  const t = await one(`
    SELECT t.*, f.name AS farmer_name, f.phone, f.village, f.block, f.language,
           ST_Y(f.geom) AS lat, ST_X(f.geom) AS lng, e.name AS expert_name, e.center
    FROM tickets t JOIN farmers f ON f.id=t.farmer_id
    LEFT JOIN experts e ON e.id=t.expert_id WHERE t.id=$1`, [req.params.id]);
  if (!t) return res.status(404).json({ error: 'not found' });
  const events = await query(`SELECT * FROM ticket_events WHERE ticket_id=$1 ORDER BY created_at`, [req.params.id]);
  const diagnosis = (t as any).diagnosis_id ? await one(`SELECT * FROM diagnoses WHERE id=$1`, [(t as any).diagnosis_id]) : null;
  res.json({ ticket: t, events, diagnosis });
}));

api.post('/tickets/:id/status', wrap(async (req: any, res: any) => {
  const { status } = req.body;
  const t = await one<any>(`UPDATE tickets SET status=$1, updated_at=now() WHERE id=$2 RETURNING *`, [status, req.params.id]);
  await one(`INSERT INTO ticket_events (ticket_id, actor, action, note) VALUES ($1,'expert','status_change',$2)`, [t.id, `Status → ${status}`]);
  res.json(t);
}));

// Expert approves/overrides AI and pushes reply back to farmer via SMS/voice.
api.post('/tickets/:id/resolve', wrap(async (req: any, res: any) => {
  const { reply, finalDiagnosis, channel } = req.body;
  const t = await one<any>(`SELECT t.*, f.* , t.id AS tid FROM tickets t JOIN farmers f ON f.id=t.farmer_id WHERE t.id=$1`, [req.params.id]);
  if (!t) return res.status(404).json({ error: 'not found' });
  await one(
    `UPDATE tickets SET status='resolved', expert_reply=$1, ai_diagnosis=COALESCE($2, ai_diagnosis), updated_at=now() WHERE id=$3 RETURNING *`,
    [reply, finalDiagnosis ?? null, t.tid]
  );
  await one(`INSERT INTO ticket_events (ticket_id, actor, action, note) VALUES ($1,'expert','resolved',$2)`,
    [t.tid, `${finalDiagnosis ? 'Diagnosis: ' + finalDiagnosis + '. ' : ''}${reply}`]);
  const farmer = { id: t.farmer_id, phone: t.phone, language: t.language };
  await dispatch(farmer as any, (channel || 'sms'),
    `RSK officer on ticket ${t.code}: ${finalDiagnosis ? '(' + finalDiagnosis + ') ' : ''}${reply}`, { kind: 'expert_reply', code: t.code });
  res.json({ ok: true, code: t.code });
}));

// ---------- IVR simulator ----------
api.post('/ivr/step', wrap(async (req: any, res: any) => {
  res.json(await ivrStep(req.body));
}));

// ---------- dashboard aggregates ----------
api.get('/stats', wrap(async (_req: any, res: any) => {
  const [farmers, alerts, tickets, diagnoses, outbreaks] = await Promise.all([
    one(`SELECT count(*)::int c FROM farmers`),
    one(`SELECT count(*)::int c, count(*) FILTER (WHERE severity='critical')::int crit FROM alerts`),
    one(`SELECT count(*)::int c, count(*) FILTER (WHERE status!='resolved')::int open FROM tickets`),
    one(`SELECT count(*)::int c FROM diagnoses`),
    one(`SELECT count(*)::int c FROM alerts WHERE type='outbreak'`),
  ]);
  res.json({ farmers, alerts, tickets, diagnoses, outbreaks });
}));

api.get('/map', wrap(async (_req: any, res: any) => {
  const rows = await query(`
    SELECT f.id, f.name, f.village, f.block, ST_Y(f.geom) AS lat, ST_X(f.geom) AS lng,
      (SELECT count(*) FROM alerts a WHERE a.farmer_id=f.id AND a.severity='critical' AND a.created_at > now()-interval '14 days') AS critical,
      (SELECT count(*) FROM tickets t WHERE t.farmer_id=f.id AND t.status!='resolved') AS open_tickets,
      (SELECT string_agg(DISTINCT a.type, ',') FROM alerts a WHERE a.farmer_id=f.id AND a.created_at > now()-interval '14 days') AS alert_types
    FROM farmers f WHERE f.geom IS NOT NULL`);
  const outbreaks = await query(`SELECT * FROM alerts WHERE type='outbreak' ORDER BY created_at DESC`);
  res.json({ farmers: rows, outbreaks });
}));
