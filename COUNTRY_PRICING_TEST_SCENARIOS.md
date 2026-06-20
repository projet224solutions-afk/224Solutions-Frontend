# COUNTRY_PRICING_TEST_SCENARIOS.md — Scénarios de test

> À jouer APRÈS application des migrations `20260618100000` + `20260618110000` et redéploiement
> backend. SQL = Supabase SQL Editor. API = appels HTTP avec un JWT du rôle indiqué.

## A． Données de référence (SQL)

```sql
-- 7 pays seedés, avec devises et moyens de paiement
SELECT country_code, currency_code, currency_symbol, payment_methods, is_active FROM public.countries ORDER BY country_code;
-- Grille de prix (vendor + driver)
SELECT country_code, service_type, plan_code, price, currency_code, commission_rate FROM public.subscription_prices ORDER BY country_code, service_type, plan_code;
-- Colonnes ajoutées
SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name IN ('country_code','country_locked');
```
**Attendu** : 7 pays, grille non vide, 2 colonnes présentes.

## B． Résolveur de prix (cœur du système)

```sql
-- Un user guinéen voit le prix GNF ; un user français voit le prix EUR — pour le MÊME plan.
SELECT public.get_subscription_price_by_country('<UUID_USER_GN>', 'vendor', 'pro', 'monthly');
SELECT public.get_subscription_price_by_country('<UUID_USER_FR>', 'vendor', 'pro', 'monthly');
```
**Attendu** : GN → `price=25000, currency_code=GNF` ; FR → `price=9.99, currency_code=EUR`.
**Échecs gérés** : user sans `country_code` → `{found:false, reason:NO_COUNTRY}` ; plan absent de la
grille → `{found:false, reason:NO_GRID_PRICE}`.

## C． Isolation : le client ne voit QUE son pays (RLS)

```sql
-- En tant que user GN (clé anon + JWT user GN), tenter de lire la grille FR :
SELECT * FROM public.subscription_prices WHERE country_code='FR';   -- → 0 ligne (RLS)
SELECT * FROM public.subscription_prices WHERE country_code='GN';   -- → ses lignes
```
**Attendu** : la requête sur un autre pays renvoie 0 ligne pour un client ; un admin/PDG voit tout.

### API
```
GET /api/v2/country-pricing/prices?service_type=vendor   (JWT user GN)
```
**Attendu** : `country_code:"GN"`, prix en GNF, libellés « … 25 000 GNF/mois ». Jamais de prix EUR/USD.

## D． Achat : le serveur impose le prix de la grille (jamais le prix client)

Scénario : un user GN achète le plan Pro service en envoyant un **faux** `p_amount` (ex. 1).
```sql
SELECT public.purchase_service_subscription_atomic(
  '<UUID_USER_GN>', 1 /* faux prix client */, 'idem-test-1', 'Abo Pro test',
  'new', '<UUID_SERVICE>', '<UUID_PLAN_PRO>', 'monthly', 'wallet',
  now(), now()+interval '30 days', true, '{}'::jsonb, NULL);
```
**Attendu** : `status='created'`, `charged_amount=25000` (prix grille GN, pas 1), `priced_by='country_grid'`.
Le wallet est débité de **25 000**, pas de 1. → Le prix client est ignoré.

### Idempotence
Rejouer le MÊME appel avec la même `idem-test-1` → **pas de double débit** (DUPLICATE_PAYMENT géré).

### Repli (pays sans grille)
User d'un pays sans ligne dans `subscription_prices` pour ce plan → `priced_by='plan_gnf_fallback'`,
montant plafonné au prix GNF du plan (ancien comportement, anti-surfacturation conservé).

### Atomicité
Forcer un solde insuffisant → `status='error'`, `error` contient `INSUFFICIENT_FUNDS`, **aucune** ligne
créée dans `service_subscriptions`, **aucun** débit (rollback total).

## E． Admin : gestion de la grille

```
POST /api/v2/country-pricing/admin/prices   (JWT admin/pdg)
  { "country_code":"GN","service_type":"vendor","plan_code":"pro","price":30000 }
```
**Attendu** : `success:true`, la grille GN/vendor/pro passe à 30 000, **cache invalidé**.
Re-`GET /price?...plan=pro` (user GN) → 30 000 (nouvelle valeur, pas l'ancienne en cache).

```
POST … (JWT client non-admin)  → 403 (requireRole) ; RPC → RAISE 'NOT_ADMIN'.
```

## F． Activer/désactiver un pays

```
POST /api/v2/country-pricing/admin/countries/MA/active   { "is_active": false }
```
**Attendu** : MA désactivé ; `admin_set_subscription_price` sur MA → `COUNTRY_NOT_FOUND_OR_INACTIVE`.

## G． Changer le pays d'un utilisateur (motif obligatoire + log)

```
POST /api/v2/country-pricing/admin/user-country
  { "user_id":"<UUID>", "new_country":"SN", "reason":"Déménagement confirmé KYC" }
```
**Attendu** : `success:true`, profil → `country_code='SN'`, `country_locked=true`, une ligne dans
`user_country_change_log` (old/new/reason/changed_by). Sans `reason` (ou <3 car.) → `REASON_REQUIRED`.

## H． Voyage ≠ changement de prix

Un user GN qui se connecte depuis la France (géoloc=FR) :
- `GET /my-country` → renvoie toujours **GN** (verrouillé).
- `GET /prices` → toujours en **GNF**.
**Attendu** : la géoloc n'altère NI le pays NI le prix (elle sert seulement à trouver des prestataires
proches, hors de ce système).

## I． Sécurité (anon / PUBLIC)

```sql
-- En anon, aucune fonction sensible n'est exécutable :
SELECT public.admin_set_subscription_price('GN','vendor','pro',1,NULL,'monthly',true); -- → permission denied
SELECT public.get_subscription_price_by_country('<UUID>','vendor','pro','monthly');     -- → permission denied (anon)
```
**Attendu** : `permission denied for function` (REVOKE FROM PUBLIC, anon).

## J． Non-régression devise

Vérifier qu'un prix de grille **n'est pas** re-converti par `<Money>` à l'affichage (sinon prix faux).
`CountryPriceTag` / `useCountryPricing` affichent la devise du pays **telle quelle**.
**Attendu** : 25 000 GNF reste 25 000 GNF (pas converti en EUR pour un écran ouvert depuis la France).
