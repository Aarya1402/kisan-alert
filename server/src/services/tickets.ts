import { query, one } from '../db/pool.js';
import { dispatch } from './telephony.js';

// Human-readable, SMS-trackable ticket code: KA-2026-000N
async function nextCode(): Promise<string> {
  const row = await one<{ c: number }>(`SELECT count(*)::int AS c FROM tickets`);
  const n = (row?.c || 0) + 1;
  return `KA-2026-${String(n).padStart(4, '0')}`;
}

// Auto-assign to an expert covering the farmer's block (falls back to any).
async function pickExpert(block: string): Promise<number | null> {
  const row = await one<{ id: number }>(
    `SELECT id FROM experts WHERE block=$1 ORDER BY id LIMIT 1`, [block]
  );
  const any = row || (await one<{ id: number }>(`SELECT id FROM experts ORDER BY id LIMIT 1`));
  return any?.id ?? null;
}

export async function createTicket(opts: {
  farmer: any; diagnosisId?: number; category: string; summary: string;
  aiDiagnosis?: string; aiConfidence?: number; priority?: string;
}) {
  const code = await nextCode();
  const expertId = await pickExpert(opts.farmer.block);
  const ticket = await one(
    `INSERT INTO tickets (code, farmer_id, diagnosis_id, expert_id, category, priority, summary, ai_diagnosis, ai_confidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [code, opts.farmer.id, opts.diagnosisId ?? null, expertId, opts.category,
     opts.priority ?? 'normal', opts.summary, opts.aiDiagnosis ?? null, opts.aiConfidence ?? null]
  );
  await query(
    `INSERT INTO ticket_events (ticket_id, actor, action, note) VALUES ($1,'system','created',$2)`,
    [(ticket as any).id, `Auto-created from ${opts.category}. AI: ${opts.aiDiagnosis || 'n/a'} (${opts.aiConfidence ?? '—'})`]
  );
  // Tell the farmer their tracking code by SMS.
  await dispatch(opts.farmer, 'sms',
    `Your query is registered with RSK. Ticket ${code}. An officer will call you. Track by replying ${code}.`,
    { kind: 'ticket', code });
  return ticket;
}

// Community outbreak detection: when >=N farmers in the same block report the
// same disease within a window, escalate a regional outbreak alert to the RSK.
export async function checkOutbreak(block: string, diseaseKey: string): Promise<any | null> {
  const row = await one<{ c: number }>(
    `SELECT count(DISTINCT d.farmer_id)::int AS c
       FROM diagnoses d JOIN farmers f ON f.id=d.farmer_id
      WHERE f.block=$1 AND d.disease ILIKE '%'||$2||'%'
        AND d.created_at > now() - interval '14 days'`,
    [block, diseaseKey.replace(/_/g, ' ')]
  );
  const count = row?.c || 0;
  if (count >= 3) {
    const existing = await one(
      `SELECT id FROM alerts WHERE block=$1 AND type='outbreak'
         AND data->>'disease'=$2 AND created_at > now() - interval '14 days'`,
      [block, diseaseKey]
    );
    if (existing) return null;
    return one(
      `INSERT INTO alerts (block, type, severity, title, message, data, channel)
       VALUES ($1,'outbreak','critical',$2,$3,$4,'sms') RETURNING *`,
      [block, `Outbreak: ${diseaseKey.replace(/_/g, ' ')} in ${block}`,
       `${count} farmers in ${block} reported ${diseaseKey.replace(/_/g, ' ')} in the last 14 days. Recommend a field visit and area-wide advisory.`,
       JSON.stringify({ disease: diseaseKey, farmer_count: count })]
    );
  }
  return null;
}
