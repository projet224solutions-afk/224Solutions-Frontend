/**
 * 🔗 SHORT LINK SERVICE
 * Appels serveur pour créer et résoudre les short links.
 * Remplace les accès client directs à la table shared_links.
 */

import { supabase } from '@/integrations/supabase/client';
import { getPublicBaseUrl, stripLovableParams } from '@/lib/site';

const PUBLIC_DOMAIN = 'https://224solution.net';

// ─── CRÉATION ───────────────────────────────────────────

export interface CreateShortLinkParams {
  originalUrl: string;
  title: string;
  type: 'shop' | 'product' | 'service' | 'digital_product' | 'other';
  resourceId?: string;
  imageUrl?: string;
  description?: string;
  price?: number;
  currency?: string;
}

/**
 * Crée un short link via l'Edge Function serveur.
 * Retourne l'URL publique courte (ex: https://224solution.net/s/AbCdEfGh)
 */
export async function createShortLink(params: CreateShortLinkParams): Promise<string | null> {
  try {
    // Nettoyer l'URL avant envoi
    let cleanedUrl = params.originalUrl;
    try {
      const u = stripLovableParams(new URL(cleanedUrl, window.location.origin));
      const base = getPublicBaseUrl();
      cleanedUrl = `${base}${u.pathname}${u.search}${u.hash}`;
    } catch {
      if (cleanedUrl.startsWith('/')) {
        cleanedUrl = `${getPublicBaseUrl()}${cleanedUrl}`;
      }
    }

    console.log('🔗 [ShortLinkService] Creating short link for:', cleanedUrl);

    const { data, error } = await supabase.functions.invoke('create-short-link', {
      body: {
        originalUrl: cleanedUrl,
        title: params.title,
        type: params.type,
        resourceId: params.resourceId || null,
        imageUrl: params.imageUrl,
        description: params.description,
        price: params.price,
        currency: params.currency,
      },
    });

    if (error) {
      console.error('🔗 [ShortLinkService] Edge Function error:', error);
      return null;
    }

    if (data?.shortCode) {
      const shortUrl = `${PUBLIC_DOMAIN}/s/${data.shortCode}`;
      console.log('🔗 [ShortLinkService] Created:', shortUrl);
      return shortUrl;
    }

    console.error('🔗 [ShortLinkService] No shortCode in response:', data);
    return null;
  } catch (err) {
    console.error('🔗 [ShortLinkService] Unexpected error:', err);
    return null;
  }
}

// ─── RÉSOLUTION ─────────────────────────────────────────

export interface ResolvedLink {
  originalUrl: string;
  title: string;
  linkType: string;
  metadata: Record<string, unknown> | null;
}

/**
 * Résout un short code via l'Edge Function serveur.
 * Bypass complet de RLS — fonctionne toujours.
 */
export async function resolveShortLink(shortCode: string): Promise<ResolvedLink | null> {
  try {
    console.log('🔗 [ShortLinkService] Resolving:', shortCode);

    const { data, error } = await supabase.functions.invoke('resolve-short-link', {
      body: { code: shortCode },
    });

    if (error) {
      console.error('🔗 [ShortLinkService] Resolve error:', error);
      return null;
    }

    if (data?.originalUrl) {
      console.log('🔗 [ShortLinkService] Resolved:', data.originalUrl);
      return data as ResolvedLink;
    }

    console.warn('🔗 [ShortLinkService] Not found:', shortCode);
    return null;
  } catch (err) {
    console.error('🔗 [ShortLinkService] Resolve unexpected error:', err);
    return null;
  }
}

/**
 * Extrait le chemin relatif d'une URL originale pour la navigation React Router.
 */
export function extractTargetPath(originalUrl: string): string {
  try {
    const url = new URL(originalUrl);
    // Strip lovable params
    for (const key of Array.from(url.searchParams.keys())) {
      if (key.startsWith('__lovable')) url.searchParams.delete(key);
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return originalUrl.startsWith('/') ? originalUrl : `/${originalUrl}`;
  }
}
