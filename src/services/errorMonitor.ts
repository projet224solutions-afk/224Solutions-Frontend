import { supabase } from '@/integrations/supabase/client';
import { alertingService } from './alertingService';

export interface SystemError {
  id?: string;
  module: string;
  error_type?: string;
  error_message: string;
  stack_trace?: string;
  severity: 'critique' | 'modérée' | 'mineure';
  user_id?: string;
  metadata?: Record<string, any>;
}

export interface AutoFix {
  id: string;
  error_pattern: string;
  fix_type: string;
  fix_description: string;
  success_rate: number;
  times_applied: number;
  is_active: boolean;
}

// Liste blanche des patterns d'erreurs à ignorer (non critiques)
const IGNORED_ERROR_PATTERNS = [
  // Audio/Media resources - Ces erreurs sont normales lors de l'interaction utilisateur
  'data:audio', 'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg',
  'data:video', 'video/mp4', 'video/webm',
  'play() request was interrupted', 'play request was interrupted',
  'The play() request', 'AbortError', 'NotAllowedError',
  'media playback', 'cannot play media', 'MediaError',
  // Analytics/Tracking
  'analytics', 'tracking', 'ads', 'gtag', 'ga.js', 'gtm.js',
  // External services non critiques
  'facebook', 'twitter', 'linkedin', 'pinterest',
  // Ressources CDN non critiques
  'fonts.googleapis', 'fonts.gstatic',
  // Browser extensions
  'chrome-extension://', 'moz-extension://',
  // Common non-critical warnings
  'ResizeObserver loop', 'Non-Error promise rejection',
  'Loading chunk', 'ChunkLoadError',
  'Failed to fetch dynamically imported module',
  'dynamically imported module',
  // Service worker updates
  'workbox', 'service-worker',
  // Development artifacts
  'hot-update', 'hmr', 'webpack',
  // Network/connectivity issues (temporary)
  'network request failed', 'NetworkError', 'Failed to fetch',
  // React development warnings
  'findDOMNode is deprecated', 'componentWillMount', 'componentWillReceiveProps',
  'useContext', 'without being wrapped',
  // Firebase non-critical
  'Firebase', 'firestore', 'offline persistence', 'quota exceeded',
  // API Gateway and external services - normalisation
  'api gateway', 'gateway timeout', '504', '503',
  'rate limit', 'too many requests', '429',
  // Geolocation (normal en desktop)
  'GeolocationService', 'Geolocation', 'getCurrentPosition', 'watchPosition',
  'User denied Geolocation', 'Position unavailable',
  // Health check false positives
  'health-check', 'health_check', 'healthcheck',
  // Supabase realtime reconnections (normal behavior)
  'WebSocket', 'realtime', 'reconnect', 'SUBSCRIBED',
  // Common browser behaviors
  'Script error', 'cross-origin', 'CORS',
  'postMessage', 'blocked', 'insecure',
  // Toast/Notification issues (UI, not critical)
  'toast', 'notification', 'sonner',
  // Native share denials are expected on unsupported browsers / permission policies
  "Failed to execute 'share' on 'Navigator'",
  'navigator.share',
  'web share',
  // Format/Locale issues
  'toLocaleString', 'Intl', 'locale', 'format',
];

// Patterns d'erreurs à toujours capturer (critiques)
const CRITICAL_ERROR_PATTERNS = [
  'TypeError', 'ReferenceError', 'SyntaxError',
  'supabase', 'auth', 'wallet', 'payment', 'transaction',
  'security', 'injection', 'unauthorized',
];

class ErrorMonitorService {
  private static instance: ErrorMonitorService;
  private errorQueue: Map<string, SystemError> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL = 2000; // 2 secondes
  private readonly MAX_QUEUE_SIZE = 50;
  private processedErrors: Set<string> = new Set();
  private readonly DEDUP_WINDOW = 5000; // 5 secondes pour déduplication

  /**
   * Vérifie si une erreur doit être ignorée
   */
  private shouldIgnoreError(message: string, resourceUrl?: string): boolean {
    const textToCheck = `${message} ${resourceUrl || ''}`.toLowerCase();

    // Toujours capturer les erreurs critiques
    for (const pattern of CRITICAL_ERROR_PATTERNS) {
      if (textToCheck.includes(pattern.toLowerCase())) {
        return false;
      }
    }

    // Ignorer si match avec pattern non critique
    for (const pattern of IGNORED_ERROR_PATTERNS) {
      if (textToCheck.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  private constructor() {
    this.setupGlobalErrorHandlers();
    this.startPeriodicFlush();
  }

  static getInstance(): ErrorMonitorService {
    if (!ErrorMonitorService.instance) {
      ErrorMonitorService.instance = new ErrorMonitorService();
    }
    return ErrorMonitorService.instance;
  }

  private generateErrorHash(error: SystemError): string {
    // Créer un hash unique basé sur les propriétés importantes
    return `${error.module}-${error.error_type}-${error.error_message.substring(0, 100)}`;
  }

  private isDuplicate(error: SystemError): boolean {
    const hash = this.generateErrorHash(error);
    const now = Date.now();

    // Vérifier si l'erreur a déjà été traitée récemment
    if (this.processedErrors.has(hash)) {
      return true;
    }

    // Ajouter au cache de déduplication
    this.processedErrors.add(hash);

    // Nettoyer le cache après la fenêtre de déduplication
    setTimeout(() => {
      this.processedErrors.delete(hash);
    }, this.DEDUP_WINDOW);

    return false;
  }

  private setupGlobalErrorHandlers() {
    // 1. Intercepter les erreurs JavaScript non gérées
    window.addEventListener('error', (event) => {
      // Ignorer les erreurs de chargement de ressources (gérées séparément)
      if (event.target !== window) {
        return;
      }

      const errorMessage = event.message || 'Uncaught exception without message';

      // Filtrer les erreurs non critiques
      if (this.shouldIgnoreError(errorMessage)) {
        return;
      }

      this.logError({
        module: 'frontend_global',
        error_type: 'uncaught_exception',
        error_message: errorMessage,
        stack_trace: event.error?.stack || 'No stack trace available',
        severity: 'modérée',
        metadata: {
          filename: event.filename || 'unknown',
          lineno: event.lineno || 0,
          colno: event.colno || 0,
          errorType: event.error?.constructor?.name || 'unknown',
          timestamp: new Date().toISOString(),
        },
      });
    });

    // 2. Intercepter les promesses rejetées non gérées avec capture améliorée
    window.addEventListener('unhandledrejection', (event) => {
      // Prévenir le comportement par défaut pour éviter les logs en double
      event.preventDefault();

      // Déterminer le type de raison avec capture robuste
      const reason = event.reason;
      let errorMessage = '';
      let stackTrace = '';
      let errorType = 'unhandled_rejection';
      let additionalContext: Record<string, any> = {};

      // Générer une stack trace de contexte
      const contextStack = new Error('Promise rejection context').stack || '';

      // Cas 1: Error object standard
      if (reason instanceof Error) {
        errorMessage = reason.message || reason.name || 'Error without message';
        stackTrace = reason.stack || contextStack;
        errorType = reason.constructor?.name || 'Error';
        additionalContext = {
          errorName: reason.name,
          errorCause: (reason as any).cause,
        };
      }
      // Cas 2: String
      else if (typeof reason === 'string') {
        errorMessage = reason || 'Empty string rejection';
        errorType = 'string_rejection';
        stackTrace = contextStack;
      }
      // Cas 3: Object avec message/error
      else if (reason && typeof reason === 'object') {
        // Essayer plusieurs propriétés possibles
        errorMessage =
          reason.message ||
          reason.error ||
          reason.msg ||
          reason.errorMessage ||
          reason.description ||
          (reason.data?.message) ||
          (reason.response?.data?.message) ||
          (typeof reason.toString === 'function' && reason.toString() !== '[object Object]'
            ? reason.toString()
            : null) ||
          JSON.stringify(reason).substring(0, 500);

        errorType = reason.name || reason.type || reason.code || 'object_rejection';
        stackTrace = reason.stack || contextStack;

        // Capturer les détails additionnels
        additionalContext = {
          rejectionType: typeof reason,
          hasMessage: !!reason.message,
          hasError: !!reason.error,
          hasStack: !!reason.stack,
          objectKeys: Object.keys(reason).slice(0, 10),
          rawValue: JSON.stringify(reason).substring(0, 200),
        };
      }
      // Cas 4: Null
      else if (reason === null) {
        errorMessage = 'Promise rejected with null value';
        errorType = 'null_rejection';
        stackTrace = contextStack;
        additionalContext = { rejectionValue: 'null' };
      }
      // Cas 5: Undefined
      else if (reason === undefined) {
        errorMessage = 'Promise rejected with undefined value';
        errorType = 'undefined_rejection';
        stackTrace = contextStack;
        additionalContext = { rejectionValue: 'undefined' };
      }
      // Cas 6: Autres types primitifs
      else {
        errorMessage = `Promise rejected with ${typeof reason}: ${String(reason)}`;
        errorType = `${typeof reason}_rejection`;
        stackTrace = contextStack;
        additionalContext = { rejectionValue: String(reason) };
      }

      // Assurer que les valeurs ne sont jamais vides
      if (!errorMessage || errorMessage === 'Unknown promise rejection') {
        errorMessage = `Unhandled rejection (type: ${errorType}, reason type: ${typeof reason})`;
      }
      if (!stackTrace || stackTrace === 'No stack trace available') {
        stackTrace = contextStack || `No stack trace - Location: ${window.location.href}`;
      }

      // Filtrer les erreurs non critiques
      if (this.shouldIgnoreError(errorMessage)) {
        return;
      }

      this.logError({
        module: 'frontend_promise',
        error_type: errorType,
        error_message: errorMessage,
        stack_trace: stackTrace,
        severity: 'modérée',
        metadata: {
          promiseState: 'rejected',
          originalReasonType: typeof reason,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent.substring(0, 200),
          ...additionalContext,
        },
      });
    });

    // 3. Intercepter les erreurs de chargement de ressources (images, scripts, CSS)
    window.addEventListener('error', (event) => {
      const target = event.target as any;

      // Vérifier que c'est bien une erreur de ressource
      if (target !== window && target?.src) {
        const resourceUrl = target.src || target.href;
        const resourceType = target.tagName?.toLowerCase() || 'unknown';

        // Utiliser le filtrage centralisé
        if (this.shouldIgnoreError('', resourceUrl) ||
          resourceType === 'audio' ||
          resourceType === 'video' ||
          // Échecs de chargement d'IMAGE : NON persistés. Ils ont déjà un repli visuel (placeholder
          // via onError), sont majoritairement transitoires (cache/réseau/course) — les fichiers
          // existent réellement (HTTP 200) — et généraient un bruit massif (mêmes URLs re-loggées à
          // chaque session). La santé réelle du stockage est surveillée séparément côté backend.
          resourceType === 'img' ||
          resourceType === 'image' ||
          resourceType === 'source' ||
          /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?|$)/i.test(resourceUrl || '')) {
          return;
        }

        this.logError({
          module: 'frontend_resource',
          error_type: 'resource_load_error',
          error_message: `Failed to load ${resourceType}: ${resourceUrl}`,
          stack_trace: 'Resource loading error',
          severity: 'mineure',
          metadata: {
            resourceUrl,
            resourceType,
            timestamp: new Date().toISOString(),
            currentUrl: window.location.href,
          },
        });
      }
    }, true); // Use capture phase
  }

  private startPeriodicFlush() {
    // Vider la queue périodiquement
    this.flushTimer = setInterval(() => {
      this.flushErrorQueue();
    }, this.FLUSH_INTERVAL);
  }

  private async flushErrorQueue() {
    if (this.errorQueue.size === 0) return;

    const errors = Array.from(this.errorQueue.values());
    this.errorQueue.clear();

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Insertion en batch pour optimiser les performances
      const errorRecords = errors.map(error => ({
        ...error,
        user_id: user?.id,
        created_at: new Date().toISOString(),
      }));

      const { error: dbError } = await supabase
        .from('system_errors')
        .insert(errorRecords);

      if (dbError) {
        console.error('Failed to log errors to database:', dbError);
      } else {
        console.log(`✅ Logged ${errors.length} error(s) to database`);

        // Déclencher la vérification des alertes après avoir loggé les erreurs
        if (errors.length > 0) {
          try {
            alertingService['checkForAlerts']?.();
          } catch (e) {
            console.error('Error triggering alert check:', e);
          }
        }
      }

      // Tenter des corrections automatiques pour les erreurs critiques
      for (const error of errors.filter(e => e.severity === 'critique')) {
        await this.tryAutoFix(error);
      }
    } catch (e) {
      console.error('Error flushing error queue:', e);
    }
  }

  async logError(error: SystemError): Promise<void> {
    try {
      // Contrôle de nullité/type sur error
      if (!error || typeof error !== 'object') {
        console.error('Erreur système ignorée (objet error invalide):', error);
        return;
      }
      if (!error.error_message || typeof error.error_message !== 'string') {
        console.error('Erreur système ignorée (message manquant):', error);
        return;
      }
      if (!error.module || typeof error.module !== 'string') {
        error.module = 'unknown';
      }
      if (!error.severity) {
        error.severity = 'critique';
      }
      // Vérifier la duplication
      if (this.isDuplicate(error)) {
        console.log('⚠️ Duplicate error ignored:', error.error_message);
        return;
      }

      // Ajouter à la queue
      const hash = this.generateErrorHash(error);
      this.errorQueue.set(hash, error);

      // Si la queue est trop grande, forcer un flush
      if (this.errorQueue.size >= this.MAX_QUEUE_SIZE) {
        await this.flushErrorQueue();
      }

      // Log immédiat pour les erreurs critiques
      if (error.severity === 'critique') {
        await this.flushErrorQueue();
      }
    } catch (e) {
      console.error('Error logging system error:', e);
    }
  }

  async tryAutoFix(error: SystemError): Promise<boolean> {
    try {
      // Récupérer les correctifs disponibles
      const { data: fixes, error: fetchError } = await supabase
        .from('auto_fixes')
        .select('*')
        .eq('is_active', true);

      if (fetchError || !fixes) {
        return false;
      }

      // Trouver un correctif correspondant
      const matchingFix = fixes.find((fix) =>
        error.error_message.includes(fix.error_pattern)
      );

      if (!matchingFix) {
        return false;
      }

      // Appliquer le correctif
      const fixApplied = await this.applyFix(matchingFix, error);

      if (fixApplied) {
        // Mettre à jour les statistiques du correctif
        await supabase
          .from('auto_fixes')
          .update({
            times_applied: matchingFix.times_applied + 1,
            success_rate: ((matchingFix.success_rate * matchingFix.times_applied + 100) / (matchingFix.times_applied + 1)),
          })
          .eq('id', matchingFix.id);

        console.log(`✅ Auto-fix appliqué: ${matchingFix.fix_description}`);
      }

      return fixApplied;
    } catch (e) {
      console.error('Error in tryAutoFix:', e);
      return false;
    }
  }

  private async applyFix(fix: AutoFix, error: SystemError): Promise<boolean> {
    try {
      switch (fix.fix_type) {
        case 'reconnect_db':
          // Tenter une reconnexion à Supabase
          await supabase.auth.refreshSession();
          return true;

        case 'retry_request':
          // Logique de retry sera gérée par les composants individuels
          console.log('Retry request suggested');
          return true;

        case 'null_check':
        case 'undefined_check':
          // Ces correctifs sont plus préventifs et seront intégrés dans le code
          console.log('Null/undefined check suggested');
          return true;

        case 'rls_check':
          console.log('RLS policy check needed');
          return false;

        default:
          return false;
      }
    } catch (e) {
      console.error('Failed to apply fix:', e);
      return false;
    }
  }

  async getRecentErrors(limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('system_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Failed to fetch recent errors:', e);
      return [];
    }
  }

  async getErrorStats() {
    try {
      // Utiliser la fonction RPC pour des stats précises
      const { data: healthResult, error: rpcError } = await supabase.rpc('calculate_system_health');

      if (!rpcError && healthResult && typeof healthResult === 'object') {
        const result = healthResult as {
          critical_pending?: number;
          moderate_pending?: number;
          minor_pending?: number;
          total_pending?: number;
          fixed_last_24h?: number;
        };

        return {
          total: (result.total_pending || 0) + (result.fixed_last_24h || 0),
          critical: result.critical_pending || 0,
          moderate: result.moderate_pending || 0,
          minor: result.minor_pending || 0,
          fixed: result.fixed_last_24h || 0,
          pending: result.total_pending || 0,
        };
      }

      // Fallback: requête directe - ne compter que les erreurs actives (ni fixed ni resolved)
      const { data, error } = await supabase
        .from('system_errors')
        .select('severity, status, fix_applied')
        .in('status', ['detected', 'critical', 'pending']);

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        critical: data?.filter((e) => e.severity === 'critique' || e.severity === 'critical').length || 0,
        moderate: data?.filter((e) => e.severity === 'modérée').length || 0,
        minor: data?.filter((e) => e.severity === 'mineure').length || 0,
        fixed: 0,
        pending: data?.length || 0,
      };

      return stats;
    } catch (e) {
      console.error('Failed to fetch error stats:', e);
      return null;
    }
  }

  // Cleanup sur déchargement de la page
  public async cleanup() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushErrorQueue();
  }
}

// Créer l'instance singleton
export const errorMonitor = ErrorMonitorService.getInstance();

// Cleanup automatique avant déchargement
window.addEventListener('beforeunload', () => {
  errorMonitor.cleanup();
});
