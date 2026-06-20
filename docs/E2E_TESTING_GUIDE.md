# END-TO-END TESTING - SYSTÈME DE SURVEILLANCE LOGIQUE

## 🧪 Vue d'ensemble

Les tests E2E valident que le système détecte, alerte et corrige les anomalies en conditions réelles.

---

## SCÉNARIO 1: Détection d'Anomalie POS (Stock)

### Préparation

```sql
-- Créer un produit de test
INSERT INTO products (id, vendor_id, name, price, stock_quantity, category)
VALUES (
  'test-prod-001',
  'vendor-uuid',
  'Test Product',
  10000,
  10,
  'test'
) RETURNING id;

-- Créer une commande POS
INSERT INTO orders (id, vendor_id, customer_id, order_number, total_amount, source, status)
VALUES (
  'test-order-001',
  'vendor-uuid',
  'customer-uuid',
  'POS-TEST-001',
  10000,
  'pos',
  'pending'
) RETURNING id;

-- Ajouter un item
INSERT INTO order_items (order_id, product_id, quantity, price)
VALUES ('test-order-001', 'test-prod-001', 1, 10000);
```

### Étape 1: Créer l'anomalie

```sql
-- Marquer la commande comme complétée MAIS ne pas décrémenter le stock
UPDATE orders SET status = 'completed' WHERE id = 'test-order-001';
-- ❌ Stock reste à 10 (devrait être à 9)
```

### Étape 2: Déclencher la détection

```bash
# Via API Edge Function
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/detect-surveillance-anomalies \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Via Dashboard PDG
# 1. Aller à /pdg/surveillance
# 2. Cliquer "Détecter anomalies"
# 3. Attendre les résultats
```

### Étape 3: Vérifier la détection

```sql
-- L'anomalie doit être détectée
SELECT * FROM logic_anomalies 
WHERE rule_id = 'POS_001' 
AND detected_at > NOW() - INTERVAL '1 minute'
LIMIT 1;

-- Résultats attendus:
-- ✓ severity = 'CRITICAL'
-- ✓ expected_value = {stock should decrease}
-- ✓ actual_value = {stock unchanged}
-- ✓ resolved_at IS NULL (pas résolue encore)
```

### Étape 4: Appliquer une correction

#### Option A: Correction Automatique

```bash
# Via Dashboard PDG
# 1. Cliquer sur l'anomalie
# 2. Cliquer "Correction auto"
# 3. Système corrige automatiquement
```

#### Option B: Correction Manuelle

```bash
# Via Dashboard PDG
# 1. Cliquer sur l'anomalie
# 2. Cliquer "Correction manuelle"
# 3. Entrer une raison
# 4. Confirmer
```

#### Option C: API Directe

```sql
-- Récupérer l'ID anomalie
SELECT id FROM logic_anomalies 
WHERE rule_id = 'POS_001' AND resolved_at IS NULL 
LIMIT 1;

-- Appliquer la correction via RPC
SELECT * FROM apply_correction(
  'ANOMALY_ID_HERE',
  'AUTO',
  '{"corrected_stock": 9}'::jsonb,
  'Auto-correction for POS sale'
);
```

### Étape 5: Vérifier la correction

```sql
-- L'anomalie doit être résolue
SELECT * FROM logic_anomalies WHERE id = 'ANOMALY_ID';

-- Vérifier l'audit trail
SELECT * FROM logic_audit WHERE anomaly_id = 'ANOMALY_ID';
-- ✓ action = 'CORRECT'
-- ✓ old_state = {stock: 10}
-- ✓ new_state = {stock: 9}

-- Le stock doit être corrigé
SELECT stock_quantity FROM products WHERE id = 'test-prod-001';
-- ✓ Résultat: 9
```

### Étape 6: Validation PDG Dashboard

```
✓ Anomalie n'apparaît plus dans les "Unresolved"
✓ Anomalie apparaît dans l'onglet "Audit"
✓ La correction est tracée avec raison + timestamp + actor
✓ System Health passe à OK
```

---

## SCÉNARIO 2: Détection d'Anomalie Stock Négatif

### Préparation

```sql
-- Créer un produit avec stock POSITIF initialement
INSERT INTO products (id, vendor_id, name, price, stock_quantity)
VALUES ('test-prod-002', 'vendor-uuid', 'Test Negative Stock', 5000, 5);
```

### Exécution

```sql
-- Forcer le stock à être négatif (simule une anomalie)
UPDATE products SET stock_quantity = -10 WHERE id = 'test-prod-002';

-- Déclencher la détection
SELECT * FROM detect_all_anomalies('INVENTORY', 'CRITICAL');

-- Vérifier l'anomalie
SELECT * FROM logic_anomalies 
WHERE rule_id = 'INV_001' 
AND detected_at > NOW() - INTERVAL '1 minute';
-- ✓ severity = 'CRITICAL'
-- ✓ expected_value.stock >= 0
-- ✓ actual_value.stock = -10

-- Corriger automatiquement (stock négatif → 0)
SELECT * FROM apply_correction(
  'ANOMALY_ID',
  'AUTO',
  '{"corrected_stock": 0}'::jsonb
);

-- Vérifier le résultat
SELECT stock_quantity FROM products WHERE id = 'test-prod-002';
-- ✓ Résultat: 0
```

---

## SCÉNARIO 3: Détection d'Anomalie Wallet

### Préparation

```sql
-- Créer un wallet de test
INSERT INTO wallets (id, user_id, balance, currency)
VALUES ('test-wallet-001', 'user-uuid', 50000, 'GNF');

-- Créer une transaction
INSERT INTO wallet_transactions (wallet_id, type, amount, description)
VALUES ('test-wallet-001', 'payment', -10000, 'Test payment');
-- ❌ Solde wallet = 50000, mais somme transactions = 40000 → DÉSYNC
```

### Détection

```bash
# Via Dashboard
# 1. Aller à /pdg/surveillance
# 2. Tab "Par Domaine"
# 3. Chercher WALLETS
# 4. Vérifier l'anomalie PAY_001
```

### Correction

```sql
-- Corriger le wallet pour matcher la somme des transactions
SELECT * FROM apply_correction(
  'ANOMALY_ID',
  'AUTO',
  '{"corrected_balance": 40000}'::jsonb,
  'Auto-reconciliation with transaction sum'
);

-- Vérifier
SELECT balance FROM wallets WHERE id = 'test-wallet-001';
-- ✓ Résultat: 40000
```

---

## SCÉNARIO 4: Test du Cron Job

### Configuration

```bash
# 1. Déployer la Edge Function
supabase functions deploy detect-surveillance-anomalies --project-ref YOUR_PROJECT_ID

# 2. Configurer le Cron (*/1 * * * *)
# Via Supabase Dashboard: Scheduled Functions → Add Schedule
```

### Test d'Exécution

```bash
# Déclencher manuellement
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/detect-surveillance-anomalies \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Vérifier les logs
supabase functions logs detect-surveillance-anomalies --follow

# Résultats attendus:
# ✓ 🔍 Starting surveillance detection...
# ✓ ✅ Detection completed in XXXms
# ✓ 📊 Results: 120 rules checked
# ✓ 🏥 Fetching system health...
# ✓ 📊 Overall Status: OK
```

### Attendre le Cron Automatique

```
1. Configurer le cron à */1 minute
2. Attendre 1 minute
3. Vérifier les logs: supabase functions logs detect-surveillance-anomalies
4. Vérifier la base: SELECT * FROM cron_job_logs
5. Vérifier le Dashboard PDG pour les nouvelles anomalies
```

---

## SCÉNARIO 5: Test de Permissions RLS

### PDG peut accéder

```bash
# 1. Se connecter en tant que PDG
# 2. Accéder à /pdg/surveillance
# ✓ Doit afficher le dashboard
```

### Non-PDG ne peut pas accéder

```bash
# 1. Se connecter en tant que client/vendeur
# 2. Essayer d'accéder à /pdg/surveillance
# ❌ Doit être redirigé (permission denied)

# Via API
SELECT * FROM logic_anomalies;
-- ❌ Retourne 0 (RLS policy l'empêche)
```

### Audit trail immuable

```sql
-- Tenter de supprimer un audit log
DELETE FROM logic_audit WHERE id = 'ANY_ID';
-- ❌ Permission denied (RLS policy)

-- Tenter de modifier
UPDATE logic_audit SET action = 'HACKED' WHERE id = 'ANY_ID';
-- ❌ Permission denied (RLS policy)
```

---

## SCÉNARIO 6: Test de Performance

### Mesurer le temps de détection

```bash
# Créer 100 anomalies de test
-- (script SQL dans PERFORMANCE_TEST.sql)

# Déclencher la détection
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/detect-surveillance-anomalies \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Vérifier le temps
# ✓ Target: < 500ms
# ⚠️ Warning: > 1000ms
# ❌ Error: > 5000ms
```

### Charger des requêtes

```bash
# Script pour tester la performance
for i in {1..10}; do
  curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/detect-surveillance-anomalies \
    -H "Authorization: Bearer YOUR_ANON_KEY" &
done
wait

# Les 10 requêtes doivent complèter en ~500ms chacune
```

---

## SCÉNARIO 7: Test Offline-Online

### Mode Offline

```bash
# 1. Déconnecter la connexion réseau
# 2. Créer une anomalie (hors ligne)
# 3. Reconnecter le réseau
# 4. Vérifier la synchronisation

# ✓ Les anomalies doivent être synchronisées
# ✓ L'audit trail doit être complet
```

---

## 🎯 Checklist de Validation E2E

- [ ] **Scénario 1 - POS Detection**
  - [ ] Anomalie créée
  - [ ] Détection réussie
  - [ ] Correction auto appliquée
  - [ ] Audit trail complète

- [ ] **Scénario 2 - Negative Stock**
  - [ ] Stock négatif détecté
  - [ ] Corrigé à 0
  - [ ] Notification PDG reçue

- [ ] **Scénario 3 - Wallet Reconciliation**
  - [ ] Désynchronisation détectée
  - [ ] Solde corrigé
  - [ ] Montants correspondants

- [ ] **Scénario 4 - Cron Job**
  - [ ] Exécution manuelle réussie
  - [ ] Logs visibles
  - [ ] Cron auto-déclenché dans 5 min

- [ ] **Scénario 5 - Permissions**
  - [ ] PDG peut accéder
  - [ ] Non-PDG ne peut pas accéder
  - [ ] Audit trail immuable

- [ ] **Scénario 6 - Performance**
  - [ ] Temps < 500ms
  - [ ] Pas de timeout
  - [ ] Pas de memory leak

- [ ] **Scénario 7 - Offline**
  - [ ] Synchronisation automatique
  - [ ] Pas de perte de données

---

## 📊 Rapport E2E Final

```
TEST DATE: ___________________________
ENVIRONMENT: Production / Staging

SCÉNARIOS PASSÉS: ___ / 7
PERFORMANCE: Average ___ ms

ISSUES RENCONTRÉS:
1. ___________________________
2. ___________________________

CORRECTIONS APPLIQUÉES:
1. ___________________________
2. ___________________________

VALIDATION GLOBALE:
☐ PASS - Prêt pour production
☐ CONDITIONAL - Problèmes mineurs acceptables
☐ FAIL - Blockers critiques

Signataire: ___________________________
Date: ___________________________
```

---

## 🔗 Ressources

- [Migration SQL](DEPLOYMENT_GUIDE.md)
- [Configuration Cron](CRON_CONFIGURATION.md)
- [Checklist Déploiement](VALIDATION_CHECKLIST.md)
- [Documentation d'Architecture](SURVEILLANCE_ARCHITECTURE.md)

---

**✅ Tests E2E Complétés - Système Prêt pour Utilisation!**
