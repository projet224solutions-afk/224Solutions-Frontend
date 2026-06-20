# Guide du Mode Hors Ligne Avancé - 224Solutions Vista Flows

## 📖 Table des Matières

1. [Introduction](#introduction)
2. [Installation et Configuration](#installation-et-configuration)
3. [Fonctionnalités Disponibles](#fonctionnalités-disponibles)
4. [Guide d'Utilisation](#guide-dutilisation)
5. [Sécurité](#sécurité)
6. [Synchronisation](#synchronisation)
7. [Résolution de Problèmes](#résolution-de-problèmes)
8. [API et Intégration](#api-et-intégration)

---

## Introduction

Le **Mode Hors Ligne Avancé** permet aux vendeurs de continuer à utiliser Vista Flows même sans connexion internet, comme un logiciel installé (type Microsoft Word).

### Caractéristiques Principales

- ✅ **Fonctionnement 100% offline** pour les fonctionnalités essentielles
- ✅ **Limite sécurisée** de 50M GNF par jour en ventes offline
- ✅ **3 méthodes de paiement** offline (Cash, USSD, QR codes)
- ✅ **Synchronisation automatique** au retour en ligne
- ✅ **Sécurité renforcée** avec PIN et biométrie
- ✅ **Aucune perte de données** grâce au système de queue

### ⚠️ Important

Le mode offline est **EXCLUSIVEMENT** réservé à l'interface vendeur. Les clients ne peuvent pas effectuer d'achats en ligne en mode offline.

---

## Installation et Configuration

### Prérequis

1. **Navigateur compatible PWA**:
   - Chrome 67+
   - Edge 79+
   - Safari 11.1+
   - Firefox 62+

2. **Espace de stockage**: Minimum 50 MB disponible

### Installation PWA

1. **Sur Mobile** (Android/iOS):
   - Ouvrez Vista Flows dans votre navigateur
   - Tapez sur le menu (⋮)
   - Sélectionnez "Ajouter à l'écran d'accueil"
   - L'icône apparaîtra sur votre écran d'accueil

2. **Sur Desktop** (Windows/Mac/Linux):
   - Ouvrez Vista Flows dans Chrome/Edge
   - Cliquez sur l'icône d'installation (⊕) dans la barre d'adresse
   - Cliquez sur "Installer"
   - L'application s'ouvrira dans une fenêtre dédiée

### Configuration Initiale

#### 1. Configurer le Code PIN

```typescript
// Au premier lancement en mode offline
import { setupPIN } from '@/lib/offline/auth/offlineAuth';

await setupPIN(userId, '1234'); // PIN à 4 chiffres
```

**Via l'interface**:
1. Allez dans **Paramètres** → **Sécurité**
2. Activez "Mode Hors Ligne"
3. Configurez votre code PIN (4 ou 6 chiffres)
4. (Optionnel) Activez l'authentification biométrique

#### 2. Précharger les Données

```typescript
// Charger le catalogue en cache
import { cacheVendorProducts, cacheCategories } from '@/lib/offline/catalogCache';

await cacheVendorProducts(vendorId, products, true); // true = cache images
await cacheCategories(categories);
```

#### 3. Initialiser le Stock Local

```typescript
import { loadInitialStock } from '@/lib/offline/localStockManager';

await loadInitialStock(vendorId, products);
```

---

## Fonctionnalités Disponibles

### ✅ Autorisées en Mode Hors Ligne

#### 1. Système POS

**Ventes au comptoir**:
- Ajout de produits au panier
- Calcul automatique des totaux
- Application de remises
- Génération de reçus

**Méthodes de paiement**:
- 💵 **Espèces** (Cash)
- 📱 **USSD** - Codes générés localement (format: `*224*XXX*YYYY#`)
- 📲 **QR Code local** - Pour paiement différé

**Limite**: Maximum **50 000 000 GNF** par jour en mode offline

#### 2. Gestion du Stock

- Consultation du stock local
- Ajustement manuel du stock
- Décompte automatique après vente
- Alertes stock bas (3 niveaux: warning, critical, out_of_stock)
- Historique des mouvements

#### 3. Consultation Catalogue

- Navigation dans le catalogue (lecture seule)
- Recherche produits (fuzzy search)
- Filtres par catégorie
- Consultation détails produits
- ⛔ **PAS d'ajout au panier client** (commande en ligne uniquement)

#### 4. Reçus et Impressions

- Génération PDF des reçus
- Impression via Bluetooth
- Sauvegarde automatique dans l'historique
- QR code sur chaque reçu

### ⛔ Interdites en Mode Hors Ligne

Les fonctionnalités suivantes nécessitent une connexion internet:

- **Commandes en ligne** (clients)
- **Copilot / Assistant IA**
- **Messagerie et chat**
- **Notifications temps réel**
- **Virements bancaires**
- **Envoi Mobile Money**
- **Retrait de commissions**
- **Paiements par carte**

---

## Guide d'Utilisation

### Effectuer une Vente POS en Mode Offline

#### Étape 1: Vérifier le Statut

```typescript
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { checkDailyLimit } from '@/lib/offline/advancedPOSManager';

const { isOnline } = useOnlineStatus();
const limitCheck = await checkDailyLimit(vendorId, montantVente);

if (!limitCheck.allowed) {
  alert(`Limite atteinte! Restant: ${limitCheck.remaining} GNF`);
  return;
}
```

#### Étape 2: Créer la Vente

```typescript
import { createOfflineSale } from '@/lib/offline/advancedPOSManager';

const result = await createOfflineSale({
  vendor_id: vendorId,
  customer_name: 'Client',
  items: [
    {
      product_id: 'prod_1',
      product_name: 'Produit A',
      quantity: 2,
      unit_price: 10000,
      discount: 0,
      total: 20000
    }
  ],
  subtotal: 20000,
  tax: 0,
  discount: 0,
  total: 20000,
  payment_method: 'cash', // ou 'ussd', 'qr_local'
  notes: 'Vente en mode offline'
});

if (result.success) {
  console.log('Vente créée:', result.sale?.receipt_number);
  // La vente sera automatiquement synchronisée au retour en ligne
}
```

#### Étape 3: Générer le Reçu

Le reçu est généré automatiquement avec:
- Numéro unique (ex: `VEND-ABC123-XY45`)
- Date et heure de la vente
- Détails des articles
- Montant total
- Méthode de paiement
- QR code de référence
- Mention "Vente Offline" si applicable

### Gérer le Stock Local

#### Consulter le Stock

```typescript
import { useOfflineStock } from '@/hooks/useOfflineStock';

function StockView() {
  const { stock, lowStockProducts, outOfStockProducts, stats } = useOfflineStock();

  return (
    <div>
      <p>Produits en stock: {stats.totalProducts}</p>
      <p>Stock bas: {stats.lowStockCount}</p>
      <p>Ruptures: {stats.outOfStockCount}</p>

      {lowStockProducts.map(item => (
        <div key={item.product_id}>
          {item.product_name}: {item.available_quantity} {item.unit}
        </div>
      ))}
    </div>
  );
}
```

#### Ajuster le Stock

```typescript
import { adjustStock } from '@/lib/offline/localStockManager';

// Corriger un inventaire
await adjustStock(
  productId,
  vendorId,
  nouveauStock,
  'Inventaire du 01/02/2026'
);
```

### Rechercher dans le Catalogue

```typescript
import { useOfflineCatalog } from '@/hooks/useOfflineCatalog';

function CatalogSearch() {
  const { search, products, loading } = useOfflineCatalog();

  const handleSearch = async (query: string) => {
    await search(query, {
      inStockOnly: true, // Seulement les produits en stock
      categoryId: 'cat_123' // Filtrer par catégorie
    });
  };

  return (
    <div>
      <input
        type="text"
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Rechercher un produit..."
      />

      {loading ? <p>Chargement...</p> : (
        <div>
          {products.map(product => (
            <div key={product.id}>
              <h3>{product.name}</h3>
              <p>{product.price} GNF</p>
              <p>Stock: {product.stock}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Sécurité

### Authentification Offline

#### Code PIN

**Configuration**:
- 4 ou 6 chiffres
- Hashé avec SHA-256 + salt unique
- Stocké de manière sécurisée dans IndexedDB

**Vérification**:
- Maximum 3 tentatives
- Verrouillage 15 minutes après échec
- Session valide 30 minutes

**Utilisation**:

```typescript
import { authenticateWithPIN } from '@/lib/offline/auth/offlineAuth';

const result = await authenticateWithPIN(userId, '1234');

if (result.success) {
  console.log('Session ID:', result.sessionId);
  // Accès accordé
} else {
  console.log('Erreur:', result.error);
  console.log('Tentatives restantes:', result.attemptsRemaining);
}
```

#### Authentification Biométrique

**Plateformes supportées**:
- 📱 iOS: Touch ID / Face ID
- 🤖 Android: Fingerprint
- 💻 Windows: Windows Hello
- 🍎 macOS: Touch ID

**Activation**:

```typescript
import { registerBiometric, authenticateWithBiometric } from '@/lib/offline/auth/biometric';

// Enregistrement
const result = await registerBiometric(userId, userName);

// Authentification
const authResult = await authenticateWithBiometric(userId);
```

### Chiffrement des Données

#### Algorithme: PBKDF2 + AES-GCM

**Caractéristiques**:
- Dérivation de clé: PBKDF2 (100 000 itérations)
- Chiffrement: AES-GCM 256 bits
- Salt unique par chiffrement
- IV (Initialization Vector) aléatoire

**Données chiffrées**:
- ✅ Historique des ventes offline
- ✅ Données produits locales
- ✅ Informations de paiement
- ✅ Clés API stockées

**Utilisation**:

```typescript
import { encryptWithPassword, decryptWithPassword } from '@/lib/offline/security/encryption';

// Chiffrer
const encrypted = await encryptWithPassword(
  { secret: 'données sensibles' },
  userPIN
);

// Déchiffrer
const decrypted = await decryptWithPassword(encrypted, userPIN);
```

---

## Synchronisation

### Fonctionnement

#### 1. Détection Automatique

Le système détecte automatiquement:
- Passage en mode offline
- Retour en ligne
- Changement de visibilité de l'onglet

#### 2. Priorités de Sync

| Priorité | Entités | Fréquence |
|----------|---------|-----------|
| **CRITICAL** | Ventes POS | Immédiate |
| **HIGH** | Commandes, Stock | 30s |
| **MEDIUM** | Produits, Messages | 1 min |
| **LOW** | Paramètres, Favoris | 10 min |
| **BACKGROUND** | Historique, Analytics | 1h |

#### 3. Retry Intelligent

En cas d'échec de synchronisation:
- **Tentative 1**: Après 1 seconde
- **Tentative 2**: Après 2 secondes
- **Tentative 3**: Après 4 secondes
- **Tentative 4**: Après 8 secondes
- **Tentative 5**: Après 16 secondes
- **Tentative 6**: Après 30 secondes (max)

Après 6 tentatives: marqué comme échec pour revue manuelle.

### Résolution de Conflits

#### Stratégies par Entité

**Ventes POS**: `client-wins`
- La vente locale prime TOUJOURS (transaction finale)

**Stock**: `smart-merge`
- Stock serveur - ventes locales = stock final

**Produits**: `server-wins` + merge
- Informations produit: serveur
- Stock local si plus récent

**Commandes**: `server-wins`
- Le serveur gère le workflow

**Paramètres**: `client-wins`
- Préférences utilisateur locales

#### Exemple de Conflit Stock

```typescript
import { resolveStockConflict } from '@/lib/offline/sync/conflictResolver';

const resolution = await resolveStockConflict(
  {
    localData: { product_id: 'prod_1', quantity: 45 },
    serverData: { product_id: 'prod_1', quantity: 50 },
    localModified: new Date('2026-02-01T10:00:00'),
    serverModified: new Date('2026-02-01T09:00:00'),
    entity: 'products'
  },
  5 // Ventes locales
);

// Résultat: 50 (serveur) - 5 (ventes locales) = 45
```

### Surveillance de la Sync

```typescript
import { globalSyncQueue } from '@/lib/offline/sync/advancedSyncEngine';

// Obtenir les statistiques
const stats = globalSyncQueue.getStats();

console.log('Total:', stats.totalItems);
console.log('Synchronisés:', stats.syncedItems);
console.log('Échoués:', stats.failedItems);
console.log('En attente:', stats.pendingItems);
console.log('Taux de compression:', stats.compressionRatio);
```

---

## Résolution de Problèmes

### Problème: Limite journalière atteinte

**Symptôme**: Message "Limite de 50M GNF atteinte"

**Solution**:
1. Vérifiez le total du jour: `checkDailyLimit(vendorId, 0)`
2. Reconnectez-vous à internet
3. Attendez la synchronisation complète
4. La limite se réinitialise à minuit

### Problème: PIN oublié

**Solution**:
1. Reconnectez-vous à internet
2. Utilisez la fonctionnalité "Mot de passe oublié"
3. Configurez un nouveau PIN
4. Les données locales resteront chiffrées avec l'ancien PIN

**⚠️ Perte de données locales si PIN définitivement perdu**

### Problème: Synchronisation bloquée

**Symptôme**: Ventes en attente qui ne se synchronisent pas

**Solution**:
1. Vérifiez votre connexion internet
2. Consultez les ventes en attente: `getPendingSales(vendorId)`
3. Forcez la synchronisation manuelle
4. Si le problème persiste, contactez le support

```typescript
import { getScheduler } from '@/lib/offline/sync/syncScheduler';

const scheduler = getScheduler();
scheduler.forceSyncAll(); // Force sync de tout
```

### Problème: Stockage plein

**Symptôme**: Erreur "Espace insuffisant"

**Solution**:
1. Nettoyez les ventes anciennes synchronisées:
```typescript
import { cleanupOldSyncedSales } from '@/lib/offline/advancedPOSManager';
await cleanupOldSyncedSales();
```

2. Supprimez les images en cache:
```typescript
import { clearCatalogCache } from '@/lib/offline/catalogCache';
await clearCatalogCache(vendorId);
```

3. Libérez de l'espace sur votre appareil

---

## API et Intégration

### Composants React

#### OfflineStatusBar

```tsx
import { OfflineStatusBar } from '@/components/vendor/OfflineUI/OfflineStatusBar';

<OfflineStatusBar
  showDetails={true}
  pendingSyncCount={5}
  lastSyncTime={new Date()}
/>
```

#### OfflineBadge

```tsx
import { OfflineBadge } from '@/components/vendor/OfflineUI/OfflineBadge';

<OfflineBadge feature="online_orders" variant="badge">
  <Button>Commander en ligne</Button>
</OfflineBadge>
```

#### PINPrompt

```tsx
import { PINPrompt } from '@/components/vendor/OfflineAuth/PINPrompt';

<PINPrompt
  isOpen={showPIN}
  onClose={() => setShowPIN(false)}
  onSuccess={(sessionId) => console.log('Session:', sessionId)}
  userId={userId}
  allowBiometric={true}
/>
```

### Hooks

#### useOfflineFeatureAccess

```tsx
import { useOfflineFeatureAccess } from '@/hooks/useOfflineFeatureAccess';

function OrderButton() {
  const { isAllowed, block } = useOfflineFeatureAccess('online_orders');

  const handleClick = () => {
    if (block()) return; // Affiche toast d'erreur automatiquement
    // Continuer...
  };

  return (
    <Button disabled={!isAllowed} onClick={handleClick}>
      Commander
    </Button>
  );
}
```

#### useOfflineStock

```tsx
import { useOfflineStock } from '@/hooks/useOfflineStock';

function StockManager() {
  const {
    stock,
    alerts,
    stats,
    decrementStock,
    updateStock
  } = useOfflineStock();

  return <div>...</div>;
}
```

#### useOfflineCatalog

```tsx
import { useOfflineCatalog } from '@/hooks/useOfflineCatalog';

function CatalogBrowser() {
  const {
    products,
    categories,
    search,
    filterByCategory
  } = useOfflineCatalog();

  return <div>...</div>;
}
```

---

## Support

Pour toute question ou assistance:

- 📧 Email: support@224solutions.com
- 📱 WhatsApp: +224 XXX XXX XXX
- 🌐 Site web: https://224solutions.com
- 📖 Documentation: https://docs.224solutions.com

---

**Version**: 1.0.0
**Date**: 01 Février 2026
**Auteur**: 224Solutions

© 2026 224Solutions - Tous droits réservés
