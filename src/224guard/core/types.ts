/**
 * 224Guard — types partagés du cœur (Lot A).
 */

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Origine où l'exposition a été observée. */
export type AlertSource =
  | 'network_request'
  | 'network_response'
  | 'websocket'
  | 'local_storage'
  | 'session_storage'
  | 'indexeddb'
  | 'dom'
  | 'bundle'
  | 'runtime'
  | 'tamper';

/** Nature de la détection. */
export type AlertType =
  | 'SECRET_EXPOSED'
  | 'SERVICE_ROLE_KEY'
  | 'PROVIDER_KEY_PUBLIC'
  | 'HIGH_ENTROPY_STRING'
  | 'TAMPER_ATTEMPT'
  | 'SYSTEM_DEGRADED'
  | 'INTEGRITY_VIOLATION'
  | 'ALERT_FLOOD';

export type Confidence = 'CERTAIN' | 'PROBABLE' | 'POSSIBLE' | 'UNLIKELY';

/** Score de détection multi-facteurs (chaque facteur ∈ [0,1]). */
export interface DetectionScore {
  regexMatch: number;
  entropyScore: number;
  contextScore: number;
  behaviorScore: number;
  historicalScore: number;
  /** score combiné pondéré ∈ [0,1]. */
  finalScore: number;
  confidence: Confidence;
}

/** Contexte d'une observation, fourni par un moniteur (Lot B). */
export interface DetectionContext {
  source: AlertSource;
  /** ex. URL de la requête, clé de storage, sélecteur DOM. */
  location?: string;
  /** direction réseau : une clé serveur dans un body SORTANT est plus grave. */
  direction?: 'outbound' | 'inbound';
  /** horodatage de l'observation. */
  observedAt?: number;
}

/** Candidat de détection produit par PatternMatcher / EntropyAnalyzer. */
export interface DetectionCandidate {
  /** identifiant du motif (ex. 'supabase.service_role', 'entropy.generic'). */
  patternKey: string;
  type: AlertType;
  severity: Severity;
  /** TRUE si la valeur est publique par conception (anon key, firebase apiKey…). */
  publicByDesign: boolean;
  /** la valeur EN CLAIR — ne sort JAMAIS du pipeline (masquée immédiatement). */
  rawValue: string;
  label: string;
}

/** Alerte finale — NE CONTIENT JAMAIS la valeur en clair (cf. règle d'or #4). */
export interface Alert224 {
  id: string;
  type: AlertType;
  severity: Severity;
  patternKey: string;
  label: string;
  /** hash SHA-256 de la valeur (corrélation sans divulgation). */
  keyHash: string;
  /** masque non reconstructible, ex. 'sk_live_****…1234'. */
  masked: string;
  /** sources où la même exposition a été vue (dédup multi-dim). */
  sources: AlertSource[];
  locations: string[];
  score: DetectionScore;
  /** nombre d'occurrences coalescées. */
  count: number;
  createdAt: number;
  updatedAt: number;
}

/** Résultat d'envoi vers un sink (Ably/Supabase — Lot C). */
export interface SinkResult {
  ok: boolean;
  retryable: boolean;
  error?: string;
}

/** Sink d'alerte (transport/persistance). Injecté dans la file (Lot C). */
export interface AlertSink {
  readonly name: string;
  deliver(alert: Alert224): Promise<SinkResult>;
}
