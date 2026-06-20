/**
 * PWA install prompt (beforeinstallprompt) singleton v2.
 *
 * Objectif: ne jamais rater l'événement `beforeinstallprompt` (qui peut arriver
 * tôt), et permettre à plusieurs composants/hooks d'y accéder.
 *
 * Version 2: Protection contre les erreurs HMR et SSR.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let initialized = false;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installable = false;

const listeners = new Set<() => void>();

// Clés localStorage partagées entre tous les composants d'installation
const KEY_WAS_INSTALLED = 'pwa-was-installed';
const KEY_DISMISSED = 'pwa-install-dismissed';
const KEY_AUTO_PROMPT = 'pwa-auto-install-prompt-v2';

/**
 * Détecte si l'app tourne en mode standalone (PWA installée).
 * Fonctionne pour Android, iOS (navigator.standalone), et Windows.
 */
function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Efface tous les flags localStorage liés à l'installation.
 * Appelé quand on détecte que l'app a été désinstallée.
 */
export function clearAllInstallFlags(): void {
  try {
    localStorage.removeItem(KEY_WAS_INSTALLED);
    localStorage.removeItem(KEY_DISMISSED);
    localStorage.removeItem(KEY_AUTO_PROMPT);
  } catch {
    // Ignorer les erreurs de localStorage (mode privé, etc.)
  }
}

/**
 * Vérifie à chaque démarrage si l'app a été désinstallée depuis la dernière visite.
 * - Si standalone → marque "installée"
 * - Si pas standalone mais marquée "installée" → désinstallation détectée → efface les flags
 */
function checkInstallState(): void {
  try {
    if (isRunningStandalone()) {
      // L'app est ouverte en tant que PWA installée → mémoriser cet état
      localStorage.setItem(KEY_WAS_INSTALLED, 'true');
    } else {
      // Mode navigateur normal
      const wasInstalled = localStorage.getItem(KEY_WAS_INSTALLED) === 'true';
      if (wasInstalled) {
        // L'app était installée mais elle ne l'est plus → désinstallation détectée
        // Effacer tous les flags pour que les prompts d'installation réapparaissent
        clearAllInstallFlags();
      }
    }
  } catch {
    // Ignorer les erreurs de localStorage
  }
}

function notify() {
  // Utiliser queueMicrotask pour éviter les problèmes de synchronisation React
  queueMicrotask(() => {
    listeners.forEach((l) => {
      try {
        l();
      } catch {
        // ignore
      }
    });
  });
}

export function initPWAInstallPromptListener() {
  // Guard SSR
  if (typeof window === 'undefined') return;
  if (initialized) return;

  initialized = true;

  // Vérifier l'état d'installation au démarrage (détection désinstallation)
  checkInstallState();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Important: empêcher le mini-infobar automatique pour garder un flow contrôlé
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installable = true;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    // L'app vient d'être installée → sauvegarder le fait qu'elle est installée
    try {
      localStorage.setItem(KEY_WAS_INSTALLED, 'true');
    } catch { /* ignore */ }
    deferredPrompt = null;
    installable = false;
    notify();
  });
}

export function subscribePWAInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPWAInstallPromptState() {
  return {
    deferredPrompt,
    isInstallable: installable,
  };
}

export async function promptPWAInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';

  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    // Le prompt n'est utilisable qu'une seule fois
    deferredPrompt = null;
    installable = false;
    notify();

    return outcome;
  } catch {
    deferredPrompt = null;
    installable = false;
    notify();
    return 'dismissed';
  }
}

// Initialiser automatiquement si on est côté client
if (typeof window !== 'undefined') {
  // Utiliser requestIdleCallback ou setTimeout pour ne pas bloquer le rendu initial
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      initPWAInstallPromptListener();
    });
  } else {
    setTimeout(() => {
      initPWAInstallPromptListener();
    }, 0);
  }
}
