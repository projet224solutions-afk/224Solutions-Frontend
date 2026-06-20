# GUARD224_ARCHITECTURE_PLAN — Étape 2 (architecture validée) — 2026-06-14

Architecture finale APRÈS l'audit ([GUARD224_LOGIC_AUDIT.md](GUARD224_LOGIC_AUDIT.md)).
224Guard = couche **client temps réel** complémentaire au scan serveur existant
(`frontendSecurity.service.ts`), alimentant le **même** dashboard PDG et les **mêmes**
tables d'alertes (préfixe `guard_224_*`).

## 2.1 Décisions architecturales finales

| # | Décision | Pourquoi (vs alternative) | Compromis | Risque résiduel |
|---|----------|---------------------------|-----------|-----------------|
| D1 | **Module privé** (closure), pas `window.Guard224` | Évite la désactivation triviale par script ; `getInstance()` interne | Debug moins direct (hook dev derrière flag) | Admin propriétaire garde tout pouvoir (assumé, cf. modèle de menace) |
| D2 | **Intercepteur = capture non-bloquante** (analyse différée Worker) | Overhead < 1 ms vs blocage requête | Analyse légèrement asynchrone (alerte à T+εms) | Requête déjà partie quand l'alerte tombe (détection, pas prévention) |
| D3 | **Proxy `fetch`/`WebSocket` + intégrité jittered** (PAS `configurable:false`) | N'écrase pas les SDK ; réversible | Un override déterminé reste possible → on **alerte** | Tamper sophistiqué non bloqué (détecté) |
| D4 | **File durable IndexedDB** comme source de vérité | Zéro perte d'alerte ; Ably/Supabase = sinks best-effort | Complexité (recovery au boot) | IndexedDB indispo (mode privé strict) → fallback mémoire |
| D5 | **Scoring de confiance** (regex + entropie + contexte + allowlist plafonnée) | Réduit drastiquement les faux positifs | Tuning nécessaire | FP/FN résiduels → ajustables |
| D6 | **Patterns critiques = constantes du bundle** (jamais depuis la DB) | Inviolabilité des règles cœur (anti-injection) | Mise à jour = redéploiement | — |
| D7 | **Scan lourd en Web Worker**, chunké, cappé | Pas de freeze UI ni crash mémoire | Worker = sérialisation des données | Bundles > cap non scannés (documenté) |
| D8 | **Aucune valeur de clé transmise/affichée** (hash + masque) | Les alertes elles-mêmes ne fuient rien | Moins d'info brute pour l'admin | — |
| D9 | **Dégradation gracieuse** (feature-detect partout) | Marche sur tous navigateurs | Capacités réduites sur Safari/iOS | Couverture moindre mobile |
| D10 | **Intégration** au Centre Sécurité PDG + `system_alerts` | Pas de silo ; UX cohérente | Dépend du schéma existant | — |

## 2.2 Matrice de robustesse

| Composant | Que se passe-t-il s'il échoue ? | Stratégie de récupération |
|-----------|--------------------------------|---------------------------|
| Intercepteur réseau | Requêtes non analysées (trou) | Moniteur d'intégrité ré-attache le proxy (non destructif) + alerte `TAMPER` ; self-heal |
| Scanner de bundle (Worker) | Pas de scan statique runtime | Retry borné ; si Worker indispo → scan inline throttlé ou skip + healthlog |
| Connexion Ably | Pas de temps réel | File durable rejoue à la reconnexion ; Supabase reste l'historique |
| Écriture Supabase | Pas d'historique persistant DB | Retry backoff + file durable locale ; alerte visible en local |
| RuntimeMonitor (storage/DOM) | Détection runtime réduite | Self-heal (ré-arme MutationObserver/intervalles) ; healthlog |
| IndexedDB | Pas de persistance d'alertes | Fallback file mémoire (perte au reload, documentée) |
| WebSocketMonitor | WS non surveillés | Dégradation ; alerte de capacité réduite |
| SelfHealingManager | Pas d'auto-réparation | Les composants restent en dernier état connu ; alerte `SYSTEM_DEGRADED` |

## 2.3 Garanties formelles (honnêtes et mesurables)

- **Détection** : « 224Guard détecte les expositions de secrets **du référentiel
  `SECRETS_INVENTORY` §3.2** dans les vecteurs **runtime couverts** (réseau fetch/XHR/WS,
  storage, DOM observé). Hors périmètre explicite : Service Workers, contextes cross-origin
  sandboxés, ajouts DOM éphémères intra-microtask. » (Pas de « 100 % », honnête.)
- **Performance** : « Overhead **< 1 ms** sur le chemin d'une requête (capture seule) ;
  l'analyse est **hors chemin critique**. Scan lourd **non bloquant** (Worker), budget borné. »
  Cible cahier des charges (< 5 ms) **largement tenue**.
- **Fiabilité** : « **Aucune alerte CRITIQUE n'est perdue** tant qu'IndexedDB est disponible,
  même si Ably est déconnecté et Supabase indisponible pendant des heures (rejeu à la
  reconnexion). Sans IndexedDB → garantie dégradée en mémoire (perte possible au reload). »
- **Sécurité** : « 224Guard **ne peut pas être désactivé par du code applicatif normal**
  (instance non exposée, pas d'API stop publique) et **détecte+alerte** les tentatives de
  tamper. Il **ne garantit PAS** l'inviolabilité face au propriétaire de la page (limite
  intrinsèque du JS client, documentée). Aucune valeur de clé ne circule en clair. »

## 2.4 Structure finale des fichiers

```
src/224guard/
  index.ts                      # bootstrap privé (closure) + ready Promise
  core/
    Guard224.ts                 # orchestrateur (registre disposables, lifecycle)
    DisposableRegistry.ts       # gestion centralisée des nettoyages (anti-leak)
    types.ts                    # Alert224, DetectionScore, Severity, Source…
  detection/
    EntropyAnalyzer.ts          # Shannon (complément aux regex)
    patterns.ts                 # PATTERNS CRITIQUES = constantes immuables (D6)
    PatternMatcher.ts           # regex bornés anti-ReDoS + décodage JWT (role claim)
    ConfidenceScorer.ts         # score 0-100 multi-facteurs (D5)
    AdaptiveAllowlist.ts        # tuning plafonné, jamais sur motifs critiques
  monitors/
    NetworkInterceptor.ts       # Proxy fetch/XHR non-bloquant + intégrité jittered (D2/D3)
    WebSocketMonitor.ts         # Proxy window.WebSocket
    StorageMonitor.ts           # localStorage/sessionStorage/IndexedDB
    DomMonitor.ts               # MutationObserver (attributs/scripts inline)
    BundleScanner.worker.ts     # Web Worker : scan source/sourcemaps/manifest (D7)
  pipeline/
    AlertManager.ts             # création, masquage, dédup multi-dim, rate-limit
    Deduplicator.ts             # {keyHash, source, severity} + fenêtre + coalescing
    ResilientAlertQueue.ts      # IndexedDB + retry backoff + recovery (D4)
    sinks/AblySink.ts           # transport temps réel best-effort (token signé)
    sinks/SupabaseSink.ts       # historique guard_224_* (RLS admin)
  resilience/
    SelfHealingManager.ts       # healthchecks + heal + healthlog
    IntegrityMonitor.ts         # surveille proxy fetch/WS, alerte TAMPER
  masking.ts                    # masque/hash — JAMAIS de clé en clair (D8)
  config.ts                     # flags, seuils, budgets, feature-detect
  __tests__/                    # unitaires + intégration + perf (Étape 5)

src/components/pdg/guard224/    # Dashboard (intégré au Centre Sécurité PDG)
  Guard224Panel.tsx             # entête santé + jauge risque + compteurs
  Guard224AlertList.tsx         # liste virtualisée + actions ≤3 clics
  Guard224Timeline.tsx          # graphe 24h/7j/30j
  Guard224ThreatMap.tsx         # heatmap composants
  Guard224Console.tsx           # console commandes (scan/status/whitelist/export)
  useGuard224.ts                # hook (souscription Ably + lecture Supabase)

backend/src/routes/guard224.routes.ts   # token Ably scopé + ingest alertes (option)
supabase/migrations/guard_224_complete.sql  # tables + RLS + vue (Étape 6)
```

## 2.5 Périmètre d'implémentation proposé (par lots, à valider)

> Le cahier des charges complet (Étapes 3-7) = ~25-35 fichiers, moteur + UI + tests + DB.
> Pour livrer du **solide et vérifié** plutôt qu'un gros bloc fragile, je propose 4 lots :

- **Lot A — Cœur détection + pipeline** : types, patterns, EntropyAnalyzer, PatternMatcher
  (JWT role-aware), ConfidenceScorer, masking, AlertManager + Deduplicator + ResilientAlertQueue.
  *(Le plus de valeur, testable unitairement, sans UI.)*
- **Lot B — Moniteurs runtime** : NetworkInterceptor (non-bloquant), WebSocketMonitor,
  StorageMonitor, DomMonitor, IntegrityMonitor, SelfHealing + bootstrap privé.
- **Lot C — Persistance & transport** : migration `guard_224_*` (RLS), AblySink/SupabaseSink,
  route backend token Ably scopé.
- **Lot D — Dashboard PDG** : panel + liste virtualisée + timeline + threat map + console +
  export, intégré au Centre Sécurité.
- **Tests** (Étape 5) tissés dans chaque lot.

## 2.6 Garde-fous d'implémentation (règles d'or appliquées)

Fail-safe (doute → alerte), zéro-trust interne (Ably/Supabase non fiables), jamais de clé en
clair, dégradation gracieuse partout, overhead < 1 ms sur le chemin requête, auto-réparation
des pannes bénignes, **honnêteté sur les limites** (pas de promesse d'inviolabilité).

---

## ⏸️ STOP — Validation requise avant l'Étape 3 (implémentation)

Conformément à ta **RÈGLE ABSOLUE** (audit avant code), je m'arrête ici. Les 3 documents
d'analyse sont produits (SECRETS_INVENTORY, LOGIC_AUDIT, ARCHITECTURE_PLAN). L'implémentation
(Lots A-D + tests + migration + dashboard) est un **gros chantier** : je le démarre sur ta
validation, idéalement **lot par lot** (en commençant par le Lot A — cœur de détection).
