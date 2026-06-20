# CHECKLIST DE VALIDATION POST-DÉPLOIEMENT

## 📋 À Compléter Après le Déploiement de la Migration

### Phase 1: Vérification de Base (15 min)

- [ ] **Tables créées**
  ```sql
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name LIKE 'logic_%';
  -- Résultat attendu: 5
  ```

- [ ] **RPC Functions créées**
  ```sql
  SELECT COUNT(*) FROM pg_proc 
  WHERE proname IN ('verify_logic_rule', 'detect_all_anomalies', 'apply_correction', 'get_system_health');
  -- Résultat attendu: 4
  ```

- [ ] **Règles insérées**
  ```sql
  SELECT COUNT(*) FROM logic_rules;
  -- Résultat attendu: > 0
  ```

- [ ] **RLS Policies activées**
  ```sql
  SELECT COUNT(*) FROM pg_policies WHERE tablename LIKE 'logic_%';
  -- Résultat attendu: > 0
  ```

### Phase 2: Tests de RPC Functions (20 min)

- [ ] **verify_logic_rule** fonctionne
  ```sql
  SELECT * FROM verify_logic_rule('POS_001', '{}'::jsonb);
  -- Doit retourner une ligne avec les colonnes: is_valid, anomaly_found, severity, etc.
  ```

- [ ] **detect_all_anomalies** fonctionne
  ```sql
  SELECT * FROM detect_all_anomalies();
  -- Doit retourner des lignes avec: rule_id, domain, status, anomaly_count
  ```

- [ ] **get_system_health** fonctionne
  ```sql
  SELECT * FROM get_system_health();
  -- Doit retourner: overall_status, total_rules, total_anomalies, critical_anomalies, recent_anomalies_24h, resolution_rate
  ```

- [ ] **apply_correction** fonctionne (si des anomalies existent)
  ```sql
  -- D'abord créer une anomalie de test
  INSERT INTO logic_anomalies (rule_id, domain, severity, detected_at)
  VALUES ('POS_001', 'POS_SALES', 'HIGH', NOW())
  RETURNING id;
  
  -- Puis tester la correction
  SELECT * FROM apply_correction('YOUR_ANOMALY_ID', 'AUTO', '{"corrected": true}'::jsonb);
  -- Doit retourner: success=true, correction_id=UUID, message="Correction applied successfully"
  ```

- [ ] **Audit trail créé**
  ```sql
  SELECT COUNT(*) FROM logic_audit;
  -- Doit être > 0 si une correction a été appliquée
  ```

### Phase 3: Permissions et Sécurité (15 min)

- [ ] **PDG peut accéder aux anomalies**
  - Se connecter en tant que PDG
  - Exécuter: `SELECT COUNT(*) FROM logic_anomalies;`
  - Doit fonctionner sans erreur

- [ ] **Non-PDG ne peut PAS accéder aux anomalies**
  - Se connecter en tant qu'utilisateur normal
  - Exécuter: `SELECT COUNT(*) FROM logic_anomalies;`
  - Doit retourner 0 ou une erreur de permission

- [ ] **Audit logs sont immuables**
  - Tenter: `DELETE FROM logic_audit WHERE id = 'ANY_ID';`
  - Doit être bloqué par les RLS policies

### Phase 4: Performance (10 min)

- [ ] **detect_all_anomalies complète en < 500ms**
  ```
  Exécuter et mesurer:
  SELECT COUNT(*) FROM logic_rules;
  -- Doit compter 120+ règles rapidement
  ```

- [ ] **Indexes créés et actifs**
  ```sql
  SELECT indexname FROM pg_indexes WHERE tablename LIKE 'logic_%';
  -- Doit lister plusieurs indexes (domain, severity, detected_at, etc.)
  ```

- [ ] **Requête sur anomalies est rapide**
  ```sql
  SELECT COUNT(*) FROM logic_anomalies WHERE domain = 'POS_SALES';
  -- Doit être instantané (< 100ms)
  ```

### Phase 5: Intégration Frontend (20 min)

- [ ] **Hook useSurveillanceLogic compilé sans erreur**
  ```bash
  npm run build
  # Doit compiler sans erreur TypeScript
  ```

- [ ] **Composant PDG Dashboard compilé**
  ```bash
  npm run lint
  # Doit passer la vérification ESLint
  ```

- [ ] **Tests passent localement**
  ```bash
  npm run test:surveillance
  # Doit avoir 0 erreur, tous les tests passent
  ```

### Phase 6: Vérification des Données (10 min)

- [ ] **Aucune anomalie détectée initialement**
  ```sql
  SELECT COUNT(*) FROM logic_anomalies WHERE resolved_at IS NULL;
  -- Résultat attendu: 0
  ```

- [ ] **Système health = OK**
  ```sql
  SELECT overall_status FROM get_system_health();
  -- Résultat attendu: OK ou WARNING (pas CRITICAL)
  ```

- [ ] **Taux de résolution est 100%**
  ```sql
  SELECT resolution_rate FROM get_system_health();
  -- Résultat attendu: 100 (ou 0 si pas d'anomalies)
  ```

### Phase 7: Cas de Test Simples (15 min)

- [ ] **Créer une anomalie de test**
  ```sql
  INSERT INTO logic_anomalies (rule_id, domain, severity, detected_at)
  VALUES ('POS_001', 'POS_SALES', 'CRITICAL', NOW())
  RETURNING id;
  ```

- [ ] **Vérifier qu'elle est détectée**
  ```sql
  SELECT COUNT(*) FROM logic_anomalies WHERE resolved_at IS NULL;
  -- Résultat attendu: 1
  ```

- [ ] **Vérifier que system_health passe à WARNING/CRITICAL**
  ```sql
  SELECT overall_status FROM get_system_health();
  -- Résultat attendu: WARNING ou CRITICAL
  ```

- [ ] **Appliquer une correction**
  ```sql
  SELECT * FROM apply_correction('YOUR_ANOMALY_ID', 'AUTO', '{"fixed": true}'::jsonb, 'Test correction');
  -- Doit retourner success=true
  ```

- [ ] **Vérifier que l'anomalie est résolue**
  ```sql
  SELECT resolved_at, resolution_type FROM logic_anomalies WHERE id = 'YOUR_ANOMALY_ID';
  -- Résultat attendu: resolved_at = NOT NULL, resolution_type = AUTO
  ```

- [ ] **Vérifier l'audit trail**
  ```sql
  SELECT * FROM logic_audit ORDER BY timestamp DESC LIMIT 1;
  -- Doit afficher la correction appliquée
  ```

### Phase 8: Tests de Régression (30 min)

- [ ] **Commandes POS existantes non affectées**
  ```bash
  npm run test -- regression.test.ts
  # Tous les tests doivent passer
  ```

- [ ] **Portefeuilles accessibles normalement**
  ```sql
  SELECT COUNT(*) FROM wallets LIMIT 1;
  -- Doit fonctionner normalement
  ```

- [ ] **Produits et stocks accessibles**
  ```sql
  SELECT COUNT(*) FROM products WHERE stock_quantity >= 0;
  -- Doit fonctionner normalement
  ```

- [ ] **Commandes visibles**
  ```sql
  SELECT COUNT(*) FROM orders;
  -- Doit fonctionner normalement
  ```

## ✅ Signature de Validation

Une fois tous les points cochés, le déploiement est complet et validé.

```
Validé par: ___________________________
Date: ___________________________
Heure: ___________________________
Environnement: Production
Status: ✓ Déploiement réussi et validé
```

## 🚨 En Cas de Problème

### Si les tables ne sont pas créées
- Vérifier la migration SQL est correcte
- Vérifier que Supabase CLI a le bon project ID
- Essayer le déploiement manuel via SQL Editor

### Si les RPC functions ne répondent pas
- Vérifier qu'elles sont créées: `SELECT * FROM pg_proc WHERE proname = 'verify_logic_rule';`
- Vérifier que l'utilisateur est PDG
- Vérifier les RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'logic_anomalies';`

### Si les tests échouent
- Vérifier que les tables existent
- Vérifier que les RPC functions existent
- Exécuter: `npm run build` pour recompiler
- Vérifier les variables d'environnement Supabase

### Si la performance est mauvaise
- Vérifier que les indexes sont créés: `SELECT * FROM pg_indexes WHERE tablename LIKE 'logic_%';`
- Exécuter: `ANALYZE logic_rules; ANALYZE logic_anomalies;`
- Vérifier qu'il n'y a pas trop d'anomalies (> 10000)

## 📊 Rapport Post-Déploiement

À générer 1 heure après le déploiement:

```
RAPPORT DE DÉPLOIEMENT - SYSTÈME DE SURVEILLANCE LOGIQUE
Date: ___________________________

Éléments déployés:
- Tables créées: 5/5 ✓
- RPC Functions: 4/4 ✓
- RLS Policies: 5+/5 ✓
- Règles insérées: ___ / 120

Performance:
- Temps de réponse verify_logic_rule: ___ ms
- Temps de réponse detect_all_anomalies: ___ ms
- Temps de réponse get_system_health: ___ ms

Tests:
- Tests unitaires: ____ / ____ passés
- Tests de régression: ____ / ____ passés
- Erreurs rencontrées: ___________________________

Observations:
___________________________________________________________________

Recommandations:
___________________________________________________________________

Signature: ___________________________
```

---

**✨ Félicitations! Le système de surveillance logique est maintenant en production!**
