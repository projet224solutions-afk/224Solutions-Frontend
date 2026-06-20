/**
 * 🔊 Voix du Copilot 224 (Phase 4 — additif, optionnel). Web Speech API du navigateur :
 * synthèse vocale (lire les réponses) + dictée (parler au lieu de taper). Aucune clé,
 * aucun backend. Dégrade proprement si le navigateur ne supporte pas.
 */

import { useCallback, useRef, useState } from 'react';

export function useCopilotVoice() {
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const SR: any = (typeof window !== 'undefined')
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null;
  const sttSupported = !!SR;
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const speak = useCallback((text: string) => {
    if (!ttsSupported || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.slice(0, 600));
      u.lang = 'fr-FR';
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }, [ttsSupported]);

  const stopSpeaking = useCallback(() => { try { window.speechSynthesis?.cancel(); } catch { /* */ } }, []);

  const listen = useCallback((onResult: (t: string) => void) => {
    if (!sttSupported) return;
    try {
      const rec = new SR();
      rec.lang = 'fr-FR'; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript || ''; if (t) onResult(t); };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec; setListening(true); rec.start();
    } catch { setListening(false); }
  }, [sttSupported, SR]);

  const stopListening = useCallback(() => { try { recRef.current?.stop(); } catch { /* */ } setListening(false); }, []);

  return { ttsSupported, sttSupported, listening, speak, stopSpeaking, listen, stopListening };
}
