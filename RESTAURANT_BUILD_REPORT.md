# RESTAURANT_BUILD_REPORT.md — Service Restaurant / Alimentation

> Approche : **audit d'abord** (lecture de tout l'existant) → **adapter** (pas dupliquer) → construire par phases.

## 1. CE QUI EXISTAIT DÉJÀ (audit, ne pas reconstruire)

Le service restaurant était **déjà très avancé côté restaurateur** :

| Élément | État avant |
|---|---|
| Tables DB `restaurant_orders`, `restaurant_tables` (avec `qr_code_url`), `restaurant_menu_items`, `restaurant_promotions`, `restaurant_settings` | ✅ existaient |
| `RestaurantModule` (7 onglets) : Menu, Tables/QR, Commandes, **Kanban temps réel**, Analytics, Promotions, POS, Réservations | ✅ existait |
| 3 modes de commande (`dine_in` / `delivery` / `takeaway`) + source `qr_code` | ✅ champs présents |
| Temps réel des commandes (Kanban) | ✅ via **Supabase Realtime** (`postgres_changes` sur `restaurant_orders`) |
| Hooks : `useRestaurantOrders`, `useRestaurantMenu`, `useRestaurantTables`, `useServiceRestaurantStats`, `useRestaurantReservations` | ✅ existaient |
| Page menu public QR (`RestaurantPublicMenu.tsx`) | ✅ existait |
| Migration promotions `20260615110000` | ✅ existait |

**Décision clé** : la table `restaurant_orders` existe avec la clé `professional_service_id` + `customer_user_id`. On **ADAPTE** (colonnes additives + RPC sur la table existante) plutôt que créer les tables du cahier des charges (qui auraient cassé tous les hooks/Kanban/POS déjà branchés).

## 2. CE QUI MANQUAIT (le cœur « paiement »)

- ❌ `createOrder` était un simple `insert` : **aucun** débit wallet, crédit restaurant, commission, ni idempotence.
- ❌ Aucune RPC de paiement (`process_restaurant_order`) ni d'annulation/remboursement.
- ❌ Aucune annulation automatique après 3 min.
- ❌ Aucune route backend restaurant.

## 3. CE QUI A ÉTÉ CONSTRUIT (Phase 1 — fondation « argent »)

> ⚠️ Sécurité : on n'a **pas** utilisé le `UPDATE wallets SET balance = …` brut du cahier des charges (il contournerait AML/FX/audit). On compose avec les **primitives durcies existantes**.

### Migration `20260615400000_restaurant_atomic_payment.sql` (À APPLIQUER)
- **Colonnes additives** sur `restaurant_orders` : `commission`, `idempotency_key` (index unique), `payment_result`, `estimated_prep_minutes`, `accepted_at`, `cancelled_at`.
- **RPC `process_restaurant_order`** (atomique, tout-ou-rien) :
  1. Idempotence (clé unique → zéro double-débit),
  2. résout le restaurateur (`professional_services.user_id`),
  3. commission selon l'abonnement (`resolve_service_commission_rate`, défaut 15 %),
  4. **débit client** via `wallet_debit_internal` (FOR UPDATE + vérif solde + ledger),
  5. **crédit restaurant (net)** via `credit_user_wallet_safe` (FX/AML/cap) + ligne d'historique,
  6. **commission PDG** + ligne d'historique,
  7. création de la commande (`status='pending'`, `payment_status='paid'`),
  + normalise les 3 modes (`pickup→takeaway`, `table→dine_in`) vers l'enum existant.
- **RPC `cancel_restaurant_order`** (atomique) : rembourse le client + reprend au restaurant (net) et au PDG (commission) — double-entrée. Idempotent (déjà remboursé → no-op).
- `REVOKE … FROM PUBLIC` + `GRANT … TO service_role` (jamais exécutable par anon/authenticated).

### Backend Node `backend/src/routes/restaurant.routes.ts` (monté `/api/v2/restaurant`)
- `POST /order` : **PRIX VALIDÉ CÔTÉ SERVEUR** (lit les vrais prix dans `restaurant_menu_items`, ignore tout prix envoyé par le client ; rejette un plat introuvable ou épuisé) → appelle la RPC atomique.
- `POST /order/:id/accept` : le restaurateur accepte (`pending→preparing`), propriété vérifiée.
- `POST /order/:id/status` : `preparing→ready→delivered/completed`, propriété vérifiée.
- `POST /order/:id/cancel` : refus restaurateur OU annulation client → remboursement atomique.

### Job `restaurant.auto-cancel` (jobQueue, toutes les 60 s)
Annule + rembourse automatiquement (RPC) toute commande **payée mais non acceptée après 3 min**.

## 4. CE QUI RESTE (phases suivantes)

- **Phase 2 — Côté client marketplace** : cartes restaurant (badges Promo/Nouveau/Populaire/Fermé, tri par abonnement), page resto (menu sticky), panier flottant, checkout 3 modes branché sur `PayButton224` + `/api/v2/restaurant/order`, suivi de commande (Leaflet + timeline ETA).
- **Phase 3 — Abonnements restaurant** : audit + câblage des 4 plans (Gratuit/Basic/Pro/Premium), limites vérifiées serveur.
- **Raffinements** : FX client cross-devise (pré-conversion backend comme le marketplace), canaux Ably dédiés + son d'alerte (le Kanban marche déjà via Supabase Realtime), notifications Firebase du flux complet, options/suppléments payants (schéma à ajouter).

## 5. À FAIRE POUR ACTIVER
1. **Appliquer** la migration `20260615400000_restaurant_atomic_payment.sql` (SQL Editor).
2. **Redémarrer** le backend.
3. Tester via `RESTAURANT_TEST_SCENARIOS.md`.

**État compilation** : backend tsc = 0. Rien déployé (local).
