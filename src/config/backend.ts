/**
 * 🔗 BACKEND CONFIGURATION
 * URL du backend Node.js (Auth Gateway) déployé sur AWS Lambda
 */

import { getPrimaryRegion } from './regions';

const DEFAULT_PUBLIC_BACKEND_URL = getPrimaryRegion().endpoints.api;

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function isLoopbackHttpUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);
}

function isPublic224Host(hostname: string): boolean {
  return /(^|\.)224solution\.net$/i.test(hostname);
}

function isVercelPreviewHost(hostname: string): boolean {
  return /(^|\.)vercel\.app$/i.test(hostname);
}

function resolveBackendBaseUrl(): string {
  // 1. Mobile-specific URL takes highest priority (Capacitor/native context)
  const mobileUrl = import.meta.env.VITE_BACKEND_MOBILE_URL?.trim();
  if (mobileUrl) {
    return normalizeUrl(mobileUrl);
  }

  const configuredUrl = (
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_BACKEND_API_URL ||
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL
  )?.trim();

  // In local dev, prefer Vite proxy for localhost backends to avoid CORS issues
  // when the dev server port changes (e.g. 8080 -> 8081).
  if (
    import.meta.env.DEV &&
    configuredUrl &&
    isLoopbackHttpUrl(configuredUrl)
  ) {
    return '';
  }

  if (configuredUrl) {
    // Prevent accidental production builds pointing to localhost.
    if (
      !import.meta.env.DEV &&
      isLoopbackHttpUrl(configuredUrl) &&
      typeof window !== 'undefined' &&
      !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
    ) {
      console.warn('[backendConfig] URL backend locale ignorée en production; fallback API publique', {
        configuredUrl,
        fallback: DEFAULT_PUBLIC_BACKEND_URL,
      });
      return normalizeUrl(DEFAULT_PUBLIC_BACKEND_URL);
    }

    return normalizeUrl(configuredUrl);
  }

  if (import.meta.env.DEV) {
    // Keep relative paths in dev to support Vite proxy and LAN/mobile testing.
    return '';
  }

  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    const hostname = window.location.hostname;

    // Native WebViews (Capacitor iOS: capacitor://localhost, Android: http://localhost)
    // must never call the local WebView origin as the API base.
    if (/^capacitor:\/\//i.test(origin) || /^ionic:\/\//i.test(origin)) {
      return normalizeUrl(DEFAULT_PUBLIC_BACKEND_URL);
    }
    if (/^http:\/\/localhost(:\d+)?$/i.test(origin) && !import.meta.env.DEV) {
      return normalizeUrl(DEFAULT_PUBLIC_BACKEND_URL);
    }

    // Public web deployment: prefer the dedicated API host instead of the SPA origin.
    if (isPublic224Host(hostname) || isVercelPreviewHost(hostname)) {
      return normalizeUrl(DEFAULT_PUBLIC_BACKEND_URL);
    }

    // Standard HTTPS origin (custom deployments with same-origin API) — use relative API calls.
    if (/^https?:\/\//i.test(origin)) {
      return normalizeUrl(origin);
    }
  }

  return normalizeUrl(DEFAULT_PUBLIC_BACKEND_URL);
}

export const backendConfig = {
  baseUrl: resolveBackendBaseUrl(),
  publicBaseUrl: normalizeUrl(DEFAULT_PUBLIC_BACKEND_URL),
};

export function resolveBackendUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return backendConfig.baseUrl
    ? `${backendConfig.baseUrl}${normalizedPath}`
    : normalizedPath;
}
