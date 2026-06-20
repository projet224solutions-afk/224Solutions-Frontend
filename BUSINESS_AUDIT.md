# BUSINESS_AUDIT — Audit logique métier & transactions

> Audit 2026-06-14. Méthode : Phase 0 (cartographie) → vérification **du code réel** des
> chemins à plus haut risque (argent, concurrence, isolation) → croisement avec les audits
> antérieurs (mémoire projet). **Aucune RPC atomique n'a été régénérée** : elles existent
> déjà (~290 fonctions PostgreSQL) et les réécrire violerait « ne casse pas ce qui marche ».
> Voir [ATOMIC_FUNCTIONS_INVENTORY.md](ATOMIC_FUNCTIONS_INVENTORY.md) pour le mapping.

## Verdict global

Codebase **très mûr**. Tout le programme de durcissement de la PHASE 4 (transactions
atomiques, idempotence, verrous, validation serveur, audit immuable, surveillance d'anomalies)
est **déjà implémenté et câblé** sur les chemins critiques. L'audit confirme l'absence de
faille bloquante sur les flux argent/concurrence vérifiés ; les points ouverts sont des
durcissements secondaires (2FA admin, expiration liens digitaux, isolation régionale bureau).

---

## ✅ Vérifié dans le code (cette passe) — robuste

| # | Question d'audit | Constat (preuve) | Verdict |
|---|------------------|------------------|---------|
| Client | Double-clic = double paiement ? | `idempotency.middleware.ts` : clé scopée user, hash payload, états processing/completed/failed, conflit unique 23505→409, fail-open si table absente | ✅ Protégé |
| Client | Solde négatif / débit sans contrepartie ? | `wallet_debit_internal` : `FOR UPDATE` + contrôle solde (`INSUFFICIENT_FUNDS`) + blocage (`WALLET_BLOCKED`) + journal, dans la transaction appelante | ✅ Impossible |
| Client | Inscription atomique (profil+wallet) ? | trigger `handle_new_user_complete` sur `auth.users` (profil + wallet dans la même tx) | ✅ Atomique |
| Taxi | Race : 2 chauffeurs acceptent la même course ? | `taxi-accept-ride` : `acquire_taxi_lock` (TTL 30s) **+ concurrence optimiste** `UPDATE … WHERE status='requested'` + vérif statut chauffeur + `release` en `finally` | ✅ Double garde |
| Taxi | Prix calculé serveur ? | `calculate_taxi_fare` (RPC serveur), paiement `process_taxi_card_payment` | ✅ Serveur |
| Vendeur | Stock : 2 acheteurs, dernier article ? | `create_order_core` + `decrement_stock_batch` : `SELECT … FOR UPDATE` + validation tout-ou-rien (`Insufficient stock`) | ✅ Sérialisé |
| Abonnement | Paiement AVANT activation, atomique ? | `purchase_*_subscription_atomic` : débit + écriture abonnement = **1 transaction**, ROLLBACK total si échec | ✅ Atomique |
| Abonnement | Double-renouvellement par double-clic ? | clé d'idempotence `wallet_idempotency_keys` → `DUPLICATE_PAYMENT` (rejet sous verrou `FOR UPDATE`) | ✅ Bloqué |
| Argent | Audit financier immuable ? | triggers `prevent_transaction_modification` / `prevent_transaction_deletion` / `prevent_audit_modification` + `log_taxi_action` / `log_security_event` | ✅ Immuable |
| Transverse | Surveillance d'anomalies ? | `run_global_anomaly_detection` + `*_monitor_report` (wallet, escrow, commission, order, pos, transfer, subscription, dispute) → `system_alerts` | ✅ Actif |

### Déjà audité/durci lors de sessions antérieures (réf. mémoire, non re-testé)
Marketplace prix serveur + escrow + remboursement atomique ; commissions agent/PDG ;
permissions agent vendeur (scopé `is_vendor_agent_of` + `agent_has_permission`) ; RLS
(0 fuite argent/PII) ; sécurité edge-functions (garde auth globale) ; AML & plafonds wallet ;
auth téléphone SMS OTP ; devise unifiée atomique.

---

## 🟠 Points ouverts (durcissement, non bloquant)

1. ~~**2FA admin / PDG** — MFA cosmétique~~ → ✅ **CORRIGÉ (2026-06-14)**. L'ancien 2FA était
   **vérifié dans le navigateur** (contournable) et **TOTP non conforme RFC 6238**. Implémenté un
   **step-up TOTP vérifié SERVEUR** (`speakeasy`) : secret chiffré AES-256-GCM dans table isolée
   `admin_mfa` (RLS service_role only), middleware `requireStepUpMFA` sur les **10 ops financières
   sensibles** (escrow release/refund/dispute, AML freeze/cap-override/quarantine release/reject/
   quarantine-amount, disputes/resolve, caps, delete-user), grant Redis 5 min, lockout anti
   brute-force, audit append-only `admin_mfa_events`. **Non-bloquant par défaut** (`ADMIN_MFA_ENFORCED=false`
   le temps de l'enrôlement). **UI livrée** : enrôlement QR (`AdminMfaCard` dans l'onglet MFA du Centre
   Sécurité PDG) + **prompt step-up automatique** (`AdminMfaStepUpGate` monté dans la racine PDG) qui
   intercepte tout défi `MFA_REQUIRED` via `backendFetch`, demande le code, appelle `/mfa/step-up`
   et **rejoue** la requête — sans toucher aux sites d'appel. **Reste** : appliquer la migration,
   enrôler les admins, puis passer `ADMIN_MFA_ENFORCED=true`.

2. **taxi-accept-ride est encore une Edge Function** — la logique (verrou + acceptation) est
   correcte mais vit dans `supabase/functions/`, contraire à ta règle « tout en backend
   Node.js ». → À migrer vers `/api/v2/taxi` (même logique, RPC inchangés). Non urgent.

## 🟡 À confirmer par lecture ciblée (pas de bug prouvé)

3. ~~**Téléchargement produit digital**~~ → 🔴 **FAILLE CONFIRMÉE puis CORRIGÉE (2026-06-14)**.
   Les livrables étaient dans un bucket **PUBLIC** (`digital-products`) avec URL publique
   permanente **lisible par tout anonyme** via `digital_products.file_urls` → produit PAYANT
   téléchargeable gratuitement (vérifié : HTTP 200 + lecture anon OK sur 1 produit live).
   **Fix** : (a) bucket basculé en **privé** (URL publique → HTTP 400, vérifié) ; (b) endpoint
   `GET /api/v2/digital/:id/download` qui **vérifie l'achat payé** (ou propriété/admin) puis
   renvoie une **URL signée 5 min** (vérifié : HTTP 200) ; (c) hook `useDigitalDownload` +
   bouton propriétaire dans `VendorDigitalProducts`. **Reste UX** : bouton « Télécharger »
   côté acheteur dans sa vue commandes (hook prêt).
4. **Isolation régionale bureau syndicat** — `get_bureau_realtime_stats` / `add_vehicle_for_bureau`
   existent ; vérifier que les lectures bureau sont **filtrées par région/bureau** (RLS ou WHERE serveur).
5. **17 services de proximité — réservation** — `get_active_service_subscription_limits`
   borne les limites côté serveur ; vérifier l'**atomicité de la réservation** (anti double-réservation
   du même créneau) service par service.
6. **Capacité moto (1 passager)** — confirmer la validation **serveur** (pas seulement UI).

---

## Recommandations (ordre)

1. **2FA réel sur les ops admin financières** — ~1 j. 🟠
2. Confirmer **liens digitaux signés+expirants** (sinon : fuite de produits payés) — ~½ j. 🟡
3. Confirmer **isolation régionale bureau** + **réservation atomique services** — ~1 j. 🟡
4. Migrer `taxi-accept-ride` Edge → Node (cohérence archi) — ~½ j. 🟡

> Aucune correction de code appliquée dans cette passe : **rien de cassé n'a été trouvé** sur
> les chemins vérifiés. Les points ouverts sont des durcissements à valider avec toi avant
> toute modification (règle : ne pas changer une logique métier incertaine sans confirmation).
