# RESTAURANT_TEST_SCENARIOS.md — Scénarios de test (Phase 1)

> Pré-requis : migration `20260615400000_restaurant_atomic_payment.sql` appliquée + backend redémarré.
> Les appels passent par `/api/v2/restaurant/*` (JWT requis). Le restaurateur = `professional_services.user_id`.

## 1. Commande payée (livraison) — chemin nominal
- En tant que **client** connecté avec un solde suffisant, `POST /api/v2/restaurant/order` :
  ```json
  { "professional_service_id": "<resto>", "order_type": "delivery",
    "delivery_address": "Coyah", "items": [{ "menu_item_id": "<plat>", "quantity": 2 }] }
  ```
- ✅ Attendu : `success:true`, `order_id`, `restaurant_receives` = montant − commission. Le **wallet client est débité**, le **restaurant crédité (net)**, la **commission au PDG**, et 3 lignes `wallet_transactions` (paiement, commission). La commande apparaît dans le **Kanban restaurateur** (colonne NOUVELLES) en temps réel.

## 2. Prix validé côté serveur (sécurité)
- Envoie le même appel mais avec un faux prix client (champ `price`/`unit_price` bricolé).
- ✅ Attendu : **ignoré** — le backend recalcule depuis `restaurant_menu_items`. Le montant débité = prix réel en base, jamais celui du client.
- Envoie un `menu_item_id` qui n'appartient pas au restaurant → **400 « Plat introuvable »**. Un plat `is_available=false` → **409 « Plat épuisé »**.

## 3. Double paiement bloqué (idempotence)
- Envoie **deux fois** la même commande avec le **même `idempotency_key`**.
- ✅ Attendu : **une seule** commande créée, **un seul** débit. Le 2ᵉ appel renvoie le même `order_id` (`idempotent`).

## 4. Solde insuffisant
- Client avec un solde < montant.
- ✅ Attendu : **402 « Solde insuffisant »**, **aucune** commande créée, **aucun** débit (rollback atomique).

## 5. Commande sur table (QR)
- `order_type: "table"`, `table_number: 5`.
- ✅ Attendu : commande créée (`order_type` normalisé `dine_in`, `source='qr_code'`), visible « Table 5 » côté restaurateur.

## 6. Annulation auto 3 min + remboursement
- Passe une commande et **ne l'accepte pas** côté restaurateur.
- ✅ Attendu : après ~3 min, le job `restaurant.auto-cancel` la passe en `cancelled`, **rembourse le client** (ligne `refund`), et reprend net au restaurant + commission au PDG. Vérifier le log `[restaurant.auto-cancel] N commande(s) … remboursée(s)`.

## 7. Refus restaurateur
- `POST /api/v2/restaurant/order/:id/cancel` en tant que **restaurateur** avec `reason: "rupture de stock"`.
- ✅ Attendu : remboursement atomique immédiat, statut `cancelled`.
- Idempotence : un 2ᵉ cancel → `already_refunded:true` (pas de double remboursement).

## 8. Acceptation + cycle de statut
- `POST /order/:id/accept` (restaurateur) → `preparing` (colonne EN PRÉPARATION).
- `POST /order/:id/status { "status": "ready" }` → `ready` (colonne PRÊTES).
- ✅ Attendu : propriété vérifiée (un autre user → **403**), pas de mouvement d'argent (déjà payé).

## 9. Anti auto-commande
- Le **restaurateur** tente de commander dans son **propre** restaurant.
- ✅ Attendu : **400 « Vous ne pouvez pas commander dans votre propre restaurant »**.

## Non couvert (phases suivantes)
UI client (cartes marketplace, panier, checkout `PayButton224`, suivi Leaflet/ETA), abonnements 4 plans, FX cross-devise client, canaux Ably + son, notifications Firebase du flux, options/suppléments payants.
