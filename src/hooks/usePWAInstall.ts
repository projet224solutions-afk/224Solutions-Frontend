// usePWAInstall v3 - Hook pour l'installation PWA avec support iOS
// Corrigé pour éviter les erreurs React HMR "Should have a queue"

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getPWAInstallPromptState,
  initPWAInstallPromptListener,
  promptPWAInstall,
  subscribePWAInstallPrompt,
} from '@/lib/pwaInstallPrompt';

// Détection iOS côté client uniquement
function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ peut se présenter comme Macintosh
  const isClassicIOS = /iPhone|iPad|iPod/i.test(ua);
  const isIPadOSDesktop = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return isClassicIOS || isIPadOSDesktop;
}

function detectSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  // Exclure les navigateurs/app wrappers iOS (Chrome, Firefox, Edge, Google app...)
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|GSA|FBAN|FBAV|Instagram/i.test(ua);
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = (window.navigator as any).standalone === true;
  return isStandalone || isIOSStandalone;
}

export function usePWAInstall() {
  // Valeurs initiales calculées de manière synchrone (safe pour SSR/HMR)
  const [isInstallable, setIsInstallable] = useState(() => {
    // Sur iOS, toujours installable via instructions manuelles
    return detectIOS() ? true : false;
  });

  const [isInstalled, setIsInstalled] = useState(() => detectStandalone());

  // Ces valeurs sont constantes après le premier render
  const isIOSRef = useRef(detectIOS());
  const isSafariRef = useRef(detectSafari());

  const [isIOS] = useState(() => isIOSRef.current);
  const [isSafari] = useState(() => isSafariRef.current);

  useEffect(() => {
    // Guard SSR
    if (typeof window === 'undefined') return;

    // 1) Listener global (au cas où l'événement arrive très tôt)
    initPWAInstallPromptListener();

    // 2) Détection installation (standalone)
    const checkIfInstalled = () => {
      setIsInstalled(detectStandalone());
    };

    checkIfInstalled();

    // 3) Sync installable depuis le singleton
    const syncInstallable = () => {
      const state = getPWAInstallPromptState();
      // Sur iOS, on considère toujours "installable" via instructions manuelles
      if (isIOSRef.current) {
        setIsInstallable(true);
      } else {
        setIsInstallable(state.isInstallable);
      }
    };

    syncInstallable();

    const unsubscribe = subscribePWAInstallPrompt(() => {
      syncInstallable();
    });

    // Re-check si le display-mode change
    const media = window.matchMedia('(display-mode: standalone)');
    const onMediaChange = () => checkIfInstalled();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onMediaChange);
    } else {
      // Safari ancien
      media.addListener(onMediaChange);
    }

    window.addEventListener('appinstalled', checkIfInstalled);

    return () => {
      unsubscribe();
      window.removeEventListener('appinstalled', checkIfInstalled);
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', onMediaChange);
      } else {
        media.removeListener(onMediaChange);
      }
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const outcome = await promptPWAInstall();

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
      return true;
    }

    return false;
  }, []);

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isSafari,
    promptInstall,
  };
}
