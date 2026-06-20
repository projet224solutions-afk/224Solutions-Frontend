/**
 * Catalog Cache - Cache du catalogue pour navigation offline
 * 224SOLUTIONS - Mode Offline Avancé
 *
 * Permet la consultation du catalogue en mode hors ligne avec:
 * - Navigation produits (lecture seule)
 * - Recherche locale rapide (Fuse.js)
 * - Filtres par catégorie
 * - Images en cache
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import Fuse from 'fuse.js';

/**
 * Produit en cache
 */
export interface CachedProduct {
  id: string;
  vendor_id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  sku?: string;
  category_id?: string;
  category_name?: string;
  images: string[]; // URLs des images
  cached_images?: string[]; // Data URLs en base64 (pour offline)
  unit?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  cached_at: string;
}

/**
 * Catégorie en cache
 */
export interface CachedCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  product_count: number;
  cached_at: string;
}

/**
 * Schéma de la base de données catalogue
 */
interface CatalogCacheSchema extends DBSchema {
  products: {
    key: string;
    value: CachedProduct;
    indexes: {
      'by-vendor': string;
      'by-category': string;
      'by-name': string;
      'by-active': number;
    };
  };
  categories: {
    key: string;
    value: CachedCategory;
    indexes: {
      'by-name': string;
    };
  };
  search_index: {
    key: string; // vendor_id
    value: {
      vendor_id: string;
      index_data: any; // Données de l'index Fuse.js sérialisées
      last_updated: string;
    };
  };
  cached_images: {
    key: string; // URL de l'image
    value: {
      url: string;
      data_url: string; // Base64
      size: number;
      cached_at: string;
    };
  };
}

let catalogDB: IDBPDatabase<CatalogCacheSchema> | null = null;
const fuseInstances: Map<string, Fuse<CachedProduct>> = new Map();

/**
 * Options de recherche Fuse.js
 */
const FUSE_OPTIONS = {
  keys: [
    { name: 'name', weight: 2 },
    { name: 'description', weight: 1 },
    { name: 'sku', weight: 1.5 },
    { name: 'category_name', weight: 0.5 }
  ],
  threshold: 0.3,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2
};

/**
 * Initialiser la base de données catalogue
 */
async function initCatalogDB(): Promise<IDBPDatabase<CatalogCacheSchema>> {
  if (catalogDB) return catalogDB;

  catalogDB = await openDB<CatalogCacheSchema>('224Solutions-CatalogCache', 1, {
    upgrade(database) {
      console.log('[CatalogCache] Création du schéma DB');

      // Store des produits
      if (!database.objectStoreNames.contains('products')) {
        const productsStore = database.createObjectStore('products', { keyPath: 'id' });
        productsStore.createIndex('by-vendor', 'vendor_id');
        productsStore.createIndex('by-category', 'category_id');
        productsStore.createIndex('by-name', 'name');
        productsStore.createIndex('by-active', 'is_active');
      }

      // Store des catégories
      if (!database.objectStoreNames.contains('categories')) {
        const categoriesStore = database.createObjectStore('categories', { keyPath: 'id' });
        categoriesStore.createIndex('by-name', 'name');
      }

      // Store de l'index de recherche
      if (!database.objectStoreNames.contains('search_index')) {
        database.createObjectStore('search_index', { keyPath: 'vendor_id' });
      }

      // Store des images en cache
      if (!database.objectStoreNames.contains('cached_images')) {
        database.createObjectStore('cached_images', { keyPath: 'url' });
      }
    }
  });

  console.log('[CatalogCache] ✅ Base de données initialisée');
  return catalogDB;
}

/**
 * Charger les produits du vendeur dans le cache
 */
export async function cacheVendorProducts(
  vendorId: string,
  products: any[],
  cacheImages: boolean = true
): Promise<{ cached: number; images_cached: number }> {
  const db = await initCatalogDB();
  let imagesCached = 0;

  for (const product of products) {
    // ✨ FIX: Supporter stock_quantity (Supabase) et stock (local)
    const stockValue = product.stock_quantity ?? product.stock ?? 0;

    const cachedProduct: CachedProduct = {
      id: product.id,
      vendor_id: vendorId,
      name: product.name,
      description: product.description || '',
      price: product.price,
      stock: stockValue,
      sku: product.sku,
      category_id: product.category_id,
      category_name: product.categories?.name || product.category?.name,
      images: product.images || [],
      is_active: product.is_active !== false,
      created_at: product.created_at,
      updated_at: product.updated_at,
      cached_at: new Date().toISOString(),
      unit: product.unit
    };

    // Mettre en cache les images si demandé (seulement les 100 premiers produits)
    if (cacheImages && product.images && product.images.length > 0) {
      const cachedImageUrls: string[] = [];
      const limit = products.indexOf(product) < 100; // Limiter aux 100 premiers

      if (limit) {
        for (const imageUrl of product.images.slice(0, 2)) { // Max 2 images par produit
          try {
            const dataUrl = await cacheImage(imageUrl);
            if (dataUrl) {
              cachedImageUrls.push(dataUrl);
              imagesCached++;
            }
          } catch (error) {
            console.warn(`[CatalogCache] Erreur cache image: ${imageUrl}`, error);
          }
        }
      }

      if (cachedImageUrls.length > 0) {
        cachedProduct.cached_images = cachedImageUrls;
      }
    }

    await db.put('products', cachedProduct);
  }

  // Construire l'index de recherche
  await buildSearchIndex(vendorId);

  console.log(`[CatalogCache] ✅ ${products.length} produits cachés, ${imagesCached} images`);

  return { cached: products.length, images_cached: imagesCached };
}

/**
 * Mettre une image en cache (convertir en base64)
 */
async function cacheImage(url: string): Promise<string | null> {
  const db = await initCatalogDB();

  // Vérifier si déjà en cache
  const existing = await db.get('cached_images', url);
  if (existing) return existing.data_url;

  try {
    const response = await fetch(url);
    const blob = await response.blob();

    // Limiter la taille (max 500KB)
    if (blob.size > 500 * 1024) {
      console.warn(`[CatalogCache] Image trop grande (${blob.size} bytes): ${url}`);
      return null;
    }

    const dataUrl = await blobToDataURL(blob);

    await db.put('cached_images', {
      url,
      data_url: dataUrl,
      size: blob.size,
      cached_at: new Date().toISOString()
    });

    return dataUrl;
  } catch (error) {
    console.error('[CatalogCache] Erreur fetch image:', error);
    return null;
  }
}

/**
 * Convertir un Blob en Data URL
 */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Construire l'index de recherche Fuse.js
 */
async function buildSearchIndex(vendorId: string): Promise<void> {
  const db = await initCatalogDB();
  const products = await db.getAllFromIndex('products', 'by-vendor', vendorId);

  // Créer l'instance Fuse
  const fuse = new Fuse(products, FUSE_OPTIONS);
  fuseInstances.set(vendorId, fuse);

  // Sauvegarder l'index (pour réutilisation rapide)
  const indexData = fuse.getIndex();

  await db.put('search_index', {
    vendor_id: vendorId,
    index_data: indexData.toJSON(),
    last_updated: new Date().toISOString()
  });

  console.log(`[CatalogCache] ✅ Index de recherche créé (${products.length} produits)`);
}

/**
 * Obtenir l'instance Fuse.js pour un vendeur
 */
async function getFuseInstance(vendorId: string): Promise<Fuse<CachedProduct>> {
  // Vérifier le cache mémoire
  if (fuseInstances.has(vendorId)) {
    return fuseInstances.get(vendorId)!;
  }

  const db = await initCatalogDB();
  const products = await db.getAllFromIndex('products', 'by-vendor', vendorId);

  // Essayer de charger l'index sauvegardé
  const savedIndex = await db.get('search_index', vendorId);

  let fuse: Fuse<CachedProduct>;

  if (savedIndex) {
    // Utiliser l'index sauvegardé (plus rapide)
    fuse = new Fuse(
      products,
      FUSE_OPTIONS,
      Fuse.parseIndex(savedIndex.index_data)
    );
  } else {
    // Construire un nouvel index
    fuse = new Fuse(products, FUSE_OPTIONS);
  }

  fuseInstances.set(vendorId, fuse);
  return fuse;
}

/**
 * Rechercher des produits (fuzzy search)
 */
export async function searchProducts(
  vendorId: string,
  query: string,
  options?: {
    categoryId?: string;
    inStockOnly?: boolean;
    limit?: number;
  }
): Promise<CachedProduct[]> {
  const fuse = await getFuseInstance(vendorId);
  const results = fuse.search(query);

  let products = results.map(r => r.item);

  // Filtrer par catégorie
  if (options?.categoryId) {
    products = products.filter(p => p.category_id === options.categoryId);
  }

  // Filtrer en stock uniquement
  if (options?.inStockOnly) {
    products = products.filter(p => p.stock > 0);
  }

  // Limiter
  if (options?.limit) {
    products = products.slice(0, options.limit);
  }

  return products;
}

/**
 * Obtenir tous les produits d'un vendeur
 */
export async function getVendorProducts(
  vendorId: string,
  options?: {
    categoryId?: string;
    inStockOnly?: boolean;
    activeOnly?: boolean;
    limit?: number;
  }
): Promise<CachedProduct[]> {
  const db = await initCatalogDB();
  let products = await db.getAllFromIndex('products', 'by-vendor', vendorId);

  // Filtres
  if (options?.categoryId) {
    products = products.filter(p => p.category_id === options.categoryId);
  }

  if (options?.inStockOnly) {
    products = products.filter(p => p.stock > 0);
  }

  if (options?.activeOnly !== false) {
    products = products.filter(p => p.is_active);
  }

  // Trier par nom
  products.sort((a, b) => a.name.localeCompare(b.name));

  // Limiter
  if (options?.limit) {
    products = products.slice(0, options.limit);
  }

  return products;
}

/**
 * Obtenir un produit par ID
 */
export async function getProduct(productId: string): Promise<CachedProduct | null> {
  const db = await initCatalogDB();
  const product = await db.get('products', productId);
  return product || null;
}

/**
 * Mettre en cache les catégories
 */
export async function cacheCategories(categories: any[]): Promise<void> {
  const db = await initCatalogDB();

  for (const category of categories) {
    const cachedCategory: CachedCategory = {
      id: category.id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      product_count: category.product_count || 0,
      cached_at: new Date().toISOString()
    };

    await db.put('categories', cachedCategory);
  }

  console.log(`[CatalogCache] ✅ ${categories.length} catégories cachées`);
}

/**
 * Obtenir toutes les catégories
 */
export async function getCategories(): Promise<CachedCategory[]> {
  const db = await initCatalogDB();
  const categories = await db.getAll('categories');

  // Trier par nom
  categories.sort((a, b) => a.name.localeCompare(b.name));

  return categories;
}

/**
 * Obtenir les produits d'une catégorie
 */
export async function getProductsByCategory(
  vendorId: string,
  categoryId: string
): Promise<CachedProduct[]> {
  return getVendorProducts(vendorId, { categoryId });
}

/**
 * Obtenir les statistiques du cache
 */
export async function getCacheStats(vendorId: string): Promise<{
  totalProducts: number;
  activeProducts: number;
  totalCategories: number;
  cachedImages: number;
  cacheSize: number;
  lastUpdated: string | null;
}> {
  const db = await initCatalogDB();
  const products = await db.getAllFromIndex('products', 'by-vendor', vendorId);
  const categories = await db.getAll('categories');
  const images = await db.getAll('cached_images');

  const activeProducts = products.filter(p => p.is_active).length;
  const cacheSize = images.reduce((sum, img) => sum + img.size, 0);

  const lastUpdated = products.length > 0
    ? products.reduce((latest, p) =>
        new Date(p.cached_at) > new Date(latest) ? p.cached_at : latest
      , products[0].cached_at)
    : null;

  return {
    totalProducts: products.length,
    activeProducts,
    totalCategories: categories.length,
    cachedImages: images.length,
    cacheSize,
    lastUpdated
  };
}

/**
 * Effacer le cache du catalogue
 */
export async function clearCatalogCache(vendorId?: string): Promise<void> {
  const db = await initCatalogDB();

  if (vendorId) {
    // Effacer seulement pour ce vendeur
    const products = await db.getAllFromIndex('products', 'by-vendor', vendorId);
    for (const product of products) {
      await db.delete('products', product.id);
    }
    await db.delete('search_index', vendorId);
    fuseInstances.delete(vendorId);

    console.log(`[CatalogCache] 🧹 Cache effacé pour vendeur ${vendorId}`);
  } else {
    // Effacer tout
    await db.clear('products');
    await db.clear('categories');
    await db.clear('search_index');
    await db.clear('cached_images');
    fuseInstances.clear();

    console.log('[CatalogCache] 🧹 Cache complet effacé');
  }
}

/**
 * Vérifier si le cache est à jour
 */
export async function isCacheStale(
  vendorId: string,
  maxAgeHours: number = 24
): Promise<boolean> {
  const stats = await getCacheStats(vendorId);

  if (!stats.lastUpdated) return true;

  const ageHours = (Date.now() - new Date(stats.lastUpdated).getTime()) / (1000 * 60 * 60);
  return ageHours > maxAgeHours;
}

/**
 * Obtenir les produits recommandés/populaires (basé sur le stock disponible)
 */
export async function getFeaturedProducts(
  vendorId: string,
  limit: number = 10
): Promise<CachedProduct[]> {
  const products = await getVendorProducts(vendorId, {
    inStockOnly: true,
    activeOnly: true
  });

  // Trier par stock (les plus en stock en premier = probablement populaires)
  products.sort((a, b) => b.stock - a.stock);

  return products.slice(0, limit);
}

export default {
  initCatalogDB,
  cacheVendorProducts,
  cacheCategories,
  searchProducts,
  getVendorProducts,
  getProduct,
  getCategories,
  getProductsByCategory,
  getCacheStats,
  clearCatalogCache,
  isCacheStale,
  getFeaturedProducts
};
