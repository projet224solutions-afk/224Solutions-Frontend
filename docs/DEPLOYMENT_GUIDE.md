# GUIDE DE DÉPLOIEMENT - SYSTÈME DE SURVEILLANCE LOGIQUE

## 📋 Checklist Pré-Déploiement

### Phase 1: Préparation (30 minutes)

- [ ] **Sauvegarde de la base de données**
  ```bash
  # Créer une sauvegarde Supabase
  supabase db push --dry-run
  ```

- [ ] **Vérifier les dépendances**
  ```bash
  npm install
  npm install --save-dev vitest @vitest/ui jsdom
  ```

- [ ] **Vérifier les variables d'environnement**
  ```
  VITE_SUPABASE_URL=https://[project].supabase.co
  VITE_SUPABASE_ANON_KEY=[key]
  SUPABASE_DB_PASSWORD=[password]
  ```

- [ ] **Exécuter les tests locaux**
  ```bash
  npm test
  # ✓ Tous les tests doivent passer
  ```

### Phase 2: Déploiement de la Base de Données (45 minutes)

#### Étape 1: Vérifier la migration

```bash
# Afficher la migration prête à être déployée
cat supabase/migrations/20260201000000_surveillance_logique_system.sql | head -50
```

**Éléments à vérifier:**
- ✓ 5 tables créées: logic_rules, logic_results, logic_anomalies, logic_corrections, logic_audit
- ✓ 4 RPC functions: verify_logic_rule, detect_all_anomalies, apply_correction, get_system_health
- ✓ RLS policies configurées pour PDG-only access

#### Étape 2: Déployer la migration

```bash
# Option 1: Avec Supabase CLI (recommandé)
supabase migration up

# Option 2: Exécution manuelle
# Copier le contenu de la migration dans le Supabase SQL Editor
# et exécuter
```

#### Étape 3: Vérifier le déploiement

```bash
# Vérifier que les tables existent
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'logic_%';

# Résultat attendu:
# - logic_rules
# - logic_results
# - logic_anomalies
# - logic_corrections
# - logic_audit

# Vérifier que les RPC functions existent
SELECT proname FROM pg_proc 
WHERE proname LIKE 'verify_logic_rule' 
OR proname LIKE 'detect_all_anomalies' 
OR proname LIKE 'apply_correction' 
OR proname LIKE 'get_system_health';

# Vérifier les RLS policies
SELECT * FROM pg_policies 
WHERE tablename LIKE 'logic_%';
```

### Phase 3: Vérification des RPC Functions (30 minutes)

#### Test 1: Vérifier verify_logic_rule()

```sql
-- Tester la fonction de vérification
SELECT * FROM verify_logic_rule('POS_001', '{"order_id":"test"}'::jsonb);

-- Résultat attendu:
-- is_valid | anomaly_found | severity | message
-- f        | t             | CRITICAL | Stock should decrease on sale
```

#### Test 2: Vérifier detect_all_anomalies()

```sql
-- Lancer la détection complète
SELECT * FROM detect_all_anomalies();

-- Résultat attendu:
-- rule_id | domain    | status | anomaly_count
-- POS_001 | POS_SALES | OK     | 0
```

#### Test 3: Vérifier get_system_health()

```sql
-- Récupérer la santé du système
SELECT * FROM get_system_health();

-- Résultat attendu:
-- overall_status | total_rules | total_anomalies | critical_anomalies
-- OK             | 120         | 0               | 0
```

### Phase 4: Déploiement Frontend (30 minutes)

#### Étape 1: Copier les fichiers

```bash
# Les fichiers suivants doivent être en place:
✓ src/hooks/useSurveillanceLogic.ts
✓ src/components/pdg/SurveillanceLogiqueDashboard.tsx
✓ src/tests/surveillance-logic.test.ts
✓ src/tests/regression.test.ts
✓ docs/SURVEILLANCE_LOGIQUE_CATALOG.json
✓ docs/SURVEILLANCE_ARCHITECTURE.md
```

#### Étape 2: Intégrer le Dashboard PDG

```typescript
// Dans les routes PDG (ex: pages/pdg/index.tsx)
import SurveillanceLogiqueDashboard from '@/components/pdg/SurveillanceLogiqueDashboard';

export function PdgPage() {
  return (
    <div>
      <h1>PDG Dashboard</h1>
      <SurveillanceLogiqueDashboard />
      {/* autres sections du dashboard */}
    </div>
  );
}
```

#### Étape 3: Vérifier les permissions

```typescript
// Dans ProtectedRoute ou équivalent
if (user?.role !== 'pdg') {
  return <AccessDenied />;
}
```

#### Étape 4: Build et test

```bash
# Build de production
npm run build

# Vérifier qu'il n'y a pas d'erreurs TypeScript
npm run lint

# Tests finals
npm test
```

### Phase 5: Configuration des Cron Jobs (30 minutes)

#### Étape 1: Créer une Edge Function

```bash
# Créer la fonction d'exécution automatique
supabase functions new detect-logic-anomalies
```

#### Étape 2: Implémenter la logique

```typescript
// supabase/functions/detect-logic-anomalies/index.ts
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Exécuter la détection d'anomalies
  const { data, error } = await supabase.rpc("detect_all_anomalies");

  if (error) {
    console.error("Erreur détection:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }

  console.log("Anomalies détectées:", data);
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
  });
});
```

#### Étape 3: Déployer la fonction

```bash
supabase functions deploy detect-logic-anomalies
```

#### Étape 4: Configurer le Cron (dans Supabase)

- Aller dans: Supabase Dashboard → Functions → Scheduled Functions
- Créer un nouveau job:
  - **Function**: detect-logic-anomalies
  - **Schedule**: `*/1 * * * *` (toutes les 1 minute)
  - **Status**: Activé

### Phase 6: Tests de Déploiement (45 minutes)

#### Test 1: Vérifier la chaîne complète

```bash
# Simuler une anomalie
# 1. Créer une commande POS
# 2. Ne pas décrementer le stock manuellement
# 3. Exécuter detect_all_anomalies()
# 4. ✓ Vérifier que l'anomalie est détectée dans logic_anomalies

# SQL
INSERT INTO orders (id, vendor_id, customer_id, status, ...) VALUES (...);
-- Attendre 1 minute ou déclencher manuellement
SELECT * FROM logic_anomalies WHERE rule_id = 'POS_001';
```

#### Test 2: Vérifier le Dashboard PDG

```bash
# 1. Se connecter en tant que PDG
# 2. Naviguer vers /pdg/surveillance
# 3. Vérifier:
#    ✓ Affichage du statut de santé du système
#    ✓ Affichage des anomalies détectées
#    ✓ Possibilité de corriger les anomalies
#    ✓ Export des données fonctionne
#    ✓ Real-time updates si nouvelle anomalie détectée
```

#### Test 3: Vérifier la correction automatique

```bash
# 1. Laisser le système détecter une anomalie
# 2. Vérifier que auto_correctable = true pour POS_001
# 3. Cliquer sur "Correction auto" dans le Dashboard
# 4. ✓ Vérifier que la correction est appliquée
# 5. ✓ Vérifier que l'audit log est créé
```

#### Test 4: Tests de régression

```bash
# Exécuter les tests de régression
npm run test -- regression.test.ts

# ✓ Tous les tests doivent passer
# ✓ Aucune régression détectée
```

### Phase 7: Monitoring Post-Déploiement (Continu)

#### Tableau de bord de monitoring

```
Métriques à surveiller:
- Nombre total d'anomalies: < 10 (normal)
- Taux de résolution: > 95% (accepté)
- Temps de détection: < 500ms (OK)
- Cron job success rate: 100%
```

#### Alertes configurées

```
CRITICAL (Page-on-call):
- > 50 anomalies en 1 heure
- Cron job échec 2x consécutives
- RLS policy violation attempt

HIGH:
- > 10 anomalies CRITICAL détectées
- Taux de résolution < 50%
- Temps de détection > 1000ms

MEDIUM:
- > 5 anomalies détectées
- Correction manuelle requise
```

## 🚨 Plan de Rollback

### Si une erreur est détectée

#### Étape 1: Arrêter le cron job

```bash
# Désactiver le cron job dans Supabase Dashboard
# Functions → Scheduled Functions → detect-logic-anomalies → Disable
```

#### Étape 2: Reverter la migration

```bash
# Revenir à la version précédente
supabase migration down

# Ou manuellement: supprimer les tables
DROP TABLE IF EXISTS logic_audit CASCADE;
DROP TABLE IF EXISTS logic_corrections CASCADE;
DROP TABLE IF EXISTS logic_anomalies CASCADE;
DROP TABLE IF EXISTS logic_results CASCADE;
DROP TABLE IF EXISTS logic_rules CASCADE;
```

#### Étape 3: Redéployer la version précédente

```bash
# Recompiler et redéployer le frontend
npm run build
npm run deploy
```

## 📊 Rapport Post-Déploiement

### Après 24 heures, générer un rapport incluant:

```
- Nombre total d'anomalies détectées: __
- Nombre d'anomalies résolues: __
- Nombre de corrections auto: __
- Nombre de corrections manuelles: __
- Anomalies non résolues: __
- Temps moyen de détection: __ms
- Taux de succès des cron jobs: ___%
- Erreurs ou problèmes rencontrés: __
- Recommandations: __
```

### Signature de l'administrateur

```
Validé par: ________________
Date: ________________
Environnement: Production
Status: ✓ Déploiement réussi
```

## 📞 Support

En cas de problème, contacter:
- **Support Technique**: support@vista-flows.com
- **PDG Dashboard Issues**: pdg-support@vista-flows.com
- **Documentation**: docs.vista-flows.com/surveillance

---

**Version**: 1.0  
**Date**: 2026-02-01  
**Statut**: Production-Ready
