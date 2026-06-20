# 📊 Vista-Flows Codebase Systems Analysis
**Date:** March 31, 2026

---

## 1. 🛒 PRODUCT PURCHASE SYSTEM

### **WHAT EXISTS**

#### Frontend Purchase Flow
| Component | Path | Purpose |
|-----------|------|---------|
| **ProductDetail.tsx** | `src/pages/ProductDetail.tsx` | Physical product detail page with basket, promotional videos |
| **DigitalProductDetail.tsx** | `src/pages/DigitalProductDetail.tsx` | Digital product detail page with downloads |
| **ProductPaymentModal** | `src/components/ecommerce/ProductPaymentModal.tsx` | Complete checkout modal (wallet, card, mobile money) |
| **QuickAddToCart** | `src/components/ecommerce/QuickAddToCart.tsx` | 1-click add to cart button (Amazon-style) |
| **Cart Page** | `src/pages/Cart.tsx` | Shopping cart with item management, affiliate product handling |
| **StripeCheckoutButton** | `src/components/payment/StripeCheckoutButton.tsx` | Stripe card payment (replaces PayPal) |

#### Database Structure
```
orders (main purchase table)
├── id, customer_id, vendor_id, order_number
├── status: pending, processing, shipped, delivered, cancelled
├── payment_method: card, mobile_money, wallet, cod
├── payment_status: pending, completed, failed, refunded
├── items[]
├── subtotal, tax_amount, shipping_amount, discount_amount, total_amount
└── timestamps, shipping_address, billing_address

order_items (line items)
├── order_id → orders
├── product_id, quantity, unit_price, total_price
└── variant_id (optional)

advanced_carts (temporary cart storage)
├── user_id, product_id, quantity
├── price_at_add, vendor_id
└── timestamps
```

#### Payment Processing
```
ProductPaymentModal Flow:
1. Select payment method:
   - Wallet (wallet debit)
   - Card (Stripe via StripeCheckoutButton)
   - Orange Money (OrangeMoney API)
   - MTN Money (ChapChapPay integration)
   - Cash on Delivery (COD)

2. Confirm payment → Order creation
3. Commission calculation (automatic)
4. Order status tracking
```

#### Backend Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/orders` | POST | Create order (uses create_order_core RPC) |
| `/api/orders/:id` | GET | Get order details |
| `/api/orders` | GET | List user's orders |
| `/api/orders/:id/cancel` | POST | Cancel order |
| `/api/orders/:id/status` | PATCH | Update order status |

**File:** `backend/src/routes/orders.routes.ts` (Phase 6 optimized version)

### **WHAT'S MISSING/INCOMPLETE**

- ❌ **No order history export** (PDF invoices, CSV export)
- ❌ **Limited order search/filtering UI** in customer dashboard
- ❌ **No estimated delivery date calculation** visible to customer
- ❌ **Return/refund workflow** not documented
- ❌ **No order tracking map** for delivery visualization
- ❌ **Bundle/combo product support** absent
- ❌ **Gift card system** not implemented
- ❌ **Pre-order functionality** missing

---

## 2. 🎓 DIGITAL PRODUCTS SYSTEM

### **WHAT EXISTS**

#### Database Schema (Complete & Working)
```sql
digital_products
├── Fields:
│   ├── Basic: title, description, short_description, images[]
│   ├── Categories: 'dropshipping', 'voyage', 'logiciel', 'formation', 'livre', 'custom'
│   ├── PRICING (NEW):
│   │   ├── pricing_type: 'one_time' | 'subscription' | 'pay_what_you_want'
│   │   ├── subscription_interval: (NULL | 'monthly' | 'yearly' | 'lifetime')
│   │   └── access_duration: 'lifetime' | 'days:30' | 'months:6' etc
│   ├── Files: file_urls[], file_type (pdf, epub, video, audio, zip, other)
│   ├── Affiliate: affiliate_url, affiliate_platform, product_mode (direct|affiliate)
│   ├── Pricing: price, original_price, commission_rate, currency
│   ├── Stats: views_count, sales_count, rating, reviews_count
│   └── Status: draft, pending, published, rejected, archived
├── Indexes: merchant, category, status, mode, published
└── RLS: Public view for published, merchant owns edit/delete
```

#### Purchasing Tables
```sql
digital_product_purchases
├── product_id → digital_products
├── buyer_id, merchant_id → auth.users
├── amount, commission_amount
├── payment_status: pending, completed, failed, refunded
├── access_granted: boolean (download access flag)
├── access_expires_at: TIMESTAMPTZ (time-limited access)
├── download_count, max_downloads (default: 5)
└── transaction tracking

digital_subscriptions (NEW - Recurring)
├── product_id → digital_products
├── buyer_id, merchant_id → auth.users
├── status: active, past_due, cancelled, expired, paused
├── billing_cycle: monthly, yearly, lifetime
├── amount_per_period, currency
├── current_period_start/end, next_billing_date
├── auto_renew: boolean
├── payment tracking: total_payments_made, total_amount_paid
├── failed_payment_count, cancellation_reason
└── UNIQUE(product_id, buyer_id)
```

#### Marketplace UI & Categories
**File:** `src/pages/DigitalProducts.tsx`

8 Product Modules available:
```
1. Dropshipping     (Blue #1f2a44)    - Affiliate products from suppliers
2. Voyage           (Blue #0d3b8f)    - Travel packages, bookings
3. Logiciel         (Blue #2a2f78)    - Software, apps, licenses
4. Formation        (Green #135d3b)   - Training courses, education ← KEY
5. Livre            (Books)           - eBooks, PDF documents
6. Custom           (Custom)          - User-created digital products
7. AI               (AI)              - AI-powered tools
8. Physique Affilié (Physical)        - Affiliate physical products
```

#### Digital Product Management
| Component | Path | Purpose |
|-----------|------|---------|
| **CategoryProductsList** | `src/components/digital-products/CategoryProductsList.tsx` | Display products by category |
| **DigitalProductForm** | `src/components/digital-products/DigitalProductForm.tsx` | Create/edit digital product |
| **DirectSaleForm** | `src/components/digital-products/DirectSaleForm.tsx` | Direct sale setup |
| **AffiliateForm** | `src/components/digital-products/AffiliateForm.tsx` | Affiliate product setup |
| **SalesModeSelector** | `src/components/digital-products/SalesModeSelector.tsx` | Choose direct or affiliate |
| **DigitalVendorDashboard** | `src/pages/DigitalVendorDashboard.tsx` | Vendor interface for digital products |
| **MerchantActivationDialog** | `src/components/digital-products/MerchantActivationDialog.tsx` | Activate merchant mode |

#### Backend Endpoints
**File:** `backend/src/routes/edge-functions/products.routes.ts`
```
POST   /api/products/digital/create
GET    /api/products/digital/:id
PATCH  /api/products/digital/:id
DELETE /api/products/digital/:id
GET    /api/products/digital?category=formation
POST   /api/products/digital/:id/purchase
GET    /api/products/digital/purchases/mine
```

### **WHAT'S MISSING/INCOMPLETE**

- ❌ **No video player component** for digital video products
- ❌ **No playlist/module system** for training courses
- ❌ **No progress tracking** for course completion
- ❌ **No certificate generation** for completed courses
- ❌ **No drip-feeding content** (release chapters over time)
- ❌ **No student/cohort management** (group course participants)
- ❌ **No discussion forum/Q&A** per course
- ❌ **No assignments/homework system** for training
- ❌ **No video duration metadata** in schema
- ❌ **No subtitle/captions support**
- ❌ **No streaming quality optimization**
- ❌ **Limited "formar" module differentiation** despite having category

---

## 3. 🎬 VIDEO/FORMATION SYSTEM

### **WHAT EXISTS**

#### Minimal Video Support
```
Digital Products Can Have:
├── file_type: 'video' (PDF, EPUB, VIDEO, AUDIO, ZIP, OTHER)
├── file_urls: TEXT[] array (can store multiple video URLs)
└── Stored on backend/uploads/ or external CDN

Physical Products Can Have:
├── promotional_videos: TEXT[] array
└── Auto carousel in ProductDetail with image/video mixing
```

#### Video Components
| Component | Path | Purpose |
|-----------|------|---------|
| **AgoraVideoCall** | `src/components/communication/AgoraVideoCall.tsx` | Real-time video calls (not for course videos) |
| **video-upload-preview** | `src/components/ui/video-upload-preview.tsx` | Video upload UI component |

#### Product Detail Page Support
**File:** `src/pages/ProductDetail.tsx`
```javascript
const videos = product?.promotional_videos || [];
const { 
  currentVideoIndex, 
  isPlayingVideo, 
  useAutoCarousel 
} = useAutoCarousel({ videos, images });
// Has auto-play/pause toggle, manual carousel control
```

### **WHAT'S MISSING/INCOMPLETE**

The Formation category exists but has NO specialized video infrastructure:

| Feature | Status | Impact |
|---------|--------|--------|
| **Dedicated Video Player** | ❌ Missing | Can't embed videos in courses |
| **Video Streaming** | ❌ None | All videos must be files/URLs |
| **Playlist/Chapters** | ❌ Missing | No course structure |
| **Progress Tracking** | ❌ None | No student engagement data |
| **Video Duration** | ❌ No DB field | Can't show length or progress bar |
| **Subtitles/Captions** | ❌ None | Accessibility issue |
| **Speed Control** | ❌ None | No 0.5x, 1x, 1.5x, 2x |
| **Download for Offline** | ❌ None | No offline access |
| **Video Analytics** | ❌ None | Watch time, completion % unknown |
| **Quality Switching** | ❌ None | All-or-nothing streaming |
| **Live Streaming** | ❌ None | No webinar capability |
| **Student Dashboard** | ❌ None | Can't track "my courses" |
| **Certificate System** | ❌ None | No completion proofs |
| **Drip-feed Content** | ❌ None | No staggered release |

---

## 4. 📱 MOBILE OPTIMIZATION

### **WHAT EXISTS**

#### Tailwind Responsive Classes (CONFIRMED WIDESPREAD)
```
Breakpoints Used Throughout:
├── sm: (640px)    - Small phones, landscape
├── md: (768px)    - Tablets, small desktops
└── lg: (1024px)   - Large desktops

Patterns Found:
├── Grid: grid-cols-1, md:grid-cols-2, md:grid-cols-3
├── Padding: px-3, sm:px-4, md:px-6, lg:px-8
├── Font-size: text-xs, sm:text-sm, md:text-base, lg:text-lg
├── Height/Width icons: h-4 w-4, sm:h-5 sm:w-5, md:h-6 md:w-6
└── Margins: mb-2, sm:mb-3, md:mb-4
```

#### Mobile-First Components
| Page | Features | Examples |
|------|----------|----------|
| **CopilotChat** | Responsive avatars, dynamic padding | `h-10 w-10 sm:h-14 sm:w-14` |
| **ProductDetail** | Auto carousel, responsive image gallery | Images + videos with auto-play |
| **Cart** | `pb-24 md:pb-4` (mobile footer fix) | Separates mobile/desktop layout |
| **Wallet** | Responsive header, icon sizing | `h-9 w-9 sm:h-11 sm:w-11` |
| **WorkerDashboard** | Grid-based layout | `grid-cols-1 md:grid-cols-3` |


#### PWA & Mobile Support
```
public/
├── service-worker.js        ✅ Offline mode
├── manifest.webmanifest     ✅ Add to Home Screen
├── mobile-diagnostic.html   ✅ Mobile detection
├── test-mobile.html         ✅ Mobile testing
└── offline.html             ✅ Offline fallback

Vite Config Mobile Support:
├── MobileVhFix plugin
└── Custom CSS for mobile layouts
```

#### Responsive Design Patterns
**Files examined:**
- ✅ `src/pages/Cart.tsx` - Mobile bottom navigation fix
- ✅ `src/pages/Wallet.tsx` - Responsive spacing
- ✅ `src/components/copilot/CopiloteChat.tsx` - Dynamic sizing
- ✅ `tailwind.config.ts` - Container queries, custom breakpoints

### **WHAT'S MISSING/INCOMPLETE**

- ⚠️ **No specific mobile nav component** (relies on default layout)
- ⚠️ **Touch-friendly button sizes** on some forms (should be 44px min)
- ⚠️ **No viewport meta optimization**
- ⚠️ **Limited landscape mode handling** on some pages
- ⚠️ **No mobile-specific images** (no srcset/webp optimization)
- ⚠️ **Table layouts** not checked for mobile wrapping
- ⚠️ **Form fields** may need larger font on mobile (avoid zoom)
- ⚠️ **No focus ring** optimization for mobile keyboard
- ⚠️ **Scrolling performance** on long lists not optimized

**Overall Assessment:** ✅ **GOOD** - Responsive design present, Tailwind well-used, but edge cases need review.

---

## 5. 💳 SUBSCRIPTION SYSTEM

### **WHAT EXISTS**

#### Vendor Subscription System
```sql
TABLE: plans
├── id, name (e.g., 'free', 'pro', 'enterprise')
├── display_name, display_order
├── monthly_price_gnf, yearly_price_gnf
├── Features:
│   ├── max_products (NULL for unlimited)
│   ├── max_images_per_product
│   ├── analytics_access
│   ├── priority_support
│   ├── featured_products
│   ├── api_access
│   ├── custom_branding
│   └── features: JSONB array
├── is_active, created_at
└── Enforced via backend limits + DB triggers

TABLE: subscriptions
├── user_id → users
├── plan_id → plans
├── status: active, cancelled, expired, trialing, past_due
├── price_paid_gnf, billing_cycle (monthly, yearly)
├── metadata: JSONB
└── Timestamps: created_at, expires_at, cancelled_at
```

#### Digital Product Subscriptions (NEW - SEPARATE SYSTEM)
```sql
TABLE: digital_subscriptions (for recurring billing on courses/products)
├── product_id → digital_products
├── buyer_id, merchant_id → auth.users
├── status: active, past_due, cancelled, expired, paused
├── billing_cycle: monthly, yearly, lifetime
├── amount_per_period, currency
├── Period tracking: current_period_start/end, next_billing_date
├── auto_renew: boolean
├── Payment history:
│   ├── total_payments_made
│   ├── total_amount_paid
│   ├── last_payment_at, last_payment_transaction_id
│   └── failed_payment_count (retry tracking)
├── Cancellation: cancelled_at, cancellation_reason
└── UNIQUE(product_id, buyer_id) - One subscription per product per buyer
```

#### Purchase & Authorization Flow
**File:** `src/pages/VendorSubscriptionPage.tsx`

Displays:
- ✅ Current plan details
- ✅ Product limit progress `current_count / max_products`
- ✅ Feature matrix (analytics, support, featured, API, branding)
- ✅ Plan upgrade/downgrade options
- ✅ Renewal date + auto-renew status
- ✅ Usage statistics

#### Backend Endpoints
**File:** `backend/src/routes/subscriptions.routes.ts` (Phase 2)

```
GET    /api/subscriptions/plans
       └─ Returns: [ { id, name, monthly_price, yearly_price, max_products, features } ]

GET    /api/subscriptions/current
       └─ Returns: Current subscription + plan details

POST   /api/subscriptions/subscribe
       ├─ Body: { plan_id, billing_cycle }
       └─ Returns: { subscription_id, status: 'trialing'|'active' }

POST   /api/subscriptions/confirm
       ├─ After payment confirmation
       └─ Moves 'trialing' → 'active'

POST   /api/subscriptions/cancel
       └─ Cancels subscription, status → 'cancelled'

POST   /api/subscriptions/expire-stale (internal)
       └─ Clean up abandoned 'trialing' subscriptions after 48h
```

#### Subscription State Machine
```
Free User
  ↓ (call /subscribe with paid plan)
trialing (48h timeout)
  ├─ ✅ Payment confirmed → active
  ├─ ❌ Payment failed → expired
  └─ ⏱️ Timeout after 48h → expired

active (has valid subscription)
  ├─ ✅ Auto-renew working → continues active
  ├─ ❌ Payment fails → past_due
  └─ Customer cancels → cancelled

past_due (payment retry phase)
  ├─ ✅ Payment succeeds → active
  └─ ❌ Max retries exhausted → expired

cancelled / expired
  └─ Can re-subscribe → back to trialing
```

#### Features Enforcement
**File:** `backend/src/routes/products.routes.ts`

```javascript
// Backend validates subscription before allowing product creation:
const { data: subscription } = await loadUserSubscription(vendorId);
const plan = await loadPlan(subscription.plan_id);

if (plan.max_products && productCount >= plan.max_products) {
  throw new Error('Product limit reached');
}

if (plan.max_images_per_product) {
  images = images.slice(0, plan.max_images_per_product);
}
```

### **WHAT'S MISSING/INCOMPLETE**

- ⚠️ **Limited invoice/receipt system** visible
- ⚠️ **No dunning management UI** for failed payments
- ⚠️ **No subscription pause/resume** feature
- ⚠️ **No usage/metering dashboard** (real-time feature usage)
- ⚠️ **No cost forecast** for annual billing
- ⚠️ **No proration logic** for mid-cycle upgrades
- ⚠️ **No coupon/discount codes** system
- ⚠️ **No bulk billing** for teams
- ⚠️ **Limited payment method flexibility** (card + momos only)
- ⚠️ **No subscription downgrade warnings** about feature loss
- ⚠️ **No auto-upgrade triggers** (e.g., "upgrade when limit reached")

---

## 📋 QUICK REFERENCE TABLE

| System | Exists | Mature | Key Entry Points |
|--------|--------|--------|------------------|
| **Physical Products** | ✅ Yes | ✅ Phase 6 (optimized) | `ProductDetail.tsx`, `orders.routes.ts` |
| **Digital Products** | ✅ Yes | ⚠️ Phase 1 | `DigitalProductDetail.tsx`, `digital_products` table |
| **Digital Subscriptions** | ✅ Yes | ⚠️ Partial | `digital_subscriptions` table, new migration |
| **Video Delivery** | ⚠️ Partial | ❌ Missing | File URLs only, no player |
| **Formation/Courses** | ⚠️ Category only | ❌ Missing | No structure, module, progress |
| **Mobile UI** | ✅ Yes | ✅ Good | Tailwind `sm:` `md:` classes |
| **Vendor Subscriptions** | ✅ Yes | ✅ Phase 2 | `subscriptions.routes.ts`, `VendorSubscriptionPage.tsx` |
| **Payment Integration** | ✅ Yes | ✅ Phase 5+ | `ProductPaymentModal.tsx`, `payments.routes.ts` |

---

## 🎯 RECOMMENDATIONS BY PRIORITY

### High Priority (Revenue/UX Impact)
1. **Implement video player component** for digital products
2. **Build course module system** (chapters, lessons, modules)
3. **Add student progress tracking** for courses
4. **Implement mobile touch optimizations** (44px buttons, better forms)

### Medium Priority
5. **Add course certificate generation**
6. **Build instructor dashboard** for course analytics
7. **Implement payment retry/dunning** for subscriptions
8. **Add course drip-feed feature** (scheduled release)

### Low Priority (Polish)
9. **Add video analytics** (watch time, completion %)
10. **Implement course forums/Q&A**
11. **Add video speed controls**
12. **Optimize video streaming quality**

---

## 📂 KEY FILE LOCATIONS

```
FRONTEND
├── Pages:
│   ├── src/pages/ProductDetail.tsx (physical products)
│   ├── src/pages/DigitalProductDetail.tsx (digital products)
│   ├── src/pages/DigitalProducts.tsx (marketplace main)
│   ├── src/pages/DigitalVendorDashboard.tsx (vendor mgmt)
│   ├── src/pages/Cart.tsx (shopping cart)
│   └── src/pages/VendorSubscriptionPage.tsx (subscription mgmt)
├── Components:
│   ├── src/components/ecommerce/ProductPaymentModal.tsx (checkout)
│   ├── src/components/payment/StripeCheckoutButton.tsx (stripe)
│   ├── src/components/digital-products/*.tsx (6 files)
│   └── src/components/ui/video-upload-preview.tsx
└── Config:
    └── tailwind.config.ts (responsive design)

BACKEND
├── Routes:
│   ├── backend/src/routes/orders.routes.ts
│   ├── backend/src/routes/subscriptions.routes.ts
│   ├── backend/src/routes/payments.routes.ts
│   ├── backend/src/routes/products.routes.ts
│   └── backend/src/routes/edge-functions/products.routes.ts
└── Services:
    ├── backend/src/services/subscriptionService.ts
    └── backend/src/services/djomy.service.ts (mobile money)

DATABASE
├── supabase/migrations/20251226013403_*.sql (digital products)
├── supabase/migrations/20260319071800_*.sql (digital subscriptions)
└── sql/google-cloud-sql-schema.sql
```

---

Generated: March 31, 2026 | Project: Vista-Flows (224Solutions)
