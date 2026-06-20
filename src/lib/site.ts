// Site/public URL helpers
// Objectif: générer des liens de partage stables sur le domaine public.

export const PUBLIC_BASE_URL = "https://224solution.net";

export function getPublicBaseUrl(): string {
  if (typeof window === "undefined") return PUBLIC_BASE_URL;

  const host = window.location.hostname;
  // Si l'app tourne déjà sur le domaine public (ou sous-domaine), on garde l'origin actuel
  if (host === "224solution.net" || host.endsWith(".224solution.net")) {
    return window.location.origin;
  }

  return PUBLIC_BASE_URL;
}

export function stripLovableParams(inputUrl: URL): URL {
  for (const key of Array.from(inputUrl.searchParams.keys())) {
    if (key.startsWith("__lovable")) inputUrl.searchParams.delete(key);
  }
  return inputUrl;
}

export function toPublicShareUrl(rawUrl: string): string {
  try {
    const u = stripLovableParams(new URL(rawUrl, window.location.origin));
    const base = getPublicBaseUrl();
    return `${base}${u.pathname}${u.search}${u.hash}`;
  } catch {
    // Si on reçoit déjà un chemin relatif
    if (rawUrl.startsWith("/")) return `${getPublicBaseUrl()}${rawUrl}`;
    return rawUrl;
  }
}
