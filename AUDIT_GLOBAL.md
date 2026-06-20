# AUDIT_GLOBAL.md — État des 18 services de proximité (PHASE 0)

> Audit conforme à la RÈGLE N°1 : lecture du code existant **avant** toute modification.
> Date : 2026-06-15. Aucune ligne de code modifiée à ce stade.

---

## 0. Synthèse exécutive

**Le socle commun est MÛR mais INÉGALEMENT branché.** L'app a déjà :
- un système d'abonnement service générique (`service_plans` + `service_subscriptions` + RPC atomique `purchase_service_subscription_atomic`) ;
- un dashboard prestataire unifié (`src/pg/ServiceDashboard.tsx`) qui rend **déjà** pour TOUT service : la **carte d'abonnement** (`ServiceSubscriptionCard`) + un **widget wallet** (`ServiceWalletWidget`) + le **module métier** (`ServiceModuleManager`) ;
- ~290 RPC PostgreSQL dont **35 fichiers** de RPC argent atomiques (`purchase_*_atomic`, `credit_user_wallet_safe`, `wallet_debit_internal`, escrow…) ;
- des tables métier pour quelques services (restaurant, beauty, health, education, transport, ecommerce) ;
- une fondation **réservations** générique créée cette session (`service_bookings` + `/api/v2/bookings` + `useServiceBookings`) — Ménage déjà branché.

**MAIS** la majorité des modules métier affichent des **données MOCK** (pas de backend), les **4 éléments obligatoires de la RÈGLE N°2 ne sont PAS tous présents/temps-réel**, et **aucune des fonctionnalités signature** décrites dans le prompt (traçabilité QR agriculture, Kanban commandes restaurant temps réel, agenda 15 min beauté, achat groupé Pinduoduo, escrow jalons BTP, etc.) n'est implémentée.

---

## 1. RÈGLE N°2 — Éléments communs obligatoires (état global)

| Élément requis | Existe ? | Réalité | Écart |
|---|---|---|---|
| **WALLET temps réel Ably** `wallet-{userId}` + bouton recharge | ⚠️ Partiel | `ServiceWalletWidget` rendu dans ServiceDashboard, mais **PAS de canal Ably `wallet-{userId}`** (pas de temps réel) ; bouton recharge à vérifier | Créer un **WalletBar** Ably temps réel + recharge, adapté au contexte du service |
| **COPILOT IA contextuel** au service | ⚠️ Partiel | Backends copilot existants (`/edge-functions/copilot`, `/ai-copilot`, `/pdg-copilot`, `/copilote/search`) + composants par-domaine (`CopiloteChat`, `RealEstateCopilot`, `DigitalVendorCopilot`, `PDGCopilot`). **PAS de bulle Copilot224 uniforme** par service avec system prompt dédié | Créer **Copilot224** (bulle bas-droite) à system prompt par service, branché `/api/copilot` (vérifier modèle Claude Sonnet) |
| **BOUTON PAIEMENT** atomique + idempotent Redis + RPC | ⚠️ Partiel | `ChapChapPayButton` (Mobile Money) avec anti-double-clic (`disabled={processing}`), mais **idempotence Redis + RPC atomique à confirmer/uniformiser** ; pas de **PayButton224** standard | Créer/normaliser **PayButton224** (clé idempotence Redis → RPC atomique) |
| **BADGE ABONNEMENT** (plan + expiration) | ✅ Oui | `ServiceSubscriptionCard` affiche plan actif + jours restants (`getDaysRemaining`) | OK — à exposer en **badge compact** sur chaque interface |

**Conclusion RÈGLE N°2** : seul le **badge abonnement** est réellement en place partout. Wallet (pas Ably temps réel), Copilot (pas uniforme), PayButton224 (pas standardisé) = **à construire en PHASE 2** comme briques communes réutilisables.

---

## 2. État par service (les 18)

Légende données : 🟢 réel (backend/tables) · 🟡 partiel · 🔴 MOCK (aucun backend).
« Signature » = la fonctionnalité phare décrite dans le prompt.

| # | Service | Module | Données | Tables backend | Signature implémentée ? |
|---|---|---|---|---|---|
| 1 | Agriculture | `AgricultureModule` | 🔴 mock(7) | aucune dédiée | ❌ QR traçabilité, parcelles Leaflet, Kanban commandes |
| 2 | Restaurant | `RestaurantModule` + `RestaurantPublicMenu` | 🟡 | `restaurant_stock/staff` | ❌ Kanban commandes temps réel Ably, menu live, promos |
| 3 | Beauté | `BeautyModule` | 🟢 | `beauty_services/appointments/staff` + `useServiceBeautyStats` | ❌ Agenda 15 min, CRM, no-show, rappels |
| 4 | Boutique/E-commerce | `EcommerceModule` | 🟢 | `ecommerce_customers`, `product_variants` | ❌ Flash sales Ably, achat groupé Pinduoduo, panier abandonné |
| 5 | Construction/BTP | `ConstructionModule` | 🔴 mock(3) | aucune dédiée | ❌ 7 onglets projet, journal chantier verrouillé 24h, escrow jalons |
| 6 | Éducation | `EducationModule` | 🟡 | `education_courses/enrollments` | ❌ Curriculum, sessions live Ably, quiz, certificat QR |
| 7 | Immobilier | `RealEstateModule` (+ Copilot, MapView) | 🟡 backend(1) | partiel | ❌ Annonce 7 étapes, bail + quittances, escrow caution |
| 8 | Maison & Déco | `HomeDecorModule` | 🔴 mock(6) | aucune | ❌ Galerie inspiration, book d'idées, 3 devis |
| 9 | Photo/Vidéo | `PhotoStudioModule` | 🔴 mock(8) | aucune | ❌ Packages, galerie privée sélection, acompte 30% |
| 10 | Services pro/Freelance | `FreelanceModule` | 🔴 mock(6) | aucune | ❌ Gigs 3 niveaux, escrow, validation 5 j |
| 11 | Réparation/Mécanique | `RepairModule` | 🔴 mock(6) | aucune | ❌ Fiche véhicule, catalogue 500 services, suivi Uber, photos obligatoires |
| 12 | Livraison | `DeliveryModule` | 🟡 | `/api/v2/delivery` (gains/wallet livreur) | ❌ (système taxi/livraison existe séparément) |
| 13 | VTC/Transport | `VTCModule` + `TransportModule` | 🟢 | système taxi-moto complet (tracking Ably/Realtime) | ⚠️ partiel (taxi réel ailleurs) |
| 14 | Santé | `HealthModule` | 🟢 | `health_consultations/patient_records` + `useServiceHealthStats` | ❌ |
| 15 | Informatique | `DeveloperModule` | 🔴 mock(10) | aucune | ❌ |
| 16 | Sport/Fitness | `FitnessModule` + `CoachModule` | 🔴 mock(13/17) | aucune | ❌ séances, programmes, suivi |
| 17 | Coiffure | `HairdresserModule` | 🔴 mock(9) | (voir Beauté) | ❌ |
| 18 | **Voyage/Tourisme** | `TransportModule`/voyage | 🟡 | `voyage` service_type + tables réservations voyage | ⚠️ **RULE N°4 : doit être IS_ACTIVE=false + « Bientôt disponible »** — à vérifier/forcer |

**Note** : les 4 services artisans (Vitrerie/Menuiserie/Plomberie/Soudure) sont **complets** (système dédié `artisan_*`) — hors périmètre de ce prompt (laissés tels quels).

---

## 3. RÈGLE N°3 — Atomicité des transactions

**Infrastructure atomique = MÛRE** (ne pas réinventer) :
- Helpers : `wallet_debit_internal` (débit + idempotence clé), `credit_user_wallet_safe` (crédit net + AML + conversion).
- Abonnements : `purchase_service_subscription_atomic` / `purchase_vendor_subscription_atomic` / `purchase_driver_subscription_atomic` (débit ↔ écriture dans 1 transaction, ROLLBACK).
- Escrow marketplace : `auto_release_escrows` (crédit vendeur + commission PDG atomiques).
- Artisans (cette session) : `accept_artisan_quote_atomic`, `pay_artisan_deposit/balance_atomic`, `submit_artisan_quote_for_request`.
- Réservations (cette session) : `create_service_booking`, `update_service_booking_status`.

**Transactions NON atomiques / manquantes (à créer par service)** :
- Agriculture : paiement commande + remboursement auto J+2h (timeout) → RPC manquant.
- Restaurant : remboursement auto si non-accepté en 3 min → RPC manquant.
- BTP / Immobilier / Freelance / Photo : **escrow par jalon / acompte 30% / validation** → RPC `process_{service}_milestone_atomic` manquants.
- E-commerce : **achat groupé Pinduoduo** (déclenche N paiements simultanés si minimum atteint, sinon 0 débit) → RPC atomique manquant.
- Beauté : **pénalité no-show** (débit wallet client) → RPC manquant.

→ **À générer par service** (cf. prompt) : `process_{service}_payment`, `create_{service}_booking_atomic` (verrou Redis), `activate_{service}_subscription`, `generate_{service}_quote_pdf`.

---

## 4. PHASE 1 (preview) — Abonnements

**Existant** : `service_plans` (free/basic/pro/premium GLOBAUX, `service_type_id` NULL) + `service_subscriptions` + RPC atomique + carte UI. **Paiement avant activation = OUI** (RPC débite puis insère). **Limites côté serveur = OUI** (`get_active_service_subscription_limits`, `max_products`…). **Expiration = OUI** (`current_period_end`, `markExpiredSubscriptions`).

**Écarts à corriger (PHASE 1)** :
- **Plans par service** : le prompt définit des prix/limites **spécifiques par métier** (ex. Agriculture 5k/15k/30k, Restaurant 10k/25k/50k + commissions 15→5%). Aujourd'hui ce sont 4 tiers génériques → **seeder des plans par `service_type_id`** + masquer les génériques quand un plan typé existe.
- **Notifications J-3 / J-1** d'expiration : existent pour **driver** (`useDriverSubscription` isExpiringSoon/daysRemaining) mais **PAS pour les abonnements service** → à créer (job + notif Firebase).
- **Double renouvellement** : à vérifier (l'index unique partiel « un actif » existe côté vendor/service — confirmer côté service).
- **Commission par plan** (15%→5% restaurant, 10%→3% e-commerce…) : à câbler dans le flux de paiement marketplace selon le plan actif.

→ Livrable PHASE 1 : `SUBSCRIPTIONS_AUDIT.md` + corrections.

---

## 5. RÈGLE N°4 — Voyage / Tourisme

- Service type `voyage` (« Voyage / Tourisme », catégorie Tourisme) **existe** dans `serviceTypesConfig.ts` + migrations (tables réservations voyage Option B).
- **À FAIRE** : forcer `IS_ACTIVE=false` côté service_type + afficher une page **« Bientôt disponible »** côté client, tout en gardant le code complet (back prêt, front masqué). **À vérifier** : l'état `is_active` actuel en base.

---

## 6. Plan d'action (ordre proposé, conforme au prompt)

1. **PHASE 1** — `SUBSCRIPTIONS_AUDIT.md` + plans par service + notifs J-3/J-1 + commissions par plan.
2. **PHASE 2** — Briques communes RÉUTILISABLES (à faire UNE fois, montées par `ServiceDashboard`/chaque module) :
   - `WalletBar` (Ably `wallet-{userId}` temps réel + recharge, libellé contextuel),
   - `Copilot224` (bulle, system prompt par service, `/api/copilot` Claude Sonnet),
   - `PayButton224` (idempotence Redis → RPC atomique, montant validé serveur),
   - `SubscriptionBadge` (compact, depuis `ServiceSubscriptionCard`).
3. **PHASE 3** — Les services **un par un**, à fond, avec leur signature (back tables + RPC atomiques + interface prestataire + interface client + copilot + abonnement). Ordre suggéré par impact : Restaurant → Agriculture → Beauté → E-commerce → Réparation → BTP → Immobilier → Éducation → Photo → Freelance → Déco → Fitness/Coach → Informatique → (Voyage = inactif).

---

## 7. Règles d'or à respecter (rappel)
- Zéro transaction sans RPC PostgreSQL atomique (RÈGLE N°3) — réutiliser `wallet_debit_internal` + `credit_user_wallet_safe`.
- Toujours **REVOKE EXECUTE … FROM PUBLIC** sur les RPC SECURITY DEFINER sensibles.
- Migrations appliquées **par l'utilisateur** (SQL Editor) — je ne peux pas exécuter de DDL.
- Tout nouveau backend en **Node.js** (jamais Edge Function).
