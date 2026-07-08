import { one, query } from '../db/pool.js';
import { asr, translate, tts, Lang } from '../lib/language.js';
import { recommendCrop } from './crop.js';
import { evaluatePlot } from './advisory.js';
import { diagnoseVoice } from './health.js';
import { createTicket, checkOutbreak } from './tickets.js';

// A narrow, predictable IVR finite-state machine (per the plan: custom FSM, not
// a generic chatbot). Each turn takes the caller's DTMF/voice input and returns
// the next spoken prompt. Low ASR confidence falls back to a keypad menu.

export interface IvrTurn {
  state: string;
  prompt: string;        // localized text ("spoken")
  promptEn: string;
  audioUrl: string;
  options?: { key: string; label: string }[];
  done?: boolean;
  payload?: any;         // structured result (recommendation, alert, diagnosis)
}

async function farmerWithPlot(farmerId: number) {
  const farmer = await one<any>(`SELECT * FROM farmers WHERE id=$1`, [farmerId]);
  const plot = await one<any>(`SELECT * FROM plots WHERE farmer_id=$1 ORDER BY id LIMIT 1`, [farmerId]);
  return { farmer, plot };
}

function say(text: string, lang: Lang, state: string, extra: Partial<IvrTurn> = {}): IvrTurn {
  const t = tts(text, lang);
  return { state, prompt: text, promptEn: text, audioUrl: t.audioUrl, ...extra };
}

export async function ivrStep(input: {
  farmerId: number; state?: string; digit?: string; speech?: string;
}): Promise<IvrTurn> {
  const { farmer, plot } = await farmerWithPlot(input.farmerId);
  if (!farmer) return say('Farmer not found', 'en', 'error', { done: true });
  const lang = farmer.language as Lang;

  const state = input.state || 'welcome';

  if (state === 'welcome') {
    return {
      ...say(translate('Welcome to Kisan Alert.', 'en', lang, 'welcome'), lang, 'menu'),
      options: [
        { key: '1', label: 'Crop advice' },
        { key: '2', label: 'Weather / dry-spell alert' },
        { key: '3', label: 'Plant disease help' },
      ],
    };
  }

  if (state === 'menu') {
    if (input.digit === '1') return cropTurn(farmer, plot, lang);
    if (input.digit === '2') return weatherTurn(farmer, plot, lang);
    if (input.digit === '3')
      return say('Please describe what you see on your crop after the beep.', lang, 'disease_listen',
        { options: [{ key: 'speak', label: 'Describe symptom (voice)' }] });
    return { ...say('Invalid choice. Press 1, 2 or 3.', lang, 'menu'),
      options: [{ key: '1', label: 'Crop advice' }, { key: '2', label: 'Weather' }, { key: '3', label: 'Disease' }] };
  }

  if (state === 'disease_listen') {
    const heard = asr(input.speech || '', lang);
    // Low ASR confidence -> keypad fallback (judge Q&A point in the plan).
    if (heard.confidence < 0.5) {
      return { ...say('Sorry, I did not catch that. Press 1 if leaves are yellow, 2 if brown/dry, 3 if you see insects.', lang, 'disease_menu'),
        options: [{ key: '1', label: 'Yellow leaves' }, { key: '2', label: 'Brown/dry' }, { key: '3', label: 'Insects' }] };
    }
    return diseaseTurn(farmer, plot, lang, heard.transcript);
  }

  if (state === 'disease_menu') {
    const map: Record<string, string> = { '1': 'leaves are yellow', '2': 'brown dry patches', '3': 'insects eating holes' };
    return diseaseTurn(farmer, plot, lang, map[input.digit || ''] || 'not sure');
  }

  return say('Thank you for calling Kisan Alert. Goodbye.', lang, 'end', { done: true });
}

async function cropTurn(farmer: any, plot: any, lang: Lang): Promise<IvrTurn> {
  const inputs = {
    n: Number(plot?.n ?? 60), p: Number(plot?.p ?? 40), k: Number(plot?.k ?? 40),
    temp: 27, humidity: 70, ph: Number(plot?.ph ?? 6.5), rainfall: 90,
    groundwater_m: Number(plot?.groundwater_m ?? 8), soil_moisture: Number(plot?.soil_moisture ?? 25),
  };
  const rec = recommendCrop(inputs, lang === 'en' ? 'en' : lang);
  await query(
    `INSERT INTO recommendations (farmer_id, plot_id, crop, score, alternatives, explanation, features)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [farmer.id, plot?.id ?? null, rec.best.key, rec.best.score, JSON.stringify(rec.alternatives), rec.explanation, JSON.stringify(inputs)]
  );
  const text = `${rec.explanation} ${rec.reasons[0]}`;
  return say(text, lang, 'crop_result', { done: true, payload: rec });
}

async function weatherTurn(farmer: any, plot: any, lang: Lang): Promise<IvrTurn> {
  const alerts = await evaluatePlot(
    { id: plot?.id ?? 0, farmer_id: farmer.id, block: farmer.block, soil_moisture: plot?.soil_moisture, current_crop: plot?.current_crop },
    { dry: true } // demo blocks are seeded dry so weather calls always show the alert
  );
  const text = alerts.length ? alerts[0].message : 'Good news — normal rainfall is expected this week. No action needed.';
  return say(text, lang, 'weather_result', { done: true, payload: { alerts } });
}

async function diseaseTurn(farmer: any, plot: any, lang: Lang, transcript: string): Promise<IvrTurn> {
  const dx = diagnoseVoice(transcript);
  const diag = await one<any>(
    `INSERT INTO diagnoses (farmer_id, plot_id, input_type, crop, disease, confidence, severity, advice, transcript, escalated)
     VALUES ($1,$2,'voice',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [farmer.id, plot?.id ?? null, dx.crop, dx.disease, dx.confidence, dx.severity, dx.advice, transcript, dx.escalate]
  );
  let ticket: any = null;
  if (dx.escalate) {
    ticket = await createTicket({
      farmer, diagnosisId: diag.id, category: 'crop_health',
      summary: `Voice symptom: "${transcript}" → ${dx.disease}`,
      aiDiagnosis: dx.disease, aiConfidence: dx.confidence,
      priority: dx.severity === 'high' ? 'high' : 'normal',
    });
    await checkOutbreak(farmer.block, dx.diseaseKey);
  }
  const text = dx.escalate
    ? `I think this may be ${dx.disease}, but I'm not fully sure. ${dx.advice} I have registered ticket ${ticket?.code} with your RSK officer, who will call you.`
    : `${dx.advice}`;
  return say(text, lang, 'disease_result', { done: true, payload: { diagnosis: dx, ticket } });
}
