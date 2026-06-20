/**
 * HOOK DE TRADUCTION DES PRODUITS
 * Traduit automatiquement les noms et descriptions de produits
 * Utilise un cache localStorage pour optimiser les performances
 *
 * @module useProductTranslation
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';

interface ProductTranslation {
  productId: string;
  originalName: string;
  originalDescription?: string;
  translatedName: string;
  translatedDescription?: string;
  targetLanguage: string;
}

interface TranslationCache {
  [key: string]: ProductTranslation; // key = `${productId}_${language}`
}

const CACHE_KEY = 'product_translations_cache';
const CACHE_EXPIRY_KEY = 'product_translations_expiry';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 heures

// Langues qui ne nécessitent pas de traduction (source principale)
const SOURCE_LANGUAGES = ['fr', 'en'];

/**
 * Charge le cache depuis localStorage
 */
function loadCache(): TranslationCache {
  try {
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
    if (expiry && Date.now() > parseInt(expiry)) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_EXPIRY_KEY);
      return {};
    }
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

/**
 * Sauvegarde le cache dans localStorage
 */
function saveCache(cache: TranslationCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    if (!localStorage.getItem(CACHE_EXPIRY_KEY)) {
      localStorage.setItem(CACHE_EXPIRY_KEY, String(Date.now() + CACHE_DURATION));
    }
  } catch (error) {
    console.warn('[ProductTranslation] Cache save failed:', error);
  }
}

/**
 * Hook principal pour traduire un ensemble de produits
 */
export function useProductTranslation() {
  const { language } = useLanguage();
  const [cache, setCache] = useState<TranslationCache>(() => loadCache());
  const [translating, setTranslating] = useState(false);
  const pendingRef = useRef<Set<string>>(new Set());

  // Sauvegarder le cache quand il change
  useEffect(() => {
    saveCache(cache);
  }, [cache]);

  /**
   * Vérifie si la traduction est nécessaire pour cette langue
   */
  const needsTranslation = useCallback((lang: string): boolean => {
    return !SOURCE_LANGUAGES.includes(lang);
  }, []);

  /**
   * Obtient la traduction depuis le cache
   */
  const getFromCache = useCallback((productId: string, lang: string): ProductTranslation | null => {
    const key = `${productId}_${lang}`;
    return cache[key] || null;
  }, [cache]);

  /**
   * Traduit un lot de produits
   */
  const translateProducts = useCallback(async (
    products: Array<{ id: string; name: string; description?: string }>
  ): Promise<ProductTranslation[]> => {
    // Si la langue source, pas besoin de traduire
    if (!needsTranslation(language)) {
      return products.map(p => ({
        productId: p.id,
        originalName: p.name,
        originalDescription: p.description,
        translatedName: p.name,
        translatedDescription: p.description,
        targetLanguage: language
      }));
    }

    // Identifier les produits non cachés et non en cours
    const uncached = products.filter(p => {
      const key = `${p.id}_${language}`;
      return !cache[key] && !pendingRef.current.has(key);
    });

    // Résultats depuis le cache
    const _cachedResults = products
      .map(p => getFromCache(p.id, language))
      .filter((t): t is ProductTranslation => t !== null);

    // Si tout est caché, retourner
    if (uncached.length === 0) {
      return products.map(p => {
        const cached = getFromCache(p.id, language);
        return cached || {
          productId: p.id,
          originalName: p.name,
          originalDescription: p.description,
          translatedName: p.name,
          translatedDescription: p.description,
          targetLanguage: language
        };
      });
    }

    // Marquer comme en cours
    uncached.forEach(p => pendingRef.current.add(`${p.id}_${language}`));
    setTranslating(true);

    try {
      const { data, error } = await supabase.functions.invoke('translate-product', {
        body: {
          products: uncached.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description
          })),
          targetLanguage: language
        }
      });

      if (error) {
        console.error('[ProductTranslation] API error:', error);
        throw error;
      }

      const translations: ProductTranslation[] = data?.translations || [];

      // Mettre à jour le cache
      const newCache: TranslationCache = { ...cache };
      translations.forEach(t => {
        const key = `${t.productId}_${language}`;
        newCache[key] = t;
        pendingRef.current.delete(key);
      });
      setCache(newCache);

      // Retourner tous les résultats (cache + nouveaux)
      return products.map(p => {
        const newTranslation = translations.find(t => t.productId === p.id);
        const cachedTranslation = newCache[`${p.id}_${language}`];
        return newTranslation || cachedTranslation || {
          productId: p.id,
          originalName: p.name,
          originalDescription: p.description,
          translatedName: p.name,
          translatedDescription: p.description,
          targetLanguage: language
        };
      });

    } catch (error) {
      console.error('[ProductTranslation] Translation failed:', error);
      // Retirer des pending
      uncached.forEach(p => pendingRef.current.delete(`${p.id}_${language}`));

      // Retourner les originaux en cas d'erreur
      return products.map(p => ({
        productId: p.id,
        originalName: p.name,
        originalDescription: p.description,
        translatedName: p.name,
        translatedDescription: p.description,
        targetLanguage: language
      }));
    } finally {
      setTranslating(false);
    }
  }, [language, cache, getFromCache, needsTranslation]);

  /**
   * Traduit un seul produit
   */
  const translateProduct = useCallback(async (
    product: { id: string; name: string; description?: string }
  ): Promise<ProductTranslation> => {
    const results = await translateProducts([product]);
    return results[0];
  }, [translateProducts]);

  /**
   * Obtient le nom traduit d'un produit (synchrone, depuis le cache uniquement)
   */
  const getTranslatedName = useCallback((productId: string, originalName: string): string => {
    if (!needsTranslation(language)) return originalName;
    const cached = getFromCache(productId, language);
    return cached?.translatedName || originalName;
  }, [language, getFromCache, needsTranslation]);

  /**
   * Obtient la description traduite d'un produit
   */
  const getTranslatedDescription = useCallback((productId: string, originalDescription?: string): string | undefined => {
    if (!needsTranslation(language)) return originalDescription;
    const cached = getFromCache(productId, language);
    return cached?.translatedDescription || originalDescription;
  }, [language, getFromCache, needsTranslation]);

  /**
   * Vérifie si un produit a une traduction en cache
   */
  const hasTranslation = useCallback((productId: string): boolean => {
    if (!needsTranslation(language)) return true;
    return !!getFromCache(productId, language);
  }, [language, getFromCache, needsTranslation]);

  /**
   * Vide le cache de traduction
   */
  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_EXPIRY_KEY);
    setCache({});
  }, []);

  return {
    // États
    translating,
    language,
    needsTranslation: needsTranslation(language),

    // Actions asynchrones
    translateProducts,
    translateProduct,

    // Accesseurs synchrones (cache uniquement)
    getTranslatedName,
    getTranslatedDescription,
    hasTranslation,

    // Utilitaires
    clearCache
  };
}

export default useProductTranslation;
