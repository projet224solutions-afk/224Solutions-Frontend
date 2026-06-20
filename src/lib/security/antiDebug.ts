/**
 * Protection Anti-Débogage pour Vista-Flows
 * 224Solutions - Propriétaire et confidentiel
 *
 * Ce module empêche l'analyse du code en production via:
 * - Détection des DevTools
 * - Détection du débogage
 * - Protection contre l'inspection du DOM
 * - Détection des proxies/interception
 */

// Activer uniquement en production
const isProduction = import.meta.env.PROD;

// Callback quand une tentative de débogage est détectée
type DebugCallback = (type: string) => void;

let onDebugDetected: DebugCallback = () => {};

/**
 * Configure le callback appelé lors de la détection de débogage
 */
export function setDebugCallback(callback: DebugCallback): void {
  onDebugDetected = callback;
}

/**
 * Détecte si les DevTools sont ouverts
 */
function detectDevTools(): boolean {
  const threshold = 160;
  const widthThreshold = window.outerWidth - window.innerWidth > threshold;
  const heightThreshold = window.outerHeight - window.innerHeight > threshold;

  if (widthThreshold || heightThreshold) {
    return true;
  }

  // Méthode alternative: vérifier le timing de console.log avec un objet spécial
  // Ne pas utiliser 'debugger' car ça bloque l'exécution
  try {
    const element = document.createElement('div');
    let devtoolsOpen = false;

    Object.defineProperty(element, 'id', {
      get: function() {
        devtoolsOpen = true;
        return '';
      }
    });

    // Ceci déclenche le getter seulement si DevTools inspecte l'objet
    console.debug(element);
    console.clear();

    return devtoolsOpen;
  } catch {
    return false;
  }
}

/**
 * Détecte les tentatives de débogage via console
 */
function detectConsoleDebug(): void {
  const element = new Image();

  Object.defineProperty(element, 'id', {
    get: function () {
      onDebugDetected('console_debug');
      return '';
    }
  });

  // Ceci déclenche le getter quand DevTools inspecte l'objet
  console.log('%c', element);
}

/**
 * Empêche le clic droit (inspection du code source)
 */
function disableRightClick(): void {
  document.addEventListener('contextmenu', (e) => {
    if (isProduction) {
      e.preventDefault();
      onDebugDetected('right_click');
      return false;
    }
  });
}

/**
 * Empêche les raccourcis clavier de débogage
 */
function disableDebugShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    if (!isProduction) return;

    // F12
    if (e.key === 'F12') {
      e.preventDefault();
      onDebugDetected('f12_key');
      return false;
    }

    // Ctrl+Shift+I (DevTools)
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      onDebugDetected('devtools_shortcut');
      return false;
    }

    // Ctrl+Shift+J (Console)
    if (e.ctrlKey && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      onDebugDetected('console_shortcut');
      return false;
    }

    // Ctrl+U (View Source)
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      onDebugDetected('view_source');
      return false;
    }

    // Ctrl+Shift+C (Inspect Element)
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      onDebugDetected('inspect_element');
      return false;
    }
  });
}

/**
 * Détecte les proxies sur les objets natifs
 */
function detectProxies(): boolean {
  try {
    // Vérifier si console.log a été modifié
    const originalToString = Function.prototype.toString;
    const consoleLogString = originalToString.call(console.log);

    if (!consoleLogString.includes('[native code]')) {
      return true;
    }

    // Vérifier fetch
    const fetchString = originalToString.call(fetch);
    if (!fetchString.includes('[native code]')) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

/**
 * Protection contre la modification du DOM
 */
function protectDOM(): void {
  if (!isProduction) return;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Détecter l'injection de scripts
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === 'SCRIPT') {
          const script = node as HTMLScriptElement;
          // Vérifier si c'est un script externe non autorisé
          if (script.src && !isAllowedScript(script.src)) {
            onDebugDetected('script_injection');
            script.remove();
          }
        }
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

/**
 * Vérifie si un script est autorisé
 */
function isAllowedScript(src: string): boolean {
  const allowedDomains = [
    'supabase.co',
    'supabase.io',
    'stripe.com',
    'js.stripe.com',
    'firebase.com',
    'firebaseio.com',
    'googleapis.com',
    'gstatic.com',
    'mapbox.com',
    'api.mapbox.com',
    'agora.io',
    'sentry.io',
    'localhost',
    '127.0.0.1',
    // Vos domaines
    '224solutions',
    'vista-flows'
  ];

  return allowedDomains.some((domain) => src.includes(domain));
}

/**
 * Intervalle de vérification DevTools
 */
let devToolsCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Démarre la surveillance anti-débogage
 */
export function startAntiDebugProtection(): void {
  if (!isProduction) {
    console.log('[AntiDebug] Désactivé en développement');
    return;
  }

  // Désactiver clic droit
  disableRightClick();

  // Désactiver raccourcis de débogage
  disableDebugShortcuts();

  // Protection DOM
  protectDOM();

  // Vérification périodique des DevTools
  devToolsCheckInterval = setInterval(() => {
    if (detectDevTools()) {
      onDebugDetected('devtools_open');
    }

    if (detectProxies()) {
      onDebugDetected('proxy_detected');
    }
  }, 1000);

  // Détection console
  detectConsoleDebug();
}

/**
 * Arrête la surveillance anti-débogage
 */
export function stopAntiDebugProtection(): void {
  if (devToolsCheckInterval) {
    clearInterval(devToolsCheckInterval);
    devToolsCheckInterval = null;
  }
}

/**
 * Action par défaut en cas de détection
 */
export function defaultDebugAction(type: string): void {
  // Logger l'événement (sera envoyé à Sentry en production)
  console.warn(`[Security] Debug attempt detected: ${type}`);

  // En production, on peut prendre des mesures plus strictes
  if (isProduction) {
    // Option 1: Rediriger vers une page d'erreur
    // window.location.href = '/security-error';

    // Option 2: Effacer les données sensibles du localStorage
    // clearSensitiveData();

    // Option 3: Simplement logger pour analyse ultérieure
    // Envoyer à un endpoint de sécurité
    try {
      fetch('/api/security/debug-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }).catch(() => {
        // Ignorer les erreurs de fetch
      });
    } catch {
      // Ignorer
    }
  }
}

export default {
  startAntiDebugProtection,
  stopAntiDebugProtection,
  setDebugCallback,
  defaultDebugAction
};
