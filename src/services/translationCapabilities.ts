// src/services/translationCapabilities.ts
// Source UNIQUE de vérité : ce que chaque langue sait vraiment faire dans le
// pipeline de traduction (texte IA, voix entrante STT, voix sortante TTS, qualité).
// Permet une UI HONNÊTE : ne pas promettre une voix fiable wolof si l'API ne la fait pas.
//
// ⚠️ Aligné sur le pipeline RÉEL de PRODUCTION (backend Node
//    src/routes/edge-functions/translation-media.routes.ts) :
//    STT = OpenAI Whisper (~99 langues), TTS = OpenAI tts-1 (multilingue),
//    traduction = OpenAI/Lovable. Donc le vrai point faible n'est PAS « 8 voix
//    Google » mais les langues à FAIBLES RESSOURCES (wolof/peul/soussou/bambara…) :
//    Whisper les transcrit mal et la prononciation TTS y est approximative.
//    (La Deno edge function legacy avec ses 8 voix Google n'est PAS le chemin prod.)

export type TranslationCapability = {
  text: boolean; // traduction texte (IA) — tentée pour toutes
  voiceOut: boolean; // synthèse vocale TTS FIABLE (audio traduit exploitable)
  voiceIn: boolean; // transcription STT fiable (comprendre un vocal entrant)
  quality: 'high' | 'medium' | 'low'; // fiabilité de la traduction texte
};

// Langues à FAIBLES RESSOURCES : STT/TTS/traduction approximatifs → message vocal
// NATIF recommandé + avertissement « traduction approximative ».
export const LOW_RESOURCE = new Set(['wo', 'ff', 'sus', 'su', 'ha', 'bm', 'yo', 'dyu', 'kr']);

// Langues bien dotées (qualité haute texte + TTS naturel). Les autres = 'medium'.
const HIGH_QUALITY = new Set([
  'fr', 'en', 'ar', 'es', 'pt', 'de', 'it', 'zh', 'hi', 'ru', 'ja', 'ko', 'nl', 'tr', 'uk', 'sw',
]);

export function getCapability(lang: string): TranslationCapability {
  const code = (lang || '').toLowerCase().split('-')[0];
  const low = LOW_RESOURCE.has(code);
  return {
    text: true,
    // OpenAI Whisper/TTS gèrent les langues majeures ; on considère NON fiable
    // (donc natif/approximatif) uniquement les langues à faibles ressources.
    voiceOut: !low,
    voiceIn: !low,
    quality: low ? 'low' : HIGH_QUALITY.has(code) ? 'high' : 'medium',
  };
}

// La langue source est-elle transcriptible ? (sinon → message vocal NATIF)
export function isTranscribable(lang: string): boolean {
  return getCapability(lang).voiceIn;
}

// Faut-il réellement traduire un audio ? (false → transmettre l'audio natif)
export function shouldTranslateAudio(sourceLang?: string | null, targetLang?: string | null): boolean {
  if (!sourceLang || !targetLang) return true; // langue source inconnue → laisser le pipeline tenter (auto-détection)
  const s = (sourceLang || '').toLowerCase().split('-')[0];
  const t = (targetLang || '').toLowerCase().split('-')[0];
  if (s === t) return false; // même langue → inutile
  if (!isTranscribable(s)) return false; // source non transcriptible → natif (éviter le charabia)
  return true;
}

// Badge court pour un sélecteur de langue.
export function capabilityBadge(lang: string): { icon: string; label: string } {
  return getCapability(lang).voiceOut
    ? { icon: '🔊', label: 'Audio + texte' }
    : { icon: '📝', label: 'Texte uniquement' };
}
