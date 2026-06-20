# 🐛 CHECKLIST DE DIAGNOSTIC - VISTA FLOWS

## ✅ 1. VÉRIFICATION ENVIRONNEMENT

### Fichier .env existe ?
- [ ] Le fichier `.env` existe à la racine du projet
- [ ] `VITE_SUPABASE_URL` est défini
- [ ] `VITE_SUPABASE_ANON_KEY` est défini
- [ ] Les valeurs ne contiennent pas d'espaces ou de guillemets en trop

**Test rapide :**
```bash
# Windows
type .env

# Linux/Mac
cat .env
```

---

## ✅ 2. VÉRIFICATION SUPABASE

### Tables créées ?
Aller sur Supabase > Table Editor et vérifier que ces tables existent :
- [ ] `profiles`
- [ ] `user_ids`
- [ ] `wallets`
- [ ] `virtual_cards`
- [ ] `vendors`
- [ ] `customers`
- [ ] `orders`
- [ ] `products`

### RLS (Row Level Security) activé ?
- [ ] RLS est activé sur toutes les tables sensibles
- [ ] Les politiques d'accès sont créées

**Test SQL :**
```sql
-- Vérifier les tables existantes
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Vérifier RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

---

## ✅ 3. VÉRIFICATION AUTHENTIFICATION

### Connexion basique fonctionne ?

**Test 1 - Créer un utilisateur :**
1. Aller sur http://localhost:8080/auth
2. Créer un compte avec email + mot de passe
3. Vérifier l'email de confirmation
4. Se connecter

**Test 2 - Session persistante :**
1. Se connecter
2. Rafraîchir la page (F5)
3. Vérifier que l'utilisateur reste connecté

**Test 3 - Console navigateur :**
1. Ouvrir DevTools (F12)
2. Console doit afficher :
   ```
   🔧 [Supabase Client] Configuration: {url: "...", keyPresent: true}
   ```
3. Pas d'erreurs rouges liées à Supabase

---

## ✅ 4. VÉRIFICATION POS

### POS accessible ?

**Prérequis :**
- [ ] Utilisateur connecté avec rôle "vendeur"
- [ ] Vendeur a `business_type = 'physical'` ou `'hybrid'`
- [ ] Pas de subscription active requise (ou subscription valide)

**Test :**
1. Se connecter en tant que vendeur
2. Aller sur `/vendeur/pos`
3. Le POS doit s'afficher (pas de message "verrouillé")

**Debug SQL :**
```sql
-- Vérifier le vendeur
SELECT v.*, p.role, p.email
FROM vendors v
JOIN profiles p ON p.id = v.user_id
WHERE p.email = 'VOTRE_EMAIL_ICI';

-- Vérifier business_type
UPDATE vendors 
SET business_type = 'physical' 
WHERE user_id = 'VOTRE_USER_ID';
```

---

## ✅ 5. VÉRIFICATION BASE DE DONNÉES

### Données de test créées ?

**Créer un vendeur de test :**
```sql
-- 1. Créer un profil vendeur (après avoir créé le compte via Auth)
UPDATE profiles 
SET role = 'vendeur', 
    first_name = 'Test',
    last_name = 'Vendeur'
WHERE email = 'VOTRE_EMAIL';

-- 2. Créer l'entrée vendeur
INSERT INTO vendors (user_id, shop_name, business_type, is_active)
SELECT id, 'Ma Boutique Test', 'physical', true
FROM profiles
WHERE email = 'VOTRE_EMAIL'
ON CONFLICT (user_id) DO UPDATE
SET business_type = 'physical', is_active = true;

-- 3. Créer quelques produits de test
INSERT INTO products (vendor_id, name, price, stock_quantity, category)
SELECT v.id, 'Produit Test 1', 10000, 100, 'Divers'
FROM vendors v
JOIN profiles p ON p.id = v.user_id
WHERE p.email = 'VOTRE_EMAIL';
```

---

## ✅ 6. ERREURS COURANTES

### ❌ "Session not found"
**Cause :** Clés Supabase incorrectes ou connexion réseau
**Solution :**
1. Vérifier `.env`
2. Vérifier connexion internet
3. Tester sur Supabase Dashboard

### ❌ "POS verrouillé"
**Cause :** `business_type` n'est pas configuré
**Solution :**
```sql
UPDATE vendors 
SET business_type = 'physical' 
WHERE user_id = 'VOTRE_USER_ID';
```

### ❌ "Cannot read properties of null"
**Cause :** Données manquantes (wallet, user_id, etc.)
**Solution :**
Exécuter la migration : `20260201000002_auto_promote_latest_user_to_ceo.sql`

### ❌ "Network error"
**Cause :** Backend non démarré ou mauvaise URL
**Solution :**
1. Vérifier que `npm run dev` tourne
2. Vérifier `VITE_API_URL` dans `.env`

---

## ✅ 7. VÉRIFICATION CONSOLE NAVIGATEUR

Ouvrir DevTools (F12) > Console et vérifier :

### ✅ Pas d'erreurs :
- Pas d'erreur 404 sur les assets
- Pas d'erreur CORS
- Pas d'erreur "Failed to fetch"

### ✅ Messages de succès :
```
✅ Session active
✅ Profil chargé
✅ Wallet initialisé
```

---

## ✅ 8. TEST COMPLET

### Scénario de test end-to-end :

1. **Inscription**
   - [ ] Créer un compte
   - [ ] Recevoir email de confirmation
   - [ ] Confirmer l'email

2. **Connexion**
   - [ ] Se connecter avec email/password
   - [ ] Session persiste après rafraîchissement

3. **Dashboard Vendeur**
   - [ ] Accéder à `/vendeur`
   - [ ] Voir les statistiques
   - [ ] Sidebar s'affiche correctement

4. **POS**
   - [ ] Accéder à `/vendeur/pos`
   - [ ] Voir les produits
   - [ ] Ajouter au panier
   - [ ] Calculer le total

5. **Marketplace**
   - [ ] Accéder à `/marketplace`
   - [ ] Voir les produits
   - [ ] Ajouter au panier
   - [ ] Passer une commande

---

## 🔧 OUTILS DE DEBUG

### Console JavaScript :
```javascript
// Vérifier la session Supabase
const { data } = await supabase.auth.getSession();
console.log(data);

// Vérifier le profil
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', 'USER_ID')
  .single();
console.log(profile);
```

### Network Tab :
1. Ouvrir DevTools (F12)
2. Onglet Network
3. Filtrer par "supabase"
4. Vérifier que les requêtes retournent 200

---

## ✅ RÉSUMÉ RAPIDE

**Si tout fonctionne, vous devez avoir :**
1. ✅ `.env` configuré avec les bonnes clés
2. ✅ Serveur local qui tourne sur http://localhost:8080
3. ✅ Connexion Supabase active
4. ✅ Utilisateur peut se connecter
5. ✅ Dashboard accessible selon le rôle
6. ✅ Pas d'erreurs dans la console

**Si un point ne fonctionne pas, consultez la section correspondante ci-dessus.**

---

## 📞 BESOIN D'AIDE ?

Si après tous ces tests, le problème persiste :

1. Noter le message d'erreur exact
2. Noter les étapes pour reproduire le problème
3. Capturer d'écran de la console (F12)
4. Contacter le support technique

---

**Dernière mise à jour :** 31 Janvier 2026
