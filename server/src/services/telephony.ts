import { query } from '../db/pool.js';
import { translate, tts, Lang } from '../lib/language.js';

// Telephony dispatcher — simulates mKisan-style SMS + outbound IVR. In
// production this calls Twilio/Gupshup/Exotel. Here every outbound message is
// logged to the DB so the dashboard and simulator can show the farmer's inbox.
export async function dispatch(
  farmer: { id: number; phone: string; language: Lang },
  channel: 'sms' | 'ivr' | 'whatsapp',
  bodyEn: string,
  meta: Record<string, any> = {}
) {
  const lang = (farmer.language || 'hi') as Lang;
  const localized = translate(bodyEn, 'en', lang, meta.phraseKey);
  const spoken = channel === 'ivr' ? tts(localized, lang) : null;
  const rows = await query(
    `INSERT INTO messages (farmer_id, phone, channel, direction, language, body, body_en, meta)
     VALUES ($1,$2,$3,'out',$4,$5,$6,$7) RETURNING *`,
    [farmer.id, farmer.phone, channel, lang, localized, bodyEn, JSON.stringify({ ...meta, spoken })]
  );
  return rows[0];
}
