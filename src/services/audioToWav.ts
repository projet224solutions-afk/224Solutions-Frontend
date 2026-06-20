/**
 * 🎧 Transcodage audio → WAV (compatibilité universelle).
 * Le MediaRecorder de Chrome/Android produit du webm/opus, ILLISIBLE sur iOS/Safari.
 * On décode l'enregistrement (Web Audio API) puis on ré-encode en WAV PCM 16-bit mono
 * 16 kHz (qualité voix, fichier léger). Le WAV est lu nativement par TOUS les appareils.
 * 100% client, aucun backend / ffmpeg requis.
 */

/** Vrai si le blob est dans un format qui pose problème sur iOS/Safari. */
export function isProblematicAudio(mime: string): boolean {
  const m = (mime || '').toLowerCase();
  return m.includes('webm') || m.includes('ogg') || m.includes('opus');
}

/** Décode un Blob audio puis le ré-encode en WAV mono 16 kHz. Renvoie null si échec. */
export async function convertBlobToWav(blob: Blob): Promise<Blob | null> {
  try {
    const AudioCtx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;

    const arrayBuf = await blob.arrayBuffer();
    const decodeCtx = new AudioCtx();
    // decodeAudioData accepte un callback ou renvoie une Promise selon le navigateur.
    const decoded: AudioBuffer = await new Promise((resolve, reject) => {
      const p = decodeCtx.decodeAudioData(arrayBuf.slice(0), resolve, reject);
      if (p && typeof (p as any).then === 'function') (p as Promise<AudioBuffer>).then(resolve, reject);
    });
    try { await decodeCtx.close(); } catch { /* noop */ }
    if (!decoded || decoded.length === 0) return null;

    // Mixdown MONO à la fréquence NATIVE (pas de resampling : OfflineAudioContext est
    // restreint à 44,1 kHz sur Safari et source de bugs). Fichier un peu plus gros mais
    // WAV PCM valide et lu par TOUS les navigateurs.
    const sampleRate = decoded.sampleRate;
    const length = decoded.length;
    const channels = Math.max(1, decoded.numberOfChannels);
    const mono = new Float32Array(length);
    for (let ch = 0; ch < channels; ch++) {
      const data = decoded.getChannelData(ch);
      for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
    }

    const wav = encodeWav(mono, sampleRate);
    // Garde-fou : un WAV valide a au moins l'en-tête (44o) + des données.
    return wav.size > 1000 ? wav : null;
  } catch (e) {
    console.warn('[audioToWav] conversion échouée, on garde l\'original:', e);
    return null;
  }
}

/** Encode un signal mono Float32 en WAV PCM 16-bit. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);        // taille du sous-chunk fmt
  view.setUint16(20, 1, true);         // PCM
  view.setUint16(22, 1, true);         // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * blockAlign)
  view.setUint16(32, 2, true);         // block align (mono * 16bit/8)
  view.setUint16(34, 16, true);        // bits par échantillon
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  // On passe l'ArrayBuffer sous-jacent (plus compatible qu'un DataView pour Blob).
  return new Blob([buffer], { type: 'audio/wav' });
}
