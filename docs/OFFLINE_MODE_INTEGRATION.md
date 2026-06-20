# Guide d'Intégration - Mode Hors Ligne Avancé

## Guide Technique pour Développeurs

Ce document explique comment intégrer le système de mode hors ligne avancé dans l'application Vista Flows existante.

---

## 📋 Table des Matières

1. [Architecture](#architecture)
2. [Intégration Étape par Étape](#intégration-étape-par-étape)
3. [Configuration](#configuration)
4. [Exemples d'Utilisation](#exemples-dutilisation)
5. [Tests](#tests)
6. [Déploiement](#déploiement)

---

## Architecture

### Principe d'Isolation

Le mode offline a été conçu pour être **100% additif** - aucun fichier existant n'a été modifié.

```
src/
├── lib/
│   ├── offline/                    ← NOUVEAU (tous les fichiers offline)
│   │   ├── advancedPOSManager.ts
│   │   ├── localStockManager.ts
│   │   ├── catalogCache.ts
│   │   ├── featureGate.ts
│   │   ├── security/
│   │   ├── auth/
│   │   └── sync/
│   ├── offlineDB.ts                ← EXISTANT (non modifié)
│   └── offlineSyncService.ts       ← EXISTANT (non modifié)
├── components/
│   └── vendor/
│       ├── OfflinePOS/             ← NOUVEAU
│       ├── OfflineUI/              ← NOUVEAU
│       └── OfflineAuth/            ← NOUVEAU
└── hooks/
    ├── useOfflineStock.ts          ← NOUVEAU
    ├── useOfflineCatalog.ts        ← NOUVEAU
    └── useOfflineFeatureAccess.ts  ← NOUVEAU
```

### Couches d'Abstraction

```
┌─────────────────────────────────┐
│   Application Existante         │
│   (POSSystem, Dashboard, etc.)  │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│   Wrapper Layer (HOC)           │
│   - OfflineEnabledPOS           │
│   - FeatureGate                 │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│   Offline Services              │
│   - advancedPOSManager          │
│   - localStockManager           │
│   - syncEngine                  │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│   Storage Layer                 │
│   - IndexedDB                   │
│   - LocalStorage (sessions)     │
└─────────────────────────────────┘
```

---

## Intégration Étape par Étape

### Étape 1: Wrapper du Composant POS

Remplacer l'utilisation directe de `POSSystem` par un wrapper conditionnel.

**Fichier**: `src/components/vendor/POSWrapper.tsx` (à créer)

```typescript
import React from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineFeatureAccess } from '@/hooks/useOfflineFeatureAccess';
import POSSystem from './POSSystem'; // Composant existant
import OfflinePOSInterface from './OfflinePOS/OfflinePOSInterface'; // Nouveau

export function POSWrapper() {
  const { isOnline } = useOnlineStatus();
  const { isAllowed } = useOfflineFeatureAccess('pos_sales');

  // Si offline et POS offline autorisé, utiliser l'interface offline
  if (!isOnline && isAllowed) {
    return <OfflinePOSInterface />;
  }

  // Sinon, utiliser le POS normal
  return <POSSystem />;
}
```

**Utilisation**:

```typescript
// AVANT
import POSSystem from '@/components/vendor/POSSystem';

// APRÈS
import { POSWrapper } from '@/components/vendor/POSWrapper';

// Dans le composant
<POSWrapper />
```

### Étape 2: Ajouter la Barre de Statut

Ajouter `OfflineStatusBar` dans le layout principal de l'interface vendeur.

**Fichier**: `src/components/layouts/VendorLayout.tsx`

```typescript
import { OfflineStatusBar } from '@/components/vendor/OfflineUI/OfflineStatusBar';
import { globalSyncQueue } from '@/lib/offline/sync/advancedSyncEngine';

export function VendorLayout({ children }) {
  const stats = globalSyncQueue.getStats();

  return (
    <div>
      {/* Barre de statut en haut */}
      <OfflineStatusBar
        showDetails={true}
        pendingSyncCount={stats.pendingItems}
        lastSyncTime={new Date()}
        className="mb-4"
      />

      {/* Contenu */}
      {children}
    </div>
  );
}
```

### Étape 3: Protéger les Fonctionnalités Interdites

Utiliser `OfflineBadge` pour désactiver visuellement les fonctionnalités non disponibles.

**Exemple - Bouton Commandes en Ligne**:

```typescript
import { OfflineBadge } from '@/components/vendor/OfflineUI/OfflineBadge';

function OrdersButton() {
  return (
    <OfflineBadge feature="online_orders" variant="overlay">
      <Button onClick={handleOrders}>
        <ShoppingCart className="w-4 h-4 mr-2" />
        Commandes en ligne
      </Button>
    </OfflineBadge>
  );
}
```

**Exemple - Menu Navigation**:

```typescript
import { useOfflineFeatureAccess } from '@/hooks/useOfflineFeatureAccess';

const menuItems = [
  { label: 'POS', href: '/pos', feature: 'pos_sales' },
  { label: 'Commandes', href: '/orders', feature: 'online_orders' },
  { label: 'Messages', href: '/messages', feature: 'messaging' },
  { label: 'Stock', href: '/stock', feature: 'stock_view' }
];

function Navigation() {
  return (
    <nav>
      {menuItems.map(item => {
        const { isAllowed } = useOfflineFeatureAccess(item.feature);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={!isAllowed ? 'opacity-50 pointer-events-none' : ''}
          >
            {item.label}
            {!isAllowed && <RequiresOnlineBadge size="xs" />}
          </Link>
        );
      })}
    </nav>
  );
}
```

### Étape 4: Initialiser le Système au Démarrage

**Fichier**: `src/App.tsx` ou `src/main.tsx`

```typescript
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { cacheVendorProducts, cacheCategories } from '@/lib/offline/catalogCache';
import { loadInitialStock } from '@/lib/offline/localStockManager';
import { startScheduledSync } from '@/lib/offline/sync/syncScheduler';
import { registerServiceWorker } from '@/lib/serviceWorkerRegistration';

export function App() {
  const { user } = useAuth();

  useEffect(() => {
    // Enregistrer le Service Worker
    registerServiceWorker({ force: false });

    // Si vendeur connecté, initialiser le mode offline
    if (user?.role === 'vendor' || user?.role === 'vendeur') {
      initializeOfflineMode(user.id);
    }
  }, [user]);

  const initializeOfflineMode = async (vendorId: string) => {
    try {
      // 1. Charger les produits et catégories en cache
      const products = await fetchVendorProducts(vendorId);
      const categories = await fetchCategories();

      await cacheVendorProducts(vendorId, products, true);
      await cacheCategories(categories);

      // 2. Initialiser le stock local
      await loadInitialStock(vendorId, products);

      // 3. Démarrer la synchronisation automatique
      startScheduledSync({
        enabled: true,
        syncOnReconnect: true,
        respectBattery: true
      });

      console.log('[App] Mode offline initialisé');
    } catch (error) {
      console.error('[App] Erreur initialisation offline:', error);
    }
  };

  return <>{/* App content */}</>;
}
```

### Étape 5: Intégrer l'Authentification PIN

**Créer un Provider**:

```typescript
// src/contexts/OfflineAuthContext.tsx
import React, { createContext, useContext, useState } from 'react';
import { PINPrompt } from '@/components/vendor/OfflineAuth/PINPrompt';
import { checkSession } from '@/lib/offline/auth/offlineAuth';

interface OfflineAuthContextType {
  requireAuth: () => Promise<string>;
  sessionId: string | null;
}

const OfflineAuthContext = createContext<OfflineAuthContextType>(null!);

export function OfflineAuthProvider({ children }: { children: React.ReactNode }) {
  const [showPIN, setShowPIN] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resolveAuth, setResolveAuth] = useState<((id: string) => void) | null>(null);

  const requireAuth = (): Promise<string> => {
    return new Promise((resolve) => {
      // Vérifier si une session existe déjà
      if (sessionId && checkSession(sessionId)) {
        resolve(sessionId);
        return;
      }

      // Sinon, demander le PIN
      setResolveAuth(() => resolve);
      setShowPIN(true);
    });
  };

  const handleSuccess = (newSessionId: string) => {
    setSessionId(newSessionId);
    setShowPIN(false);
    resolveAuth?.(newSessionId);
  };

  return (
    <OfflineAuthContext.Provider value={{ requireAuth, sessionId }}>
      {children}
      <PINPrompt
        isOpen={showPIN}
        onClose={() => setShowPIN(false)}
        onSuccess={handleSuccess}
        userId={user?.id || ''}
      />
    </OfflineAuthContext.Provider>
  );
}

export const useOfflineAuth = () => useContext(OfflineAuthContext);
```

**Utilisation**:

```typescript
import { useOfflineAuth } from '@/contexts/OfflineAuthContext';

function SensitiveAction() {
  const { requireAuth } = useOfflineAuth();
  const { isOnline } = useOnlineStatus();

  const handleAction = async () => {
    // Si offline, demander le PIN
    if (!isOnline) {
      const sessionId = await requireAuth();
      if (!sessionId) return; // Annulé
    }

    // Continuer avec l'action
    performSensitiveAction();
  };

  return <Button onClick={handleAction}>Action Sensible</Button>;
}
```

---

## Configuration

### Configuration du Service Worker

**Fichier**: `vite.config.ts` ou `next.config.js`

```typescript
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300 // 5 minutes
              }
            }
          }
        ]
      },
      manifest: {
        name: '224Solutions Vista Flows',
        short_name: 'Vista Flows',
        description: 'Plateforme e-commerce avec mode offline avancé',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});
```

### Variables d'Environnement

```env
# .env.local
VITE_OFFLINE_MODE_ENABLED=true
VITE_OFFLINE_DAILY_LIMIT=50000000
VITE_OFFLINE_PIN_LENGTH=4
VITE_OFFLINE_SESSION_TIMEOUT=30
VITE_OFFLINE_MAX_FAILED_ATTEMPTS=3
VITE_OFFLINE_LOCKOUT_DURATION=15
```

---

## Exemples d'Utilisation

### Exemple 1: Vente POS Complète en Mode Offline

```typescript
import { createOfflineSale } from '@/lib/offline/advancedPOSManager';
import { decrementStockFromSale } from '@/lib/offline/localStockManager';

async function completeSale(cart, paymentMethod) {
  // 1. Vérifier la limite
  const limitCheck = await checkDailyLimit(vendorId, cart.total);
  if (!limitCheck.allowed) {
    toast.error(`Limite atteinte. Restant: ${limitCheck.remaining} GNF`);
    return;
  }

  // 2. Créer la vente
  const sale = await createOfflineSale({
    vendor_id: vendorId,
    customer_name: cart.customerName,
    items: cart.items,
    subtotal: cart.subtotal,
    tax: cart.tax,
    discount: cart.discount,
    total: cart.total,
    payment_method: paymentMethod
  });

  if (!sale.success) {
    toast.error(sale.error);
    return;
  }

  // 3. Décompter le stock
  for (const item of cart.items) {
    await decrementStockFromSale(
      item.product_id,
      item.quantity,
      sale.sale!.id
    );
  }

  // 4. Afficher le reçu
  toast.success(`Vente enregistrée: ${sale.sale!.receipt_number}`);

  return sale.sale;
}
```

### Exemple 2: Recherche Catalogue avec Cache

```typescript
import { searchProducts } from '@/lib/offline/catalogCache';

async function searchCatalog(query: string) {
  // Recherche fuzzy avec Fuse.js
  const results = await searchProducts(vendorId, query, {
    inStockOnly: true,
    limit: 20
  });

  return results.map(product => ({
    id: product.id,
    name: product.name,
    price: product.price,
    stock: product.stock,
    image: product.cached_images?.[0] || product.images[0]
  }));
}
```

### Exemple 3: Monitoring de Sync

```typescript
import { globalSyncQueue } from '@/lib/offline/sync/advancedSyncEngine';

function SyncMonitor() {
  const [stats, setStats] = useState(globalSyncQueue.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(globalSyncQueue.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h3>Synchronisation</h3>
      <p>Total: {stats.totalItems}</p>
      <p>Synchronisés: {stats.syncedItems}</p>
      <p>En attente: {stats.pendingItems}</p>
      <p>Échoués: {stats.failedItems}</p>
      <p>Compression: {(stats.compressionRatio * 100).toFixed(0)}%</p>
    </div>
  );
}
```

---

## Tests

### Tests Unitaires

```typescript
// src/lib/offline/__tests__/advancedPOSManager.test.ts
import { describe, it, expect } from 'vitest';
import { createOfflineSale, checkDailyLimit } from '../advancedPOSManager';

describe('advancedPOSManager', () => {
  it('devrait créer une vente offline', async () => {
    const result = await createOfflineSale({
      vendor_id: 'vendor_1',
      items: [{ product_id: 'p1', quantity: 1, unit_price: 1000, total: 1000 }],
      total: 1000,
      payment_method: 'cash'
    });

    expect(result.success).toBe(true);
    expect(result.sale).toBeDefined();
    expect(result.sale?.receipt_number).toMatch(/^[A-Z0-9]+-/);
  });

  it('devrait bloquer si limite dépassée', async () => {
    const limitCheck = await checkDailyLimit('vendor_1', 51_000_000);
    expect(limitCheck.allowed).toBe(false);
  });
});
```

### Tests d'Intégration

```typescript
// e2e/offline-mode.spec.ts
import { test, expect } from '@playwright/test';

test('Vente POS en mode offline', async ({ page, context }) => {
  // Activer le mode offline
  await context.setOffline(true);

  await page.goto('/vendor/pos');

  // Ajouter un produit
  await page.click('[data-testid="product-1"]');
  await page.click('[data-testid="add-to-cart"]');

  // Sélectionner paiement cash
  await page.click('[data-testid="payment-cash"]');

  // Valider la vente
  await page.click('[data-testid="complete-sale"]');

  // Vérifier le reçu
  await expect(page.locator('[data-testid="receipt"]')).toBeVisible();
  await expect(page.locator('[data-testid="offline-badge"]')).toBeVisible();
});
```

---

## Déploiement

### Checklist Pré-Déploiement

- [ ] Tests unitaires passent (80%+ coverage)
- [ ] Tests d'intégration passent
- [ ] Tests de non-régression passent (fonctionnalités existantes)
- [ ] Service Worker configuré et testé
- [ ] Manifest PWA valide
- [ ] Variables d'environnement configurées
- [ ] Documentation complète
- [ ] Formation équipe support
- [ ] Plan de rollback préparé

### Déploiement Progressif

**Phase 1 - Beta (10% utilisateurs)**:
```bash
# Activer pour 10% des vendeurs
VITE_OFFLINE_MODE_ROLLOUT_PERCENTAGE=10
```

**Phase 2 - Élargissement (50% utilisateurs)**:
```bash
VITE_OFFLINE_MODE_ROLLOUT_PERCENTAGE=50
```

**Phase 3 - Complet (100% utilisateurs)**:
```bash
VITE_OFFLINE_MODE_ROLLOUT_PERCENTAGE=100
```

### Monitoring

```typescript
// Sentry pour tracking erreurs
import * as Sentry from '@sentry/react';

try {
  await createOfflineSale(saleData);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      feature: 'offline-pos',
      payment_method: saleData.payment_method
    },
    extra: {
      daily_total: limitCheck.currentTotal,
      sale_amount: saleData.total
    }
  });
}
```

---

## Support et Maintenance

### Logs de Débogage

Activer les logs détaillés:

```typescript
// En développement
localStorage.setItem('DEBUG_OFFLINE_MODE', 'true');

// Les modules loggeront automatiquement
// [OfflinePOS] ✅ Vente créée: ...
// [LocalStock] ✅ Stock décompté: ...
// [AdvancedSync] Processing queued item: ...
```

### Nettoyage de Données

Fonction utilitaire pour nettoyer toutes les données offline:

```typescript
import { clearCatalogCache } from '@/lib/offline/catalogCache';
import { cleanupOldSyncedSales } from '@/lib/offline/advancedPOSManager';
import { cleanupOldMovements } from '@/lib/offline/localStockManager';

async function cleanupAllOfflineData(vendorId: string) {
  await clearCatalogCache(vendorId);
  await cleanupOldSyncedSales();
  await cleanupOldMovements();

  console.log('Données offline nettoyées');
}
```

---

**Version**: 1.0.0
**Date**: 01 Février 2026
**Auteur**: 224Solutions

© 2026 224Solutions - Tous droits réservés
