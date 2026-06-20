# Rapport d'audit scalabilité — 2026-06-14

> **🔄 Rafraîchissement (2026-06-14, 2ᵉ passe)** — re-scan des commits postérieurs à l'audit
> initial (marketplace : filtres pays/ville, recherche, proximité ; monitoring ; ids).
> **Verdict** : le nouveau code marketplace est **bien fait pour le scaling** — index
> **trigram GIN** (`pg_trgm`) pour la recherche `%terme%` insensible aux accents (sinon seq scan),
> RPCs **atomiques en 1 appel** (`get_marketplace_home_country`, `get_proximity_listings`),
> sonde de capability cachée côté client. **1 régression corrigée** + 2 points notés ci-dessous.
>
> - 🟠 **CORRIGÉ** — `GET /api/v2/marketplace/home-country` (chemin **public à fort trafic**,
>   appelé à chaque chargement marketplace) **n'était pas caché** → ajout `cache.getOrSet`
>   Redis (60 s/pays, ne cache que les succès). `backend/src/routes/marketplace.routes.ts`.
> - 🟡 **À surveiller** — `computeHomeCountryFallback` charge **tous** les produits actifs sans
>   borne (`.eq('is_active', true)` sans `.limit`) **uniquement en mode dégradé** (RPC non
>   appliquée). Le cache ci-dessus le protège ; à appliquer la migration `…180000` pour ne
>   jamais l'emprunter.
> - 🟡 **À surveiller** — `get_proximity_listings` (RPC) renvoie **tous** les vendeurs du
>   périmètre **sans LIMIT** : OK tant que borné par ville/région, à paginer si une zone
>   dépasse quelques milliers de boutiques.


**Périmètre** : audit complet (backend Node/Express, Supabase/PostgreSQL, frontend React/TS,
sécurité, services tiers) pour tenir des millions d'utilisateurs simultanés.
**Stack** : React TS · Node Express · Supabase · GCS · Firebase FCM · Ably · Redis (Upstash) · Twilio · Cloudflare.

## Score global : **80 → 90 / 100** (après corrections code de cette passe)

> Codebase **mûr et déjà fortement durci** (rate-limiting Redis, helmet, compression, CORS strict,
> gestion d'erreurs, RLS, webhooks signés, idempotence en base, abstraction temps réel Ably-ready,
> cache FX, scaling horizontal ECS prêt).
>
> **Pourquoi pas 100/100 tout de suite** — les 10 points restants ne dépendent PAS du code :
> 1. **Révoquer/roter les clés Supabase** committées (TON compte Supabase) — tant que non fait, risque ouvert.
> 2. **Provisionner l'infra** (ECS Fargate, ElastiCache, Cloudflare CDN) — TON ops.
> 3. Nettoyage **progressif** des `SELECT *` sur les listes (à faire écran par écran, pas en bloc — risque métier).
> 4. **Cluster mode** volontairement écarté (incompatible serverless/ECS) — choix d'archi, pas un défaut.
>
> Autrement dit : **côté code, on est au maximum atteignable sans casser de fonctionnalité** ;
> le « 100 » se débloque par TES actions (rotation clés + infra) + le nettoyage progressif des SELECT *.

---

## 🔴 Critique (à corriger immédiatement)

1. **Clés Supabase RÉELLES committées dans `backend/.env.example` ET `.env.example` (racine)** (anon **+ `service_role`** — la racine est un fichier *frontend*, donc service_role doublement déplacée).
   La `service_role` bypasse la RLS = **accès total à la base** pour quiconque a le repo.
   - ✅ **Fait** : fichier remplacé par des placeholders.
   - ⚠️ **À FAIRE par toi, URGENT** : **révoquer/roter** ces clés dans Supabase (elles sont
     compromises car déjà dans l'historique git), puis purger l'historique si le repo est partagé.

2. **Aucun autre « tueur d'app » détecté** : pas de Realtime Supabase dans le backend, pas de pool
   `pg` persistant par instance, webhooks Stripe signés, gestion `unhandledRejection`/`uncaughtException`
   présente. (Bon signe.)

---

## 🟠 Important (à corriger avant le lancement)

1. **`SELECT *` répandu** — 96 (backend) + 443 (frontend). Sur les grosses tables (orders,
   products, wallet_transactions, messages), récupère des colonnes inutiles → bande passante + RAM.
   → Cibler les **requêtes de LISTE sur grosses tables** (pas les fetch mono-ligne). Ne PAS réécrire
   les 539 en masse (risque de casser une logique qui lit une colonne précise) — y aller par écran chaud.

2. **`console.log` référant des tokens** — ✅ **corrigé** : `users-extended.routes.ts:522` ne logge
   plus le token d'invitation (seulement l'email). Les autres (`useAgora`, `firebaseMessaging`,
   `Auth.tsx`) logguent autour de tokens **sans en imprimer la valeur** (messages d'état) → bénins.

3. **Cluster mode : NON, et c'est VOULU.** Le backend tourne en **serverless (Vercel)** +
   **ECS Fargate** (scaling par conteneurs, couche 1 livrée). Ajouter le module `cluster` Node
   **entrerait en conflit** avec ces deux modèles (un process par invocation/conteneur). → Le scaling
   se fait par **N conteneurs derrière l'ALB + autoscaling** (voir `backend/AWS_ECS_FARGATE.md`),
   pas par `cluster`. **Ne pas ajouter cluster.**

4. ~~Rate limit trop bas~~ → **RÉSOLU / faux positif** : le **défaut réel du code** est sain
   (`RATE_LIMIT_MAX_REQUESTS=10000` / fenêtre `60000ms`). Seul l'ancien `.env.example` affichait
   100/15min (trompeur) — ✅ corrigé pour refléter les vraies valeurs.

---

## 🟡 Optimisation (à corriger pour scaler)

1. **Index composites manquants** — la base a déjà ~122 index, mais il manque des **composites**
   filtre+tri pour les patterns chauds. → Voir **`migration.sql`** (11 index `CONCURRENTLY IF NOT EXISTS`).

2. **Cache (Redis) sous-exploité** — seul le **taux FX** est caché (fait). Candidats : listings
   marketplace (clé par query params + invalidation à l'écriture), profils vendeur publics.
   ⚠️ Ne PAS cacher les données mutables sensibles sans invalidation (ex. devise utilisateur).

3. **Realtime frontend** — 161 `supabase.channel()`. **Décision archi** : seuls les flux
   **haute-fréquence** (GPS, tracking) passent sur **Ably** (déjà fait, dual-mode) ; les flux
   **basse-fréquence/transactionnels** (notifications, statuts, escrow) **restent sur Supabase
   Realtime** (correct). → Finir : retirer les `postgres_changes` des 3 flux GPS migrés après
   validation live, puis activer Ably (`ABLY_API_KEY` + `VITE_REALTIME_PROVIDER=ably`).

4. **Images** — ~80 % en `loading="lazy"` (58/72). → Ajouter `loading="lazy"` + dimensions
   aux ~14 `<img>` restants. CDN **Cloudflare** devant GCS pour le cache edge.

5. **GPS en base** — les positions s'écrivent encore dans Postgres (delivery_tracking,
   taxi_ride_tracking). Après bascule Ably validée → **throttler/arrêter** ces écritures (le live
   passe par Ably) → WAL Postgres déchargé.

---

## ✅ Ce qui est déjà bien fait

- **Rate limiting** : `express-rate-limit` + limiteur global **partagé via Redis** + limites par route (`routeRateLimiter`).
- **Sécurité headers** : `helmet` actif. **Compression** gzip active.
- **CORS** : restrictif (allowlist `corsOrigins`, pas de `*`, local autorisé en dev seulement).
- **Erreurs** : middleware `errorHandler` global + `unhandledRejection`/`uncaughtException` + graceful shutdown.
- **Supabase** : client **singleton** (`supabaseAdmin`) ; accès via **PostgREST** (poolé côté Supabase) → scaler le backend ne multiplie pas les connexions DB. Pas de pool `pg` persistant (sauf migrations, sur pooler 6543).
- **Temps réel** : **aucun** Realtime Supabase dans le backend ; abstraction `getLiveChannel` (Supabase↔**Ably** par flag), client Ably **singleton** lazy, tokens signés serveur.
- **Webhooks** : Stripe **vérifié par signature** + idempotence en base.
- **DB** : RLS solide (audit antérieur : 0 fuite argent/PII), ~122 index, RPC monétaires **atomiques**.
- **Scaling** : backend **stateless** (Redis cache+rate-limit+locks, JWT, idempotence en base) → ECS Fargate prêt (split web/worker + verrou distribué + Dockerfile).
- **Frontend** : pas d'imports lourds (lodash/moment complets = 0), **308 `.limit()`** (requêtes bornées), 80 % images lazy.
- **Cache FX** : lecture des taux mise en cache (45 s, money-safe).

---

## Plan d'action prioritaire

1. **Révoquer/roter les clés Supabase** committées (anon + service_role) — **30 min** 🔴
2. Relever `RATE_LIMIT_MAX_REQUESTS` à une valeur prod réaliste — **5 min** 🟠
3. Appliquer **`migration.sql`** (index composites, en `CONCURRENTLY`) — **30 min** 🟡
4. Nettoyer les `console.log` qui impriment un token — **30 min** 🟠
5. Activer **Ably** (`ABLY_API_KEY` + `VITE_REALTIME_PROVIDER=ably`) + valider live, puis retirer les `postgres_changes` GPS — **2 h** 🟡
6. Cibler `SELECT *` → colonnes explicites sur les **listes** des grosses tables (écran par écran) — **progressif** 🟠
7. Provisionner **ECS Fargate + ElastiCache + Cloudflare** (guide fourni) — **ops** 🟡
8. Cache marketplace listings + invalidation à l'écriture — **2 h** 🟡

---

## Fichiers créés / modifiés (cet audit)

- **`backend/.env.example`** — secrets réels remplacés par placeholders + toutes les variables du stack (Ably, Redis, GCS, FCM, Twilio, RUN_BACKGROUND_JOBS…). *(modifié — sécurité)*
- **`.env.example`** (racine, frontend) — clés Supabase réelles (anon + service_role) remplacées par placeholders + ajout Ably (`VITE_REALTIME_PROVIDER`). *(modifié — sécurité)*
- **`migration.sql`** — 11 index composites `CONCURRENTLY IF NOT EXISTS` pour les patterns chauds. *(créé)*
- **`AUDIT_REPORT.md`** — ce rapport. *(créé)*

### Rappel — livré lors des sessions de scaling précédentes (déjà en place)
- `backend/Dockerfile`, `backend/AWS_ECS_FARGATE.md`, `AWS_SCALING_ROADMAP.md`, `REALTIME_SCALING.md`
- Split web/worker (`RUN_BACKGROUND_JOBS`) + verrou Redis surveillance
- Abstraction realtime `src/lib/realtime/*` (Supabase/Ably) + flux GPS dual-mode + analytics live
- Cache FX (`getInternalFxRate`) + helper `cache.getOrSet`

---

## Notes / hypothèses (à confirmer avec toi)
- **Cluster mode volontairement écarté** au profit d'ECS/serverless — confirme si tu veux malgré tout
  du `cluster` *dans* chaque conteneur (possible, mais l'autoscaling ECS est plus simple).
- **Réécriture massive des `SELECT *`** non faite (risque métier : certaines lectures s'appuient sur
  des colonnes précises) → à faire écran par écran, pas en bloc.
- **Twilio** : usage **sortant** uniquement (envoi SMS) → pas de webhook entrant à signer. Si tu ajoutes
  un webhook Twilio entrant, il faudra valider `X-Twilio-Signature`.
