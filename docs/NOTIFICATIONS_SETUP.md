# 🔔 Configuration des Notifications Push - Vista-Flows

## Prérequis

1. Un projet Firebase configuré
2. Firebase Cloud Messaging activé
3. Accès à la console Supabase

---

## Étape 1: Configuration Firebase

### 1.1 Créer/Accéder au projet Firebase
- Aller sur [Firebase Console](https://console.firebase.google.com)
- Créer un nouveau projet ou sélectionner un existant

### 1.2 Activer Cloud Messaging
- Dans le projet Firebase, aller à **Project Settings** (⚙️)
- Onglet **Cloud Messaging**
- Activer **Cloud Messaging API (V1)**

### 1.3 Récupérer les clés

#### Depuis Firebase Console > Project Settings > General:
```
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
FIREBASE_PROJECT_ID=votre-projet
FIREBASE_STORAGE_BUCKET=votre-projet.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123
```

#### Depuis Firebase Console > Project Settings > Cloud Messaging:
```
FIREBASE_SERVER_KEY=AAAA...  (Legacy server key - pour envoyer des push)
FIREBASE_VAPID_KEY=BLKx...   (Web Push certificates > Key pair)
```

> ⚠️ **Important**: La VAPID Key doit faire ~87-88 caractères (format base64)

---

## Étape 2: Configuration Supabase Secrets

Dans le Dashboard Supabase > Project Settings > Edge Functions > Secrets:

```bash
# Configuration Firebase
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com  
FIREBASE_PROJECT_ID=votre-projet
FIREBASE_STORAGE_BUCKET=votre-projet.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123

# Clés pour les notifications push
FIREBASE_SERVER_KEY=AAAA...
FIREBASE_VAPID_KEY=BLKx...
```

---

## Étape 3: Déployer les Edge Functions

```bash
# Déployer la fonction de configuration
supabase functions deploy firebase-config --no-verify-jwt

# Déployer la fonction de notifications
supabase functions deploy smart-notifications --no-verify-jwt
```

---

## Étape 4: Appliquer la migration des politiques

```bash
supabase db push
```

Ou exécuter manuellement le fichier:
`supabase/migrations/20260125000001_fix_notifications_policies.sql`

---

## Test des Notifications

### Via le navigateur (Console DevTools):
```javascript
// Vérifier le support
console.log('Support:', 'Notification' in window);
console.log('Permission:', Notification.permission);

// Demander la permission
Notification.requestPermission().then(p => console.log('Result:', p));

// Test notification locale
new Notification('Test', { body: 'Notification de test' });
```

### Via l'application:
1. Aller dans les paramètres utilisateur
2. Activer les notifications
3. Cliquer sur "Tester les notifications"

---

## Debugging

### Logs Firebase Config:
```bash
supabase functions logs firebase-config --tail
```

### Logs Smart Notifications:
```bash
supabase functions logs smart-notifications --tail
```

### Vérifier les tokens FCM en base:
```sql
SELECT user_id, 
       LEFT(fcm_token, 20) || '...' as token_preview,
       is_active,
       updated_at
FROM user_fcm_tokens
ORDER BY updated_at DESC
LIMIT 10;
```

### Vérifier les notifications créées:
```sql
SELECT id, user_id, type, title, read, created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 20;
```

---

## Erreurs Communes

| Erreur | Cause | Solution |
|--------|-------|----------|
| "Config Firebase non disponible" | Secrets non configurés | Ajouter les secrets dans Supabase |
| "VAPID key non disponible" | FIREBASE_VAPID_KEY manquant | Générer depuis Firebase Console |
| "Permission denied" | L'utilisateur a bloqué | Débloquer dans paramètres navigateur |
| "No token FCM" | Utilisateur non enregistré | Activer notifications dans l'app |
| "Service Worker error" | SW non enregistré | Vérifier HTTPS + /service-worker.js |

---

## Architecture des Notifications

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  Edge Function   │────▶│  Firebase FCM   │
│  (React App)    │     │ smart-notif.     │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        │                        ▼                        │
        │               ┌──────────────────┐              │
        │               │   PostgreSQL     │              │
        │               │  notifications   │              │
        │               │  user_fcm_tokens │              │
        │               └──────────────────┘              │
        │                                                 │
        ▼                                                 ▼
┌─────────────────┐                              ┌─────────────────┐
│ Service Worker  │◀─────────────────────────────│ Push Message    │
│ (Background)    │                              │                 │
└─────────────────┘                              └─────────────────┘
```
