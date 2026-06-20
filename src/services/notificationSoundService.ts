/**
 * SERVICE DE SON DE NOTIFICATION GLOBAL
 * Utilise AudioContext (Web Audio API) pour contourner le blocage autoplay mobile.
 * L'AudioContext est créé + le buffer audio est pré-décodé au premier geste utilisateur.
 * Ensuite, les lectures depuis des callbacks async (Realtime, WebSocket) fonctionnent.
 */

let audioContext: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;
let unlocked = false;
let unlocking = false;
let volume = 0.7;

/**
 * Déverrouille l'audio au premier geste utilisateur.
 * Crée l'AudioContext + pré-charge et décode le fichier son.
 */
async function unlockAudio(): Promise<void> {
  if (unlocked || unlocking) return;
  unlocking = true;

  try {
    // Créer l'AudioContext (doit être dans un geste utilisateur)
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) {
      console.warn('[NotificationSound] AudioContext non supporté');
      unlocking = false;
      return;
    }

    audioContext = new AC();

    // Si le contexte est suspendu (politique navigateur), le reprendre
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Pré-charger et décoder le fichier audio
    const response = await fetch('/notification-sound.mp3');
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    unlocked = true;
    console.log('🔔 [NotificationSound] Audio déverrouillé via AudioContext (mobile OK)');
  } catch (error) {
    console.warn('[NotificationSound] Erreur unlock AudioContext:', error);
    // Fallback : essayer quand même avec HTMLAudioElement
    unlocked = true;
  } finally {
    unlocking = false;
  }
}

// Écouter le premier geste utilisateur pour déverrouiller
if (typeof window !== 'undefined') {
  const gestureEvents = ['touchstart', 'touchend', 'click', 'keydown'];
  const onFirstGesture = () => {
    unlockAudio();
    gestureEvents.forEach(evt => window.removeEventListener(evt, onFirstGesture, true));
  };
  gestureEvents.forEach(evt => window.addEventListener(evt, onFirstGesture, { capture: true }));
}

/**
 * Initialiser le son (peut être appelé manuellement)
 */
export function initNotificationSound(): void {
  unlockAudio();
}

/**
 * Faire vibrer le téléphone
 */
function vibrateDevice(): void {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch {
    // Vibration non supportée
  }
}

/**
 * Jouer le son via Web Audio API (fonctionne depuis callbacks async)
 */
function playViaAudioContext(): boolean {
  if (!audioContext || !audioBuffer) return false;

  try {
    // Reprendre le contexte s'il est suspendu
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // Contrôle du volume via GainNode
    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(0);

    return true;
  } catch (error) {
    console.debug('[NotificationSound] AudioContext playback error:', error);
    return false;
  }
}

/**
 * Fallback : jouer via HTMLAudioElement
 */
function playViaHtmlAudio(): void {
  try {
    const audio = new Audio('/notification-sound.mp3');
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch {
    // Silencieux
  }
}

/**
 * Jouer le son de notification + vibration
 */
export function playNotificationSound(): void {
  // 1. Toujours vibrer (fonctionne sans restriction)
  vibrateDevice();

  // 2. Jouer le son via AudioContext (méthode principale)
  const played = playViaAudioContext();

  // 3. Fallback HTMLAudioElement si AudioContext échoue
  if (!played) {
    playViaHtmlAudio();
  }
}

/**
 * Définir le volume du son (0 à 1)
 */
export function setNotificationVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
}

/**
 * Vérifier si le son peut être joué
 */
export async function canPlaySound(): Promise<boolean> {
  return unlocked && audioContext !== null && audioBuffer !== null;
}

export default {
  init: initNotificationSound,
  play: playNotificationSound,
  setVolume: setNotificationVolume,
  canPlay: canPlaySound
};
