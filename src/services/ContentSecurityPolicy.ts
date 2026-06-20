/**
 * CONTENT SECURITY POLICY SERVICE
 * 224Solutions - Protection XSS, injection, et ressources malveillantes
 */

/**
 * Configuration CSP stricte
 */
export const CSP_CONFIG = {
  // Directives principales
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'", // Nécessaire pour React
    "'unsafe-eval'", // Nécessaire pour certaines libs
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://maps.googleapis.com'
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Nécessaire pour styled-components
    'https://fonts.googleapis.com'
  ],
  imgSrc: [
    "'self'",
    'data:', // Pour images base64
    'blob:',
    'https:',
    'https://supabase.co',
    'https://*.supabase.co'
  ],
  fontSrc: [
    "'self'",
    'https://fonts.gstatic.com'
  ],
  connectSrc: [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://www.google-analytics.com'
  ],
  mediaSrc: [
    "'self'",
    'https://*.supabase.co',
    // Blocage data:audio/mpeg;base64 sauf si whitelisté
  ],
  objectSrc: ["'none'"],
  frameSrc: [
    "'self'",
    'https://maps.googleapis.com'
  ],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  upgradeInsecureRequests: []
};

/**
 * Types
 */
export interface CSPViolation {
  documentUri: string;
  violatedDirective: string;
  effectiveDirective: string;
  originalPolicy: string;
  blockedUri: string;
  statusCode: number;
  timestamp: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  threat?: 'xss' | 'injection' | 'malicious_resource' | 'unknown';
}

/**
 * Service de Content Security Policy
 */
class ContentSecurityPolicyService {
  private static instance: ContentSecurityPolicyService;
  private violations: CSPViolation[] = [];
  private whitelistedAudioSources: Set<string> = new Set();

  private constructor() {
    this.initializeCSP();
  }

  static getInstance(): ContentSecurityPolicyService {
    if (!ContentSecurityPolicyService.instance) {
      ContentSecurityPolicyService.instance = new ContentSecurityPolicyService();
    }
    return ContentSecurityPolicyService.instance;
  }

  /**
   * Initialiser CSP
   */
  private initializeCSP(): void {
    // Générer et appliquer CSP header
    const cspHeader = this.generateCSPHeader();

    // Écouter violations CSP
    if (typeof document !== 'undefined') {
      document.addEventListener('securitypolicyviolation', (e) => {
        this.handleCSPViolation(e as SecurityPolicyViolationEvent);
      });
    }

    // Whitelist sources audio par défaut
    this.whitelistedAudioSources.add('https://supabase.co');
    this.whitelistedAudioSources.add('self');

    console.log('✅ Content Security Policy initialisé');
    console.log('CSP Header:', cspHeader);
  }

  /**
   * Générer header CSP
   */
  private generateCSPHeader(): string {
    const directives: string[] = [];

    // Default src
    if (CSP_CONFIG.defaultSrc.length > 0) {
      directives.push(`default-src ${CSP_CONFIG.defaultSrc.join(' ')}`);
    }

    // Script src
    if (CSP_CONFIG.scriptSrc.length > 0) {
      directives.push(`script-src ${CSP_CONFIG.scriptSrc.join(' ')}`);
    }

    // Style src
    if (CSP_CONFIG.styleSrc.length > 0) {
      directives.push(`style-src ${CSP_CONFIG.styleSrc.join(' ')}`);
    }

    // Img src
    if (CSP_CONFIG.imgSrc.length > 0) {
      directives.push(`img-src ${CSP_CONFIG.imgSrc.join(' ')}`);
    }

    // Font src
    if (CSP_CONFIG.fontSrc.length > 0) {
      directives.push(`font-src ${CSP_CONFIG.fontSrc.join(' ')}`);
    }

    // Connect src
    if (CSP_CONFIG.connectSrc.length > 0) {
      directives.push(`connect-src ${CSP_CONFIG.connectSrc.join(' ')}`);
    }

    // Media src
    if (CSP_CONFIG.mediaSrc.length > 0) {
      directives.push(`media-src ${CSP_CONFIG.mediaSrc.join(' ')}`);
    }

    // Object src
    directives.push(`object-src ${CSP_CONFIG.objectSrc.join(' ')}`);

    // Frame src
    if (CSP_CONFIG.frameSrc.length > 0) {
      directives.push(`frame-src ${CSP_CONFIG.frameSrc.join(' ')}`);
    }

    // Base URI
    directives.push(`base-uri ${CSP_CONFIG.baseUri.join(' ')}`);

    // Form action
    directives.push(`form-action ${CSP_CONFIG.formAction.join(' ')}`);

    // Frame ancestors
    directives.push(`frame-ancestors ${CSP_CONFIG.frameAncestors.join(' ')}`);

    // Upgrade insecure requests
    if (CSP_CONFIG.upgradeInsecureRequests.length === 0) {
      directives.push('upgrade-insecure-requests');
    }

    return directives.join('; ');
  }

  /**
   * Gérer violation CSP
   */
  private handleCSPViolation(event: SecurityPolicyViolationEvent): void {
    const violation: CSPViolation = {
      documentUri: event.documentURI,
      violatedDirective: event.violatedDirective,
      effectiveDirective: event.effectiveDirective,
      originalPolicy: event.originalPolicy,
      blockedUri: event.blockedURI,
      statusCode: event.statusCode,
      timestamp: new Date().toISOString()
    };

    this.violations.push(violation);

    // Logger la violation
    console.warn('🚨 Violation CSP détectée:', violation);

    // Analyser si menace critique
    if (this.isCriticalViolation(violation)) {
      this.reportCriticalViolation(violation);
    }

    // Garder seulement les 100 dernières violations
    if (this.violations.length > 100) {
      this.violations = this.violations.slice(-100);
    }
  }

  /**
   * Vérifier si violation critique
   */
  private isCriticalViolation(violation: CSPViolation): boolean {
    // data:audio/mpeg;base64 est critique
    if (violation.blockedUri.includes('data:audio/mpeg;base64')) {
      return true;
    }

    // Script inline bloqué
    if (violation.effectiveDirective === 'script-src' &&
        violation.blockedUri === 'inline') {
      return true;
    }

    // eval() bloqué (possible injection)
    if (violation.blockedUri.includes('eval')) {
      return true;
    }

    return false;
  }

  /**
   * Reporter violation critique
   */
  private async reportCriticalViolation(violation: CSPViolation): Promise<void> {
    try {
      // Envoyer à monitoring service
      const { monitoringService } = await import('./MonitoringService');

      await monitoringService.logError(
        'critical',
        'csp_violation',
        `Violation CSP critique: ${violation.violatedDirective} - ${violation.blockedUri}`,
        violation
      );
    } catch (error) {
      console.error('Erreur report violation CSP:', error);
    }
  }

  /**
   * Valider data URI audio
   */
  validateAudioDataURI(dataUri: string): ValidationResult {
    // Bloquer data:audio/mpeg;base64 par défaut
    if (dataUri.startsWith('data:audio/mpeg;base64')) {
      return {
        valid: false,
        reason: 'data:audio/mpeg;base64 bloqué par CSP (injection potentielle)',
        threat: 'injection'
      };
    }

    // Vérifier autres data URIs audio
    if (dataUri.startsWith('data:audio/')) {
      // Extraire le type MIME
      const mimeMatch = dataUri.match(/^data:(audio\/[^;]+)/);
      if (!mimeMatch) {
        return {
          valid: false,
          reason: 'Type MIME audio invalide',
          threat: 'malicious_resource'
        };
      }

      // Types audio autorisés
      const allowedTypes = ['audio/wav', 'audio/ogg', 'audio/webm'];
      if (!allowedTypes.includes(mimeMatch[1])) {
        return {
          valid: false,
          reason: `Type audio non autorisé: ${mimeMatch[1]}`,
          threat: 'malicious_resource'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Valider URL ressource
   */
  validateResourceURL(url: string, type: 'script' | 'style' | 'media' | 'image'): ValidationResult {
    try {
      const parsedUrl = new URL(url);

      // Bloquer data: URIs sauf pour images
      if (parsedUrl.protocol === 'data:') {
        if (type === 'media') {
          return this.validateAudioDataURI(url);
        }
        if (type !== 'image') {
          return {
            valid: false,
            reason: `data: URI non autorisé pour type ${type}`,
            threat: 'injection'
          };
        }
      }

      // Vérifier whitelist selon type
      const whitelist = type === 'script' ? CSP_CONFIG.scriptSrc
                      : type === 'style' ? CSP_CONFIG.styleSrc
                      : type === 'media' ? CSP_CONFIG.mediaSrc
                      : CSP_CONFIG.imgSrc;

      const isWhitelisted = whitelist.some(source => {
        if (source === "'self'" && parsedUrl.origin === window.location.origin) {
          return true;
        }
        if (source.startsWith('https://') && url.startsWith(source)) {
          return true;
        }
        return false;
      });

      if (!isWhitelisted) {
        return {
          valid: false,
          reason: `URL non whitelistée pour type ${type}: ${parsedUrl.origin}`,
          threat: 'malicious_resource'
        };
      }

      return { valid: true };
    } catch (_error) {
      return {
        valid: false,
        reason: 'URL invalide',
        threat: 'unknown'
      };
    }
  }

  /**
   * Sanitizer HTML (protection XSS)
   */
  sanitizeHTML(html: string): string {
    // Créer un élément temporaire
    const temp = document.createElement('div');
    temp.textContent = html;

    // Retourner le texte échappé
    return temp.innerHTML;
  }

  /**
   * Valider et sanitizer input utilisateur
   */
  sanitizeUserInput(input: string, context: 'html' | 'url' | 'script' = 'html'): string {
    if (context === 'html') {
      return this.sanitizeHTML(input);
    }

    if (context === 'url') {
      try {
        const url = new URL(input);
        // Bloquer javascript: et data: URLs
        if (url.protocol === 'javascript:' || url.protocol === 'data:') {
          return '';
        }
        return url.href;
      } catch {
        return '';
      }
    }

    if (context === 'script') {
      // Bloquer complètement scripts utilisateurs
      return '';
    }

    return input;
  }

  /**
   * Whitelist source audio
   */
  whitelistAudioSource(source: string): void {
    this.whitelistedAudioSources.add(source);
  }

  /**
   * Vérifier si source audio whitelistée
   */
  isAudioSourceWhitelisted(source: string): boolean {
    return Array.from(this.whitelistedAudioSources).some(
      whitelisted => source.startsWith(whitelisted)
    );
  }

  /**
   * Obtenir violations récentes
   */
  getRecentViolations(limit: number = 20): CSPViolation[] {
    return this.violations.slice(-limit);
  }

  /**
   * Obtenir violations critiques
   */
  getCriticalViolations(): CSPViolation[] {
    return this.violations.filter(v => this.isCriticalViolation(v));
  }

  /**
   * Nettoyer violations
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Obtenir header CSP
   */
  getCSPHeader(): string {
    return this.generateCSPHeader();
  }
}

// Instance singleton
export const cspService = ContentSecurityPolicyService.getInstance();

// Export pour utilisation externe
export default cspService;
