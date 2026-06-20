# CARTOGRAPHIE — Audit logique métier (Phase 0)

> Carte du système avant audit approfondi. Beaucoup de zones ont **déjà été auditées/durcies**
> lors de sessions précédentes — signalées par ✅ + référence. On évite ainsi de refaire le travail.

---

## 1. Rôles trouvés dans le code (`profiles.role` + `allowedRoles`)

| Rôle | Interface | Notes |
|---|---|---|
| `client` | Home / ClientDashboard / Orders | acheteur, commandes, wallet |
| `vendeur` | /vendeur/* (VendorRoutes) | physique **et** digital (même rôle, gating par abonnement) |
| `agent` | /agent (AgentDashboard) | **agent du PDG** (commissions, affiliation) |
| *(agent vendeur)* | /vendor-agent/:token (VendorAgentInterface) | sous-compte d'un vendeur, **pas un rôle DB** — accès par token + permissions |
| `livreur` / `driver` | /livreur (LivreurDashboard) | livraison + courses |
| `taxi` | /taxi-moto/driver | chauffeur (taxi + moto, même rôle) |
| `syndicat` | /syndicat, /bureau (BureauDashboard) | bureau syndicat |
| `transitaire` | interfaces dédiées | fret/logistique |
| `prestataire` | services de proximité | 17 services |
| `actionnaire` | ActionnaireDashboard | actionnaires (✅ [[project-shareholder-system]]) |
| `admin` / `pdg` / `ceo` | /pdg* (PDG224Solutions) | super-admin (PDG_ROLES backend) |

---

## 2. Routes API backend (montées dans `server.ts`)

**Argent / paiements** : `/api/wallet`, `/api/v2/wallet`, `/api/payments`, `/api/payment-links`,
`/webhooks` (Stripe signé), `/api/subscriptions`.
**Marketplace** : `/api/products`, `/api/orders`, `/api/v2/marketplace`, `/api/inventory`,
`/api/marketplace-visibility`, `/api/pos`.
**Mobilité** : `/api/v2/taxi`, `/api/v2/delivery`.
**Acteurs** : `/api/vendors`, `/api/agents`, `/api/shareholders`.
**Admin** : `/api/admin` (requireRole PDG), `/api/identity`.
**Temps réel / push** : `/api/v2/realtime` (tokens Ably), `/api/v2/push` (FCM).
**Transverse** : `/api/analytics`, `/api/campaigns`, `/api/core`, `/api/documents`,
`/api/affiliate`, `/media`, `/jobs`, `/internal`, `/edge-functions` (garde auth globale ✅).

---

## 3. Abonnements (tables)

| Table | Pour qui |
|---|---|
| `subscriptions` | vendeurs (plans, rabais 15% ✅ [[project-subscription-system]]) |
| `driver_subscriptions` (+ `_config`, `_revenues`) | taxi / moto / livreur |
| `service_subscriptions` | 17 services de proximité |
| `digital_subscriptions` | vendeur digital |
| `subscription_events` | journal |

Surveillance abonnements ✅ : RPC `subscription_monitor_report` (expiré-mais-actif, etc.)
[[project-escrow-monitoring]].

---

## 4. Tables Supabase principales (par domaine)

- **Identité** : `profiles` (role, public_id source de vérité ✅ [[project-id-system]]), `vendors`, `agents_management`, `bureaus`.
- **Argent** : `wallets`, `wallet_transactions` (sender/receiver_user_id), `transactions`, `escrow_transactions`, `escrow_disputes`, `dispute_messages`, `revenus_pdg`, `currency_exchange_rates`.
- **Marketplace** : `products`, `orders`, `order_items`, `inventory`, `pos_sales`.
- **Mobilité** : `taxi_drivers`, `taxi_trips`/`rides`, `taxi_ride_tracking`, `deliveries`, `delivery_tracking`.
- **Abonnements** : voir §3.
- **Comms** : `notifications`, `messages`, `taxi_notifications`.
- **Sécurité** : `audit_logs`, `system_alerts`, RLS active (✅ [[project-rls-audit]]).

---

## 5. Flux principaux

**Course taxi/moto** : client crée (prix calculé **serveur**) → `taxi_trips` (held escrow si wallet) →
notif chauffeurs proximité → acceptation (⚠️ verrou à confirmer) → tracking via **Ably** (✅ dual-mode) →
fin → crédit chauffeur + commission (atomique RPC).

**Commande marketplace** : client checkout (prix **revalidé serveur** ✅ [[project-marketplace]]) →
`create_order_core` (RPC atomique : stock + escrow + commission acheteur) → escrow `held` →
notif vendeur (Ably) → livraison → confirmation → `release_escrow` (net + commission vendeur, atomique) ;
annulation → `refund_order_escrow` (crédit wallet acheteur, atomique). Litige tripartite ✅.

**Abonnement** : paiement → activation (règle « code fait foi » ✅ [[project-subscription-system]]).

---

## 6. Zones DÉJÀ auditées/durcies (ne pas refaire)

| Zone du prompt | Statut |
|---|---|
| Atomicité wallet / transferts | ✅ RPC atomiques [[project-money-wallet-atomicity]] |
| Escrow / remboursement / litige | ✅ durci atomique [[project-escrow-monitoring]] |
| Commissions agent/PDG | ✅ [[project-agent-commission-system]] |
| Permissions agent vendeur | ✅ [[project-vendor-agent-interface]] / [[project-agent-permissions-gap]] |
| Marketplace (prix serveur, escrow, stock) | ✅ [[project-marketplace]] |
| Abonnements (gating réel, expiration) | ✅ [[project-subscription-system]] |
| Sécurité edge-functions / RLS | ✅ [[project-edge-functions-auth-gap]] / [[project-rls-audit]] |
| AML / plafonds wallet | ✅ [[project-wallet-aml]] |
| Auth téléphone (SMS OTP) | ✅ [[project-auth-phone]] |
| Idempotence commandes | ✅ idempotencyGuard + index unique base |

---

## 7. Zones à (re)vérifier — STATUT après audit du 2026-06-14

| # | Point | Statut vérifié |
|---|-------|----------------|
| 1 | **Acceptation de course** (anti-race) | ✅ `acquire_taxi_lock` + concurrence optimiste `WHERE status='requested'` (`taxi-accept-ride`) |
| 2 | **Inscription** (profil+wallet atomique) | ✅ trigger `handle_new_user_complete` |
| 3 | **2FA admin** | 🟠 rôle vérifié serveur OK, mais **MFA cosmétique** → durcir |
| 4 | **Stock concurrent** | ✅ `FOR UPDATE` + tout-ou-rien (`create_order_core`, `decrement_stock_batch`) |
| 5 | **Abonnement paiement-avant-activation** + anti-double | ✅ `purchase_*_subscription_atomic` (1 tx, ROLLBACK, `DUPLICATE_PAYMENT`) |
| 6 | **Capacité moto** (1 passager serveur) | 🔎 à confirmer |
| 7 | **Téléchargement digital** (lien signé+expirant) | 🔎 infra `gcs-signed-url` existe, câblage à confirmer |
| 8 | **Isolation régionale bureau** | 🔎 à confirmer |
| 9 | **Services proximité** (réservation atomique + limites) | 🔎 `get_active_service_subscription_limits` borne ; atomicité à confirmer |

---

## ✅ Audit réalisé — livrables
- [BUSINESS_AUDIT.md](BUSINESS_AUDIT.md) — constats par rôle (vérifiés + ouverts).
- [TESTS_SCENARIOS.md](TESTS_SCENARIOS.md) — 17 scénarios de test manuel.
- [ATOMIC_FUNCTIONS_INVENTORY.md](ATOMIC_FUNCTIONS_INVENTORY.md) — mapping PHASE 4 → RPC existant
  (les ~290 RPC atomiques existent déjà → **pas de régénération**, ce serait une régression).

**Conclusion** : sur les chemins argent/concurrence vérifiés, **aucun bug bloquant**. Restent des
durcissements secondaires (§7 : points 3, 6, 7, 8, 9) à valider avec toi avant toute modif.
