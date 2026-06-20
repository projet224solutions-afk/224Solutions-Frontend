# COUNTRY_PRICING_BUILD_REPORT.md — Ce qui a été construit

> Système de **prix d'abonnement par pays** (Modèle B : grilles indépendantes fixées par
> l'admin, devise locale, pays verrouillé à l'inscription). Adapté au schéma réel
> (`profiles`, `service_plans`, wallet PDG) ; **aucune RPC d'activation parallèle** (on a
> ÉTENDU l'existante → zéro nouvelle surcharge = zéro drift). Atomique + blindé + idempotent.

## 1． Base de données (migrations)

### `20260618100000_country_pricing_foundation.sql`
- **Table `countries`** : country_code (ISO-2, PK), country_name, currency_code, currency_symbol,
  flag_emoji, `payment_methods text[]`, is_active. **Seed 7 pays** : GN, SN, CI, ML, FR, US, MA
  avec devises (GNF/XOF/EUR/USD/MAD) et moyens de paiement (orange_money, wave, card, sepa, cash_plus…).
- **Table `subscription_prices`** : (country_code, service_type, plan_code, billing_cycle) **UNIQUE**,
  `price` (dans la devise du pays), currency_code, commission_rate, is_active. Grille **fixée par
  l'admin** (PAS une conversion FX). Seed représentatif vendor + driver (ex. GN Pro = 25 000 GNF,
  FR Pro = 9,99 €).
- **`profiles.country_code`** (FK countries) + **`profiles.country_locked`** (bool). Backfill prudent
  depuis `country`/`detected_country` (mapping noms→ISO-2).
- **Table `user_country_change_log`** : journal des overrides de pays (user, ancien/nouveau, motif, par qui).
- **`get_subscription_price_by_country(user_id, service_type, plan, cycle)`** — résolveur SECURITY DEFINER :
  lit le pays **verrouillé** du profil, renvoie le prix de la grille (jamais le prix client). Renvoie
  `{found:false}` si pas de pays / pas de grille.
- **`admin_set_subscription_price(...)`** : upsert atomique d'un prix, gardé `is_admin_or_pdg()`, devise
  dérivée du pays (cohérence forcée).
- **`admin_set_country_active(code, bool)`** : activer/désactiver un pays (gardé admin).
- **`admin_change_user_country(user_id, new_country, reason)`** : change le pays d'un user, **motif
  obligatoire (≥3 car.)**, verrouille (`country_locked=true`), **journalise** dans
  user_country_change_log. `FOR UPDATE` sur la ligne profil.
- **RLS** : `countries` lisible par tous (auth) ; `subscription_prices` **lisible UNIQUEMENT pour son
  propre pays** (le client ne voit jamais un autre pays) ; écriture réservée admin/PDG ; journal
  lisible admin seulement.
- **REVOKE EXECUTE FROM PUBLIC, anon** sur toutes les fonctions.

### `20260618110000_subscription_purchase_by_country.sql`
- **`purchase_service_subscription_atomic`** recréé avec **la MÊME signature** (donc **aucune nouvelle
  surcharge**) : après les validations existantes, il appelle `get_subscription_price_by_country` ; si
  une grille existe pour le pays verrouillé, **le serveur IMPOSE ce prix** (le `p_amount` client est
  ignoré) et écrit `priced_by='country_grid'` + devise + commission en metadata. Sinon **repli** sur
  l'ancien comportement (plafond GNF du plan). Débit + écriture **atomiques**, rollback total sur RAISE,
  **idempotent** (clé via `wallet_debit_internal`). REVOKE FROM PUBLIC (service_role only).

## 2． Backend Node.js

### `backend/src/services/subscriptionPricing.service.ts`
- `getUserCountry(userId)` — pays verrouillé depuis profiles.
- `getCountryServicePrices(country, serviceType)` — grille d'un (pays, service), **cache Redis 24 h**
  (`prices:${country}:${service}`), jointure symbole + drapeau, fallback DB direct si Redis absent.
- `getSubscriptionPrice(userId, serviceType, plan, cycle)` — appelle le résolveur SQL (jamais le prix client).
- `formatPriceLabel(...)` — « 🇬🇳 Plan Pro — 25 000 GNF/mois ».
- `invalidateCountryPriceCache(country, service?)` — purge le cache après modif admin.

### `backend/src/routes/countryPricing.routes.ts` → monté `/api/v2/country-pricing`
- **Client** : `GET /my-country`, `GET /prices?service_type=`, `GET /price?service_type=&plan=&cycle=`
  (renvoient **uniquement le pays du client**).
- **Admin/PDG** (`requireRole(['admin','pdg'])`) : `GET /admin/countries`, `GET /admin/prices`,
  `POST /admin/prices`, `POST /admin/countries/:code/active`, `POST /admin/user-country`.
  Chaque écriture passe par une RPC atomique + invalide le cache.

## 3． Frontend

- **`src/hooks/useCountryPricing.ts`** : charge le pays + la grille du client via le backend ;
  `getPlanPrice(planCode, cycle)` ; `formatCountryPrice(price, currency)`. **N'utilise PAS `<Money>`**
  (prix déjà localisés → pas de double conversion).
- **`src/components/subscription/CountryPriceTag.tsx`** : affiche le prix avec le **drapeau réel**
  (`CountryFlag`, car les emojis-drapeaux ne s'affichent pas sur Windows). Ex. : 🇬🇳 Plan Pro — 25 000 GNF/mois.

## 4． Garanties (atomicité / blindage / drift)

| Exigence | Réalisé |
|---|---|
| Prix serveur (jamais client) | `get_subscription_price_by_country` + override dans le RPC d'achat |
| Pays verrouillé | `profiles.country_locked`, override admin tracé + motif obligatoire |
| Voyage n'affecte pas le prix | prix lu par `country_code` (pas la géoloc) |
| Atomique tout-ou-rien | RPC achat = débit + écriture, rollback sur RAISE |
| Idempotent | clé via `wallet_debit_internal` |
| Pas de drift | **même signature** du RPC d'achat → aucune surcharge ajoutée |
| Cache | Redis 24 h `prices:${country}:${service}`, invalidé à chaque modif admin |
| Sécurité | RLS (grille = son pays only) + REVOKE FROM PUBLIC + garde admin |

## 5． À FAIRE par l'utilisateur (déploiement)

1. **Appliquer** les 2 migrations dans Supabase SQL Editor (ordre : `…100000` puis `…110000`).
2. **Redéployer le backend** (nouvelles routes `/api/v2/country-pricing` + service de pricing).
3. Vérifier que les profils ont bien un `country_code` (le backfill couvre les cas connus ; les inconnus
   restent NULL → repli GNF jusqu'à correction admin via `POST /admin/user-country`).
4. (Optionnel) Brancher `CountryPriceTag` / `useCountryPricing` dans les écrans d'abonnement existants
   à la place du prix GNF converti.

## 6． Limites connues / non couvert (volontaire)

- Le RPC d'achat **service** est étendu ; les RPC **vendor**/**driver** (`purchase_vendor_subscription_atomic`,
  `purchase_driver_subscription_atomic`) peuvent être étendues à l'identique (même patron) quand on
  veut activer la grille sur ces domaines — non fait pour rester scoping minimal et sûr.
- Les prix de la grille sont seedés à titre d'exemple ; l'admin doit poser les vraies valeurs par pays.
- Hypothèse : la devise du wallet du client = la devise de son pays (cohérent avec le verrouillage). Si
  un client a un wallet d'une autre devise, le débit reste dans la devise du wallet via
  `wallet_debit_internal` (pas de conversion appliquée ici — à surveiller).
