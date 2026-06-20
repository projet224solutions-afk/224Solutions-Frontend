

# ✅ Checklist d'Intégration - Mode Hors Ligne Avancé

Guide pas à pas pour intégrer le système de mode offline dans votre application Vista Flows.

---

## 📋 Phase 1: Préparation (15 min)

### ✅ 1.1 Vérifier les Prérequis

- [ ] Node.js 16+ installé
- [ ] Dépendances installées (`npm install`)
- [ ] Fuse.js installé (`npm install fuse.js`) ✅ FAIT
- [ ] Application démarre sans erreurs
- [ ] Git configuré (pour sauvegardes)

### ✅ 1.2 Créer une Branche

```bash
git checkout -b feature/offline-mode-integration
```

### ✅ 1.3 Sauvegarder l'État Actuel

```bash
git add .
git commit -m "Avant intégration mode offline"
```

---

## 📋 Phase 2: Configuration Provider (10 min)

### ✅ 2.1 Ajouter le Provider d'Auth Offline

**Fichier**: `src/App.tsx` ou `src/main.tsx`

```tsx
import { OfflineAuthProvider } from '@/contexts/OfflineAuthContext';

function App() {
  return (
    <AuthProvider> {/* Provider existant */}
      <OfflineAuthProvider> {/* NOUVEAU */}
        {/* Reste de l'app */}
      </OfflineAuthProvider>
    </AuthProvider>
  );
}
```

**Vérification**:
- [ ] Application compile sans erreurs
- [ ] Aucune régression visuelle

### ✅ 2.2 Ajouter l'Initialisation Automatique

**Fichier**: `src/App.tsx`

```tsx
import { useOfflineInitialization } from '@/hooks/useOfflineInitialization';

function App() {
  // Hook d'initialisation (s'active automatiquement pour les vendeurs)
  const { isInitialized, isInitializing, error } = useOfflineInitialization();

  // Optionnel: Afficher un indicateur de chargement
  if (isInitializing) {
    return <div>Initialisation du mode offline...</div>;
  }

  return (
    <OfflineAuthProvider>
      {/* Reste de l'app */}
    </OfflineAuthProvider>
  );
}
```

**Vérification**:
- [ ] Hook s'initialise au démarrage
- [ ] Console affiche `[OfflineInit] Démarrage initialisation...`
- [ ] Pas d'erreurs dans la console

---

## 📋 Phase 3: Intégration UI (30 min)

### ✅ 3.1 Ajouter la Barre de Statut Offline

**Fichier**: `src/components/layouts/VendorLayout.tsx` (ou votre layout principal)

```tsx
import { OfflineStatusBar } from '@/components/vendor/OfflineUI/OfflineStatusBar';
import { globalSyncQueue } from '@/lib/offline/sync/advancedSyncEngine';

export function VendorLayout({ children }: { children: React.ReactNode }) {
  const stats = globalSyncQueue.getStats();

  return (
    <div className="min-h-screen">
      {/* Barre de statut en haut */}
      <OfflineStatusBar
        showDetails={true}
        pendingSyncCount={stats.pendingItems}
        className="mb-4"
      />

      {/* Header existant */}
      <header>...</header>

      {/* Contenu */}
      <main>{children}</main>
    </div>
  );
}
```

**Vérification**:
- [ ] Barre visible en haut de la page
- [ ] Badge "En ligne" affiché quand connecté
- [ ] Badge "Hors ligne" affiché en mode avion (tester)

### ✅ 3.2 Protéger les Fonctionnalités Interdites

**Exemple**: Menu de Navigation

```tsx
import { OfflineBadge } from '@/components/vendor/OfflineUI/OfflineBadge';

const menuItems = [
  { label: 'POS', href: '/pos', feature: 'pos_sales' },
  { label: 'Commandes', href: '/orders', feature: 'online_orders' }, // Bloqué offline
  { label: 'Messages', href: '/messages', feature: 'messaging' }, // Bloqué offline
  { label: 'Stock', href: '/stock', feature: 'stock_view' }
];

function Navigation() {
  return (
    <nav>
      {menuItems.map(item => (
        <OfflineBadge
          key={item.href}
          feature={item.feature}
          variant="inline"
        >
          <Link href={item.href}>{item.label}</Link>
        </OfflineBadge>
      ))}
    </nav>
  );
}
```

**Vérification**:
- [ ] Fonctionnalités affichent badge "Nécessite connexion" en mode offline
- [ ] Liens fonctionnent normalement en ligne
- [ ] Toast d'erreur si clic sur fonctionnalité bloquée

### ✅ 3.3 Intégrer le POS Offline (si applicable)

**Option A**: Wrapper Automatique (Recommandé)

Créer: `src/components/vendor/POSWrapper.tsx`

```tsx
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import POSSystem from './POSSystem'; // Votre POS existant
import { OfflinePOSInterface } from './OfflinePOS/OfflinePOSInterface';

export function POSWrapper() {
  const { isOnline } = useOnlineStatus();

  // Si offline, utiliser l'interface offline
  if (!isOnline) {
    return <OfflinePOSInterface />;
  }

  // Sinon, POS normal
  return <POSSystem />;
}
```

Puis remplacer:
```tsx
// AVANT
import POSSystem from '@/components/vendor/POSSystem';
<POSSystem />

// APRÈS
import { POSWrapper } from '@/components/vendor/POSWrapper';
<POSWrapper />
```

**Option B**: Bouton Manuel

```tsx
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

function POSButton() {
  const { isOnline } = useOnlineStatus();

  return (
    <div>
      <Link href="/pos/online">POS Normal</Link>
      {!isOnline && (
        <Link href="/pos/offline" className="bg-orange-500">
          POS Offline (Mode Hors Ligne)
        </Link>
      )}
    </div>
  );
}
```

**Vérification**:
- [ ] POS offline accessible en mode avion
- [ ] Interface affiche les produits du stock local
- [ ] Paiements Cash/USSD/QR fonctionnent
- [ ] Ventes enregistrées localement

---

## 📋 Phase 4: Implémentation Fetch Données (20 min)

### ✅ 4.1 Implémenter fetchVendorProducts

**Fichier**: `src/hooks/useOfflineInitialization.ts`

Remplacer la fonction simulée:

```tsx
async function fetchVendorProducts(vendorId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('is_active', true);

  if (error) {
    console.error('Erreur fetch produits:', error);
    throw error;
  }

  return data || [];
}
```

**Vérification**:
- [ ] Produits se chargent correctement
- [ ] Pas d'erreurs dans la console
- [ ] Cache IndexedDB contient les produits (DevTools → Application → IndexedDB)

### ✅ 4.2 Implémenter fetchCategories

```tsx
async function fetchCategories(): Promise<any[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*');

  if (error) {
    console.error('Erreur fetch catégories:', error);
    throw error;
  }

  return data || [];
}
```

**Vérification**:
- [ ] Catégories se chargent
- [ ] Cache contient les catégories

---

## 📋 Phase 5: Configuration PWA (15 min)

### ✅ 5.1 Vérifier le Service Worker

**Fichier**: `public/service-worker.js` (devrait déjà exister)

Si pas de SW, en créer un basique:

```js
const CACHE_NAME = 'vista-flows-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/offline.html'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

**Vérification**:
- [ ] Service Worker enregistré (DevTools → Application → Service Workers)
- [ ] Cache créé (DevTools → Application → Cache Storage)

### ✅ 5.2 Vérifier le Manifest PWA

**Fichier**: `public/manifest.json`

```json
{
  "name": "224Solutions Vista Flows",
  "short_name": "Vista Flows",
  "description": "Plateforme e-commerce avec mode offline",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Vérification**:
- [ ] Manifest valide (DevTools → Application → Manifest)
- [ ] Icônes présentes

---

## 📋 Phase 6: Tests (45 min)

### ✅ 6.1 Tests Mode Online

- [ ] Application démarre normalement
- [ ] Toutes les fonctionnalités existantes fonctionnent
- [ ] Barre de statut affiche "En ligne"
- [ ] Pas d'erreurs dans la console

### ✅ 6.2 Tests Mode Offline (Mode Avion)

**Activer le mode avion**:
- Mobile: Paramètres → Mode Avion
- Desktop: DevTools → Network → Offline

**Tests à effectuer**:

#### POS Offline
- [ ] Interface POS offline accessible
- [ ] Produits affichés depuis le cache local
- [ ] Ajout produit au panier fonctionne
- [ ] Paiement Cash fonctionne
- [ ] Paiement USSD génère un code
- [ ] Paiement QR génère un QR
- [ ] Reçu généré avec numéro unique
- [ ] Vente enregistrée dans IndexedDB

#### Stock Local
- [ ] Consultation stock fonctionne
- [ ] Stock décompté après vente
- [ ] Alertes stock bas affichées
- [ ] Ajustement manuel fonctionne

#### Catalogue
- [ ] Navigation catalogue fonctionne
- [ ] Recherche produits fonctionne
- [ ] Filtres par catégorie fonctionnent
- [ ] Images en cache affichées

#### Fonctionnalités Bloquées
- [ ] Badge "Nécessite connexion" affiché
- [ ] Toast d'erreur si clic sur fonctionnalité bloquée
- [ ] Liens désactivés visuellement

### ✅ 6.3 Tests Synchronisation

**Scénario**:
1. Mode offline: Faire 3 ventes POS
2. Vérifier dans IndexedDB que les ventes sont stockées
3. Repasser en ligne (désactiver mode avion)
4. Attendre 10 secondes
5. Vérifier que les ventes sont synchronisées

**Checklist**:
- [ ] Sync automatique au retour en ligne
- [ ] Toast "Synchronisation en cours" affiché
- [ ] Ventes apparaissent dans la base de données serveur
- [ ] Stock serveur mis à jour correctement
- [ ] Aucune erreur de sync

### ✅ 6.4 Tests Sécurité

#### Configuration PIN
- [ ] Peut configurer un PIN à 4 chiffres
- [ ] Peut configurer un PIN à 6 chiffres
- [ ] PIN refusé si pas que des chiffres
- [ ] PIN refusé si longueur incorrecte

#### Authentification PIN
- [ ] Prompt PIN s'affiche en mode offline
- [ ] PIN correct → accès accordé
- [ ] PIN incorrect → erreur affichée
- [ ] 3 tentatives échouées → verrouillage 15 min
- [ ] Session expire après 30 min d'inactivité

#### Biométrie (si disponible)
- [ ] Option biométrie proposée
- [ ] Touch ID / Face ID fonctionne
- [ ] Authentification réussie → accès accordé

### ✅ 6.5 Tests Limite Journalière

**Scénario**:
1. Mode offline
2. Faire des ventes pour un total > 50M GNF
3. Vérifier le blocage

**Checklist**:
- [ ] Ventes < 50M → autorisées
- [ ] Vente qui dépasse 50M → refusée
- [ ] Message d'erreur explicite affiché
- [ ] Compteur restant affiché

### ✅ 6.6 Tests de Non-Régression

**CRITIQUE**: Vérifier que rien n'est cassé

- [ ] POS normal (online) fonctionne identiquement
- [ ] Commandes en ligne fonctionnent
- [ ] Messagerie fonctionne
- [ ] Dashboard vendeur fonctionne
- [ ] Gestion produits fonctionne
- [ ] Paiements en ligne (Mobile Money, Carte) fonctionnent

---

## 📋 Phase 7: Optimisation (30 min)

### ✅ 7.1 Préchargement Images

**Limiter le nombre d'images**:
```tsx
// Dans useOfflineInitialization.ts
await cacheVendorProducts(vendorId, products, true); // Cache top 100 images
```

**Vérifier**:
- [ ] Maximum 100 images en cache
- [ ] Taille totale cache < 50 MB
- [ ] Images s'affichent correctement offline

### ✅ 7.2 Nettoyage Automatique

**Ajouter un cron de nettoyage**:
```tsx
// Dans App.tsx
useEffect(() => {
  // Nettoyer toutes les 24h
  const interval = setInterval(async () => {
    await cleanupOldSyncedSales();
    await cleanupOldMovements();
    await cleanupExpiredSessions();
  }, 24 * 60 * 60 * 1000);

  return () => clearInterval(interval);
}, []);
```

**Vérifier**:
- [ ] Anciennes ventes (>30j) supprimées
- [ ] Anciens mouvements (>90j) supprimés
- [ ] Sessions expirées supprimées

---

## 📋 Phase 8: Documentation (15 min)

### ✅ 8.1 Documenter l'Intégration

Créer: `docs/OFFLINE_MODE_SETUP.md`

```markdown
# Configuration Mode Offline - Vista Flows

## Activation pour un Vendeur

1. Se connecter en tant que vendeur
2. Aller dans Paramètres → Sécurité
3. Activer "Mode Hors Ligne"
4. Configurer un code PIN
5. (Optionnel) Activer la biométrie

## Utilisation

- Le mode offline s'active automatiquement si pas de connexion
- Limite: 50M GNF par jour en ventes offline
- Méthodes de paiement: Cash, USSD, QR uniquement
- Synchronisation automatique au retour en ligne
```

**Vérifier**:
- [ ] Documentation créée
- [ ] Guide utilisateur clair

### ✅ 8.2 Former l'Équipe

**Formation Support** (1h):
- [ ] Présentation des fonctionnalités
- [ ] Démonstration live
- [ ] Guide de dépannage
- [ ] Q&A

**Formation Développeurs** (2h):
- [ ] Architecture du système
- [ ] Points d'intégration
- [ ] Débogage
- [ ] Maintenance

---

## 📋 Phase 9: Déploiement (Variable)

### ✅ 9.1 Déploiement Staging

```bash
# Build
npm run build

# Deploy staging
# (selon votre processus)
```

**Tests Staging**:
- [ ] Tous les tests Phase 6 passent
- [ ] Performance acceptable
- [ ] Aucune erreur en production

### ✅ 9.2 Déploiement Progressif Production

**10% utilisateurs** (Semaine 1):
```env
VITE_OFFLINE_MODE_ROLLOUT=10
```
- [ ] Monitoring actif (Sentry, logs)
- [ ] Feedback utilisateurs positif
- [ ] Aucun bug critique

**50% utilisateurs** (Semaine 2):
```env
VITE_OFFLINE_MODE_ROLLOUT=50
```
- [ ] Performance stable
- [ ] Sync fonctionne correctement
- [ ] Feedback positif

**100% utilisateurs** (Semaine 3):
```env
VITE_OFFLINE_MODE_ROLLOUT=100
```
- [ ] Déploiement complet
- [ ] Communication aux utilisateurs
- [ ] Support prêt

---

## 📋 Phase 10: Monitoring (Continu)

### ✅ 10.1 Métriques à Surveiller

**Performance**:
- [ ] Temps chargement PWA < 3s
- [ ] Temps vente POS offline < 2s
- [ ] Temps recherche catalogue < 100ms

**Utilisation**:
- [ ] Nombre de ventes offline / jour
- [ ] Taux de synchronisation réussie
- [ ] Nombre d'utilisateurs avec PIN configuré

**Erreurs**:
- [ ] Taux d'erreur sync < 1%
- [ ] Erreurs limite dépassée
- [ ] Échecs d'authentification

### ✅ 10.2 Alertes à Configurer

- [ ] Taux de sync < 95% → Alerte équipe tech
- [ ] Stockage plein → Notification utilisateur
- [ ] Erreurs critiques → Page Sentry

---

## ✅ CHECKLIST FINALE

Avant de considérer l'intégration terminée:

- [ ] **Toutes** les phases 1-9 complétées
- [ ] **Zéro** régression des fonctionnalités existantes
- [ ] **Tous** les tests passent (online et offline)
- [ ] Documentation complète et à jour
- [ ] Équipe formée
- [ ] Monitoring en place
- [ ] Plan de rollback préparé
- [ ] Déploiement progressif validé

---

## 🆘 Support

Si vous rencontrez des problèmes:

1. **Vérifier les logs** (Console navigateur)
2. **Consulter** [OFFLINE_MODE_GUIDE.md](./OFFLINE_MODE_GUIDE.md)
3. **Tester** en mode incognito
4. **Vider** le cache (DevTools → Application → Clear storage)
5. **Contacter** l'équipe technique

---

**Bonne chance avec l'intégration! 🚀**

© 2026 224Solutions
