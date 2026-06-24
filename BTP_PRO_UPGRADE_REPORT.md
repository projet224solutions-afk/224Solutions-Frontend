# BTP CONSTRUCTION — UPGRADE PROFESSIONNEL (style Archipad)
Date : 2026-06-22

## Objectif
Transformer le module BTP en outil pro (réserves/punch list, lots par corps d'état,
réunions OPC, multi-intervenants, export PDF) **sans rien supprimer** des fonctions
existantes (vue générale, journal de chantier, budget, jalons escrow, espace client).

## Statut : ✅ Livré entièrement · Build frontend exit 0

| Phase | Fonctionnalité | Statut |
|-------|----------------|--------|
| 0 | Migration 4 tables + RLS + triggers | ✅ Créée (À APPLIQUER en Studio) |
| 1 | Bugfix `log_date` dans le journal | ✅ |
| 2 | Hook `useConstructionExtended` (lots/réserves/réunions/intervenants) | ✅ |
| 3 | Composant Corps d'état (Lots) | ✅ |
| 4 | Composant Réserves / Punch list | ✅ (fin reconstruite — prompt tronqué) |
| 5 | Composant Réunions OPC | ✅ |
| 6 | Composant Intervenants | ✅ |
| 7 | Export PDF (rapport chantier + CR de réunion) | ✅ |
| 8 | Intégration onglets (4 nouveaux) + bouton Rapport PDF | ✅ |

## Note sur le prompt
Le prompt reçu a été **tronqué par la limite de 50 000 caractères**, au milieu de la
Phase 4. Phases 0→3 appliquées **verbatim**. Phase 4 : fin reconstruite à partir des
handlers déjà fournis. Phases 5→8 : **construites par mes soins** (validé par l'utilisateur)
en s'appuyant sur le hook Phase 2 qui spécifiait déjà toute la couche données, et sur les
conventions du module existant.

## Correctif apporté à la migration
Le SQL du prompt faisait `CREATE POLICY` **sans** `DROP POLICY IF EXISTS` → non rejouable
(rejouer aurait planté sur « policy already exists »). J'ai ajouté les `DROP POLICY IF EXISTS`
+ les `WITH CHECK` explicites, alignés sur le style des tables `construction_*` existantes.

## Fichiers

### Backend (`224Solutions-Backend`)
- `supabase/migrations/20260622120000_btp_professional_upgrade.sql` — 4 tables
  (`construction_lots`, `construction_reserves`, `construction_meetings`,
  `construction_intervenants`) + RLS (prestataire gère via `check_service_owner`,
  client lit) + triggers de numérotation séquentielle (réserves & réunions).

### Frontend (`224Solutions-Frontend`)
- `src/hooks/useConstruction.ts` — bugfix `log_date` (date du jour si absente).
- `src/hooks/useConstructionExtended.ts` — **nouveau** : 4 hooks + types + labels.
- `src/lib/constructionPdf.ts` — **nouveau** : `exportProjectReportPdf` (rapport chantier
  complet : synthèse + lots + réserves + intervenants) et `exportMeetingPdf` (CR OPC).
  jsPDF unit 'pt' A4, en-tête de marque, pagination, pied numéroté.
- `src/components/professional-services/modules/construction/ConstructionLots.tsx` — **nouveau**
- `src/components/professional-services/modules/construction/ConstructionReserves.tsx` — **nouveau**
- `src/components/professional-services/modules/construction/ConstructionMeetings.tsx` — **nouveau**
- `src/components/professional-services/modules/construction/ConstructionIntervenants.tsx` — **nouveau**
- `src/components/professional-services/modules/construction/ConstructionProjectDetail.tsx` —
  +4 onglets (Corps d'état, Réserves, Réunions, Intervenants) + bouton « Rapport PDF ».
  Les 4 onglets d'origine (Vue générale, Journal, Budget, Jalons) **inchangés**.

## ⚠️ Action requise
La migration `20260622120000_btp_professional_upgrade.sql` doit être **appliquée
manuellement via Supabase Studio (SQL Editor)** — la base est en accès REST seul.
Tant qu'elle n'est pas appliquée, les nouveaux onglets afficheront des listes vides
(les requêtes échouent silencieusement, l'app ne casse pas).

## Build : frontend exit 0 ✅
