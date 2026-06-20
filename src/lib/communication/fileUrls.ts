/**
 * 🔐 RÉSOLUTION SÉCURISÉE DES FICHIERS DE MESSAGERIE - 224SOLUTIONS
 *
 * Le bucket `communication-files` est PRIVÉ. Les pièces jointes (images, vidéos,
 * vocaux, documents) ne sont donc plus accessibles via une URL publique : il faut
 * générer une URL signée (à durée limitée) au moment de l'affichage.
 *
 * Ce module centralise :
 *  - l'extraction du chemin de stockage depuis une valeur stockée (chemin OU
 *    ancienne URL publique héritée),
 *  - la génération d'URL signées (avec petit cache mémoire),
 *  - le batch sur une liste de messages.
 */

import { supabase } from '@/integrations/supabase/client';

export const COMMUNICATION_BUCKET = 'communication-files';

// Durée de validité d'une URL signée (24 h) — re-signée à chaque chargement.
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

// Cache mémoire : chemin -> { url, expiresAt } pour éviter de re-signer en boucle.
const signedCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Extrait le chemin de stockage interne au bucket depuis une valeur stockée.
 * Gère 3 cas :
 *  - chemin déjà relatif au bucket : `communication/<conv>/<file>`
 *  - ancienne URL publique : `.../object/public/communication-files/<path>`
 *  - URL signée : `.../object/sign/communication-files/<path>?token=...`
 * Retourne `null` si ce n'est pas un fichier de ce bucket (ex. URL externe).
 */
export function extractStoragePath(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;

  // Déjà un chemin relatif (pas une URL http)
  if (!/^https?:\/\//i.test(v)) {
    return v.replace(/^\/+/, '');
  }

  // URL Supabase storage (public ou signed) -> extraire après le nom du bucket
  const marker = `/${COMMUNICATION_BUCKET}/`;
  const idx = v.indexOf(marker);
  if (idx === -1) return null; // URL externe (ex. fichier d'un autre bucket / lien web)

  let path = v.substring(idx + marker.length);
  // Retirer une éventuelle query string (?token=...) et la décoder
  path = path.split('?')[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    /* garder tel quel */
  }
  return path || null;
}

/**
 * Génère (ou récupère depuis le cache) une URL signée pour une valeur stockée.
 * Si la valeur n'appartient pas au bucket de messagerie, elle est renvoyée telle quelle.
 */
export async function resolveCommunicationFileUrl(value?: string | null): Promise<string | null> {
  if (!value) return null;
  const path = extractStoragePath(value);
  if (!path) return value; // URL externe : on laisse tel quel

  const cached = signedCache.get(path);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(COMMUNICATION_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.warn('[fileUrls] Échec signature URL:', path, error?.message);
    return value; // fallback : valeur d'origine
  }

  signedCache.set(path, {
    url: data.signedUrl,
    expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}

/**
 * Résout en lot les `file_url` d'une liste de messages (mutation immuable).
 * Renvoie une nouvelle liste où chaque message ayant un `file_url` voit
 * celui-ci remplacé par une URL signée fraîche.
 */
export async function signMessagesFileUrls<T extends { file_url?: string | null }>(
  messages: T[]
): Promise<T[]> {
  if (!messages?.length) return messages;
  return Promise.all(
    messages.map(async (msg) => {
      if (!msg.file_url) return msg;
      const signed = await resolveCommunicationFileUrl(msg.file_url);
      return signed && signed !== msg.file_url ? { ...msg, file_url: signed } : msg;
    })
  );
}
