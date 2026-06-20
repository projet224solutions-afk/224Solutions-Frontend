# 224SOLUTIONS - Architecture Super App 4 Cores

Date: 2026-04-01
Statut: Foundation v1 (additif, sans suppression de flux existants)

## 1. Vision Produit Cible

224SOLUTIONS converge vers 4 moteurs centraux:
- Identity Core
- Payment Core
- Commerce Core
- Intelligence & Supervision Core

Principe d implementation:
- aucun remplacement brutal des modules existants
- aucun effacement de logique utile
- migration progressive par couches
- compatibilite avec les donnees et routes actuelles

## 2. Etat Existant (constate dans le code)

### Identity
- Role principal en profile.role (mono-valeur)
- Multiples hooks et guards frontend
- Systeme de permissions agents existant (RPC check_agent_permission)

### Payment
- Wallet backend centralise (api/v2/wallet)
- Liens de paiement backend centralises
- Commission affiliation centralisee via RPC credit_agent_commission
- Idempotence deja active sur certains flux wallet

### Commerce
- Marketplace + abonnement + boosts + scoring existants
- Algorithme de ranking deja code dans marketplaceVisibility.service.ts

### Intelligence & Supervision
- Dashboard surveillance PDG existant
- Job queue avec checks et alertes
- Health endpoints backend existants

## 3. Nouveaux Fondements Ajoutes (Foundation v1)

### 3.1 Identity Core - Activation modulaire additive

Ajouts:
- table identity_user_modules
- route GET /api/core/identity/modules
- route POST /api/core/identity/modules/activate

Objectif:
- conserver profile.role tel quel
- ajouter la capacite multi-modules sans casser l existant
- permettre les combinaisons (client+affilie, vendeur+affilie, prestataire+affilie)

### 3.2 Intelligence & Supervision Core - Feature Registry extensible

Ajouts:
- table core_feature_registry
- table core_feature_health_events
- route GET /api/core/supervision/feature-registry
- route POST /api/core/supervision/feature-events

Objectif:
- enregistrer toutes les features critiques dans un registre unifie
- standardiser les evenements de sante fonctionnelle
- permettre l auto-inscription des nouvelles features via POST event

## 4. Modele d Orchestration Cible

### Identity Core
- source role legacy: profiles.role
- source module moderne: identity_user_modules
- synthese runtime: role + modules explicites + entites existantes

### Payment Core
- source de verite financiere: wallets + wallet_transactions + payment_links
- point de pilotage: routes backend payment/wallet
- extension prevue: audit fonctionnel via feature events

### Commerce Core
- source de verite commerce: products, digital_products, professional_services, subscriptions, boosts
- ranking unifie: marketplace_visibility_settings + scoring service
- extension prevue: separation explicite sponsorise/populaire/organique/recommande

### Intelligence & Supervision Core
- source observation: core_feature_registry + core_feature_health_events + logic_*
- gouvernance PDG: monitoring.view / monitoring.manage
- extension prevue: KPI pays/zone et corrélation metier multi-core

## 5. Fichiers Cibles de Foundation v1

- supabase/migrations/20260401195000_superapp_core_foundations.sql
- backend/src/routes/core.routes.ts
- backend/src/server.ts

## 6. Garanties de Non Regression

- aucune route legacy supprimee
- aucun schema existant modifie de facon destructive
- fonctionnalites historiques conservees
- ajout uniquement de tables/routes/core additifs

## 7. Prochaines Etapes Professionnelles (Phase 2)

- unifier les PermissionGuard frontend en une seule source
- ajouter enforcement backend permission sur toutes routes PDG sensibles
- brancher emissions feature-events depuis paiements, wallet, auth, marketplace
- relier monitoring a segmentation pays/zone
- enrichir Identity Core avec policies de delegation module par module

## 8. Gouvernance PDG

- monitoring et vision globale via feature registry
- evolution vers cockpit PDG unique (finance + commerce + supervision + pays)
- base preparee pour gestion fine des droits par domaine
