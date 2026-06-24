# RAPPORT — AMÉLIORATIONS SYSTÈME DE POSITIONNEMENT MARKETPLACE
Date : 2026-06-24

## Principe respecté
ZÉRO suppression — tout est additif. Comportements existants préservés.
Migration idempotente + atomique (BEGIN/COMMIT + self-check `DO $$`).

## Phase 1 — Migration SQL (backend/supabase/migrations/20260624_marketplace_visibility_improvements.sql)
- Poids rééquilibrés sur `config_name='default'` : performance 25→35, abonnement 35→20, boost 20→15, qualité 10→15, pertinence 10→15.
- 6 colonnes additives sur `marketplace_visibility_settings` (new_vendor_*, trend_*, low_stock_*).
- 2 colonnes géo sur `marketplace_visibility_boosts` (target_country, target_city) + index.
- Table `product_trend_signals` + RPC `record_product_trend_signal` (GRANT anon/authenticated) + `cleanup_old_trend_signals`. RLS activée.
- Table `vendor_reliability_cache` + RPC `refresh_vendor_reliability` (utilise `order_returns`, la vraie table retours du projet, sinon `sale_returns`).
- Self-check durci : cible `config_name='default'` (sans dépendre de is_active) pour éviter un faux échec.

## Phase 2 — Backend (src/services/marketplaceVisibility.service.ts, additif)
- `RankingConfig` + `DEFAULT_CONFIG` : 6 nouveaux champs.
- `getConfig()` : sélection + parsing des 6 colonnes.
- `relevanceFromRecency()` : 1 ligne — fraîcheur **logarithmique** (jamais 0).
- `getActiveBoostMap(candidates, context?)` : filtrage **géo** (NULL/`all` = mondial).
- `ScoredItem` : 5 nouveaux champs.
- 4 nouvelles fonctions : `getVendorCreationMap`, `getTrendScoreMap`, `getVendorReliabilityMap`, `computeNewVendorBonus`.
- `rankMarketplaceCandidates()` : Promise.all enrichi + 5 nouveaux signaux dans le score final
  (`+trendBonus +newVendorBonus +categoryBonus −reliabilityPenalty −lowStockPenalty`).
- `buildVendorChecklist()` + `getVendorVisibilitySummary()` retourne `checklist` (topProducts enrichi de description/images).

## Phase 3 — Frontend (additif)
- `useMarketplaceUniversal` : option `userPreferredCategories` → transmise au contexte de ranking (forwardé au backend).
- `Marketplace.tsx` : `record_product_trend_signal` (view) au clic produit (fire-and-forget).

## Phase 4 — Dashboard vendeur (additif)
- `VendorAnalyticsDashboard` : carte « Score de visibilité marketplace » avec checklist 5 actions + impact.
- Chargée via `GET /api/marketplace-visibility/vendor/me` (route existante, gatée JWT) → `res.data.checklist`.

## Adaptations vs prompt (vérifiées dans le code réel)
- Migration : `order_returns` (vraie table retours) en plus de `sale_returns` ; self-check sans `is_active`.
- Dashboard : réponse backend = `{success, data}` → checklist lue en `res.data.checklist` (pas `res.checklist`) ; pas de dépendance `userId` (route JWT).
- Route `/vendor/me` déjà existante → aucune route à créer.

## Ce qui est préservé (inchangé)
applyDiversityPenalty · qualityScore · performanceScore · isItemEligible · getPlanScoresMap ·
timeout 4.5s + fallback local · is_sponsored en tête · modes de tri utilisateur.

## Vérifications
- Backend `tsc --noEmit` : 0 erreur · Frontend `tsc --noEmit` : 0 erreur.
- Greps prompt : tous conformes (4 fonctions, fraîcheur log, géo, bonus, checklist, signal trend).
- Frontend `npm run build` : voir conclusion.

## À déployer
- Migration `20260624_marketplace_visibility_improvements.sql` (SQL editor Supabase).
- Backend (service modifié) + Frontend — quand tu voudras.
