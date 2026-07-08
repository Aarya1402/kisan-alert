import { CROPS, FEATURE_STD, CropProfile } from '../lib/cropData.js';

export interface CropInputs {
  n: number; p: number; k: number;
  temp: number; humidity: number; ph: number; rainfall: number;
  groundwater_m?: number;   // depth to water table (m), deeper = scarcer water
  soil_moisture?: number;   // current %
}

export interface CropCandidate {
  key: string;
  name: string;
  score: number;            // 0..1 suitability
  waterNeed: CropProfile['waterNeed'];
  season: string;
}

export interface CropResult {
  best: CropCandidate;
  alternatives: CropCandidate[];
  explanation: string;
  reasons: string[];
  features: CropInputs;
}

function normDist(a: CropInputs, c: CropProfile): number {
  const d =
    ((a.n - c.n) / FEATURE_STD.n) ** 2 +
    ((a.p - c.p) / FEATURE_STD.p) ** 2 +
    ((a.k - c.k) / FEATURE_STD.k) ** 2 +
    ((a.temp - c.temp) / FEATURE_STD.temp) ** 2 +
    ((a.humidity - c.humidity) / FEATURE_STD.humidity) ** 2 +
    ((a.ph - c.ph) / FEATURE_STD.ph) ** 2 +
    ((a.rainfall - c.rainfall) / FEATURE_STD.rainfall) ** 2;
  return Math.sqrt(d);
}

const waterPenalty = { low: 0, medium: 1, high: 2 } as const;

export function recommendCrop(inputs: CropInputs, lang: 'en' | 'hi' | 'te' | 'mr' = 'en'): CropResult {
  const gw = inputs.groundwater_m ?? 8;
  // Rule layer: scarce groundwater (deep water table) penalizes thirsty crops.
  const waterStress = gw > 12 ? 2 : gw > 8 ? 1 : 0; // 0 ample, 2 scarce

  const scored = CROPS.map((c) => {
    const dist = normDist(inputs, c);
    // Convert distance to a similarity score; add groundwater-aware penalty.
    const base = 1 / (1 + dist);
    const penalty = 0.06 * waterStress * waterPenalty[c.waterNeed];
    const score = Math.max(0, base - penalty);
    return { c, dist, score };
  }).sort((a, b) => b.score - a.score);

  const toCand = (x: { c: CropProfile; score: number }): CropCandidate => ({
    key: x.c.key,
    name: x.c.name[lang] || x.c.name.en,
    score: Number(x.score.toFixed(3)),
    waterNeed: x.c.waterNeed,
    season: x.c.season,
  });

  const best = scored[0];
  const reasons = buildReasons(inputs, best.c, gw, waterStress);
  const explanation = buildExplanation(best.c, reasons, lang);

  return {
    best: toCand(best),
    alternatives: scored.slice(1, 4).map(toCand),
    explanation,
    reasons,
    features: inputs,
  };
}

function buildReasons(inp: CropInputs, c: CropProfile, gw: number, waterStress: number): string[] {
  const r: string[] = [];
  if (waterStress >= 2 && c.waterNeed === 'low')
    r.push(`Groundwater is deep (${gw} m) — a low-water crop like ${c.name.en} avoids over-pumping.`);
  else if (waterStress === 0 && c.waterNeed === 'high')
    r.push(`Groundwater is shallow (${gw} m) so a water-loving crop like ${c.name.en} is viable here.`);
  else
    r.push(`${c.name.en} matches your soil and water availability (groundwater ${gw} m).`);

  if (Math.abs(inp.ph - c.ph) < 0.7) r.push(`Soil pH ${inp.ph} suits ${c.name.en} (ideal ~${c.ph}).`);
  else r.push(`Soil pH ${inp.ph} is off ideal ${c.ph} for ${c.name.en} — consider amendment.`);

  if (inp.rainfall < c.rainfall * 0.7)
    r.push(`Expected rainfall ${Math.round(inp.rainfall)} mm is below ${c.name.en}'s need (~${c.rainfall} mm) — plan supplemental irrigation.`);
  else
    r.push(`Rainfall ${Math.round(inp.rainfall)} mm is adequate for ${c.name.en} (~${c.rainfall} mm).`);

  const npk: string[] = [];
  if (inp.n < c.n - 20) npk.push('nitrogen is low');
  if (inp.p < c.p - 20) npk.push('phosphorus is low');
  if (inp.k < c.k - 20) npk.push('potassium is low');
  if (npk.length) r.push(`Per Soil Health Card, ${npk.join(' and ')} vs ${c.name.en}'s optimum — apply matching fertilizer dose.`);

  return r;
}

function buildExplanation(c: CropProfile, reasons: string[], lang: string): string {
  if (lang === 'hi') {
    return `हमारी सलाह है: ${c.name.hi} (${c.season})। कारण: ${reasons[0]}`;
  }
  return `Recommended crop: ${c.name.en} (${c.season}). Why: ${reasons.slice(0, 2).join(' ')}`;
}
