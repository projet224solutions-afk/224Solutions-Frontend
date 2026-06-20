# SECRETS_INVENTORY — Étape 0 (cartographie) — 2026-06-14

Inventaire des secrets/clés du projet **avant** conception de 224Guard. Sert de
référentiel de vérité au moteur de détection (ce qui est PUBLIC légitime vs ce qui
ne doit JAMAIS apparaître côté frontend).

## 1. Stack & services tiers

| Service | Usage | Côté |
|---------|-------|------|
| Supabase (PostgreSQL/Auth/Storage) | DB, auth, RLS | front (anon) + back (service_role) |
| Ably | temps réel (géoloc, analytics) | front (token signé) + back (API key) |
| Redis (Upstash) | cache, rate-limit, locks | **back only** |
| Firebase FCM | push | front (config publique) + back (admin SDK) |
| Twilio | SMS | **back only** |
| Google Cloud Storage / Maps | fichiers, cartes | front (API key restreinte) + back (service acct) |
| Stripe | paiements | front (publishable) + back (secret) |
| Agora | audio/vidéo | front (app id) |
| AWS Cognito | (auth legacy/optionnel) | front (pool id public) |
| Mapbox / Sentry | cartes / erreurs | front (token public / DSN) |

## 2. Variables exposées au frontend (préfixe `VITE_`)

> Vite n'expose au bundle QUE les variables préfixées `VITE_`. Tout `VITE_*` est **public par conception** (présent en clair dans le bundle).

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_ABLY_KEY`, `VITE_REALTIME_PROVIDER`, `VITE_FIREBASE_*` (API_KEY, AUTH_DOMAIN,
PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID), `VITE_GOOGLE_CLOUD_API_KEY`,
`VITE_GOOGLE_MAPS_API_KEY`, `VITE_MAPBOX_TOKEN`, `VITE_AGORA_APP_ID`,
`VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_AWS_COGNITO_*`, `VITE_SENTRY_DSN`,
`VITE_BACKEND_URL`/`_API_URL`/`_MOBILE_URL`, `VITE_WEBSOCKET_URL`, `VITE_APP_*`.

## 3. Classification — référentiel pour 224Guard

### 3.1 PUBLIC par conception → NE PAS alerter (sauf contexte aggravant)
| Clé | Pourquoi public |
|-----|-----------------|
| `VITE_SUPABASE_ANON_KEY` | JWT `role:anon`, protégé par RLS — public attendu |
| `VITE_ABLY_KEY` (si présent) | ⚠️ une *API key* Ably (`xxx:yyy`) ne devrait PAS être au front → préférer token signé. À ÉVALUER EN CONTEXTE |
| `VITE_FIREBASE_API_KEY` (`AIza…`) | identifiant projet Firebase, public (sécurité = règles Firebase) |
| `VITE_STRIPE_PUBLISHABLE_KEY` (`pk_…`) | publishable, public par design |
| `VITE_GOOGLE_*` / `VITE_MAPBOX_TOKEN` | clés à **restreindre côté provider** (referrer/IP) — public mais à surveiller |
| `VITE_SENTRY_DSN` | public par design |
| `VITE_AGORA_APP_ID`, `VITE_AWS_COGNITO_*` | identifiants publics |

### 3.2 INTERDIT au frontend → ALERTE CRITIQUE si détecté
| Motif | Raison |
|-------|--------|
| JWT `role:service_role` (Supabase) | **bypass RLS = accès total DB** |
| `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `TRANSACTION_SECRET_KEY`, `CCP_ENCRYPTION_KEY`, `INTERNAL_API_KEY`, `MFA_ENCRYPTION_KEY` | secrets serveur |
| `sk_live_…` / `sk_test_…` / `rk_…` (Stripe secret) | paiement |
| `TWILIO_AUTH_TOKEN`, `TWILIO_ACCOUNT_SID` | SMS |
| Redis `rediss://default:PASSWORD@…` / `REDIS_PASSWORD` | cache/locks |
| `ALIEXPRESS_*`, `ALIBABA_*`, `ONE688_*`, `PRIVATE_SUPPLIER_API_KEY` | dropshipping (back only) |
| Firebase **admin** `FIREBASE_PRIVATE_KEY` / service account JSON | push admin |
| `-----BEGIN … PRIVATE KEY-----`, `AKIA…` (AWS), `ghp_…` (GitHub), `xox…` (Slack) | génériques serveur |
| `RESEND_API_KEY`, `PAYPAL_CLIENT_SECRET`, `DJOMY_CLIENT_SECRET`, `OPENAI_API_KEY`, `STRIPE_WEBHOOK_SECRET` | intégrations back |

## 4. Existant sécurité (à ÉTENDRE, pas dupliquer)

| Brique | Nature | Périmètre |
|--------|--------|-----------|
| `backend/src/services/frontendSecurity.service.ts` | scan **serveur périodique** du bundle DÉPLOYÉ (vue attaquant) : secrets, service_role JWT, source maps, headers manquants, clés provider | back, surveillance 24/7 → PDG « Surveillance Plateforme » |
| `scripts/scan-frontend-secrets.mjs` | garde **pré-déploiement** (`npm run scan:secrets`, bloque le build si fuite) | CI/local |
| `PdgSecurity.tsx` (`/pdg/security`) | dashboard sécurité (onglets Menaces/Surveillance/Bloqués/MFA/Fraude…) | front PDG |
| Tables : `system_alerts`, `security_alerts`, `audit_logs`, `blocked_ips` | alertes/incidents | DB |

**➡️ Différence de 224Guard** : monitoring **CLIENT, temps réel, in-browser** (intercepteur réseau live, runtime, WebSocket, anti-tamper) — couche **complémentaire** au scan serveur existant. 224Guard alimente les MÊMES tables d'alertes (`guard_224_*` + lien `system_alerts`) et s'affiche dans le MÊME dashboard PDG.

## 5. Style visuel du dashboard (intégration)

- **shadcn/ui** (Card, Tabs, Badge, Dialog, DropdownMenu, Button) + Tailwind.
- Couleur de marque : **`#ff4000`** (orange 224) ; sévérités vert/orange/rouge.
- Icônes **lucide-react**. Toasts **sonner**. Layout PDG = `Tabs` + `Card` arrondis.
- 224Guard = nouvel onglet du Centre Sécurité PDG, même langage visuel.

## 6. Surface d'exposition à couvrir (vecteurs)

bundle JS chargé · `localStorage`/`sessionStorage`/IndexedDB · headers/bodies des
requêtes `fetch`/XHR · messages WebSocket (Ably/Firebase) · DOM (attributs `data-*`,
scripts inline) · source maps `.map` · `manifest.json`/config JSON publiques ·
variables CSS · Service Worker.
