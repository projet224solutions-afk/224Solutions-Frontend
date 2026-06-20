/**
 * 224Guard — orchestrateur du pipeline d'alertes.
 * Reçoit des observations (valeur de storage, texte de body, header…), produit des
 * candidats (PatternMatcher + entropie), les score (ConfidenceScorer), applique la
 * déduplication multi-dim + le rate-limiting anti-flood, MASQUE la valeur, et émet.
 *
 * INVARIANT : la valeur brute ne quitte JAMAIS cette fonction autrement que hashée/masquée.
 */

import { GUARD_CONFIG } from '../config';
import type { Alert224, DetectionCandidate, DetectionContext } from '../core/types';
import { hashSecret, maskSecret, fnv1a } from '../masking';
import { patternMatcher } from '../detection/PatternMatcher';
import { entropyAnalyzer } from '../detection/EntropyAnalyzer';
import { ConfidenceScorer } from '../detection/ConfidenceScorer';
import { Deduplicator } from './Deduplicator';

/** Une valeur qui CONTIENT un JWT a déjà été évaluée par le décodage de rôle
 *  (PatternMatcher) — y compris un header « Bearer <jwt> ». Un JWT user est
 *  légitimement à haute entropie → ne PAS le re-flaguer par entropie. */
function containsJwt(value: string): boolean {
  return /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(value);
}

function newId(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'g_' + fnv1a(String(Math.random()) + Date.now());
}

export type EmitFn = (alert: Alert224) => void | Promise<void>;

export class AlertManager {
  private rateBucket = new Map<string, { count: number; windowStart: number; flooded: boolean }>();

  constructor(
    private scorer: ConfidenceScorer,
    private dedup: Deduplicator,
    private emitFn: EmitFn,
    private now: () => number = () => Date.now(),
  ) {}

  /**
   * Émet une alerte SYSTÈME (tamper, dégradation, intégrité) — pas une détection de secret.
   * Dédupliquée par type pour éviter le spam (ex. tamper répété dans la fenêtre).
   */
  async emitSystem(
    type: import('../core/types').AlertType,
    severity: import('../core/types').Severity,
    label: string,
    patternKey: string,
    source: import('../core/types').AlertSource = 'runtime',
  ): Promise<void> {
    const keyHash = 'system:' + patternKey;
    if (!this.dedup.decide(keyHash, severity, source).emit) return;
    const t = this.now();
    await this.emitFn({
      id: newId(), type, severity, patternKey, label, keyHash, masked: '—',
      sources: [source], locations: [], count: 1, createdAt: t, updatedAt: t,
      score: { regexMatch: 0, entropyScore: 0, contextScore: 0, behaviorScore: 0, historicalScore: 0, finalScore: 1, confidence: 'CERTAIN' },
    });
  }

  /** Analyse une VALEUR discrète (entrée de storage, header) : patterns + entropie. */
  async analyzeValue(value: string, ctx: DetectionContext): Promise<void> {
    if (!value) return;
    const candidates = patternMatcher.match(value);

    // ENTROPIE = signal d'EXFILTRATION uniquement. On ne génère un candidat entropie QUE si la
    // valeur SORT (réseau sortant / websocket) : là une chaîne aléatoire inconnue peut être un
    // secret qui fuit. Pour local_storage / dom / inbound, ce sont des blobs d'app (JSON du panier,
    // cache produits, état UI) → FAUX POSITIFS systématiques. Les MOTIFS NOMMÉS (clé service_role,
    // AWS, Stripe…) restent détectés PARTOUT via patternMatcher — une vraie clé en storage est captée.
    const exfil = (ctx.source === 'network_request' && ctx.direction === 'outbound') || ctx.source === 'websocket';
    if (candidates.length === 0 && !containsJwt(value) && exfil) {
      // On ne flague PAS le blob entier (JSON/texte = faux positifs) : on extrait les
      // jetons contigus à haute entropie et on remonte le plus suspect (un seul candidat).
      const tokens = entropyAnalyzer.extractSecretTokens(value);
      if (tokens.length > 0) {
        let best = tokens[0];
        let bestH = entropyAnalyzer.calculateEntropy(best);
        for (const tok of tokens) {
          const h = entropyAnalyzer.calculateEntropy(tok);
          if (h > bestH) { best = tok; bestH = h; }
        }
        candidates.push({
          patternKey: 'entropy.generic',
          type: 'HIGH_ENTROPY_STRING',
          severity: 'MEDIUM',
          publicByDesign: false,
          rawValue: best,
          label: 'Chaîne à haute entropie (secret probable sans format connu)',
        });
      }
    }
    for (const c of candidates) await this.emitCandidate(c, ctx);
  }

  /** Analyse un TEXTE libre (body de requête, bundle) : patterns uniquement. */
  async analyzeText(text: string, ctx: DetectionContext): Promise<void> {
    for (const c of patternMatcher.match(text)) await this.emitCandidate(c, ctx);
  }

  private async emitCandidate(candidate: DetectionCandidate, ctx: DetectionContext): Promise<void> {
    const score = this.scorer.score(candidate, ctx);
    if (score.finalScore < GUARD_CONFIG.emitThreshold) return; // sous le seuil → ignoré.

    // Rate-limit anti-flood (cf. attaque #5).
    if (this.isFlooded(ctx)) return;

    // Entropie : on COALESCE par (motif + source) plutôt que par valeur, sinon chaque
    // jeton distinct crée une alerte → flood. Un secret À FORMAT CONNU reste dédupliqué
    // par sa valeur (hash) pour ne pas masquer deux fuites différentes.
    const keyHash = candidate.patternKey.startsWith('entropy.')
      ? 'entropy:' + ctx.source
      : await hashSecret(candidate.rawValue);
    const decision = this.dedup.decide(keyHash, candidate.severity, ctx.source);
    if (!decision.emit) return; // doublon coalescé → pas de nouvelle alerte.

    const t = this.now();
    const alert: Alert224 = {
      id: newId(),
      type: candidate.type,
      severity: candidate.severity,
      patternKey: candidate.patternKey,
      label: candidate.label,
      keyHash,
      masked: maskSecret(candidate.rawValue),
      sources: [ctx.source],
      locations: ctx.location ? [ctx.location] : [],
      score,
      count: 1,
      createdAt: t,
      updatedAt: t,
    };
    await this.emitFn(alert);
  }

  /** Renvoie true si la source dépasse le quota (et émet 1 méta-alerte de flood une fois). */
  private isFlooded(ctx: DetectionContext): boolean {
    const t = this.now();
    const b = this.rateBucket.get(ctx.source) ?? { count: 0, windowStart: t, flooded: false };
    if (t - b.windowStart > GUARD_CONFIG.rateLimit.windowMs) {
      b.count = 0;
      b.windowStart = t;
      b.flooded = false;
    }
    b.count++;
    this.rateBucket.set(ctx.source, b);

    if (b.count <= GUARD_CONFIG.rateLimit.maxPerSourcePerWindow) return false;

    if (!b.flooded) {
      b.flooded = true;
      // Une seule méta-alerte de flood par fenêtre/source (les détails suivants sont supprimés).
      const t2 = this.now();
      void this.emitFn({
        id: newId(),
        type: 'ALERT_FLOOD',
        severity: 'HIGH',
        patternKey: 'system.flood',
        label: `Flood d'alertes détecté sur la source ${ctx.source} (possible pollution)`,
        keyHash: 'flood:' + ctx.source,
        masked: '—',
        sources: [ctx.source],
        locations: [],
        score: {
          regexMatch: 0, entropyScore: 0, contextScore: 0, behaviorScore: 0,
          historicalScore: 0, finalScore: 1, confidence: 'CERTAIN',
        },
        count: b.count,
        createdAt: t2,
        updatedAt: t2,
      });
    }
    return true;
  }
}
