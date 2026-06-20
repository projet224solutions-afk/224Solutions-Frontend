import { ComponentType, lazy, LazyExoticComponent } from 'react';

// Interface pour le cache de préchargement
interface PreloadCache {
  [key: string]: {
    component: LazyExoticComponent<ComponentType<any>>;
    preloaded: boolean;
    error?: Error;
  };
}

const preloadCache: PreloadCache = {};

/**
 * Crée un composant lazy avec préchargement optimisé
 * @param importFn Fonction d'import dynamique
 * @param componentName Nom du composant pour le cache
 * @param fallback Composant de fallback en cas d'erreur
 */
export function lazyWithPreload<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string,
  fallback?: ComponentType<any>
): LazyExoticComponent<T> & { preload: () => Promise<void> } {

  // Vérifier le cache
  if (preloadCache[componentName]) {
    return preloadCache[componentName].component as any;
  }

  // Créer le composant lazy avec gestion d'erreur
  const LazyComponent = lazy(() =>
    importFn().catch((error) => {
      console.error(`Error loading component ${componentName}:`, error);

      // Stocker l'erreur dans le cache
      if (preloadCache[componentName]) {
        preloadCache[componentName].error = error;
      }

      // Retourner le fallback si fourni
      if (fallback) {
        return { default: fallback as any };
      }

      // Sinon retourner un composant d'erreur simple en React pur (sans JSX)
      const ErrorComponent: ComponentType<any> = () => {
        return null; // React gère mieux les erreurs de chargement avec Suspense
      };

      return { default: ErrorComponent };
    })
  ) as LazyExoticComponent<T> & { preload: () => Promise<void> };

  // Méthode de préchargement
  const preload = async () => {
    if (preloadCache[componentName]?.preloaded) {
      return;
    }

    try {
      await importFn();

      if (!preloadCache[componentName]) {
        preloadCache[componentName] = {
          component: LazyComponent,
          preloaded: false,
        };
      }

      preloadCache[componentName].preloaded = true;
      console.log(`✅ Component ${componentName} preloaded successfully`);
    } catch (error) {
      console.error(`❌ Failed to preload component ${componentName}:`, error);

      if (!preloadCache[componentName]) {
        preloadCache[componentName] = {
          component: LazyComponent,
          preloaded: false,
        };
      }

      preloadCache[componentName].error = error as Error;
    }
  };

  LazyComponent.preload = preload;

  // Ajouter au cache
  preloadCache[componentName] = {
    component: LazyComponent,
    preloaded: false,
  };

  return LazyComponent;
}

/**
 * Précharge plusieurs composants en parallèle
 * @param components Array de composants avec méthode preload
 */
export async function preloadComponents(
  components: Array<{ preload: () => Promise<void> }>
): Promise<void> {
  try {
    await Promise.all(components.map(c => c.preload()));
    console.log(`✅ Preloaded ${components.length} components`);
  } catch (error) {
    console.error('Error preloading components:', error);
  }
}

/**
 * Précharge un composant au hover
 * @param component Composant avec méthode preload
 */
export function usePreloadOnHover(
  component: { preload: () => Promise<void> }
) {
  return {
    onMouseEnter: () => component.preload(),
    onFocus: () => component.preload(),
  };
}

/**
 * Précharge un composant après un délai
 * @param component Composant avec méthode preload
 * @param delay Délai en millisecondes
 */
export function preloadAfterDelay(
  component: { preload: () => Promise<void> },
  delay: number = 2000
): void {
  setTimeout(() => {
    component.preload();
  }, delay);
}

/**
 * Vérifie le statut du préchargement d'un composant
 * @param componentName Nom du composant
 */
export function getPreloadStatus(componentName: string): {
  preloaded: boolean;
  error?: Error;
} {
  const cached = preloadCache[componentName];
  return {
    preloaded: cached?.preloaded || false,
    error: cached?.error,
  };
}
