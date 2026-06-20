# 📋 RAPPORT COMPLET - MIGRATION EDGE FUNCTIONS SUPABASE → NODE.JS BACKEND

**Date**: 31 Mars 2026  
**Total Edge Functions**: 216  
**Status**: Audit complet  
**Projet**: Vista Flows

---

## 📊 RÉSUMÉ EXÉCUTIF

### Distribution par Catégorie

| Catégorie | Nombre | Priorité | Complexité |
|-----------|--------|----------|-----------|
| **Payment Processing** | 36 | 🔴 HAUTE | ⭐⭐⭐ |
| **Authentication & Security** | 13+ | 🔴 HAUTE | ⭐⭐ |
| **User Management** | 30+ | 🟡 MOYENNE | ⭐⭐ |
| **Product Management** | 14 | 🟡 MOYENNE | ⭐ |
| **AI/ML & Generation** | 19 | 🟡 MOYENNE | ⭐⭐⭐ |
| **File Generation** | 10 | 🟡 MOYENNE | ⭐⭐ |
| **Order Management** | 7 | 🟡 MOYENNE | ⭐ |
| **Webhooks** | 5+ | 🔴 HAUTE | ⭐⭐ |
| **External APIs & Integrations** | 50+ | 🟢 FAIBLE | ⭐ |
| **Analytics & Monitoring** | 20+ | 🟢 FAIBLE | ⭐ |
| **Other (Security, Cache, etc)** | 50+ | 🟢 FAIBLE | ⭐⭐ |

---

## 🔐 CATÉGORIE 1: AUTHENTICATION & SECURITY (13+ functions)

### 1.1 Authentication Functions

| Fonction | Path | Méthode HTTP | Paramètres | BD | APIs Externes | Dépendances |
|----------|------|--------------|-----------|----|----|-------------|
| `auth-verify-otp` | `/auth/verify-otp` | POST | `identifier`, `otp`, `user_type` | ✅ Supabase Auth | ❌ | @supabase/supabase-js |
| `auth-agent-login` | `/auth/agent/login` | POST | `email`, `password` | ✅ Supabase Auth | ❌ | JWT, @supabase/supabase-js |
| `auth-bureau-login` | `/auth/bureau/login` | POST | `email`, `password` | ✅ Supabase Auth | ❌ | JWT, @supabase/supabase-js |
| `auth-agent-bureau-login` | `/auth/agent-bureau/login` | POST | `email`, `password`, `bureau_id` | ✅ Supabase Auth | ❌ | JWT, @supabase/supabase-js |
| `auth-agent-bureau-verify-otp` | `/auth/agent-bureau/verify-otp` | POST | `identifier`, `otp`, `bureau_id` | ✅ Supabase Auth | ❌ | @supabase/supabase-js |
| `universal-login` | `/auth/universal` | POST | `email_or_phone`, `password` | ✅ Supabase Auth + profiles | ❌ | @supabase/supabase-js |
| `create-bureau-with-auth` | `/auth/create-bureau` | POST | `name`, `email`, `password` | ✅ Supabase Auth + bureaux | ❌ | @supabase/supabase-js |
| `cognito-auth-proxy` | `/auth/cognito` | POST | AWS Cognito tokens | ✅ Supabase sync | ✅ AWS Cognito | aws-sdk-js, @supabase/supabase-js |
| `cognito-sync-session` | `/auth/cognito/sync` | POST | `cognito_token` | ✅ Supabase | ✅ AWS Cognito | aws-sdk-js, @supabase/supabase-js |
| `generate-totp` | `/auth/totp/generate` | POST | (aucun) | ✅ users_totp table | ❌ | speakeasy, qrcode |
| `verify-totp` | `/auth/totp/verify` | POST | `user_id`, `token` | ✅ users_totp table | ❌ | speakeasy |
| `pdg-mfa-verify` | `/auth/pdg/mfa` | POST | `user_id`, `totp_code`, `passport` | ✅ Supabase | ❌ | speakeasy, @supabase/supabase-js |
| `reset-agent-password` | `/auth/agent/reset-password` | POST | `email` | ✅ Supabase Auth | ❌ | @supabase/supabase-js |
| `reset-pdg-password` | `/auth/pdg/reset-password` | POST | `email` | ✅ Supabase Auth | ❌ | @supabase/supabase-js |
| `change-agent-password` | `/auth/agent/change-password` | POST | `old_password`, `new_password` | ✅ Supabase Auth | ❌ | @supabase/supabase-js |
| `change-bureau-password` | `/auth/bureau/change-password` | POST | `old_password`, `new_password` | ✅ Supabase Auth | ❌ | @supabase/supabase-js |
| `change-member-password` | `/auth/member/change-password` | POST | `old_password`, `new_password` | ✅ Supabase Auth | ❌ | @supabase/supabase-js |

**Opérations Principales**:
- ✅ Authentification multi-canaux (email, SMS, TOTP)
- ✅ Gestion des profils (agents, bureaux, membres)
- ✅ Intégration AWS Cognito
- ✅ MFA/2FA avec TOTP
- ✅ Password reset/change

---

## 💳 CATÉGORIE 2: PAYMENT PROCESSING (36 functions)

### 2.1 Stripe Integration

| Fonction | Path | Méthode HTTP | Paramètres | BD | APIs Externes | Dépendances |
|----------|------|--------------|-----------|----|----|-------------|
| `create-payment-intent` | `/payment/stripe/create-intent` | POST | `amount`, `currency`, `user_id`, `metadata` | ✅ Supabase | ✅ Stripe API | @stripe/stripe-js, @supabase/supabase-js |
| `stripe-create-payment-intent` | `/payment/stripe/create` | POST | `amount`, `currency` | ✅ Supabase | ✅ Stripe API | @stripe/stripe-js |
| `stripe-deposit` | `/payment/stripe/deposit` | POST | `amount`, `currency` | ✅ Supabase (wallets) | ✅ Stripe | @stripe/stripe-js |
| `stripe-withdrawal` | `/payment/stripe/withdrawal` | POST | `amount`, `currency`, `account_id` | ✅ Supabase | ✅ Stripe Connect | @stripe/stripe-js |
| `stripe-webhook` | `/payment/stripe/webhook` | POST | Stripe event JSON | ✅ Supabase (transactions) | ✅ Stripe (webhook) | @stripe/stripe-js |
| `stripe-marketplace-payment` | `/payment/stripe/marketplace` | POST | `seller_id`, `amount`, `items` | ✅ Supabase | ✅ Stripe Connect | @stripe/stripe-js |
| `stripe-pos-payment` | `/payment/stripe/pos` | POST | `amount`, `venue_id` | ✅ Supabase | ✅ Stripe Terminal | @stripe/stripe-js |
| `confirm-stripe-deposit` | `/payment/stripe/confirm-deposit` | POST | `deposit_id`, `confirmation_token` | ✅ Supabase | ✅ Stripe | @stripe/stripe-js |

### 2.2 PayPal Integration

| Fonction | Path | Méthode HTTP | Paramètres | BD | APIs Externes | Dépendances |
|----------|------|--------------|-----------|----|----|-------------|
| `create-paypal-order` | `/payment/paypal/create` | POST | `amount`, `currency`, `items` | ✅ Supabase | ✅ PayPal API | axios, @supabase/supabase-js |
| `paypal-deposit` | `/payment/paypal/deposit` | POST | `amount`, `currency` | ✅ Supabase (wallets) | ✅ PayPal | axios |
| `paypal-withdrawal` | `/payment/paypal/withdrawal` | POST | `amount`, `paypal_email` | ✅ Supabase | ✅ PayPal | axios |
| `paypal-webhook` | `/payment/paypal/webhook` | POST | PayPal event JSON | ✅ Supabase (transactions) | ✅ PayPal (webhook) | axios |
| `paypal-client-id` | `/payment/paypal/config` | GET | (aucun) | ❌ | ❌ | (env vars only) |

### 2.3 Escrow Management

| Fonction | Path | Méthode HTTP | Paramètres | BD | APIs Externes | Dépendances |
|----------|------|--------------|-----------|----|----|-------------|
| `escrow-create` | `/escrow/create` | POST | `seller_id`, `buyer_id`, `amount`, `items` | ✅ Supabase (escrow table) | ❌ | @supabase/supabase-js |
| `escrow-create-stripe` | `/escrow/create-stripe` | POST | `seller_id`, `buyer_id`, `amount`, `stripe_token` | ✅ Supabase | ✅ Stripe | @stripe/stripe-js, @supabase/supabase-js |
| `escrow-release` | `/escrow/release` | POST | `escrow_id`, `authorization` | ✅ Supabase | ✅ Stripe (if applicable) | @supabase/supabase-js, @stripe/stripe-js |
| `escrow-refund` | `/escrow/refund` | POST | `escrow_id`, `reason` | ✅ Supabase | ✅ Stripe (if applicable) | @supabase/supabase-js |
| `escrow-dispute` | `/escrow/dispute` | POST | `escrow_id`, `reason`, `evidence` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `escrow-auto-release` | `/escrow/auto-release` | POST | `escrow_id` | ✅ Supabase | ✅ Stripe (if applicable) | @supabase/supabase-js |
| `escrow-stripe-webhook` | `/escrow/stripe/webhook` | POST | Stripe event | ✅ Supabase | ✅ Stripe (webhook) | @stripe/stripe-js |
| `link-escrow-order` | `/escrow/link-order` | POST | `escrow_id`, `order_id` | ✅ Supabase | ❌ | @supabase/supabase-js |

### 2.4 Wallet Management

| Fonction | Path | Méthode HTTP | Paramètres | BD | APIs Externes | Dépendances |
|----------|------|--------------|-----------|----|----|-------------|
| `wallet-transfer` | `/wallet/transfer` | POST | `from_user`, `to_user`, `amount` | ✅ Supabase (wallets) | ❌ | @supabase/supabase-js |
| `wallet-operations` | `/wallet/operations` | GET/POST | `user_id`, `type` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `wallet-payment-api` | `/wallet/pay` | POST | `user_id`, `amount`, `recipient` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `wallet-audit` | `/wallet/audit` | GET | `user_id`, `start_date`, `end_date` | ✅ Supabase | ❌ | @supabase/supabase-js |

### 2.5 Mobile Money Integration

| Fonction | Path | Méthode HTTP | Paramètres | BD | APIs Externes | Dépendances |
|----------|------|--------------|-----------|----|----|-------------|
| `djomy-init-payment` | `/payment/djomy/init` | POST | `amount`, `phone`, `currency` | ✅ Supabase | ✅ Djomy API | axios |
| `djomy-payment` | `/payment/djomy/pay` | POST | `amount`, `phone`, `reference` | ✅ Supabase | ✅ Djomy API | axios |
| `djomy-webhook` | `/payment/djomy/webhook` | POST | Djomy event | ✅ Supabase | ✅ Djomy (webhook) | axios |
| `djomy-verify` | `/payment/djomy/verify` | POST | `reference` | ✅ Supabase | ✅ Djomy API | axios |
| `djomy-secure-webhook` | `/payment/djomy/secure` | POST | Djomy event (signed) | ✅ Supabase | ✅ Djomy (webhook) | axios, crypto |
| `chapchappay-ecommerce` | `/payment/chapchappay/ecommerce` | POST | `amount`, `reference` | ✅ Supabase | ✅ ChapChapPay | axios |
| `chapchappay-webhook` | `/payment/chapchappay/webhook` | POST | ChapChapPay event | ✅ Supabase | ✅ ChapChapPay (webhook) | axios |
| `chapchappay-push` | `/payment/chapchappay/push` | POST | Payment data | ✅ Supabase | ✅ ChapChapPay | axios |
| `chapchappay-pull` | `/payment/chapchappay/pull` | GET | `reference` | ✅ Supabase | ✅ ChapChapPay | axios |
| `chapchappay-status` | `/payment/chapchappay/status` | GET | `reference` | ✅ Supabase | ✅ ChapChapPay | axios |
| `mobile-money-withdrawal` | `/payment/mobile-money/withdraw` | POST | `amount`, `phone`, `provider` | ✅ Supabase | ✅ M-Pesa, Airtel, etc | axios |

### 2.6 Payment Management

| Fonction | Path | Méthode HTTP | Paramètres | BD | APIs Externes | Dépendances |
|----------|------|--------------|-----------|----|----|-------------|
| `payment-core` | `/payment/core` | POST | `type`, `amount`, `user_id` | ✅ Supabase | ✅ Multiple providers | @stripe/stripe-js, axios |
| `payment-diagnostic` | `/payment/diagnostic` | GET | `payment_id` | ✅ Supabase | ✅ Payment providers | @supabase/supabase-js |
| `process-payment-link` | `/payment/link/process` | POST | `link_id`, `amount` | ✅ Supabase | ✅ Stripe/PayPal | @stripe/stripe-js, axios |
| `resolve-payment-link` | `/payment/link/resolve` | GET | `link_id` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `delivery-payment` | `/payment/delivery` | POST | `order_id`, `driver_id`, `amount` | ✅ Supabase | ✅ Multiple | @supabase/supabase-js |
| `freight-payment` | `/payment/freight` | POST | `shipment_id`, `amount` | ✅ Supabase | ✅ Stripe/Africa FX | @stripe/stripe-js, axios |
| `restaurant-payment` | `/payment/restaurant` | POST | `order_id`, `restaurant_id`, `amount` | ✅ Supabase | ✅ Multiple | @supabase/supabase-js |
| `service-payment` | `/payment/service` | POST | `service_id`, `amount` | ✅ Supabase | ✅ Multiple | @supabase/supabase-js |
| `secure-payment-init` | `/payment/secure/init` | POST | `amount`, `user_id` | ✅ Supabase | ✅ Stripe/PayPal | @stripe/stripe-js, axios |
| `secure-payment-validate` | `/payment/secure/validate` | POST | `token`, `amount` | ✅ Supabase | ✅ Stripe/PayPal | @stripe/stripe-js, axios |
| `marketplace-escrow-payment` | `/payment/marketplace/escrow` | POST | `seller_id`, `buyer_id`, `amount` | ✅ Supabase | ✅ Multiple | @supabase/supabase-js |
| `taxi-payment` | `/payment/taxi` | POST | `ride_id`, `amount` | ✅ Supabase | ✅ Multiple | @supabase/supabase-js |
| `taxi-payment-process` | `/payment/taxi/process` | POST | `ride_id`, `driver_id` | ✅ Supabase | ✅ Multiple | @supabase/supabase-js |
| `assess-payment-risk` | `/payment/risk/assess` | POST | `amount`, `user_id`, `metadata` | ✅ Supabase | ✅ Fraud detection API | axios, @supabase/supabase-js |
| `admin-review-payment` | `/admin/payment/review` | POST | `payment_id` | ✅ Supabase | ✅ Stripe | @stripe/stripe-js, @supabase/supabase-js |

**Opérations Principales**:
- ✅ Intégration Stripe (payment intents, transfers, Connect)
- ✅ Intégration PayPal
- ✅ Gestion Escrow
- ✅ Mobile Money (Djomy, ChapChapPay, M-Pesa)
- ✅ Webhooks de confirmation de paiement
- ✅ Gestion des portefeuilles numériques
- ✅ Détection de fraude
- ✅ Logs de transactions

---

## 👥 CATÉGORIE 3: USER & AGENT MANAGEMENT (30+ functions)

| Fonction | Path | Méthode HTTP | Paramètres | BD | APIs Externes | Dépendances |
|----------|------|--------------|-----------|----|----|-------------|
| `create-user-by-agent` | `/users/create-by-agent` | POST | `email`, `name`, `phone` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `delete-user` | `/users/delete` | DELETE | `user_id` | ✅ Supabase Auth + profiles | ❌ | @supabase/supabase-js |
| `restore-user` | `/users/restore` | POST | `user_id` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `export-users-for-cognito` | `/users/export` | GET | (auth only) | ✅ Supabase Auth | ❌ | @supabase/supabase-js |
| `migrate-users-to-cognito` | `/users/migrate-cognito` | POST | Auth data | ✅ Supabase → AWS Cognito | ✅ AWS Cognito | aws-sdk-js, @supabase/supabase-js |
| `get-user-activity` | `/users/activity` | GET | `user_id`, `time_range` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `get-agent-users` | `/agents/users` | GET | `agent_id` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `create-pdg-agent` | `/agents/pdg/create` | POST | `email`, `name` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `create-sub-agent` | `/agents/sub/create` | POST | `parent_agent_id`, `email` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `create-vendor-agent` | `/agents/vendor/create` | POST | `vendor_id`, `email` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `delete-pdg-agent` | `/agents/pdg/delete` | DELETE | `agent_id` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `pdg-delete-vendor` | `/agents/pdg/vendor/delete` | DELETE | `vendor_id` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `pdg-delete-service-product` | `/agents/pdg/product/delete` | DELETE | `product_id` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `pdg-update-agent-email` | `/agents/pdg/email` | PATCH | `agent_id`, `new_email` | ✅ Supabase Auth | ❌ | @supabase/supabase-js |
| `update-bureau-email` | `/users/bureau/email` | PATCH | `bureau_id`, `new_email` | ✅ Supabase Auth | ❌ | @supabase/supabase-js |
| `update-member-email` | `/users/member/email` | PATCH | `member_id`, `new_email` | ✅ Supabase Auth | ❌ | @supabase/supabase-js |
| `update-vendor-agent-email` | `/users/vendor/email` | PATCH | `vendor_id`, `new_email` | ✅ Supabase Auth | ❌ | @supabase/supabase-js |
| `send-agent-invitation` | `/users/agent/invite` | POST | `email`, `role` | ✅ Supabase | ✅ Email service | @supabase/supabase-js, nodemailer |
| `change-agent-email` | `/users/agent/email` | PATCH | `agent_id`, `new_email` | ✅ Supabase Auth | ❌ | @supabase/supabase-js |
| `agent-affiliate-link` | `/agents/affiliate/link` | GET/POST | `agent_id` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `agent-delete-user` | `/agents/user/delete` | DELETE | `user_id` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `agent-toggle-user-status` | `/agents/user/toggle` | PATCH | `user_id`, `status` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `agent-get-products` | `/agents/products` | GET | `agent_id` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `agent-update-product` | `/agents/product/update` | PATCH | `product_id`, `data` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `agent-delete-product` | `/agents/product/delete` | DELETE | `product_id` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `agent-toggle-product-status` | `/agents/product/toggle` | PATCH | `product_id`, `status` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `vendor-agent-get-products` | `/vendors/products` | GET | `vendor_id` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `create-syndicate-member` | `/syndicate/member/create` | POST | `syndicate_id`, `email` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `register-with-affiliate` | `/users/affiliate/register` | POST | `email`, `affiliate_code` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `affiliate-commission-trigger` | `/affiliate/commission/trigger` | POST | `transaction_id` | ✅ Supabase | ❌ | @supabase/supabase-js |

---

## 📦 CATÉGORIE 4: PRODUCT MANAGEMENT (14 functions)

| Fonction | Path | Méthode HTTP | Paramètres | BD | APIs Externes | Dépendances |
|----------|------|--------------|-----------|----|----|-------------|
| `create-product` | `/products/create` | POST | `name`, `price`, `category`, etc | ✅ Supabase | ❌ | @supabase/supabase-js |
| `inventory-api` | `/products/inventory` | GET/PATCH | `product_id` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `generate-product-description` | `/products/generate-description` | POST | `product_name`, `category` | ✅ Supabase | ✅ OpenAI/Gemini | axios, openai |
| `generate-product-image` | `/products/generate-image` | POST | `product_name`, `description` | ✅ Supabase | ✅ Lovable AI / Gemini | axios |
| `generate-product-image-openai` | `/products/generate-image-openai` | POST | `product_name`, `description` | ✅ Supabase | ✅ OpenAI DALL-E | openai |
| `enhance-product-image` | `/products/enhance-image` | POST | `image_url`, `style` | ✅ Supabase | ✅ Image API | axios, sharp |
| `translate-product` | `/products/translate` | POST | `product_id`, `languages` | ✅ Supabase | ✅ Google Translate | axios, @google-cloud/translate |
| `production-cron-jobs` | `/products/cron` | POST | (internal) | ✅ Supabase | ❌ | @supabase/supabase-js |
| `validate-purchase` | `/products/validate-purchase` | POST | `product_id`, `user_id` | ✅ Supabase | ❌ | @supabase/supabase-js |

---

## 🤖 CATÉGORIE 5: AI/ML & GENERATION (19 functions)

### 5.1 AI Assistants

| Fonction | Path | Méthode HTTP | Paramètres | BD | APIs Externes | Dépendances |
|----------|------|--------------|-----------|----|----|-------------|
| `ai-copilot` | `/ai/copilot` | POST | `prompt`, `context` | ✅ Supabase | ✅ OpenAI/Gemini | openai, axios |
| `client-ai-assistant` | `/ai/client` | POST | `prompt`, `user_id` | ✅ Supabase | ✅ OpenAI/Gemini | openai, axios |
| `pdg-ai-assistant` | `/ai/pdg` | POST | `prompt`, `pdg_id` | ✅ Supabase | ✅ OpenAI/Gemini | openai, axios |
| `pdg-copilot` | `/ai/pdg/copilot` | POST | `prompt` | ✅ Supabase | ✅ OpenAI/Gemini | openai, axios |
| `vendor-ai-assistant` | `/ai/vendor` | POST | `prompt`, `vendor_id` | ✅ Supabase | ✅ OpenAI/Gemini | openai, axios |
| `ai-contract-assistant` | `/ai/contract` | POST | `contract_text` | ✅ Supabase | ✅ OpenAI | openai |
| `ai-error-analyzer` | `/ai/errors` | POST | `error_logs`, `context` | ✅ Supabase | ✅ OpenAI | openai |
| `ai-recommend` | `/ai/recommend` | POST | `user_id`, `type` | ✅ Supabase | ✅ OpenAI/ML | openai, axios |
| `dispute-ai-arbitrate` | `/ai/dispute/arbitrate` | POST | `dispute_id` | ✅ Supabase | ✅ OpenAI | openai |

### 5.2 Document Generation

| Fonction | Path | Méthode HTTP | Paramètres | BD | APIs Externes | Dépendances |
|----------|------|--------------|-----------|----|----|-------------|
| `generate-contract-with-ai` | `/generate/contract-ai` | POST | `parties`, `terms` | ✅ Supabase | ✅ OpenAI | openai, pdfkit |
| `generate-contract-pdf` | `/generate/contract-pdf` | POST | `contract_data` | ✅ Supabase | ❌ | pdfkit |
| `generate-invoice-pdf` | `/generate/invoice-pdf` | POST | `invoice_data` | ✅ Supabase | ❌ | pdfkit |
| `generate-purchase-pdf` | `/generate/purchase-pdf` | POST | `purchase_data` | ✅ Supabase | ❌ | pdfkit |
| `generate-quote-pdf` | `/generate/quote-pdf` | POST | `quote_data` | ✅ Supabase | ❌ | pdfkit |
| `generate-pdf` | `/generate/pdf` | POST | `html_content` | ✅ Supabase | ❌ | pdfkit, puppeteer |
| `sign-contract` | `/contracts/sign` | POST | `contract_id`, `signature` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `create-contract` | `/contracts/create` | POST | `parties`, `terms` | ✅ Supabase | ❌ | @supabase/supabase-js |

### 5.3 Image Processing

| Fonction | Path | Méthode HTTP | Paramètres | BD | APIs Externes | Dépendances |
|----------|------|--------------|-----------|----|----|-------------|
| `generate-similar-image` | `/images/similar` | POST | `image_url`, `count` | ✅ Supabase | ✅ Image API | axios |
| `visual-search` | `/images/visual-search` | POST | `image_url` | ✅ Supabase | ✅ Vision API | axios, @google-cloud/vision |
| `convert-audio` | `/audio/convert` | POST | file, format | ✅ Supabase | ✅ Audio API | ffmpeg, axios |
| `translate-audio` | `/audio/translate` | POST | file, target_language | ✅ Supabase | ✅ Google Speech-to-Text | @google-cloud/speech |

### 5.4 Detection & Analysis

| Fonction | Path | Méthode HTTP | Paramètres | BD | APIs Externes | Dépendances |
|----------|------|--------------|-----------|----|----|-------------|
| `detect-anomalies` | `/ml/anomalies` | POST | `data_points` | ✅ Supabase | ❌ | numpy, scikit-learn (via API) |
| `detect-surveillance-anomalies` | `/ml/surveillance` | POST | `video_frames` | ✅ Supabase | ✅ Computer Vision API | axios |
| `fraud-detection` | `/ml/fraud` | POST | `transaction_data` | ✅ Supabase | ✅ Fraud API | axios, sklearn |
| `ml-fraud-detection` | `/ml/fraud-v2` | POST | `features` | ✅ Supabase | ✅ ML API | axios |

---

## 📄 CATÉGORIE 6: FILE GENERATION (10 functions)

(Voir CATÉGORIE 5.2 - Document Generation pour les détails)

---

## 📊 CATÉGORIE 7: ANALYTICS & MONITORING (20+ functions)

| Fonction | Path | Méthode HTTP | Paramètres | BD | APIs Externes | Dépendances |
|----------|------|--------------|-----------|----|----|-------------|
| `advanced-analytics` | `/analytics/advanced` | GET | `user_id`, `date_range` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `financial-stats` | `/analytics/financial` | GET | `start_date`, `end_date` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `get-user-activity` | `/analytics/user-activity` | GET | `user_id` | ✅ Supabase | ❌ | @supabase/supabase-js |
| `error-monitor` | `/monitoring/errors` | GET | (monitoring internal) | ✅ Supabase | ✅ Sentry/DataDog | axios |
| `api-guard-monitor` | `/monitoring/api-guard` | GET | (monitoring internal) | ✅ Supabase | ✅ Security API | axios |
| `check-all-services` | `/monitoring/services` | GET | (monitoring internal) | ✅ Supabase | ✅ Multiple services | axios |
| `firebase-health-check` | `/monitoring/firebase` | GET | (monitoring internal) | ✅ Supabase | ✅ Firebase | axios, firebase-admin |
| `google-cloud-test` | `/monitoring/gcloud` | GET | (monitoring internal) | ✅ Supabase | ✅ Google Cloud | @google-cloud/monitoring |
| `security-analysis` | `/security/analysis` | GET | `user_id` | ✅ Supabase | ✅ Security APIs | axios |
| `security-forensics` | `/security/forensics` | GET/POST | `incident_id` | ✅ Supabase | ✅ Forensics API | axios |
| ...and more (cleanup-cache-errors, detect-anomalies, etc) |

---

## 🔗 CATÉGORIE 8: EXTERNAL APIs & INTEGRATIONS (50+ functions)

### 8.1 Google Integration

| Fonction | Endpoints | Intégration | Paramètres |
|----------|-----------|------------|-----------|
| `google-maps-config` | GET /google/maps/config | Google Maps API | (env vars) |
| `google-places-autocomplete` | POST /google/places | Google Places | `query`, `location` |
| `geocode-address` | POST /geo/geocode | Google Geocoding | `address` |
| `geo-detect` | POST /geo/detect | Geolocation API | `lat`, `lng` |
| `calculate-route` | POST /geo/route | Google Maps Directions | `origin`, `destination` |
| `calculate-delivery-distances` | POST /delivery/distances` | Google Maps Distance | `locations` |
| `spatial-analysis` | (proprietary) | Google Cloud BigQuery | (spatial queries) |

### 8.2 Media & Storage

| Fonction | Endpoints | Intégration | Paramètres |
|----------|-----------|------------|-----------|
| `gcs-signed-url` | GET /storage/gcs/signed-url | Google Cloud Storage | `bucket`, `file` |
| `gcs-upload-complete` | POST /storage/gcs/complete | GCS webhook | GCS event |
| `upload-bureau-stamp` | POST /files/upload | GCS | `file`, `bureau_id` |
| `og-meta` | POST /meta/og | Meta extraction | `url` |

### 8.3 Communication

| Fonction | Endpoints | Intégration | Paramètres |
|----------|-----------|------------|-----------|
| `send-sms` | POST /communication/sms | Twilio / Africastalking | `phone`, `message` |
| `send-otp-email` | POST /communication/otp | SendGrid / Mailgun | `email`, `code` |
| `send-bureau-access-email` | POST /communication/bureau-access | Email service | `email`, `password` |
| `send-communication-notification` | POST /notifications/communicate | Email/SMS | `user_id`, `message` |
| `send-agent-invitation` | POST /users/agent/invite | Email service | `email`, `link` |
| `send-security-alert` | POST /security/alert` | Email/SMS | `user_id`, `alert_type` |
| `send-delivery-notification` | POST /delivery/notify | SMS/Email | `user_id`, `order_id` |
| `notify-vendor-delivery-complete` | POST /vendors/notify | Email/SMS | `vendor_id` |
| `smart-notifications` | POST /notifications/smart | Email/SMS/Push | `user_id`, `preferences` |
| `translate-message` | POST /translate/message | Google Translate | `message`, `target_lang` |

### 8.4 Audio/Media Processing

| Fonction | Endpoints | Intégration | Paramètres |
|----------|-----------|------------|-----------|
| `convert-audio` | POST /audio/convert | Audio conversion lib | `file`, `format` |
| `translate-audio` | POST /audio/translate | Google Cloud Speech | `file`, `language` |
| `audio-translation-webhook` | POST /audio/webhook | External provider | Webhook event |
| `agora-token` | POST /media/agora/token | Agora API | `channel`, `user_id` |

### 8.5 AI Services (External)

| Fonction | Endpoints | Intégration | Paramètres |
|----------|-----------|------------|-----------|
| `test-gemini-api` | POST /ai/test/gemini | Google Gemini | Test request |
| `test-google-cloud-api` | POST /ai/test/gcloud | Google Cloud AI | Test request |
| `get-google-secret` | GET /config/google-secret | Secret Manager | `secret_name` |

### 8.6 Third-Party Services

| Fonction | Endpoints | Intégration | Paramètres |
|----------|-----------|------------|-----------|
| `mapbox-proxy` | POST /proxy/mapbox | Mapbox API | `endpoint`, `params` |
| `firebase-config` | GET /config/firebase | Firebase | (env vars) |
| `firebase-health-check` | GET /health/firebase | Firebase | (monitoring) |
| `get-google-secret` | GET /secrets/google | Google Secret Manager | `secret_id` |

---

## 🔄 CATÉGORIE 9: WEBHOOKS (5+ functions)

| Fonction | Source | Événement | Opération |
|----------|--------|----------|-----------|
| `stripe-webhook` | Stripe | Payment events | Update transactions |
| `paypal-webhook` | PayPal | Payment events | Update transactions |
| `chapchappay-webhook` | ChapChapPay | Payment events | Update transactions |
| `djomy-webhook` | Djomy | Payment events | Update transactions |
| `djomy-secure-webhook` | Djomy | Signed payment events | Update transactions |
| `subscription-webhook` | Stripe | Subscription events | Update subscriptions |
| `escrow-stripe-webhook` | Stripe | Escrow updates | Update escrow |
| `audio-translation-webhook` | Audio service | Translation complete | Store result |
| `gcs-upload-complete` | GCS | Upload complete | Finalize upload |

---

## 🛡️ CATÉGORIE 10: SECURITY & ADMIN (30+ functions)

### 10.1 Security

| Fonction | Path | Opération |
|----------|------|----------|
| `security-block-ip` | `/security/block-ip` | Block IP addresses |
| `security-detect-anomaly` | `/security/anomaly` | Detect suspicious activity |
| `security-incident-response` | `/security/incident` | Handle security incidents |
| `security-forensics` | `/security/forensics` | Forensic analysis |
| `security-analysis` | `/security/analysis` | Security audit |
| `pdg-mfa-verify` | `/auth/pdg/mfa` | Multi-factor authentication |

### 10.2 Admin Functions

| Fonction | Path | Opération |
|----------|------|----------|
| `admin-release-funds` | `/admin/funds/release` | Release funds (escrow) |
| `admin-review-payment` | `/admin/payment/review` | Review payments |
| `fix-error` | `/admin/fix-error` | Fix errors |
| `restart-module` | `/admin/restart` | Restart modules |

---

## 📋 CATÉGORIE 11: OTHER INTEGRATIONS (50+ functions)

- `advanced-analytics`, `affiliated-commission-trigger`, `african-fx-collect`, `african-fx-query`
- `cached-data`, `cleanup-cache-errors`, `redis-cache`
- `communication-handler`, `create-conversation`, `create-short-link`
- `confirm-delivery`, `confirm-order-by-seller`
- `competitive-analysis`, `create-syndicate-member`
- `dispute-create`, `dispute-resolve`, `dispute-respond`, `open-dispute`
- `enhance-product-image`, `get-agent-users`
- `link-escrow-order`, `manual-credit-seller`
- `marketplace-rotation`, `pdg-delete-vendor`
- `process-digital-renewals`, `pubsub-manage`, `pubsub-publish`, `pubsub-subscribe`
- `register-with-affiliate`, `release-scheduled-funds`
- `renew-subscription`, `request-refund`, `resolve-dispute`
- `short-link`, `subscription-expiry-check`
- `sync-system-apis`, `sync-to-cloudsql`, `task-queue-worker`
- `taxi-accept-ride`, `taxi-refuse-ride`
- `verify-bureau-token`, `verify-vendor`
- `waap-protect`

---

## 📈 STATISTIQUES DE DÉPENDANCES EXTERNES

### Intégrations de Paiement
- **Stripe**: 8-10 functions
- **PayPal**: 5 functions
- **Djomy**: 5 functions
- **ChapChapPay**: 5 functions
- **Mobile Money (M-Pesa, Airtel)**: 1+ functions

### AI/ML
- **OpenAI**: 7-9 functions
- **Google Gemini**: 3-5 functions
- **Vision APIs**: 2 functions

### Cloud Services
- **Google Cloud**: 8-10 functions (GCS, Maps, Speech, etc)
- **AWS**: 3 functions (Cognito, etc)
- **Firebase**: 2 functions

### Communication
- **Email Services**: 7+ functions
- **SMS/Twilio**: 2-3 functions
- **Agora**: 1 function

### File Storage/Processing
- **Google Cloud Storage**: 2-3 functions
- **Image Processing**: 2-3 functions
- **Audio**: 3 functions
- **PDF Generation**: 5-6 functions

---

## 🚀 PLAN DE MIGRATION RECOMMANDÉ

### Phase 1: Infrastructure & Fondations (Week 1)
1. ✅ Setup Node.js routing layer
2. ✅ Replicate authentication middleware
3. ✅ Setup database connection pool
4. ✅ Create shared utilities (logging, error handling, CORS)

### Phase 2: Authentication (Week 1-2)
1. Migrate 13 authentication functions
2. Test JWT token generation
3. Test OTP verification
4. Test Cognito sync
5. Test MFA/TOTP

### Phase 3: Core Payment (Week 2-3)
1. Migrate Stripe functions (8-10)
2. Setup webhook handlers
3. Test payment flow
4. Test escrow management
5. Setup wallet system

### Phase 4: Secondary Payment (Week 3-4)
1. Migrate PayPal
2. Migrate Djomy
3. Migrate ChapChapPay
4. Migrate Mobile Money
5. Test all payment flows

### Phase 5: User Management (Week 2-3)  
1. Migrate 30+ user management functions
2. Setup agent/vendor/bureau hierarchies
3. Test email changes
4. Test user deletion/restoration

### Phase 6: Product Management (Week 2-3)
1. Migrate 14 product functions
2. Setup inventory tracking
3. Test product creation

### Phase 7: AI & File Generation (Week 4-5)
1. Migrate AI assistants (5-9)
2. Migrate document generation (5-6)
3. Setup image generation
4. Test all AI functions

### Phase 8: External APIs (Week 5-6)
1. Setup Google Maps integration
2. Setup Google Cloud Storage
3. Setup communication services
4. Setup analytics

### Phase 9: Webhooks & Monitoring (Week 6)
1. Setup webhook handlers
2. Setup monitoring/alerting
3. Setup logging
4. Test all webhooks

### Phase 10: Testing & Optimization (Week 7)
1. Load testing
2. Performance optimization
3. Security audit
4. Documentation

---

## ⚠️ POINTS CRITIQUES DE MIGRATION

1. **Webhook endpoints**: Stripe, PayPal, Djomy must receive correct URLs
2. **Authentication**: JWT validation across all functions
3. **Database**: Connection pooling, transaction management
4. **Rate limiting**: Payment gateway rate limits
5. **Environment variables**: Tons of API keys to configure
6. **CORS**: Update CORS headers for new backend domain
7. **Supabase Auth**: Replicate Supabase Auth in Node.js or use Cognito
8. **File handling**: Replicate GCS signed URLs, upload flows
9. **Real-time features**: Check if websockets needed
10. **Cron jobs**: Replicate scheduled functions (production-cron-jobs, subscription-expiry-check, etc)

---

## 📚 SHARED LIBRARIES IN SUPABASE/FUNCTIONS/_SHARED

```
_shared/
├── pdg-fees.ts          # Fee calculation logic
├── fx-internal.ts       # Currency exchange rates
└── [other shared utilities]
```

These need to be ported to Node.js as well.

---

## 🎯 CONCLUSION

**216 Edge Functions** requires comprehensive migration planning:

- **High Priority**: 50+ functions (Payment, Auth, User Management)
- **Medium Priority**: 60+ functions (Products, Orders, AI/ML)
- **Low Priority**: 100+ functions (Monitoring, External APIs, Utilities)

Estimated Timeline: **6-8 weeks** for complete migration with proper testing

Recommendation: **Start with Auth & Payment** as they have the most dependencies and highest business impact.
