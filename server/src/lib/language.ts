// Language Gateway — mock of the Bhashini / AI4Bharat ULCA pipeline
// (ASR -> NMT -> TTS). If BHASHINI_API_KEY is set this is where a real call
// would go; without it we return a deterministic, demo-safe simulation so the
// full voice flow works offline. This mirrors the plan's "degrade gracefully".

export type Lang = 'hi' | 'te' | 'mr' | 'en';

export const LANGS: Record<Lang, string> = {
  hi: 'हिंदी (Hindi)',
  te: 'తెలుగు (Telugu)',
  mr: 'मराठी (Marathi)',
  en: 'English',
};

// A tiny phrase memory so common system messages come back naturally translated.
// Real deployment routes these through Bhashini NMT.
const PHRASES: Record<string, Partial<Record<Lang, string>>> = {
  welcome: {
    hi: 'किसान अलर्ट में आपका स्वागत है। फसल सलाह के लिए 1, मौसम चेतावनी के लिए 2, पौधे की बीमारी के लिए 3 दबाएँ।',
    te: 'కిసాన్ అలర్ట్‌కు స్వాగతం. పంట సలహా కోసం 1, వాతావరణ హెచ్చరిక కోసం 2, మొక్క వ్యాధి కోసం 3 నొక్కండి.',
    mr: 'किसान अलर्टमध्ये आपले स्वागत आहे. पीक सल्ल्यासाठी 1, हवामान इशाऱ्यासाठी 2, रोगासाठी 3 दाबा.',
    en: 'Welcome to Kisan Alert. Press 1 for crop advice, 2 for weather alerts, 3 for plant disease.',
  },
};

export function langName(l: Lang) {
  return LANGS[l] || l;
}

// Simulated ASR: turns a "spoken" utterance into a transcript. In the simulator
// the farmer types/selects what they said; a real system decodes audio here.
export function asr(audioTranscriptStub: string, _lang: Lang): { transcript: string; confidence: number } {
  const text = (audioTranscriptStub || '').trim();
  // Simulate lower confidence for very short or noisy input, to exercise the
  // "low ASR confidence -> menu fallback" path the pitch calls out.
  const confidence = text.length < 3 ? 0.35 : text.length < 8 ? 0.72 : 0.9;
  return { transcript: text, confidence };
}

// Simulated NMT. For known phrase keys returns a real translation; otherwise
// tags the string so it is clearly a translation placeholder in the demo.
export function translate(text: string, _from: Lang, to: Lang, phraseKey?: string): string {
  if (phraseKey && PHRASES[phraseKey]?.[to]) return PHRASES[phraseKey][to]!;
  return text; // English fallback content is already localized at call sites
}

// Simulated TTS. Returns an SSML-ish spoken form + a fake audio handle. The
// simulator "plays" the text; a real system returns audio bytes from Bhashini.
export function tts(text: string, lang: Lang): { spokenText: string; audioUrl: string; lang: Lang } {
  return {
    spokenText: text,
    audioUrl: `data:audio/sim;lang=${lang};len=${text.length}`,
    lang,
  };
}
