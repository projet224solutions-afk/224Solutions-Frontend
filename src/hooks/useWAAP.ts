/**
 * Hook React pour intégrer WAAP dans les composants
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { waapService, ThreatScore, BotSignature, APIAnomaly } from '@/services/security/WAAPService';

interface UseWAAPOptions {
  sessionId?: string;
  enableBehaviorTracking?: boolean;
  onThreatDetected?: (score: ThreatScore) => void;
  onBlocked?: (reason: string) => void;
}

interface WAAPState {
  isBlocked: boolean;
  threatScore: ThreatScore | null;
  botSignature: BotSignature | null;
  isLoading: boolean;
}

export function useWAAP(options: UseWAAPOptions = {}) {
  const {
    sessionId = crypto.randomUUID(),
    enableBehaviorTracking = true,
    onThreatDetected,
    onBlocked
  } = options;

  const [state, setState] = useState<WAAPState>({
    isBlocked: false,
    threatScore: null,
    botSignature: null,
    isLoading: true
  });

  const sessionIdRef = useRef(sessionId);
  const lastCheckRef = useRef<number>(0);

  // Initialisation et génération de signature
  useEffect(() => {
    const init = async () => {
      try {
        const signature = await waapService.generateBotSignature();
        const score = waapService.analyzeBotSignature(signature);

        setState(prev => ({
          ...prev,
          botSignature: signature,
          threatScore: score,
          isLoading: false,
          isBlocked: score.recommendation === 'block'
        }));

        if (score.recommendation === 'block') {
          onBlocked?.('Bot détecté via signature');
          await waapService.blockEntity(
            signature.fingerprint,
            'fingerprint',
            'Bot signature detected',
            true
          );
        } else if (score.score >= 50) {
          onThreatDetected?.(score);
        }
      } catch (error) {
        console.error('[useWAAP] Erreur initialisation:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    init();
  }, [onBlocked, onThreatDetected]);

  // Tracking des mouvements de souris
  useEffect(() => {
    if (!enableBehaviorTracking) return;

    const handleMouseMove = () => {
      waapService.recordInteraction(sessionIdRef.current, 'mouse');
    };

    const handleKeyPress = () => {
      waapService.recordInteraction(sessionIdRef.current, 'keyboard');
    };

    const handleScroll = () => {
      waapService.recordInteraction(sessionIdRef.current, 'scroll');
    };

    const handleClick = (e: MouseEvent) => {
      waapService.recordInteraction(sessionIdRef.current, 'click', {
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now(),
        element: (e.target as HTMLElement)?.tagName || 'unknown'
      });
    };

    // Throttle pour performance
    let mouseTimeout: ReturnType<typeof setTimeout>;
    const throttledMouseMove = () => {
      if (!mouseTimeout) {
        mouseTimeout = setTimeout(() => {
          handleMouseMove();
          mouseTimeout = undefined as any;
        }, 100);
      }
    };

    document.addEventListener('mousemove', throttledMouseMove);
    document.addEventListener('keypress', handleKeyPress);
    document.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('mousemove', throttledMouseMove);
      document.removeEventListener('keypress', handleKeyPress);
      document.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleClick);
    };
  }, [enableBehaviorTracking]);

  // Vérification périodique du comportement
  useEffect(() => {
    if (!enableBehaviorTracking) return;

    const checkBehavior = () => {
      const now = Date.now();
      if (now - lastCheckRef.current < 30000) return; // Max 1 check / 30s
      lastCheckRef.current = now;

      const score = waapService.analyzeBehavior(sessionIdRef.current);

      setState(prev => ({
        ...prev,
        threatScore: score,
        isBlocked: score.recommendation === 'block'
      }));

      if (score.recommendation === 'block') {
        onBlocked?.('Comportement suspect détecté');
      } else if (score.score >= 50) {
        onThreatDetected?.(score);
      }
    };

    const interval = setInterval(checkBehavior, 30000);
    return () => clearInterval(interval);
  }, [enableBehaviorTracking, onBlocked, onThreatDetected]);

  // Fonction pour analyser une requête API avant envoi
  const analyzeRequest = useCallback((
    endpoint: string,
    method: string,
    payload: any,
    headers: Record<string, string> = {}
  ): { allowed: boolean; anomalies: APIAnomaly[] } => {
    const anomalies = waapService.analyzeAPIRequest(
      endpoint,
      method,
      payload,
      headers
    );

    const hasCritical = anomalies.some(a => a.severity === 'critical');
    const hasHigh = anomalies.filter(a => a.severity === 'high').length >= 2;

    return {
      allowed: !hasCritical && !hasHigh,
      anomalies
    };
  }, []);

  // Fonction pour vérifier les honeypots
  const checkHoneypot = useCallback((formData: Record<string, any>): boolean => {
    return waapService.checkHoneypot(formData);
  }, []);

  // Fonction pour générer les champs honeypot
  const getHoneypotFields = useCallback(() => {
    return waapService.generateHoneypotFields();
  }, []);

  // Fonction pour vérifier si CAPTCHA nécessaire
  const needsCaptcha = useCallback((): boolean => {
    return waapService.shouldShowCaptcha(sessionIdRef.current);
  }, []);

  // Fonction pour bloquer manuellement
  const blockEntity = useCallback(async (
    identifier: string,
    type: 'ip' | 'user' | 'fingerprint',
    reason: string
  ) => {
    await waapService.blockEntity(identifier, type, reason, true);
  }, []);

  return {
    ...state,
    sessionId: sessionIdRef.current,
    analyzeRequest,
    checkHoneypot,
    getHoneypotFields,
    needsCaptcha,
    blockEntity,
    isBot: state.threatScore?.recommendation === 'block',
    needsChallenge: state.threatScore?.recommendation === 'challenge'
  };
}

/**
 * Hook simplifié pour la protection de formulaires
 */
export function useFormProtection() {
  const honeypotFields = waapService.generateHoneypotFields();

  const validateForm = useCallback((formData: Record<string, any>): {
    isBot: boolean;
    errors: string[];
  } => {
    const errors: string[] = [];

    // Vérifier honeypots
    if (waapService.checkHoneypot(formData)) {
      return { isBot: true, errors: ['Bot détecté'] };
    }

    // Vérifier injection
    const payloadStr = JSON.stringify(formData);
    const sqlPatterns = /('|"|;|--|\bOR\b|\bAND\b|\bUNION\b|\bSELECT\b)/gi;
    if (sqlPatterns.test(payloadStr)) {
      errors.push('Caractères non autorisés détectés');
    }

    const xssPatterns = /<script|javascript:|on\w+\s*=/gi;
    if (xssPatterns.test(payloadStr)) {
      errors.push('Contenu HTML non autorisé');
    }

    return { isBot: false, errors };
  }, []);

  return {
    honeypotFields,
    validateForm,
    honeypotCSS: `
      .hp-field-1, .hp-field-2, .hp-field-3 {
        position: absolute !important;
        left: -9999px !important;
        top: -9999px !important;
        opacity: 0 !important;
        pointer-events: none !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
      }
    `
  };
}

export default useWAAP;
