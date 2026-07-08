// Crop-disease classes (PlantVillage-style) with voice-symptom keyword maps,
// severity, and template advice. Used by both the image heuristic classifier
// and the voice-symptom fallback matcher.

export interface Disease {
  key: string;
  crop: string;
  name: { en: string; hi: string; te: string; mr: string };
  severity: 'low' | 'medium' | 'high';
  // Keywords in transcripts (any language, romanized/english) that indicate this.
  keywords: string[];
  // Dominant leaf color signature used by the image heuristic.
  colorSignature: 'yellow' | 'brown' | 'white' | 'black' | 'orange' | 'healthy';
  advice: { en: string; hi: string };
}

export const DISEASES: Disease[] = [
  {
    key: 'healthy',
    crop: 'any',
    name: { en: 'Healthy', hi: 'स्वस्थ', te: 'ఆరోగ్యకరమైన', mr: 'निरोगी' },
    severity: 'low',
    keywords: ['healthy', 'fine', 'green', 'theek', 'accha', 'swasth'],
    colorSignature: 'healthy',
    advice: {
      en: 'Crop looks healthy. Continue normal irrigation and monitoring.',
      hi: 'फसल स्वस्थ दिख रही है। सामान्य सिंचाई और निगरानी जारी रखें।',
    },
  },
  {
    key: 'leaf_blight',
    crop: 'maize/rice',
    name: { en: 'Leaf Blight', hi: 'पत्ती झुलसा', te: 'ఆకు ఎండు తెగులు', mr: 'पानावरील करपा' },
    severity: 'high',
    keywords: ['blight', 'jhulsa', 'brown spot', 'brown patch', 'drying', 'sukh', 'bhura', 'daag'],
    colorSignature: 'brown',
    advice: {
      en: 'Likely leaf blight. Remove affected leaves; spray Mancozeb 75% WP. Avoid overhead irrigation.',
      hi: 'संभवतः पत्ती झुलसा। प्रभावित पत्तियाँ हटाएँ; मैंकोज़ेब 75% WP छिड़कें। ऊपर से सिंचाई से बचें।',
    },
  },
  {
    key: 'leaf_rust',
    crop: 'wheat/coffee',
    name: { en: 'Leaf Rust', hi: 'रतुआ', te: 'తుప్పు తెగులు', mr: 'तांबेरा' },
    severity: 'high',
    keywords: ['rust', 'ratua', 'orange powder', 'orange spot', 'tamera', 'peela powder'],
    colorSignature: 'orange',
    advice: {
      en: 'Likely leaf rust. Spray Propiconazole; remove volunteer plants. Monitor nearby plots.',
      hi: 'संभवतः रतुआ रोग। प्रोपिकोनाज़ोल छिड़कें; अवांछित पौधे हटाएँ। पास के खेतों पर नज़र रखें।',
    },
  },
  {
    key: 'powdery_mildew',
    crop: 'grapes/vegetables',
    name: { en: 'Powdery Mildew', hi: 'चूर्णिल फफूंदी', te: 'బూజు తెగులు', mr: 'भुरी रोग' },
    severity: 'medium',
    keywords: ['mildew', 'white powder', 'safed', 'powdery', 'bhuri', 'white patch'],
    colorSignature: 'white',
    advice: {
      en: 'Likely powdery mildew. Spray wettable Sulphur; improve air circulation, reduce leaf wetness.',
      hi: 'संभवतः चूर्णिल फफूंदी। घुलनशील सल्फर छिड़कें; हवा का आवागमन बढ़ाएँ।',
    },
  },
  {
    key: 'nutrient_deficiency',
    crop: 'any',
    name: { en: 'Nutrient Deficiency', hi: 'पोषक तत्व की कमी', te: 'పోషక లోపం', mr: 'अन्नद्रव्य कमतरता' },
    severity: 'low',
    keywords: ['yellow', 'yellowing', 'peela', 'pila', 'pale', 'peeli patti', 'nitrogen'],
    colorSignature: 'yellow',
    advice: {
      en: 'Yellowing suggests nitrogen deficiency. Apply urea top-dressing per Soil Health Card dose.',
      hi: 'पीलापन नाइट्रोजन की कमी दर्शाता है। मृदा स्वास्थ्य कार्ड के अनुसार यूरिया डालें।',
    },
  },
  {
    key: 'pest_infestation',
    crop: 'any',
    name: { en: 'Pest Infestation', hi: 'कीट प्रकोप', te: 'పురుగు దాడి', mr: 'किड प्रादुर्भाव' },
    severity: 'high',
    keywords: ['insect', 'pest', 'keeda', 'kida', 'holes', 'eaten', 'chewed', 'caterpillar', 'sundi', 'worm'],
    colorSignature: 'black',
    advice: {
      en: 'Pest damage likely. Install pheromone traps; spray recommended insecticide only if threshold crossed.',
      hi: 'कीट क्षति संभावित। फेरोमोन ट्रैप लगाएँ; सीमा पार होने पर ही अनुशंसित कीटनाशक छिड़कें।',
    },
  },
  {
    key: 'bacterial_wilt',
    crop: 'tomato/vegetables',
    name: { en: 'Bacterial Wilt', hi: 'जीवाणु उकठा', te: 'బాక్టీరియా వాడు', mr: 'जिवाणू मर' },
    severity: 'high',
    keywords: ['wilt', 'wilting', 'murjha', 'drooping', 'sukhna', 'collapse', 'jhuk'],
    colorSignature: 'black',
    advice: {
      en: 'Possible bacterial wilt. Uproot and destroy affected plants; avoid waterlogging; rotate crop next season.',
      hi: 'संभवतः जीवाणु उकठा। प्रभावित पौधे उखाड़कर नष्ट करें; जलभराव से बचें; अगली फसल बदलें।',
    },
  },
];

export function diseaseByKey(key: string): Disease | undefined {
  return DISEASES.find((d) => d.key === key);
}
