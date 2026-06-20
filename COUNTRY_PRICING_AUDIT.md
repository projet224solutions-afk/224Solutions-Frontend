# COUNTRY_PRICING_AUDIT.md — Audit de la structure d'abonnement actuelle

> Audit préalable à la fonctionnalité « prix d'abonnement par pays ». Objectif : éviter de
> dupliquer/contredire l'existant (le drift de fonctions dupliquées vient de causer des fuites
> d'argent — voir money_integrity). On documente l'existant, le manquant, et le **conflit de modèle**
> à trancher avant tout code.

## 1． Ce qui existe déjà

### Abonnements (par service, en GNF)
- Tables **`plans`** (abonnement vendeur) et **`service_plans`** (services de proximité), prix en
  **`monthly_price_gnf` / `yearly_price_gnf`** + `commission_rate`, `max_*`, `features`. **Devise unique = GNF.**
- **`subscriptions`** (vendeur) / **`service_subscriptions`** (service) / **`driver_subscriptions`** (taxi/livreur)
  + `driver_subscription_config`.
- Création/paiement = **RPC atomiques EXISTANTES** : `purchase_vendor_subscription_atomic`,
  `purchase_service_subscription_atomic`, `purchase_driver_subscription_atomic`
  (débit wallet + insert en 1 transaction, idempotentes) via le backend `/api/v2/subscriptions/*`.
  Résolution du plan actif via `get_service_subscription`.
- Exploit « premium gratuit » récemment fermé (écriture directe `subscriptions`/`service_subscriptions`
  verrouillée à service_role/admin).

### Devise / pays (déjà en place)
- `profiles.country` (texte), `profiles.detected_country`, `profiles.detected_currency`. **Pas** de
  `country_code` ISO ni de `country_locked`.
- **Modèle devise actuel = CONVERSION FX** : le prix est en GNF ; l'UI le **convertit** vers la devise
  du client au taux **BCRG** (brique `<Money>`, table `currency_exchange_rates`, helper
  `credit_user_wallet_safe` qui convertit au crédit). Un client en France voit le prix GNF **converti** en €.
- Détection pays marketplace : `/api/v2/marketplace/home-country` (décision atomique, seuil 30).
- `system_settings.purchase_fee_percent` (frais acheteur), `PLATFORM_FEE_RATES` (commission par type).

### Ce qui N'existe PAS (à créer pour le spec)
- ❌ Table `countries` (référentiel pays + devise + symbole + moyens de paiement).
- ❌ Table `subscription_prices` (grille prix par pays × service × plan).
- ❌ `profiles.country_code` (ISO) + `profiles.country_locked`.
- ❌ Cache Redis des grilles de prix.
- ❌ Écran admin « prix par pays » + « modifier pays d'un utilisateur » (avec motif/log).

## 2． 🔴 CONFLIT DE MODÈLE À TRANCHER (décision produit)

Le spec et l'existant reposent sur **deux philosophies de prix incompatibles** :

| | **Modèle A — existant (conversion FX)** | **Modèle B — spec (grilles par pays)** |
|---|---|---|
| Prix de base | 1 prix en GNF par plan | 1 prix **indépendant** par (pays, service, plan) |
| France | GNF **converti** en € au taux BCRG (≈ 2,47 € pour 25 000 GNF) | prix **fixé** par l'admin (ex. 25 € — sans rapport avec le taux) |
| Devise | dérivée du taux du jour | figée dans la grille |
| Où | `plans.monthly_price_gnf` + `<Money>` | nouvelle table `subscription_prices` |

➡️ **Adopter le Modèle B implique** : la grille `subscription_prices` **remplace** le prix affiché/débité
pour l'abonnement (on **désactive la conversion FX** sur les prix d'abonnement, sinon double conversion),
et `service_plans.monthly_price_gnf` devient un repli. Le pays est **verrouillé** à l'inscription.

## 3． ⚠️ Risques si on code le spec « tel quel » (à éviter)

1. **Schéma générique faux** : le spec écrit `users` / `system_accounts` / `wallets.balance` simple.
   Réel = `profiles` (pas `users`), **pas** de `system_accounts` (plateforme = wallet du PDG via
   `pdg_management`), `wallets.id` **BIGINT**, crédit via `credit_user_wallet_safe` (AML + plafond).
2. **🔴 RPC d'activation parallèle = DRIFT** : créer `activate_subscription_by_country` **en plus** des
   `purchase_*_subscription_atomic` existantes recréerait EXACTEMENT le problème de surcharges
   dupliquées qui vient de causer les fuites (vendeur sur-payé, commission non prélevée). **Interdit.**
   → Il faut **ÉTENDRE** les RPC existantes (résolution du prix par pays), pas en ajouter une nouvelle.
3. **Double comptage devise** : laisser `<Money>` convertir un prix déjà localisé (grille) = prix faux.
4. **Verrou pays** : le spec verrouille `country_code` ; OK, mais l'override admin doit être tracé
   (audit) et passer par le backend (écriture d'identité durcie).

## 4． Recommandation d'implémentation (adaptée au réel)

1. **Tables** : créer `countries` + `subscription_prices` (OK, additif) ; ajouter `profiles.country_code`
   + `profiles.country_locked` (ALTER profiles, pas `users`).
2. **Prix** : `subscription_prices` devient la **source de vérité** du prix d'abonnement ; repli sur
   `plans/service_plans.monthly_price_gnf` (converti) si pas de grille pour le pays → migration douce.
3. **Activation** : **étendre** les RPC `purchase_*_subscription_atomic` pour qu'elles lisent le prix
   dans `subscription_prices` selon `profiles.country_code` (jamais le prix client). **Aucune** nouvelle
   RPC d'activation parallèle. Plateforme créditée = wallet PDG (pas `system_accounts`).
4. **Affichage** : prix de la grille du pays + symbole + 🇬🇳 drapeau ; **désactiver** la conversion `<Money>`
   sur ces prix (déjà localisés).
5. **Admin** : écrans prix par pays + override pays (backend, motif obligatoire, audit_logs) + invalidation
   cache Redis par pays.
6. **Voyage** : `country_code` verrouillé → prix d'abonnement inchangés ; GPS sert seulement à la
   découverte de prestataires (déjà le cas).

## 5． Décision requise avant build

**Quel modèle de prix retenir ?**
- **B (grilles par pays)** comme demandé → on construit `subscription_prices` + on étend les RPC + on
  désactive la conversion FX sur les abonnements.
- **A étendu** → garder le GNF + FX et juste ajouter des **overrides par pays** (prix fixe pour
  certains pays, sinon conversion) — moins de duplication, mais moins « grille pure ».

→ La fonctionnalité étant à cheval sur l'argent (atomicité + drift), **on confirme le modèle + le point
d'extension des RPC AVANT de coder**, conformément à la règle « audit avant code » et pour ne pas
réintroduire de surcharges dupliquées.
