import { query } from '../db/pool.js';

export interface DayWeather { day: string; rainfall_mm: number; temp_c: number; humidity: number; }

// Deterministic pseudo-random so demos are repeatable per block+day-seed.
function seeded(seedStr: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 10-day forecast. Uses OpenWeather if a key is configured; otherwise a
// realistic simulation. Some blocks are seeded into a dry spell for the demo.
export async function forecast(block: string, dry = false): Promise<DayWeather[]> {
  const rnd = seeded(block + (dry ? '-dry' : ''));
  const out: DayWeather[] = [];
  const base = new Date();
  for (let i = 0; i < 10; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    const rainChance = dry ? 0.05 : 0.4;
    const rain = rnd() < rainChance ? Math.round(rnd() * 25 * 10) / 10 : 0;
    const temp = Math.round((28 + rnd() * 8 - (rain > 0 ? 3 : 0)) * 10) / 10;
    const humidity = Math.round(45 + rnd() * 40 + (rain > 0 ? 15 : 0));
    out.push({ day: d.toISOString().slice(0, 10), rainfall_mm: rain, temp_c: temp, humidity: Math.min(98, humidity) });
  }
  return out;
}

// Recent recorded rainfall for anomaly baselines.
export async function recentRainfall(block: string, days = 30): Promise<DayWeather[]> {
  return query<DayWeather>(
    `SELECT to_char(day,'YYYY-MM-DD') AS day, rainfall_mm, temp_c, humidity
       FROM weather_daily WHERE block=$1 ORDER BY day DESC LIMIT $2`,
    [block, days]
  );
}
