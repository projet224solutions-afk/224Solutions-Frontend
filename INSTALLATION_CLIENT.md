# 📦 INSTALLATION VISTA FLOWS - GUIDE CLIENT

## ✅ Prérequis

Avant de commencer, assurez-vous d'avoir installé :

1. **Node.js** (v18 ou supérieur)
   - Télécharger sur : https://nodejs.org
   - Vérifier la version : `node --version`

2. **npm** (inclus avec Node.js)
   - Vérifier : `npm --version`

3. **Git** (optionnel, pour cloner le projet)
   - Télécharger sur : https://git-scm.com

---

## 🚀 INSTALLATION RAPIDE

### Étape 1 : Récupérer les fichiers

**Option A - Avec Git :**
```bash
git clone [URL_DU_REPO] vista-flows
cd vista-flows
```

**Option B - Archive ZIP :**
1. Extraire l'archive dans un dossier
2. Ouvrir le terminal dans ce dossier

### Étape 2 : Installer les dépendances

```bash
npm install
```

⏱️ **Durée** : 2-5 minutes selon votre connexion

### Étape 3 : Configuration

Créer un fichier `.env` à la racine du projet :

```env
# Configuration Supabase (OBLIGATOIRE)
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre_cle_anon_key_ici
VITE_SUPABASE_PUBLISHABLE_KEY=votre_cle_anon_key_ici

# Port du serveur local (OPTIONNEL)
PORT=3001
VITE_API_URL=http://localhost:3001
```

> ⚠️ **Important** : Remplacez les valeurs par vos propres clés Supabase

### Étape 4 : Configuration Supabase

1. **Créer un compte** sur https://supabase.com
2. **Créer un nouveau projet**
3. **Récupérer les clés** :
   - Aller dans `Settings` > `API`
   - Copier `Project URL` → `VITE_SUPABASE_URL`
   - Copier `anon/public key` → `VITE_SUPABASE_ANON_KEY`

4. **Exécuter les migrations** :
   - Aller dans `SQL Editor` sur Supabase
   - Exécuter chaque fichier du dossier `supabase/migrations/` dans l'ordre chronologique

### Étape 5 : Démarrer l'application

```bash
# Frontend uniquement
npm run dev

# OU Frontend + Backend
npm run dev:all
```

L'application sera accessible sur : **http://localhost:8080**

---

## 🔧 CONFIGURATION BACKEND (Optionnel)

Si vous voulez utiliser le backend Node.js :

### 1. Configuration backend

Créer un fichier `backend/.env` :

```env
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
PORT=3001
NODE_ENV=development
```

### 2. Installer les dépendances backend

```bash
cd backend
npm install
cd ..
```

### 3. Démarrer le backend

```bash
npm run dev:backend
```

Le backend sera accessible sur : **http://localhost:3001**

---

## 📱 CONNEXION & PREMIER UTILISATEUR

### Créer un compte CEO automatiquement

1. Créer un utilisateur via l'interface de connexion
2. Exécuter dans Supabase SQL Editor :

```sql
-- Copier le contenu de :
-- supabase/migrations/20260201000002_auto_promote_latest_user_to_ceo.sql
```

3. Réinitialiser le mot de passe :
   - Cliquer sur "Mot de passe oublié"
   - Entrer votre email
   - Suivre le lien reçu par email

---

## 🎯 FONCTIONNALITÉS PRINCIPALES

### ✅ Authentification
- Connexion par email/mot de passe
- OAuth (Google, Facebook)
- Système multi-rôles (CEO, Vendeur, Livreur, Client, etc.)
- Authentification 2FA pour agents et bureaux

### ✅ POS (Point de Vente)
- Interface tactile pour caisse
- Gestion des produits
- Scanner de code-barres
- Impression de tickets
- Mode hors ligne

### ✅ E-commerce
- Marketplace produits physiques et numériques
- Panier d'achat
- Paiements intégrés
- Gestion des commandes
- Suivi de livraison

### ✅ Services
- Taxi-Moto (géolocalisation en temps réel)
- Livraison
- Services professionnels
- Restaurants

### ✅ Wallet & Paiements
- Portefeuille électronique
- Cartes virtuelles
- Transferts
- Historique des transactions

---

## 🔍 DÉPANNAGE

### Problème : "Cannot connect to Supabase"

**Solution :**
1. Vérifier que le fichier `.env` existe
2. Vérifier que les clés Supabase sont correctes
3. Vérifier la connexion internet

### Problème : "npm install" échoue

**Solution :**
```bash
# Nettoyer le cache npm
npm cache clean --force

# Supprimer node_modules
rm -rf node_modules

# Réinstaller
npm install
```

### Problème : "Port 8080 already in use"

**Solution :**
```bash
# Trouver le processus
netstat -ano | findstr :8080

# Tuer le processus (Windows)
taskkill /PID [PID_NUMBER] /F

# Ou utiliser un autre port
npm run dev -- --port 3000
```

### Problème : Le POS ne s'affiche pas

**Solution :**
1. Vérifier que l'utilisateur a le rôle "vendeur"
2. Vérifier que `business_type` du vendeur est "physical" ou "hybrid"
3. Exécuter la migration : `20260201000003_fix_notifications_system.sql`

### Problème : Authentification ne fonctionne pas

**Solution :**
1. Vérifier les clés Supabase dans `.env`
2. Vérifier que les tables `profiles`, `user_ids`, `wallets` existent
3. Vérifier que les RLS (Row Level Security) sont configurés correctement

---

## 📞 SUPPORT

Pour toute question ou problème :

1. Vérifier la documentation dans `/docs`
2. Consulter le fichier `TODO.md` pour les bugs connus
3. Contacter le support technique

---

## 🔐 SÉCURITÉ

⚠️ **IMPORTANT** :
- Ne jamais commiter le fichier `.env`
- Ne jamais partager vos clés Supabase
- Utiliser la `SERVICE_ROLE_KEY` uniquement côté backend
- Activer l'authentification 2FA pour les comptes sensibles

---

## 📚 RESSOURCES

- Documentation Supabase : https://supabase.com/docs
- Documentation React : https://react.dev
- Documentation Vite : https://vitejs.dev

---

## 🎉 Félicitations !

Votre installation de Vista Flows est terminée. Vous pouvez maintenant :

1. **Créer votre compte** sur http://localhost:8080/auth
2. **Explorer le marketplace**
3. **Configurer votre boutique** (pour les vendeurs)
4. **Commander des produits** (pour les clients)

Bon développement ! 🚀
