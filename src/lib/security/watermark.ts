/**
 * Système de Watermarking pour Vista-Flows
 * 224Solutions - Propriétaire et confidentiel
 *
 * Ce module intègre des marqueurs uniques dans chaque build pour:
 * - Identifier les fuites de code
 * - Tracer l'origine des copies non autorisées
 * - Vérifier l'intégrité de l'application
 */

// Informations de build injectées lors du build
declare const __BUILD_ID__: string | undefined;
declare const __BUILD_DATE__: string | undefined;
declare const __BUILD_ENV__: string | undefined;

/**
 * Watermark invisible intégré dans l'application
 */
export interface BuildWatermark {
  buildId: string;
  buildDate: string;
  environment: string;
  signature: string;
  company: string;
  product: string;
}

/**
 * Génère un ID de build unique
 */
function generateBuildId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `VF-${timestamp}-${random}`.toUpperCase();
}

/**
 * Génère une signature de vérification
 */
function generateSignature(buildId: string, buildDate: string): string {
  // Simple hash pour vérification (en production, utiliser une vraie signature cryptographique)
  const data = `224Solutions:Vista-Flows:${buildId}:${buildDate}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).toUpperCase();
}

/**
 * Watermark de l'application
 */
export const APP_WATERMARK: BuildWatermark = {
  buildId: typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : generateBuildId(),
  buildDate: typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date().toISOString(),
  environment: typeof __BUILD_ENV__ !== 'undefined' ? __BUILD_ENV__ : 'development',
  signature: '',
  company: '224Solutions',
  product: 'Vista-Flows'
};

// Générer la signature
APP_WATERMARK.signature = generateSignature(APP_WATERMARK.buildId, APP_WATERMARK.buildDate);

/**
 * Intègre le watermark dans le DOM de manière invisible
 */
export function embedWatermarkInDOM(): void {
  const embed = () => {
    // Watermark dans un commentaire HTML
    if (document.head) {
      const comment = document.createComment(
        ` 224Solutions Vista-Flows | Build: ${APP_WATERMARK.buildId} | ${APP_WATERMARK.buildDate} `
      );
      document.head.appendChild(comment);

      // Watermark dans les métadonnées
      const meta = document.createElement('meta');
      meta.name = 'x-build-id';
      meta.content = APP_WATERMARK.buildId;
      document.head.appendChild(meta);
    }

    // Watermark dans un élément caché (nécessite body)
    if (document.body) {
      const hiddenElement = document.createElement('div');
      hiddenElement.id = '_vf_' + APP_WATERMARK.signature.toLowerCase();
      hiddenElement.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);';
      hiddenElement.setAttribute('data-vf-id', APP_WATERMARK.buildId);
      document.body.appendChild(hiddenElement);
    }
  };

  // Si le DOM est déjà prêt, exécuter immédiatement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', embed);
  } else {
    embed();
  }
}

/**
 * Intègre le watermark dans les requêtes API
 */
export function getWatermarkHeaders(): Record<string, string> {
  return {
    'X-VF-Build': APP_WATERMARK.buildId,
    'X-VF-Signature': APP_WATERMARK.signature
  };
}

/**
 * Vérifie l'intégrité du watermark
 */
export function verifyWatermark(): boolean {
  const expectedSignature = generateSignature(APP_WATERMARK.buildId, APP_WATERMARK.buildDate);
  return APP_WATERMARK.signature === expectedSignature;
}

/**
 * Obtient les informations de watermark pour le logging
 */
export function getWatermarkInfo(): string {
  return `[Build: ${APP_WATERMARK.buildId}] [Date: ${APP_WATERMARK.buildDate}] [Env: ${APP_WATERMARK.environment}]`;
}

/**
 * Watermark invisible dans le code source
 * Cette chaîne sera présente dans le code minifié et peut être recherchée
 */
export const INVISIBLE_WATERMARK = '\u200B\u200C\u200D\uFEFF224Solutions\u200B\u200C\u200D\uFEFFVista-Flows\u200B\u200C\u200D\uFEFF';

/**
 * Encode un message dans des caractères Unicode invisibles
 */
export function encodeInvisibleWatermark(message: string): string {
  const binary = message.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join('');
  return binary.split('').map(bit => bit === '0' ? '\u200B' : '\u200C').join('');
}

/**
 * Décode un watermark invisible
 */
export function decodeInvisibleWatermark(encoded: string): string {
  const binary = encoded.split('').map(char => char === '\u200B' ? '0' : char === '\u200C' ? '1' : '').join('');
  const chars = binary.match(/.{8}/g) || [];
  return chars.map(byte => String.fromCharCode(parseInt(byte, 2))).join('');
}

/**
 * Fingerprint de l'application
 * Utilisé pour identifier de manière unique cette instance de l'application
 */
export function getAppFingerprint(): string {
  const components = [
    APP_WATERMARK.buildId,
    APP_WATERMARK.company,
    APP_WATERMARK.product,
    navigator.userAgent,
    window.screen.width,
    window.screen.height,
    new Date().getTimezoneOffset()
  ];

  let fingerprint = '';
  for (const component of components) {
    const str = String(component);
    for (let i = 0; i < str.length; i++) {
      fingerprint += str.charCodeAt(i).toString(16);
    }
  }

  return fingerprint.substring(0, 64);
}

export default {
  APP_WATERMARK,
  embedWatermarkInDOM,
  getWatermarkHeaders,
  verifyWatermark,
  getWatermarkInfo,
  getAppFingerprint,
  INVISIBLE_WATERMARK
};
