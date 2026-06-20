/**
 * Service Worker Registration v2
 * Non-blocking, with PWA diagnostics and universal reset
 */

const isPWAStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as any).standalone === true;

export function registerServiceWorker(options?: { force?: boolean }) {
  if (import.meta.env.DEV && !options?.force) return;
  if (!("serviceWorker" in navigator)) return;

  console.log(`[PWA] Mode: ${isPWAStandalone() ? 'standalone (installed)' : 'browser'}`);

  if (document.readyState === 'complete') {
    registerSW();
  } else {
    window.addEventListener("load", registerSW);
  }
}

function registerSW() {
  setTimeout(async () => {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js", {
        updateViaCache: 'none' as any
      });

      console.log("[PWA] SW registered, scope:", registration.scope);

      // Toujours vérifier immédiatement les mises à jour pour éviter les écrans blancs liés aux anciens chunks.
      registration.update().catch(() => { });

      if (registration.waiting) {
        console.log("[PWA] Waiting SW detected — auto-activating...");
        registration.waiting.postMessage("skipWaiting");
        setTimeout(() => window.location.reload(), 500);
        return;
      }

      registration.onupdatefound = () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.onstatechange = () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("[PWA] New SW version available — auto-activating...");
              newWorker.postMessage("skipWaiting");
              setTimeout(() => window.location.reload(), 500);
            }
          };
        }
      };

      // Check for updates every 30 min (more aggressive for PWA)
      const interval = isPWAStandalone() ? 30 * 60 * 1000 : 60 * 60 * 1000;
      setInterval(() => {
        registration.update().catch(() => { });
      }, interval);

    } catch (error) {
      console.warn("[PWA] SW registration failed (non-blocking):", error);
    }
  }, 500);
}

function showUpdateMessage() {
  if (document.getElementById("pwa-update-banner")) return;

  const alertBox = document.createElement("div");
  alertBox.id = "pwa-update-banner";
  alertBox.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <span>🔄</span>
      <span>Nouvelle version disponible</span>
    </div>
    <button id="pwa-update-btn" style="background:white;color:#023288;border:none;padding:6px 12px;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px">Actualiser</button>
  `;
  alertBox.style.cssText = `
    position:fixed;bottom:20px;left:20px;right:20px;max-width:400px;margin:0 auto;
    padding:12px 16px;background:#023288;color:white;border-radius:12px;z-index:99999;
    box-shadow:0 10px 40px rgba(2,50,136,0.3);display:flex;justify-content:space-between;
    align-items:center;font-family:system-ui;font-size:14px;animation:pwaSlideUp .3s ease-out
  `;

  const style = document.createElement("style");
  style.textContent = `@keyframes pwaSlideUp{from{transform:translateY(100px);opacity:0}to{transform:translateY(0);opacity:1}}`;
  document.head.appendChild(style);
  document.body.appendChild(alertBox);

  document.getElementById("pwa-update-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg?.waiting) reg.waiting.postMessage("skipWaiting");
    });
    window.location.reload();
  });
}

export function unregisterServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then(reg => reg.unregister());
  }
}

/**
 * Full PWA reset — clears all SW + caches
 * Can be called from console: window.__resetPWA()
 */
export async function resetPWA(): Promise<void> {
  console.log("[PWA] Full reset...");
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      console.log(`[PWA] Unregistered ${regs.length} SW(s)`);
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      console.log(`[PWA] Cleared ${keys.length} cache(s)`);
    }
    window.location.reload();
  } catch (e) {
    console.error("[PWA] Reset error:", e);
    window.location.reload();
  }
}

// Expose globally for debugging
if (typeof window !== 'undefined') {
  (window as any).__resetPWA = resetPWA;
}
