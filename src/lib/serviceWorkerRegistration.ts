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
        // ✅ Un SW est déjà en attente → proposer la mise à jour (pas de reload silencieux)
        console.log("[PWA] SW en attente détecté — affichage de la bannière");
        showUpdateMessage();
      }

      registration.onupdatefound = () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.onstatechange = () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // ✅ Une nouvelle version est prête — DEMANDER à l'utilisateur
              // (au lieu de recharger silencieusement et risquer une perte de données)
              console.log("[PWA] Nouvelle version disponible — affichage de la bannière");
              showUpdateMessage();
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
  if (document.getElementById("pwa-update-banner")) return; // déjà affichée

  const alertBox = document.createElement("div");
  alertBox.id = "pwa-update-banner";
  alertBox.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <span style="font-size:18px">🔄</span>
      <span>Une nouvelle version est disponible</span>
    </div>
    <button id="pwa-update-btn" style="background:white;color:#023288;border:none;padding:8px 16px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;white-space:nowrap">Mettre à jour</button>
  `;
  alertBox.style.cssText = `
    position:fixed;bottom:20px;left:20px;right:20px;max-width:420px;margin:0 auto;
    padding:14px 18px;background:#023288;color:white;border-radius:14px;z-index:99999;
    box-shadow:0 12px 48px rgba(2,50,136,0.4);display:flex;justify-content:space-between;
    align-items:center;gap:12px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;
    animation:pwaSlideUp .35s cubic-bezier(0.16,1,0.3,1)
  `;

  if (!document.getElementById("pwa-update-style")) {
    const style = document.createElement("style");
    style.id = "pwa-update-style";
    style.textContent = `@keyframes pwaSlideUp{from{transform:translateY(120px);opacity:0}to{transform:translateY(0);opacity:1}}`;
    document.head.appendChild(style);
  }

  document.body.appendChild(alertBox);

  document.getElementById("pwa-update-btn")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLButtonElement;
    btn.textContent = "Mise à jour...";
    btn.disabled = true;

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage("skipWaiting");
        // Attendre que le nouveau SW prenne le contrôle avant de recharger
        let reloaded = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!reloaded) { reloaded = true; window.location.reload(); }
        });
        // Sécurité : recharger après 1.5s même si controllerchange ne se déclenche pas
        setTimeout(() => { if (!reloaded) { reloaded = true; window.location.reload(); } }, 1500);
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
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
