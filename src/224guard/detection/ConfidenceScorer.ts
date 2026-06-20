/**
 * 224Guard — scoring de confiance multi-facteurs (0-1).
 * Combine pattern + entropie + contexte + comportement + historique (cf. LOGIC_AUDIT §1.1 Q5).
 * Réduit fortement les faux positifs : une valeur PUBLIQUE par conception n'atteint un
 * score significatif que dans un contexte aggravant (ex. envoyée dans un body sortant).
 */

import { GUARD_CONFIG } from '../config';
import type { Confidence, DetectionCandidate, DetectionContext, DetectionScore } from '../core/types';
import { entropyAnalyzer } from './EntropyAnalyzer';
import { AdaptiveAllowlist } from './AdaptiveAllowlist';

function contextScore(ctx: DetectionContext, publicByDesign: boolean): number {
  // Une clé serveur dans un body SORTANT = très grave ; dans le bundle = grave ; inbound = moindre.
  let base: number;
  switch (ctx.source) {
    case 'network_request':
      base = ctx.direction === 'outbound' ? 1.0 : 0.6;
      break;
    case 'websocket':
      base = 0.9;
      break;
    case 'local_storage':
    case 'session_storage':
    case 'indexeddb':
      base = 0.8;
      break;
    case 'dom':
      base = 0.7;
      break;
    case 'bundle':
      base = 0.6;
      break;
    case 'network_response':
      base = 0.5;
      break;
    default:
      base = 0.5;
  }
  // Pour une valeur publique, seul un contexte fortement aggravant (outbound) compte.
  if (publicByDesign) {
    return ctx.source === 'network_request' && ctx.direction === 'outbound' ? base * 0.6 : base * 0.2;
  }
  return base;
}

function toConfidence(finalScore: number): Confidence {
  if (finalScore >= 0.85) return 'CERTAIN';
  if (finalScore >= 0.65) return 'PROBABLE';
  if (finalScore >= 0.45) return 'POSSIBLE';
  return 'UNLIKELY';
}

export class ConfidenceScorer {
  constructor(private allowlist: AdaptiveAllowlist) {}

  score(candidate: DetectionCandidate, ctx: DetectionContext): DetectionScore {
    const w = GUARD_CONFIG.scoreWeights;

    const entropyScore = entropyAnalyzer.entropyScore(candidate.rawValue);

    // ── Candidat ENTROPIE pur (pas de motif nommé) ───────────────────────────
    // L'entropie seule est un signal FAIBLE : une chaîne aléatoire STOCKÉE localement
    // n'est pas une exposition. Elle n'est actionnable qu'en contexte d'EXFILTRATION
    // (valeur sortante / websocket). Ailleurs, on l'étouffe (anti-faux-positifs).
    if (candidate.patternKey.startsWith('entropy.')) {
      const exfil = (ctx.source === 'network_request' && ctx.direction === 'outbound') || ctx.source === 'websocket';
      const ctxMult = exfil ? 1.0 : (ctx.source === 'network_request' ? 0.4 : 0.15);
      const finalScore = Math.max(0, Math.min(1, entropyScore * ctxMult));
      return {
        regexMatch: 0,
        entropyScore,
        contextScore: ctxMult,
        behaviorScore: 0,
        historicalScore: 1 - this.allowlist.reductionFor(candidate.patternKey),
        finalScore,
        confidence: toConfidence(finalScore),
      };
    }

    // ── Candidat à MOTIF nommé ───────────────────────────────────────────────
    // public-par-conception = 0.3 (matché mais public) ; secret non-public = 1.
    const regexMatch = candidate.publicByDesign ? 0.3 : 1;
    const ctxScore = contextScore(ctx, candidate.publicByDesign);
    const behaviorScore = 0; // Lot B (corrélation comportementale) → 0 pour l'instant.
    const historicalScore = 1 - this.allowlist.reductionFor(candidate.patternKey);

    let finalScore =
      w.regex * regexMatch +
      w.entropy * entropyScore +
      w.context * ctxScore +
      w.behavior * behaviorScore +
      w.historical * historicalScore;

    // Allowlist adaptative (plafonnée, jamais sur motif critique).
    finalScore = Math.max(0, finalScore - this.allowlist.reductionFor(candidate.patternKey));

    // Garde-fou : un motif CRITIQUE non-public a un plancher de confiance élevé
    // (fail-safe : on préfère un faux positif à un vrai positif manqué).
    if (candidate.severity === 'CRITICAL' && !candidate.publicByDesign) {
      finalScore = Math.max(finalScore, 0.9);
    }

    finalScore = Math.max(0, Math.min(1, finalScore));

    return {
      regexMatch,
      entropyScore,
      contextScore: ctxScore,
      behaviorScore,
      historicalScore,
      finalScore,
      confidence: toConfidence(finalScore),
    };
  }
}
