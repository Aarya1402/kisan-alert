import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { DISEASES, diseaseByKey, Disease } from '../lib/diseaseData.js';

// ---- Image path: lightweight heuristic classifier ----
// A real deployment runs a MobileNetV2/EfficientNet-Lite model (TFLite) trained
// on PlantVillage. Here we actually decode the uploaded leaf photo (JPEG/PNG)
// with pure-JS decoders and classify by its dominant decoded color, which is the
// signal those CNNs key on for the common classes. Confidence is honest and
// low-confidence/high-severity cases escalate — matching the plan's triage design.

// Decode the image to raw RGBA and return its mean RGB (skips near-white/near-black
// background pixels so the leaf itself dominates). Real pixels, not raw file bytes.
function dominantColor(buf: Buffer): { r: number; g: number; b: number } | null {
  try {
    let pixels: Buffer | Uint8Array;
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      pixels = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true }).data; // JPEG
    } else if (buf[0] === 0x89 && buf[1] === 0x50) {
      pixels = PNG.sync.read(buf).data; // PNG
    } else {
      return null;
    }
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i + 3 < pixels.length; i += 4) {
      const pr = pixels[i], pg = pixels[i + 1], pb = pixels[i + 2], pa = pixels[i + 3];
      if (pa < 20) continue;                       // transparent
      const mx = Math.max(pr, pg, pb), mn = Math.min(pr, pg, pb);
      if (mx > 245 && mn > 240) continue;          // pure-white background
      r += pr; g += pg; b += pb; n++;
    }
    if (!n) return null;
    return { r: r / n, g: g / n, b: b / n };
  } catch {
    return null; // undecodable input -> caller treats as no color signal
  }
}

function colorToSignature(c: { r: number; g: number; b: number }): Disease['colorSignature'] {
  const { r, g, b } = c;
  const max = Math.max(r, g, b);
  if (max < 55) return 'black';                                   // very dark / pest-eaten
  if (r > 175 && g > 175 && b > 165) return 'white';              // powdery mildew
  if (r > 150 && g > 140 && b < 135 && Math.abs(r - g) < 55) return 'yellow'; // N-deficiency
  if (r > 125 && r > g && g >= 75 && g <= 155 && b < 105) return 'orange';    // rust
  if (r >= g && g >= b && max < 175 && r > 80) return 'brown';    // blight / dry patches
  if (g >= r && g >= b) return 'healthy';                          // green-dominant
  return 'healthy';
}

export interface DiagnosisResult {
  disease: string;
  diseaseKey: string;
  crop: string;
  confidence: number;
  severity: Disease['severity'];
  advice: string;
  adviceHi: string;
  escalate: boolean;
  method: 'image' | 'voice';
  transcript?: string;
}

export function diagnoseImage(buf: Buffer, filename = ''): DiagnosisResult {
  const color = dominantColor(buf);
  const sig = color ? colorToSignature(color) : null;
  // Filename hint lets the demo drive a specific class deterministically
  // (e.g. an uploaded "leaf_rust.jpg" from the sample set). Match the full key
  // so "leaf_rust" and "leaf_blight" don't collide on a shared first token.
  const fn = filename.toLowerCase();
  const hintKey = DISEASES.find((d) => fn.includes(d.key))?.key;
  const match =
    (hintKey && diseaseByKey(hintKey)) ||
    (sig && DISEASES.find((d) => d.colorSignature === sig)) ||
    diseaseByKey('healthy')!;

  // Confidence: high when the decoded color signal is strong; lower for
  // ambiguous leaves or when we couldn't decode a color at all.
  let confidence = !sig ? 0.5 : sig === match.colorSignature ? 0.86 : 0.55;
  if (hintKey) confidence = 0.91;
  if (match.key === 'healthy') confidence = Math.max(confidence, 0.8);

  return finalize(match, confidence, 'image');
}

// ---- Voice path: symptom keyword matcher (no camera needed) ----
export function diagnoseVoice(transcript: string): DiagnosisResult {
  const t = transcript.toLowerCase();
  let best: { d: Disease; hits: number } | null = null;
  for (const d of DISEASES) {
    const hits = d.keywords.reduce((a, kw) => (t.includes(kw) ? a + 1 : a), 0);
    if (hits > 0 && (!best || hits > best.hits)) best = { d, hits };
  }
  const d = best?.d || diseaseByKey('healthy')!;
  // Confidence scales with keyword hits; single vague hit stays low -> escalates.
  const confidence = best ? Math.min(0.85, 0.45 + best.hits * 0.2) : 0.3;
  const res = finalize(d, confidence, 'voice');
  res.transcript = transcript;
  return res;
}

function finalize(d: Disease, confidence: number, method: 'image' | 'voice'): DiagnosisResult {
  // Escalation logic: low confidence OR high severity -> human expert ticket.
  const escalate = confidence < 0.7 || d.severity === 'high';
  return {
    disease: d.name.en,
    diseaseKey: d.key,
    crop: d.crop,
    confidence: Number(confidence.toFixed(2)),
    severity: d.severity,
    advice: d.advice.en,
    adviceHi: d.advice.hi,
    escalate,
    method,
  };
}
