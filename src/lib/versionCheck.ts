/**
 * VÉRIFICATION DE VERSION — mise à jour forcée si version trop ancienne.
 *
 * Fonctionnement :
 * 1. Au démarrage et périodiquement, on lit /version.json (servi à la racine,
 *    régénéré à chaque déploiement).
 * 2. On compare avec la version embarquée (import.meta.env.VITE_APP_VERSION).
 * 3. Si version.json indique une `minVersion` > version locale → mise à jour
 *    FORCÉE (modal bloquant, pas de bouton "plus tard").
 * 4. Sinon, si une nouvelle version existe (mais pas critique) → la bannière
 *    de serviceWorkerRegistration suffit.
 */

const LOCAL_VERSION = import.meta.env.VITE_APP_VERSION || 'v0';
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 min

interface VersionInfo {
  version: string;     // version actuelle déployée
  minVersion?: string; // version minimale acceptée (en dessous → forcer)
  message?: string;    // message custom à afficher
}

/** Compare 2 versions vNNNN (timestamps). Retourne true si a < b. */
function isOlder(a: string, b: string): boolean {
  const na = Number(String(a).replace(/^v/, '')) || 0;
  const nb = Number(String(b).replace(/^v/, '')) || 0;
  return na < nb;
}

async function fetchVersionInfo(): Promise<VersionInfo | null> {
  try {
    // cache:'no-store' → toujours la dernière version, jamais le cache
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function showForcedUpdateModal(message?: string) {
  if (document.getElementById('pwa-forced-update')) return;

  const overlay = document.createElement('div');
  overlay.id = 'pwa-forced-update';
  overlay.innerHTML = `
    <div style="background:white;border-radius:20px;padding:32px 24px;max-width:360px;margin:20px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
      <div style="font-size:48px;margin-bottom:16px">🔄</div>
      <h2 style="margin:0 0 12px;color:#023288;font-size:20px;font-weight:700">Mise à jour requise</h2>
      <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.5">
        ${message || "Une nouvelle version de 224Solutions est disponible. Veuillez mettre à jour pour continuer."}
      </p>
      <button id="pwa-forced-btn" style="width:100%;background:#023288;color:white;border:none;padding:14px;border-radius:12px;font-weight:700;font-size:15px;cursor:pointer">
        Mettre à jour maintenant
      </button>
    </div>
  `;
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(2,50,136,0.85);backdrop-filter:blur(4px);
    z-index:999999;display:flex;align-items:center;justify-content:center;
    font-family:system-ui,-apple-system,sans-serif;animation:pwaFadeIn .3s ease-out
  `;

  if (!document.getElementById('pwa-forced-style')) {
    const style = document.createElement('style');
    style.id = 'pwa-forced-style';
    style.textContent = `@keyframes pwaFadeIn{from{opacity:0}to{opacity:1}}`;
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);

  document.getElementById('pwa-forced-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('pwa-forced-btn') as HTMLButtonElement;
    btn.textContent = 'Mise à jour...';
    btn.disabled = true;

    try {
      // Vider les caches et mettre à jour le SW pour forcer le rechargement complet
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => {
          if (r.waiting) r.waiting.postMessage('skipWaiting');
          return r.update();
        }));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch { /* ignore */ }

    // Rechargement forcé (bypass cache navigateur)
    window.location.reload();
  });
}

/** Démarre la vérification de version (au boot + périodique). */
export function startVersionCheck() {
  const check = async () => {
    const info = await fetchVersionInfo();
    if (!info) return;

    // Mise à jour FORCÉE si la version locale est sous la minVersion
    if (info.minVersion && isOlder(LOCAL_VERSION, info.minVersion)) {
      console.warn(`[version] Version ${LOCAL_VERSION} < min ${info.minVersion} — mise à jour forcée`);
      showForcedUpdateModal(info.message);
      return;
    }

    // Sinon, si nouvelle version dispo → le SW affichera la bannière non-bloquante
    if (info.version && isOlder(LOCAL_VERSION, info.version)) {
      console.log(`[version] Nouvelle version ${info.version} disponible (actuelle ${LOCAL_VERSION})`);
    }
  };

  check(); // au démarrage
  setInterval(check, VERSION_CHECK_INTERVAL); // toutes les 5 min
}
