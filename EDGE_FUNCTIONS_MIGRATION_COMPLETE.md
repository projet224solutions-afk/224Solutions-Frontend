# 📋 MIGRATION COMPLÈTE: EDGE FUNCTIONS → NODE.JS BACKEND

## 🎯 Vue d'ensemble

**Total:** 216 Edge Functions Supabase → Nécess créer 30-40 routes Express/Node.js groupées par catégorie

**Timeline:** 6-8 semaines  
**Effort:** 240-320 heures  
**Équipe suggérée:** 2-3 développeurs

---

## 📁 Structure créée

```
backend/
├── src/routes/edge-functions/
│   ├── index.ts                 ← Point d'entrée (expose toutes les routes)
│   ├── auth.routes.ts           ✅ 13 functions (créé)
│   ├── payments.routes.ts       ✅ 45 functions (créé)
│   ├── TEMPLATE.routes.ts       ← Template pour les autres
│   ├── users.routes.ts          ← À faire
│   ├── ai.routes.ts             ← À faire
│   ├── files.routes.ts          ← À faire
│   └── ...                      ← À faire
├── EDGE_FUNCTIONS_INTEGRATION.md ← Instructions d'intégration
└── src/server.ts                (À mettre à jour avec 2 lignes)
```

---

## ⚙️ ÉTAPE 1: Intégration au Backend

Ouvrez `backend/src/server.ts` et effectuez 2 changements:

### Change 1 - Ajouter l'import (ligne ~50)

```typescript
// @ts-ignore
import edgeFunctionsRoutes from './routes/edge-functions/index.js';
```

### Change 2 - Monter la route (ligne ~150, avec autres app.use())

```typescript
// ==================== V3 ROUTES (with per-route rate limits) ====================
app.use('/api/vendors', vendorRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
// ... autres routes ...
app.use('/api/payment-links', paymentLinksRoutes);

// Edge Functions - Migrated from Supabase ← AJOUTER CETTE LIGNE
app.use('/edge-functions', edgeFunctionsRoutes);
```

**Nouvelles routes disponibles après intégration:**
```
POST   /edge-functions/auth/login
POST   /edge-functions/auth/verify-otp
POST   /edge-functions/payments/stripe/intent
POST   /edge-functions/payments/stripe/webhook
...et bien d'autres
```

---

## 📊 PHASES DE MIGRATION

### ✅ PHASE 1 (SEMAINE 1-2): AUTHENTICATION & AUTH-CRITICAL

**13 fonctions**  
**Priorité:** 🔴 MAXIMUM (bloc pour toutes autres)

**Fichier créé:** `backend/src/routes/edge-functions/auth.routes.ts`

**Fonctions incluses:**
- POST `/auth/login` - Login standard ✅
- POST `/auth/verify-otp` - Vérif OTP ✅
- POST `/auth/agent/login` - Login agent ✅
- POST `/auth/bureau/login` - Login bureau ✅
- POST `/auth/reset-password` - Reset MDL ✅
- PATCH `/auth/change-password` - Change MDL ✅
- POST `/auth/pdg/mfa` - Setup MFA ✅
- POST `/auth/cognito/proxy` - Cognito proxy
- POST `/auth/totp-setup` - TOTP setup
- POST `/auth/verify-totp` - TOTP verification
- POST `/auth/backup-codes` - Backup codes
- DELETE `/auth/session/:id` - Logout
- POST `/auth/refresh-token` - Refresh token

**Dépendances à vérifier:**
- Supabase Auth SDK ✅
- jsonwebtoken
- speakeasy (TOTP)
- AWS SDK (Cognito)

---

### 🟠 PHASE 2 (SEMAINE 2-4): PAYMENTS & ESCROW

**45 fonctions**  
**Priorité:** 🔴 MAXIMUM (revenue-critical)

**Fichier créé:** `backend/src/routes/edge-functions/payments.routes.ts`

**Sous-catégories:**

#### A. Stripe (15 functions)
- POST `/payment/stripe/intent` - Create payment intent ✅
- POST `/payment/stripe/webhook` - Handle webhooks ✅
- POST `/payment/stripe/deposit` - Create deposit ✅
- POST `/payment/stripe/subscription` - Create subscription
- POST `/payment/stripe/refund` - Process refund
- GET `/payment/stripe/invoice/:id` - Get invoice
- POST `/payment/stripe/retry-payment` - Retry failed payment
- DELETE `/payment/stripe/customer/:id` - Delete customer
- POST `/payment/stripe/daily-summary` - Daily reconciliation
- ... (5+ autres)

#### B. PayPal (10 functions)
- POST `/payment/paypal/order` - Create order
- POST `/payment/paypal/webhook` - Handle webhooks ✅
- POST `/payment/paypal/capture` - Capture order
- GET `/payment/paypal/order/:id` - Get order details
- ... (6+ autres)

#### C. Escrow (8 functions)
- POST `/escrow/create` - Create escrow ✅
- POST `/escrow/release` - Release to seller ✅
- POST `/escrow/refund` - Refund to buyer
- POST `/escrow/dispute` - Raise dispute
- GET `/escrow/:id` - Get escrow details
- ... (3+ autres)

#### D. Wallet (8 functions)
- POST `/wallet/transfer` - Transfer funds ✅
- GET `/wallet/balance` - Get balance ✅
- GET `/wallet/transactions` - List transactions
- POST `/wallet/deposit` - Deposit to wallet
- POST `/wallet/withdraw` - Withdraw from wallet
- ... (3+ autres)

#### E. Mobile Money (4 functions)
- POST `/payment/djomy/init` - Djomy init
- POST `/payment/chapchappay/init` - ChapChapPay init
- POST `/payment/mobile-money/withdraw` - Withdraw
- POST `/payment/mobile-money/webhook` - Handle webhooks

**Dépendances:**
- @stripe/stripe-js ✅
- @paypal/checkout-server-sdk ✅
- Database RPC functions (transfer_funds, etc.) - À vérifier
- External APIs: Djomy, ChapChapPay

---

### 🟡 PHASE 3 (SEMAINE 2-3): USER MANAGEMENT

**28 fonctions**  
**Priorité:** 🟡 HAUTE

**À créer:** `backend/src/routes/edge-functions/users.routes.ts`

**Fonctions:**
- POST `/users/create` - Create user
- DELETE `/users/delete` - Delete user
- POST `/users/export` - Export user data
- POST `/users/migrate-cognito` - Migrate to Cognito
- GET `/users/activity` - Get activity log
- PATCH `/users/profile` - Update profile
- POST `/agents/create` - Create agent
- DELETE `/agents/delete` - Delete agent
- GET `/agents/productos` - Get agent products
- PATCH `/agents/performance` - Update performance
- POST `/companies/create` - Create company
- DELETE `/companies/delete` - Delete company
- POST `/bureaus/create` - Create bureau
- DELETE `/bureaus/delete` - Delete bureau
- ... (14+ autres)

---

### 🟡 PHASE 4 (SEMAINE 3-4): AI/ML & FILE GENERATION

**27 functions (14 AI + 13 Files)**  
**Priorité:** 🟡 MOYENNE

**À créer:** 
- `backend/src/routes/edge-functions/ai.routes.ts` (14)
- `backend/src/routes/edge-functions/files.routes.ts` (13)

**AI Functions:**
- POST `/ai/copilot` - Copilot chat (OpenAI)
- POST `/ai/contract` - Generate contract (Gemini)
- POST `/ai/recommend` - Product recommendation
- POST `/ai/predict` - Predict demand
- ... (10+ autres)

**File Generation:**
- POST `/generate/pdf/invoice` - Generate invoice PDF
- POST `/generate/pdf/contract` - Generate contract PDF
- POST `/generate/image/product` - Generate product image
- POST `/generate/csv/export` - Export to CSV
- ... (9+ autres)

**Dépendances:**
- openai (GPT-4)
- Gemini API
- pdfkit
- canvas / image-processing
- csv-parser

---

### 🟢 PHASE 5+ (SEMAINE 4+): RESTE DES FUNCTIONS

**~160 functions restantes**  
**Priorité:** 🟢 BASSE-MOYENNE

**Backlog à traiter:**
- Product Management (14)
- Order Management (9)
- Webhooks (9+)
- Analytics & Monitoring (20+)
- External APIs (Google, Firebase, etc) (11+)
- Autres (60+)

**À créer progressivement:**
```
├── products.routes.ts
├── orders.routes.ts
├── webhooks.routes.ts
├── analytics.routes.ts
├── external-apis.routes.ts
└── misc.routes.ts
```

---

## 🛠️ CHECKLIST PAR ÉTAPE

### Avant de commencer
- [ ] Lire ce document entièrement
- [ ] Vérifier tous les fichiers `.env` sont à jour
- [ ] Tester que `npm run dev:backend` fonctionne
- [ ] Backuper la base de données Supabase

### Phase 1: Setup
- [ ] Ajouter 2 lignes à `backend/src/server.ts` (import + mount)
- [ ] `npm install jsonwebtoken speakeasy` (dépendances Auth)
- [ ] Tester: `curl http://localhost:3001/edge-functions/health`

### Phase 2: Auth Routes
- [ ] ✅ `auth.routes.ts` est déjà créé
- [ ] Tester chaque endpoint (voir tests API ci-dessous)
- [ ] Ajouter tests unitaires pour auth
- [ ] Vérifier logs pour erreurs

### Phase 3: Payment Routes
- [ ] ✅ `payments.routes.ts` est déjà créé
- [ ] Tester Stripe intent creation
- [ ] Tester webhook signature verification
- [ ] Tester wallet transfer logic
- [ ] Configurer webhooks Stripe/PayPal en production

### Phase 4+: Autres Routes
- [ ] Copier `TEMPLATE.routes.ts` pour chaque catégorie
- [ ] Implémenter selon les specs de chaque fonction
- [ ] Importer dans `edge-functions/index.ts`
- [ ] Monter via `router.use()`

---

## 🧪 TESTS API

### Test Auth Login
```bash
curl -X POST http://localhost:3001/edge-functions/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Test Stripe Intent
```bash
curl -X POST http://localhost:3001/edge-functions/payments/stripe/intent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{
    "amount": 99.99,
    "currency": "USD",
    "description": "Test payment"
  }'
```

### Test Wallet Balance
```bash
curl http://localhost:3001/edge-functions/payments/wallet/balance \
  -H "Authorization: Bearer YOUR_JWT"
```

---

## 📦 DÉPENDANCES NPM À INSTALLER

```bash
npm install \
  jsonwebtoken \
  speakeasy \
  qrcode \
  @stripe/stripe-js \
  @paypal/checkout-server-sdk \
  openai \
  @google-ai/generativelanguage \
  pdfkit \
  canvas \
  csv-stringify \
  axios
```

---

## 🚀 COMMANDES DE DÉVELOPPEMENT

```bash
# Démarrer backend
npm run dev:backend

# Ou avec watch/auto-reload
npm run dev:all

# Tester Edge Functions
curl http://localhost:3001/edge-functions/health

# Vérifier logs
npm run dev:backend 2>&1 | grep "edge-functions"
```

---

## ✅ CRITÈRES DE SUCCÈS

- [ ] Toutes 216 Edge Functions migrées → 30-40 routes Express
- [ ] Pas de changement de l'API (mêmes endpoints HTTP)
- [ ] Tous les webhooks continuent à fonctionner
- [ ] Performance similaire ou meilleure
- [ ] Logs et monitoring en place
- [ ] Tests automatisés fournis
- [ ] Documentation mise à jour

---

## 📞 SUPPORT

Si vous êtes bloqué sur une fonction spécifique:
1. Consulter le rapport audit: `EDGE_FUNCTIONS_DETAILED.json`
2. Utiliser le template: `TEMPLATE.routes.ts`
3. Adapter selon la logique spécifique
4. Ajouter des logs pour déboguer

Good luck! 🚀
