/**
 * WAAP - Web Application and API Protection Service
 * Protection anti-bots, détection d'anomalies, rate limiting avancé
 */

import { supabase } from '@/integrations/supabase/client';

// ============== TYPES ==============

export interface ThreatScore {
  score: number; // 0-100, 100 = très suspect
  factors: ThreatFactor[];
  recommendation: 'allow' | 'challenge' | 'block';
  confidence: number;
}

export interface ThreatFactor {
  name: string;
  weight: number;
  detected: boolean;
  details?: string;
}

export interface BotSignature {
  fingerprint: string;
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookiesEnabled: boolean;
  webGLRenderer: string;
  canvasFingerprint: string;
  audioFingerprint: string;
  fonts: string[];
  plugins: string[];
  touchSupport: boolean;
  hardwareConcurrency: number;
  deviceMemory: number;
}

export interface BehaviorPattern {
  mouseMovements: number;
  keystrokes: number;
  scrollEvents: number;
  clickPatterns: ClickPattern[];
  sessionDuration: number;
  pageViews: number;
  requestFrequency: number;
  formInteractionTime: number;
}

export interface ClickPattern {
  x: number;
  y: number;
  timestamp: number;
  element: string;
}

export interface APIAnomaly {
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  endpoint: string;
  details: Record<string, any>;
  timestamp: Date;
  userId?: string;
  ip?: string;
}

type AnomalyType =
  | 'rate_spike'
  | 'unusual_pattern'
  | 'sql_injection'
  | 'xss_attempt'
  | 'credential_stuffing'
  | 'scraping'
  | 'api_abuse'
  | 'geographic_anomaly'
  | 'time_anomaly'
  | 'payload_anomaly';

export interface SecurityIncident {
  id: string;
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  details: Record<string, any>;
  status: 'detected' | 'investigating' | 'blocked' | 'resolved';
  createdAt: Date;
  resolvedAt?: Date;
  actionTaken?: string;
}

export interface BlockedEntity {
  identifier: string;
  type: 'ip' | 'user' | 'fingerprint';
  reason: string;
  blockedAt: Date;
  expiresAt?: Date;
  permanent: boolean;
}

// ============== WAAP SERVICE ==============

class WAAPService {
  private behaviorData: Map<string, BehaviorPattern> = new Map();
  private blockedEntities: Map<string, BlockedEntity> = new Map();
  private requestHistory: Map<string, number[]> = new Map();
  private anomalyThreshold = 70; // Score au-dessus duquel on bloque
  private challengeThreshold = 50; // Score au-dessus duquel on demande un challenge

  // ============== BOT DETECTION ==============

  /**
   * Génère une signature unique du navigateur/appareil
   */
  async generateBotSignature(): Promise<BotSignature> {
    const canvas = this.getCanvasFingerprint();
    const webGL = this.getWebGLRenderer();

    return {
      fingerprint: await this.generateFingerprint(),
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      cookiesEnabled: navigator.cookieEnabled,
      webGLRenderer: webGL,
      canvasFingerprint: canvas,
      audioFingerprint: await this.getAudioFingerprint(),
      fonts: await this.detectFonts(),
      plugins: this.getPlugins(),
      touchSupport: 'ontouchstart' in window,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      deviceMemory: (navigator as any).deviceMemory || 0,
    };
  }

  /**
   * Analyse une signature pour détecter un bot
   */
  analyzeBotSignature(signature: BotSignature): ThreatScore {
    const factors: ThreatFactor[] = [];
    let totalScore = 0;

    // User-Agent suspect
    const botUserAgents = ['bot', 'crawler', 'spider', 'scraper', 'headless', 'phantom', 'selenium', 'puppeteer'];
    const isKnownBot = botUserAgents.some(ua => signature.userAgent.toLowerCase().includes(ua));
    factors.push({
      name: 'known_bot_ua',
      weight: 30,
      detected: isKnownBot,
      details: isKnownBot ? 'User-Agent de bot connu détecté' : undefined
    });
    if (isKnownBot) totalScore += 30;

    // Headless browser detection
    const isHeadless = !signature.webGLRenderer ||
      signature.webGLRenderer.includes('SwiftShader') ||
      signature.plugins.length === 0;
    factors.push({
      name: 'headless_browser',
      weight: 25,
      detected: isHeadless,
      details: isHeadless ? 'Navigateur headless suspecté' : undefined
    });
    if (isHeadless) totalScore += 25;

    // WebDriver detection
    const hasWebDriver = (navigator as any).webdriver === true;
    factors.push({
      name: 'webdriver',
      weight: 40,
      detected: hasWebDriver,
      details: hasWebDriver ? 'WebDriver détecté' : undefined
    });
    if (hasWebDriver) totalScore += 40;

    // Résolution d'écran inhabituelle
    const unusualResolution = signature.screenResolution === '0x0' ||
      signature.screenResolution === '800x600';
    factors.push({
      name: 'unusual_resolution',
      weight: 10,
      detected: unusualResolution,
      details: unusualResolution ? `Résolution inhabituelle: ${signature.screenResolution}` : undefined
    });
    if (unusualResolution) totalScore += 10;

    // Pas de support tactile sur mobile
    const mobileUA = /mobile|android|iphone|ipad/i.test(signature.userAgent);
    const noTouchOnMobile = mobileUA && !signature.touchSupport;
    factors.push({
      name: 'touch_mismatch',
      weight: 15,
      detected: noTouchOnMobile,
      details: noTouchOnMobile ? 'Appareil mobile sans support tactile' : undefined
    });
    if (noTouchOnMobile) totalScore += 15;

    // Timezone suspect
    const suspiciousTimezone = !signature.timezone || signature.timezone === 'UTC';
    factors.push({
      name: 'suspicious_timezone',
      weight: 5,
      detected: suspiciousTimezone,
      details: suspiciousTimezone ? 'Timezone UTC/vide suspecté' : undefined
    });
    if (suspiciousTimezone) totalScore += 5;

    // Hardware concurrency = 0 (rare sur vrais appareils)
    const noHardware = signature.hardwareConcurrency === 0;
    factors.push({
      name: 'no_hardware_info',
      weight: 10,
      detected: noHardware,
      details: noHardware ? 'Informations hardware manquantes' : undefined
    });
    if (noHardware) totalScore += 10;

    const recommendation = totalScore >= this.anomalyThreshold
      ? 'block'
      : totalScore >= this.challengeThreshold
        ? 'challenge'
        : 'allow';

    return {
      score: Math.min(100, totalScore),
      factors,
      recommendation,
      confidence: this.calculateConfidence(factors)
    };
  }

  // ============== BEHAVIORAL ANALYSIS ==============

  /**
   * Enregistre une interaction utilisateur
   */
  recordInteraction(
    sessionId: string,
    type: 'mouse' | 'keyboard' | 'scroll' | 'click',
    details?: Partial<ClickPattern>
  ): void {
    let pattern = this.behaviorData.get(sessionId);

    if (!pattern) {
      pattern = {
        mouseMovements: 0,
        keystrokes: 0,
        scrollEvents: 0,
        clickPatterns: [],
        sessionDuration: 0,
        pageViews: 1,
        requestFrequency: 0,
        formInteractionTime: 0
      };
    }

    switch (type) {
      case 'mouse':
        pattern.mouseMovements++;
        break;
      case 'keyboard':
        pattern.keystrokes++;
        break;
      case 'scroll':
        pattern.scrollEvents++;
        break;
      case 'click':
        if (details) {
          pattern.clickPatterns.push({
            x: details.x || 0,
            y: details.y || 0,
            timestamp: details.timestamp || Date.now(),
            element: details.element || 'unknown'
          });
        }
        break;
    }

    this.behaviorData.set(sessionId, pattern);
  }

  /**
   * Analyse le comportement d'une session
   */
  analyzeBehavior(sessionId: string): ThreatScore {
    const pattern = this.behaviorData.get(sessionId);
    const factors: ThreatFactor[] = [];
    let totalScore = 0;

    if (!pattern) {
      return {
        score: 50, // Score moyen par défaut
        factors: [{ name: 'no_data', weight: 50, detected: true, details: 'Aucune donnée comportementale' }],
        recommendation: 'challenge',
        confidence: 0.5
      };
    }

    // Pas de mouvement de souris (suspect sur desktop)
    const noMouse = pattern.mouseMovements < 5;
    factors.push({
      name: 'no_mouse_movement',
      weight: 20,
      detected: noMouse,
      details: noMouse ? 'Très peu de mouvements de souris' : undefined
    });
    if (noMouse) totalScore += 20;

    // Pas de scroll (suspect pour sessions longues)
    const noScroll = pattern.scrollEvents === 0 && pattern.pageViews > 2;
    factors.push({
      name: 'no_scroll',
      weight: 15,
      detected: noScroll,
      details: noScroll ? 'Aucun scroll sur plusieurs pages' : undefined
    });
    if (noScroll) totalScore += 15;

    // Clicks trop réguliers (pattern robotique)
    const roboticClicks = this.detectRoboticClicks(pattern.clickPatterns);
    factors.push({
      name: 'robotic_clicks',
      weight: 30,
      detected: roboticClicks,
      details: roboticClicks ? 'Pattern de clics robotique détecté' : undefined
    });
    if (roboticClicks) totalScore += 30;

    // Vitesse de frappe anormale
    const abnormalTyping = pattern.keystrokes > 1000 && pattern.sessionDuration < 60000;
    factors.push({
      name: 'abnormal_typing',
      weight: 25,
      detected: abnormalTyping,
      details: abnormalTyping ? 'Vitesse de frappe anormalement élevée' : undefined
    });
    if (abnormalTyping) totalScore += 25;

    // Requêtes trop fréquentes
    const highFrequency = pattern.requestFrequency > 10; // > 10 req/sec
    factors.push({
      name: 'high_request_frequency',
      weight: 20,
      detected: highFrequency,
      details: highFrequency ? `Fréquence de requêtes: ${pattern.requestFrequency}/s` : undefined
    });
    if (highFrequency) totalScore += 20;

    const recommendation = totalScore >= this.anomalyThreshold
      ? 'block'
      : totalScore >= this.challengeThreshold
        ? 'challenge'
        : 'allow';

    return {
      score: Math.min(100, totalScore),
      factors,
      recommendation,
      confidence: this.calculateConfidence(factors)
    };
  }

  // ============== API ANOMALY DETECTION ==============

  /**
   * Analyse une requête API pour détecter des anomalies
   */
  analyzeAPIRequest(
    endpoint: string,
    method: string,
    payload: any,
    headers: Record<string, string>,
    userId?: string,
    ip?: string
  ): APIAnomaly[] {
    const anomalies: APIAnomaly[] = [];

    // SQL Injection detection
    const sqlPatterns = /('|"|;|--|\bOR\b|\bAND\b|\bUNION\b|\bSELECT\b|\bINSERT\b|\bDROP\b|\bDELETE\b)/gi;
    const payloadStr = JSON.stringify(payload);
    if (sqlPatterns.test(payloadStr)) {
      anomalies.push({
        type: 'sql_injection',
        severity: 'critical',
        endpoint,
        details: { pattern: 'SQL injection pattern detected', payload: payloadStr.substring(0, 200) },
        timestamp: new Date(),
        userId,
        ip
      });
    }

    // XSS detection
    const xssPatterns = /<script|javascript:|on\w+\s*=|<iframe|<object|<embed|<svg\s+on/gi;
    if (xssPatterns.test(payloadStr)) {
      anomalies.push({
        type: 'xss_attempt',
        severity: 'high',
        endpoint,
        details: { pattern: 'XSS pattern detected', payload: payloadStr.substring(0, 200) },
        timestamp: new Date(),
        userId,
        ip
      });
    }

    // Rate spike detection
    const identifier = userId || ip || 'anonymous';
    const rateAnomaly = this.detectRateSpike(identifier, endpoint);
    if (rateAnomaly) {
      anomalies.push(rateAnomaly);
    }

    // Payload size anomaly
    const payloadSize = new Blob([payloadStr]).size;
    if (payloadSize > 1024 * 1024) { // > 1MB
      anomalies.push({
        type: 'payload_anomaly',
        severity: 'medium',
        endpoint,
        details: { size: payloadSize, maxExpected: 1024 * 1024 },
        timestamp: new Date(),
        userId,
        ip
      });
    }

    // Geographic anomaly (si on a des données de localisation)
    // Time-based anomaly (requêtes à des heures inhabituelles)
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 5) { // Entre 2h et 5h du matin
      // Note: ceci est un exemple simple, en production on comparerait avec les habitudes
      anomalies.push({
        type: 'time_anomaly',
        severity: 'low',
        endpoint,
        details: { hour, note: 'Activité à heure inhabituelle' },
        timestamp: new Date(),
        userId,
        ip
      });
    }

    return anomalies;
  }

  // ============== BLOCKING & INCIDENTS ==============

  /**
   * Bloque une entité (IP, utilisateur, fingerprint)
   */
  async blockEntity(
    identifier: string,
    type: 'ip' | 'user' | 'fingerprint',
    reason: string,
    permanent: boolean = true,
    durationMs?: number
  ): Promise<void> {
    const blockedEntity: BlockedEntity = {
      identifier,
      type,
      reason,
      blockedAt: new Date(),
      expiresAt: permanent ? undefined : new Date(Date.now() + (durationMs || 86400000)),
      permanent
    };

    this.blockedEntities.set(`${type}:${identifier}`, blockedEntity);

    // Persister en base
    try {
      await supabase.from('blocked_entities' as any).insert({
        identifier,
        type,
        reason,
        blocked_at: blockedEntity.blockedAt.toISOString(),
        expires_at: blockedEntity.expiresAt?.toISOString(),
        permanent
      });
    } catch (error) {
      console.error('[WAAP] Erreur blocage entité:', error);
    }

    // Log de sécurité
    await this.logSecurityIncident({
      type: 'api_abuse',
      severity: 'high',
      source: identifier,
      details: { type, reason, permanent },
      status: 'blocked',
      createdAt: new Date(),
      id: crypto.randomUUID(),
      actionTaken: permanent ? 'Blocage permanent' : `Blocage temporaire ${durationMs}ms`
    });
  }

  /**
   * Vérifie si une entité est bloquée
   */
  isBlocked(identifier: string, type: 'ip' | 'user' | 'fingerprint'): boolean {
    const key = `${type}:${identifier}`;
    const entity = this.blockedEntities.get(key);

    if (!entity) return false;

    // Vérifier expiration
    if (!entity.permanent && entity.expiresAt && new Date() > entity.expiresAt) {
      this.blockedEntities.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Débloque une entité
   */
  async unblockEntity(identifier: string, type: 'ip' | 'user' | 'fingerprint'): Promise<void> {
    const key = `${type}:${identifier}`;
    this.blockedEntities.delete(key);

    try {
      await supabase
        .from('blocked_entities' as any)
        .update({ unblocked_at: new Date().toISOString() })
        .eq('identifier', identifier)
        .eq('type', type);
    } catch (error) {
      console.error('[WAAP] Erreur déblocage:', error);
    }
  }

  /**
   * Log un incident de sécurité
   */
  async logSecurityIncident(incident: SecurityIncident): Promise<void> {
    console.warn('[WAAP] 🚨 Incident de sécurité:', incident);

    try {
      await supabase.from('security_incidents' as any).insert({
        id: incident.id,
        type: incident.type,
        severity: incident.severity,
        source: incident.source,
        details: incident.details,
        status: incident.status,
        created_at: incident.createdAt.toISOString(),
        action_taken: incident.actionTaken
      });
    } catch (error) {
      console.error('[WAAP] Erreur log incident:', error);
    }

    // Notification admin si critique
    if (incident.severity === 'critical') {
      await this.notifyAdmins(incident);
    }
  }

  // ============== HONEYPOT ==============

  /**
   * Génère des champs honeypot pour les formulaires
   */
  generateHoneypotFields(): { fieldName: string; cssClass: string }[] {
    const fields = [
      { fieldName: 'website_url', cssClass: 'hp-field-1' },
      { fieldName: 'phone_confirm', cssClass: 'hp-field-2' },
      { fieldName: 'email_verify', cssClass: 'hp-field-3' },
    ];

    return fields;
  }

  /**
   * Vérifie si un honeypot a été rempli (= bot)
   */
  checkHoneypot(formData: Record<string, any>): boolean {
    const honeypotFields = ['website_url', 'phone_confirm', 'email_verify', 'fax', 'company_website'];

    for (const field of honeypotFields) {
      if (formData[field] && formData[field].toString().trim() !== '') {
        return true; // Bot détecté
      }
    }

    return false;
  }

  // ============== CAPTCHA INTEGRATION ==============

  /**
   * Détermine si un CAPTCHA est nécessaire
   */
  shouldShowCaptcha(sessionId: string): boolean {
    const botScore = this.analyzeBehavior(sessionId);
    return botScore.recommendation === 'challenge';
  }

  // ============== HELPER METHODS ==============

  private async generateFingerprint(): Promise<string> {
    const components = [
      navigator.userAgent,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.language,
      navigator.platform,
      navigator.hardwareConcurrency,
    ];

    const data = components.join('|');
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private getCanvasFingerprint(): string {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      ctx.textBaseline = 'top';
      ctx.font = "14px 'Arial'";
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('WAAP-224Solutions', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('WAAP-224Solutions', 4, 17);

      return canvas.toDataURL().slice(-50);
    } catch {
      return '';
    }
  }

  private getWebGLRenderer(): string {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return '';

      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (!debugInfo) return '';

      return (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
    } catch {
      return '';
    }
  }

  private async getAudioFingerprint(): Promise<string> {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const analyser = audioContext.createAnalyser();
      const gain = audioContext.createGain();
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      gain.gain.value = 0;
      oscillator.type = 'triangle';
      oscillator.connect(analyser);
      analyser.connect(processor);
      processor.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(0);

      await new Promise(resolve => setTimeout(resolve, 100));

      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(frequencyData);

      oscillator.stop();
      audioContext.close();

      return Array.from(frequencyData.slice(0, 10)).join(',');
    } catch {
      return '';
    }
  }

  private async detectFonts(): Promise<string[]> {
    const testFonts = ['Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia'];
    const detectedFonts: string[] = [];

    const testString = 'mmmmmmmmmmlli';
    const baseFonts = ['monospace', 'sans-serif', 'serif'];

    const span = document.createElement('span');
    span.style.position = 'absolute';
    span.style.left = '-9999px';
    span.style.fontSize = '72px';
    span.innerText = testString;
    document.body.appendChild(span);

    const baseWidths: Record<string, number> = {};
    for (const baseFont of baseFonts) {
      span.style.fontFamily = baseFont;
      baseWidths[baseFont] = span.offsetWidth;
    }

    for (const font of testFonts) {
      for (const baseFont of baseFonts) {
        span.style.fontFamily = `'${font}', ${baseFont}`;
        if (span.offsetWidth !== baseWidths[baseFont]) {
          detectedFonts.push(font);
          break;
        }
      }
    }

    document.body.removeChild(span);
    return detectedFonts;
  }

  private getPlugins(): string[] {
    const plugins: string[] = [];
    for (let i = 0; i < navigator.plugins.length; i++) {
      plugins.push(navigator.plugins[i].name);
    }
    return plugins;
  }

  private detectRoboticClicks(clicks: ClickPattern[]): boolean {
    if (clicks.length < 5) return false;

    // Vérifier si les intervalles entre clics sont trop réguliers
    const intervals: number[] = [];
    for (let i = 1; i < clicks.length; i++) {
      intervals.push(clicks[i].timestamp - clicks[i-1].timestamp);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((acc, val) => acc + Math.pow(val - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Si l'écart-type est très faible (clics trop réguliers), c'est suspect
    return stdDev < 50 && avgInterval < 500;
  }

  private detectRateSpike(identifier: string, endpoint: string): APIAnomaly | null {
    const key = `${identifier}:${endpoint}`;
    const now = Date.now();
    const windowMs = 60000; // 1 minute

    let history = this.requestHistory.get(key) || [];
    history = history.filter(t => now - t < windowMs);
    history.push(now);
    this.requestHistory.set(key, history);

    // Plus de 100 requêtes par minute = spike
    if (history.length > 100) {
      return {
        type: 'rate_spike',
        severity: 'high',
        endpoint,
        details: { requestCount: history.length, windowMs },
        timestamp: new Date()
      };
    }

    return null;
  }

  private calculateConfidence(factors: ThreatFactor[]): number {
    const detectedCount = factors.filter(f => f.detected).length;
    return detectedCount / factors.length;
  }

  private async notifyAdmins(incident: SecurityIncident): Promise<void> {
    console.error('[WAAP] 🔴 ALERTE CRITIQUE:', incident);

    // Créer une notification en base
    try {
      await supabase.from('notifications' as any).insert({
        type: 'security_alert',
        title: `🚨 Alerte Sécurité: ${incident.type}`,
        message: `Incident ${incident.severity}: ${incident.source}`,
        data: incident,
        is_read: false
      });
    } catch (error) {
      console.error('[WAAP] Erreur notification:', error);
    }
  }

  // ============== STATISTICS ==============

  getStats(): {
    blockedCount: number;
    incidentsToday: number;
    topThreats: string[];
  } {
    return {
      blockedCount: this.blockedEntities.size,
      incidentsToday: 0, // À implémenter avec requête DB
      topThreats: ['rate_spike', 'sql_injection', 'xss_attempt']
    };
  }
}

// Export singleton
export const waapService = new WAAPService();
export default waapService;
