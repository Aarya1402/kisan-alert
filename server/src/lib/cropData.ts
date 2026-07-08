// Per-crop feature centroids derived from the public Kaggle "Crop Recommendation"
// dataset (mean N, P, K, temperature, humidity, pH, rainfall per label) plus
// agronomic metadata used by the rule layer and the explanation generator.

export interface CropProfile {
  key: string;
  name: { en: string; hi: string; te: string; mr: string };
  n: number; p: number; k: number;
  temp: number; humidity: number; ph: number; rainfall: number;
  waterNeed: 'low' | 'medium' | 'high'; // irrigation demand
  season: string;
}

// waterNeed encodes relative irrigation demand — used with groundwater depth.
export const CROPS: CropProfile[] = [
  { key: 'rice', name: { en: 'Rice (Paddy)', hi: 'धान', te: 'వరి', mr: 'भात' }, n: 90, p: 42, k: 40, temp: 23.7, humidity: 82, ph: 6.4, rainfall: 236, waterNeed: 'high', season: 'Kharif' },
  { key: 'maize', name: { en: 'Maize', hi: 'मक्का', te: 'మొక్కజొన్న', mr: 'मका' }, n: 77, p: 48, k: 19, temp: 22.6, humidity: 65, ph: 6.2, rainfall: 84, waterNeed: 'medium', season: 'Kharif/Rabi' },
  { key: 'chickpea', name: { en: 'Chickpea (Chana)', hi: 'चना', te: 'శనగలు', mr: 'हरभरा' }, n: 40, p: 68, k: 80, temp: 18.9, humidity: 16.9, ph: 7.3, rainfall: 80, waterNeed: 'low', season: 'Rabi' },
  { key: 'kidneybeans', name: { en: 'Kidney Beans (Rajma)', hi: 'राजमा', te: 'రాజ్మా', mr: 'राजमा' }, n: 21, p: 67, k: 20, temp: 20.1, humidity: 21.6, ph: 5.7, rainfall: 105, waterNeed: 'medium', season: 'Rabi' },
  { key: 'pigeonpeas', name: { en: 'Pigeon Peas (Tur)', hi: 'अरहर', te: 'కంది', mr: 'तूर' }, n: 21, p: 68, k: 20, temp: 27.7, humidity: 48.6, ph: 5.8, rainfall: 149, waterNeed: 'low', season: 'Kharif' },
  { key: 'mothbeans', name: { en: 'Moth Beans', hi: 'मोठ', te: 'ముత్తడు', mr: 'मटकी' }, n: 21, p: 48, k: 20, temp: 28.2, humidity: 53, ph: 6.8, rainfall: 51, waterNeed: 'low', season: 'Kharif' },
  { key: 'mungbean', name: { en: 'Mung Bean (Moong)', hi: 'मूँग', te: 'పెసలు', mr: 'मूग' }, n: 21, p: 47, k: 20, temp: 28.5, humidity: 85, ph: 6.7, rainfall: 48, waterNeed: 'low', season: 'Kharif' },
  { key: 'blackgram', name: { en: 'Black Gram (Urad)', hi: 'उड़द', te: 'మినుములు', mr: 'उडीद' }, n: 40, p: 67, k: 19, temp: 30, humidity: 65, ph: 7.1, rainfall: 68, waterNeed: 'low', season: 'Kharif' },
  { key: 'lentil', name: { en: 'Lentil (Masoor)', hi: 'मसूर', te: 'పప్పు', mr: 'मसूर' }, n: 19, p: 68, k: 19, temp: 24.5, humidity: 64.8, ph: 6.9, rainfall: 46, waterNeed: 'low', season: 'Rabi' },
  { key: 'pomegranate', name: { en: 'Pomegranate', hi: 'अनार', te: 'దానిమ్మ', mr: 'डाळिंब' }, n: 19, p: 18, k: 40, temp: 21.8, humidity: 90, ph: 6.4, rainfall: 107, waterNeed: 'low', season: 'Perennial' },
  { key: 'banana', name: { en: 'Banana', hi: 'केला', te: 'అరటి', mr: 'केळी' }, n: 100, p: 82, k: 50, temp: 27, humidity: 80, ph: 6, rainfall: 105, waterNeed: 'high', season: 'Perennial' },
  { key: 'mango', name: { en: 'Mango', hi: 'आम', te: 'మామిడి', mr: 'आंबा' }, n: 20, p: 27, k: 30, temp: 31.4, humidity: 50, ph: 5.8, rainfall: 95, waterNeed: 'medium', season: 'Perennial' },
  { key: 'grapes', name: { en: 'Grapes', hi: 'अंगूर', te: 'ద్రాక్ష', mr: 'द्राक्षे' }, n: 23, p: 132, k: 200, temp: 23.8, humidity: 81.9, ph: 6.2, rainfall: 69, waterNeed: 'medium', season: 'Perennial' },
  { key: 'watermelon', name: { en: 'Watermelon', hi: 'तरबूज', te: 'పుచ్చకాయ', mr: 'कलिंगड' }, n: 99, p: 17, k: 50, temp: 25.6, humidity: 85, ph: 6.5, rainfall: 51, waterNeed: 'medium', season: 'Zaid' },
  { key: 'muskmelon', name: { en: 'Muskmelon', hi: 'खरबूजा', te: 'ఖర్బూజా', mr: 'खरबूज' }, n: 100, p: 18, k: 50, temp: 28.7, humidity: 92, ph: 6.4, rainfall: 25, waterNeed: 'medium', season: 'Zaid' },
  { key: 'apple', name: { en: 'Apple', hi: 'सेब', te: 'ఆపిల్', mr: 'सफरचंद' }, n: 21, p: 134, k: 200, temp: 22.6, humidity: 92.3, ph: 5.9, rainfall: 113, waterNeed: 'medium', season: 'Perennial' },
  { key: 'orange', name: { en: 'Orange', hi: 'संतरा', te: 'నారింజ', mr: 'संत्रे' }, n: 20, p: 17, k: 10, temp: 22.8, humidity: 92, ph: 7, rainfall: 110, waterNeed: 'medium', season: 'Perennial' },
  { key: 'papaya', name: { en: 'Papaya', hi: 'पपीता', te: 'బొప్పాయి', mr: 'पपई' }, n: 50, p: 59, k: 50, temp: 33.7, humidity: 92, ph: 6.7, rainfall: 143, waterNeed: 'medium', season: 'Perennial' },
  { key: 'coconut', name: { en: 'Coconut', hi: 'नारियल', te: 'కొబ్బరి', mr: 'नारळ' }, n: 22, p: 17, k: 31, temp: 27.4, humidity: 94.8, ph: 5.98, rainfall: 175, waterNeed: 'high', season: 'Perennial' },
  { key: 'cotton', name: { en: 'Cotton', hi: 'कपास', te: 'పత్తి', mr: 'कापूस' }, n: 118, p: 46, k: 20, temp: 24, humidity: 80, ph: 6.9, rainfall: 80, waterNeed: 'medium', season: 'Kharif' },
  { key: 'jute', name: { en: 'Jute', hi: 'जूट', te: 'జనుము', mr: 'ताग' }, n: 78, p: 47, k: 40, temp: 25, humidity: 80, ph: 6.7, rainfall: 175, waterNeed: 'high', season: 'Kharif' },
  { key: 'coffee', name: { en: 'Coffee', hi: 'कॉफ़ी', te: 'కాఫీ', mr: 'कॉफी' }, n: 101, p: 29, k: 30, temp: 26, humidity: 59, ph: 6.8, rainfall: 158, waterNeed: 'medium', season: 'Perennial' },
];

// Approximate per-feature standard deviations across the dataset, used to
// normalize the Euclidean distance so no single feature dominates.
export const FEATURE_STD = {
  n: 36.9, p: 32.9, k: 50.6, temp: 5.06, humidity: 22.3, ph: 0.77, rainfall: 55.0,
};

export function cropByKey(key: string): CropProfile | undefined {
  return CROPS.find((c) => c.key === key);
}
