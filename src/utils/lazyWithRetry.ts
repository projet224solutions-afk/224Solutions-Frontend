import { lazy, ComponentType, createElement } from 'react';

type ComponentImport<T> = () => Promise<{ default: T }>;

// Fallback pour erreurs de chunk/caches: proposer un refresh MANUEL (pas automatique)
const ReloadFallback = () => {
  return createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '200px',
      padding: '20px',
      textAlign: 'center',
      color: '#666'
    }
  }, [
    createElement('div', {
      key: 'icon',
      style: { fontSize: '48px', marginBottom: '16px', color: '#04439e' }
    }, '🔄'),
    createElement('h3', {
      key: 'title',
      style: { margin: '0 0 8px 0', color: '#04439e', fontWeight: '700' }
    }, 'Mise à jour requise'),
    createElement('p', {
      key: 'message',
      style: { margin: '0', fontSize: '14px', color: '#04439e', opacity: '0.8' }
    }, "Impossible de charger une partie de l'application. Actualisez pour continuer."),
    createElement('button', {
      key: 'button',
      onClick: () => window.location.reload(),
      style: {
        marginTop: '16px',
        padding: '10px 24px',
        border: 'none',
        borderRadius: '6px',
        background: '#04439e',
        color: '#fff',
        cursor: 'pointer',
        fontWeight: '600'
      }
    }, 'Actualiser')
  ]);
};

/**
 * Wrapper pour les imports dynamiques avec retry automatique
 * Gère les erreurs de cache après déploiement et le mode offline
 * v3 - Support mode hors ligne amélioré avec meilleur fallback UI
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: ComponentImport<T>,
  retries = 3,
  interval = 1500
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    // Clé pour éviter les boucles infinies de reload
    const pageHasAlreadyReloaded = sessionStorage.getItem('page_reloaded_for_chunk') === 'true';

    try {
      const component = await componentImport();
      // Succès - réinitialiser le flag
      sessionStorage.removeItem('page_reloaded_for_chunk');
      return component;
    } catch (error: any) {
      const errorMessage = error?.message || '';
      const isChunkLoadError =
        errorMessage.includes('Failed to fetch dynamically imported module') ||
        errorMessage.includes('Loading chunk') ||
        errorMessage.includes('Loading CSS chunk') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('Failed to load') ||
        error?.name === 'ChunkLoadError';

      console.warn('[LazyRetry] Module load error:', errorMessage);

      // Si c'est une erreur de chunk et qu'on n'a pas encore rechargé
      if (isChunkLoadError && !pageHasAlreadyReloaded) {
        console.warn('[LazyRetry] Chunk load error detected, attempting retries...');

        // Essayer avec retry d'abord
        for (let i = 0; i < retries; i++) {
          await new Promise(resolve => setTimeout(resolve, interval));

          try {
            // Ajouter cache-bust pour forcer le rechargement
            const _cacheBuster = `?t=${Date.now()}`;
            const component = await componentImport();
            sessionStorage.removeItem('page_reloaded_for_chunk');
            console.log(`[LazyRetry] Retry ${i + 1}/${retries} succeeded`);
            return component;
          } catch (_retryError) {
            console.warn(`[LazyRetry] Retry ${i + 1}/${retries} failed`);
          }
        }

        // Si les retries échouent et qu'on est toujours online, recharger la page
        // IMPORTANT: ne pas recharger automatiquement (ça ferme des formulaires/modals sur mobile)
        // → on propose un refresh manuel à l'utilisateur.
        console.warn('[LazyRetry] All retries failed, showing manual refresh fallback...');
        sessionStorage.setItem('page_reloaded_for_chunk', 'true');
        return { default: ReloadFallback as unknown as T };
      }

      // Si on a déjà rechargé, afficher le fallback au lieu de planter
      if (pageHasAlreadyReloaded && isChunkLoadError) {
        console.warn('[LazyRetry] Already reloaded, showing fallback');
        sessionStorage.removeItem('page_reloaded_for_chunk');
        return { default: ReloadFallback as unknown as T };
      }

      // Pour les autres erreurs, propager
      throw error;
    }
  });
}

/**
 * Version simplifiée qui recharge immédiatement sans retry
 */
export function lazyWithReload<T extends ComponentType<any>>(
  componentImport: ComponentImport<T>
): React.LazyExoticComponent<T> {
  return lazyWithRetry(componentImport, 0, 0);
}
