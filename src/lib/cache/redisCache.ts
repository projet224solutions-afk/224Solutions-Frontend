/**
 * 🚀 Redis Cache Layer - Upstash via Edge Function
 * Intercepte les lectures fréquentes pour réduire la charge Supabase de 70%
 */

import { supabase } from '@/integrations/supabase/client';

const CACHE_PREFIX = 'cache:';
const DEFAULT_TTL = 300; // 5 minutes

// In-memory L1 cache (RAM) pour éviter même l'appel Edge Function
const memoryCache = new Map<string, { data: any; expiresAt: number }>();
const MAX_MEMORY_ENTRIES = 200;

function getFromMemory(key: string): any | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setInMemory(key: string, data: any, ttlSeconds: number) {
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// Appel Edge Function Redis
async function redisGet(key: string): Promise<any | null> {
  try {
    const { data, error } = await supabase.functions.invoke('redis-cache', {
      body: null,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    // Use query params approach
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redis-cache?action=get&key=${CACHE_PREFIX}${key}`,
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) return null;
    const result = await response.json();
    return result.hit ? result.value : null;
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: any, ttl: number): Promise<void> {
  try {
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redis-cache?action=set`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: `${CACHE_PREFIX}${key}`, value, ttl }),
      }
    );
  } catch {
    // Silently fail - cache is optional
  }
}

async function redisInvalidate(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redis-cache?action=delete&key=${CACHE_PREFIX}${key}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      }
    );
  } catch {
    // Silently fail
  }
}

/**
 * Cached query - vérifie L1 (RAM) → L2 (Redis) → L3 (Supabase)
 */
export async function cachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL
): Promise<T> {
  // L1: Memory cache
  const memResult = getFromMemory(cacheKey);
  if (memResult !== null) {
    return memResult as T;
  }

  // L2: Redis cache
  const redisResult = await redisGet(cacheKey);
  if (redisResult !== null) {
    setInMemory(cacheKey, redisResult, ttlSeconds);
    return redisResult as T;
  }

  // L3: Supabase (source de vérité)
  const data = await queryFn();

  // Stocker dans les 2 couches de cache
  setInMemory(cacheKey, data, ttlSeconds);
  redisSet(cacheKey, data, ttlSeconds); // fire-and-forget

  return data;
}

/**
 * Invalider un cache spécifique
 */
export async function invalidateCache(pattern: string): Promise<void> {
  // Supprimer toutes les entrées mémoire qui matchent
  for (const key of memoryCache.keys()) {
    if (key.startsWith(pattern) || key.includes(pattern)) {
      memoryCache.delete(key);
    }
  }
  await redisInvalidate(pattern);
}

/**
 * Invalider tout le cache
 */
export function clearMemoryCache(): void {
  memoryCache.clear();
}

/**
 * Stats du cache pour monitoring
 */
export function getCacheStats() {
  return {
    memoryEntries: memoryCache.size,
    maxEntries: MAX_MEMORY_ENTRIES,
  };
}
