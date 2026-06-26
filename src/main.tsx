import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker, unregisterServiceWorker, resetPWA } from "./lib/serviceWorkerRegistration";
import { startVersionCheck } from "@/lib/versionCheck";
import { initPWAInstallPromptListener } from "./lib/pwaInstallPrompt";
import { initMonitoring } from "./lib/monitoring";
import { initializeSecurity } from "./lib/security";
import { initFrontendObserver } from "./services/monitoring/FrontendObserver";
import { backendConfig, resolveBackendUrl } from "./config/backend";
import { startGuard224, isGuard224EnabledPref } from "./224guard";

function safeGetLocalStorageItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function runSafeStartupStep(label: string, step: () => void) {
  try {
    step();
  } catch (error) {
    console.error(`[Startup] ${label} failed`, error);
  }
}

async function runSafeStartupStepAsync(label: string, step: () => Promise<void>) {
  try {
    await step();
  } catch (error) {
    console.error(`[Startup] ${label} failed`, error);
  }
}

function installBackendRequestBridge() {
  if (typeof window === 'undefined' || import.meta.env.DEV) return;
  if ((window as any).__vfBackendBridgeInstalled) return;

  const baseUrl = backendConfig.baseUrl?.trim();
  if (!baseUrl) return;

  const currentOrigin = window.location.origin;
  const currentHost = window.location.hostname;
  const currentProtocol = window.location.protocol;
  const shouldRewriteRelativeBackendCalls =
    /^capacitor:$/i.test(currentProtocol) ||
    /^ionic:$/i.test(currentProtocol) ||
    /^http:\/\/localhost(:\d+)?$/i.test(currentOrigin) ||
    /(^|\.)224solution\.net$/i.test(currentHost);

  if (!shouldRewriteRelativeBackendCalls) return;

  const originalFetch = window.fetch.bind(window);
  const backendPrefixes = ['/api', '/edge-functions', '/health', '/healthz', '/healthz.json'];

  const isBackendPath = (url: URL) =>
    backendPrefixes.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));

  const rewriteCandidate = (rawUrl: string) => {
    const url = new URL(rawUrl, currentOrigin);
    if (!isBackendPath(url)) return null;
    if (url.origin !== currentOrigin) return null;
    return resolveBackendUrl(`${url.pathname}${url.search}`);
  };

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    try {
      if (input instanceof Request) {
        const rewritten = rewriteCandidate(input.url);
        if (rewritten) {
          return originalFetch(new Request(rewritten, input), init);
        }
      } else {
        const raw = typeof input === 'string' ? input : input.toString();
        const rewritten = rewriteCandidate(raw);
        if (rewritten) {
          return originalFetch(rewritten, init);
        }
      }
    } catch (error) {
      console.warn('[NetworkBridge] Rewrite skipped', error);
    }

    return originalFetch(input as RequestInfo, init);
  }) as typeof window.fetch;

  (window as any).__vfBackendBridgeInstalled = true;
  console.info('[NetworkBridge] Active', { baseUrl });
}

// --- Crash recovery (stale cache / SW / chunk load) ---
const RECOVERY_FLAG = "__224_cache_recovery_done";

function isLikelyChunkOrAssetLoadError(err: unknown): boolean {
  const message =
    (err instanceof Error ? err.message : "") ||
    (typeof err === "string" ? err : "");

  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Loading chunk \d+ failed/i.test(message) ||
    /ChunkLoadError/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Failed to load module script/i.test(message) ||
    /disallowed MIME type/i.test(message) ||
    /Unexpected token\s*</i.test(message)
  );
}

async function recoverFromStaleCache(trigger: string, err?: unknown) {
  try {
    if (sessionStorage.getItem(RECOVERY_FLAG) === "1") return;
    sessionStorage.setItem(RECOVERY_FLAG, "1");
    sessionStorage.removeItem("page_reloaded_for_chunk");

    console.warn("­ƒº╣ [Recovery] Tentative de r├®cup├®ration (cache/SW)", { trigger, err });

    // Unregister ALL service workers for this origin
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }

    // Clear caches
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // Reload with a cache-busting param (avoid reusing bad SW/HTML)
    const url = new URL(window.location.href);
    url.searchParams.set("__reload", Date.now().toString());
    window.location.replace(url.toString());
  } catch (e) {
    console.warn("­ƒº╣ [Recovery] ├ëchec r├®cup├®ration", e);
    // As a last resort, hard reload
    window.location.reload();
  }
}

function initializeNonCriticalStartup() {
  runSafeStartupStep('backend bridge', () => {
    installBackendRequestBridge();
  });

  // 224Guard APRÈS le pont backend (qui override fetch légitimement) → 224Guard
  // l'enveloppe sans fausse alerte de tamper. Surveille storage/réseau/WS/DOM en live.
  runSafeStartupStep('224guard', () => {
    // Respecte la préférence PDG (interrupteur du dashboard). Défaut = activé.
    if (isGuard224EnabledPref()) startGuard224();
  });

  void runSafeStartupStepAsync('monitoring', async () => {
    await initMonitoring();
  });

  runSafeStartupStep('frontend observer', () => {
    initFrontendObserver();
  });

  void runSafeStartupStepAsync('security', async () => {
    await initializeSecurity();
  });

  runSafeStartupStep('pwa install prompt', () => {
    initPWAInstallPromptListener();
  });
}

function initializePwaRuntime() {
  const resetParams = new URLSearchParams(window.location.search);

  if (resetParams.has('resetSw')) {
    runSafeStartupStep('reset PWA', () => {
      resetPWA();
    });
    return;
  }

  const enablePwaPreview =
    resetParams.has('pwa') ||
    safeGetLocalStorageItem('enable_pwa_preview') === '1';

  if (import.meta.env.DEV && !enablePwaPreview) {
    runSafeStartupStep('unregister service worker', () => {
      unregisterServiceWorker();
      if ('caches' in window) {
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
      }
    });
    return;
  }

  runSafeStartupStep('register service worker', () => {
    registerServiceWorker({ force: enablePwaPreview });
  });

  // Vérification de version (bannière non-bloquante + forçage si version critique)
  runSafeStartupStep('version check', () => {
    startVersionCheck();
  });
}

// Hide the initial loader
const hideLoader = () => {
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.classList.add('fade-out');
    setTimeout(() => {
      if (loader) loader.style.display = 'none';
    }, 400);
  }
  // Also try legacy loader ID
  const legacyLoader = document.getElementById('initial-loader');
  if (legacyLoader) {
    legacyLoader.classList.add('hidden');
    setTimeout(() => {
      if (legacyLoader) legacyLoader.style.display = 'none';
    }, 400);
  }
};

// Show error if app fails to load
const showError = (rootElement: HTMLElement, error: unknown) => {
  hideLoader();
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const safeErrorMessage = errorMessage
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  rootElement.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: #f8f9fa; font-family: system-ui, -apple-system, sans-serif;">
      <div style="max-width: 500px; text-align: center;">
        <div style="font-size: 64px; margin-bottom: 16px;">ÔÜá´©Å</div>
        <h1 style="color: #e74c3c; font-size: 24px; margin-bottom: 16px;">Erreur de chargement</h1>
        <p style="color: #666; margin-bottom: 16px;">L'application n'a pas pu d├®marrer.</p>
        <pre style="text-align: left; background: #fff; padding: 16px; border-radius: 8px; border: 1px solid #ddd; overflow-x: auto; font-size: 12px; color: #c0392b; margin-bottom: 24px; white-space: pre-wrap;">${safeErrorMessage}</pre>
        <button onclick="location.reload()" style="padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">Recharger</button>
      </div>
    </div>
  `;
};

// PWA Diagnostic Logger ÔÇö helps debug production vs preview differences
function logPwaDiagnostics() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
  const swSupported = 'serviceWorker' in navigator;

  console.info('­ƒô▒ [PWA Diagnostics]', {
    mode: isStandalone ? 'standalone (installed)' : 'browser',
    hostname: location.hostname,
    protocol: location.protocol,
    swSupported,
    navigatorOnline: navigator.onLine,
    timestamp: new Date().toISOString(),
  });

  // Check SW registration
  if (swSupported) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      console.info('­ƒô▒ [PWA SW]', {
        registrations: regs.length,
        active: regs.map(r => r.active?.scriptURL || 'none'),
      });
    });
  }

  // Test healthz.json accessibility
  fetch('/healthz.json?diag=1', { cache: 'no-store' })
    .then(async r => {
      const ct = r.headers.get('content-type') || '';
      const isJson = ct.includes('application/json');
      let body: any = null;
      try { body = await r.json(); } catch { }
      console.info('­ƒô▒ [PWA healthz]', {
        status: r.status,
        contentType: ct,
        isRealJson: isJson && body?.status === 'ok',
        source: body?.source || 'server',
      });
    })
    .catch(err => {
      console.warn('­ƒô▒ [PWA healthz] FAILED', err.message);
    });
}

// 🚀 Warm up ALL Supabase domains at startup (DNS + TCP + TLS handshake).
// On utilise `preconnect` (indices de ressource) et NON des fetch HEAD : les anciennes requêtes
// vers /rest/v1/, /auth/v1/settings, /storage/v1/, /health-check répondaient 401/404 (endpoints
// non sollicitables sans contexte) → erreurs rouges inutiles dans la console à chaque page.
// `preconnect` ouvre la connexion en amont SANS aucune requête HTTP → même gain, zéro erreur.
function warmUpConnections() {
  if (typeof document === 'undefined') return;
  // Extraire le project ID depuis la variable d'environnement VITE_SUPABASE_URL
  // Format attendu : https://<project-id>.supabase.co
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseRef = supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : '';
  if (!supabaseRef) return; // Ne pas tenter de preconnect si l'URL n'est pas configurée
  const hosts = [
    `https://${supabaseRef}.supabase.co`,            // DB / REST / Auth / Storage
    `https://${supabaseRef}.functions.supabase.co`,  // Edge Functions
  ];
  for (const href of hosts) {
    if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }
}

// Initialize app

const initApp = () => {
  console.log("­ƒÜÇ 224Solutions - Starting...");
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    console.error("ÔØî Root element not found");
    return;
  }

  try {
    const root = createRoot(rootElement);
    // Log de debug visible
    console.log("[DEBUG] Avant rendu React");
    rootElement.setAttribute('data-app-mounted', 'booting');
    root.render(
      <React.StrictMode>
        <HelmetProvider>
          <App />
        </HelmetProvider>
      </React.StrictMode>
    );
    console.log("[DEBUG] Apr├¿s rendu React");
    console.log("Ô£à React app mounted");
    // Hide loader after React renders
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rootElement.setAttribute('data-app-mounted', 'true');
        hideLoader();
        setTimeout(() => {
          runSafeStartupStep('pwa diagnostics', () => {
            logPwaDiagnostics();
          });
          runSafeStartupStep('warm up connections', () => {
            warmUpConnections();
          });
          initializeNonCriticalStartup();
          initializePwaRuntime();
        }, 0);
      });
    });
  } catch (error) {
    rootElement.setAttribute('data-app-mounted', 'error');
    console.error("ÔØî React render error:", error);
    showError(rootElement, error);
  }
};

// Start app
initApp();

// Capturer les erreurs globales
window.addEventListener('error', (event) => {
  console.error('Erreur globale:', event.error || event.message);

  // Auto-r├®cup├®ration sur erreurs typiques de cache/SW (├®cran blanc)
  const err = (event as any).error ?? event.message;
  if (isLikelyChunkOrAssetLoadError(err)) {
    recoverFromStaleCache("window.error", err);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Promise rejet├®e:', event.reason);

  if (isLikelyChunkOrAssetLoadError(event.reason)) {
    recoverFromStaleCache("unhandledrejection", event.reason);
  }
});
