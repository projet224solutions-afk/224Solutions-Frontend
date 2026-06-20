# 🏗️ ARCHITECTURE - SYSTÈME DE SURVEILLANCE LOGIQUE GLOBAL

**Date**: Février 1, 2026  
**Portée**: 100% des fonctionnalités du système  
**Objectif**: Zéro incohérence logique non détectée

---

## 📐 ARCHITECTURE GÉNÉRALE

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COUCHE 1: BASE DE DONNÉES (PostgreSQL + Supabase)     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  logic_rules              │  logic_results            │  logic_anomalies │
│  ─────────────────────    │  ───────────────────     │  ──────────────── │
│  • id (PK)                 │  • id (PK)               │  • id (PK)        │
│  • rule_id (FK)            │  • rule_id (FK)          │  • rule_id (FK)   │
│  • domain                  │  • execution_date        │  • domain         │
│  • name                    │  • status (passed/failed) │  • severity       │
│  • expected_logic (JSON)   │  • expected_result (JSON)│  • expected_value │
│  • severity                │  • actual_result (JSON)  │  • actual_value   │
│  • auto_correctable        │  • duration_ms           │  • difference     │
│  • parameters (JSON)       │  • error_message         │  • detected_at    │
│  • created_at              │  • created_at            │  • acknowledged   │
│                            │                         │  • resolved_at    │
│                            │                         │  • created_at     │
│                                                                          │
│  logic_corrections        │  logic_audit                                 │
│  ──────────────────       │  ────────────                                │
│  • id (PK)                 │  • id (PK)                                   │
│  • anomaly_id (FK)         │  • correction_id (FK)                        │
│  • rule_id (FK)            │  • action (grant/revoke/update)              │
│  • correction_type         │  • pdg_id (actor)                            │
│  • old_value (JSON)        │  • old_state (JSON)                          │
│  • new_value (JSON)        │  • new_state (JSON)                          │
│  • status (pending/applied)│  • reason                                    │
│  • pdg_id (who)            │  • timestamp                                 │
│  • reason                  │  • ip_address                                │
│  • applied_at              │  • is_immutable = true                       │
│  • created_at              │  • deleted_at = NULL (soft delete forbidden) │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│             COUCHE 2: FONCTIONS RPC (PostgreSQL + Security Definer)     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  verify_logic_rule(rule_id, params)                                      │
│  ────────────────────────────────────                                    │
│  → Vérifie une règle métier                                              │
│  → Retourne: {is_valid, anomaly, severity, can_auto_correct}             │
│  → SECURITY DEFINER: PDG/Admin only                                      │
│                                                                          │
│  detect_all_anomalies(domain_filter?, severity_filter?)                  │
│  ─────────────────────────────────────────────────────────               │
│  → Exécute TOUTES les règles du domaine                                  │
│  → Retourne: [{rule_id, status, anomalies[]}]                            │
│  → Peut être appelée scheduled (cron) toutes les 5 min                   │
│                                                                          │
│  create_logic_alert(anomaly_id, alert_level)                             │
│  ────────────────────────────────────────                                │
│  → Crée alerte PDG                                                       │
│  → Broadcast via Supabase Realtime                                       │
│  → Envoie notification toast                                             │
│                                                                          │
│  apply_correction(anomaly_id, correction_type, new_value)                │
│  ──────────────────────────────────────────────────────                  │
│  → Applique correction (auto ou manuelle)                                │
│  → Logs atomique dans logic_corrections + logic_audit                    │
│  → Retourne: {success, transaction_id, error}                            │
│                                                                          │
│  get_system_health()                                                     │
│  ──────────────────                                                      │
│  → Vue globale du système                                                │
│  → Retourne: {overall_status, domains[], anomaly_count}                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│           COUCHE 3: BACKEND (Edge Functions + Services)                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Cron Job: /functions/surveillance-logic-detector (toutes les 5 min)    │
│  ───────────────────────────────────────────────────────────            │
│  → Appelle detect_all_anomalies() pour chaque domaine                    │
│  → Crée alertes si anomalies trouvées                                    │
│  → Logs durée execution (< 30 sec timeout)                               │
│                                                                          │
│  Edge Function: /functions/apply-logic-correction                       │
│  ──────────────────────────────────────────────                         │
│  → Reçoit correction request du PDG                                      │
│  → Valide before/after                                                   │
│  → Appelle apply_correction()                                            │
│  → Retourne résultat + audit trail                                       │
│                                                                          │
│  Service: SurveillanceLogicService.ts                                    │
│  ────────────────────────────────────                                    │
│  • detectAnomalies(domain): Promise<Anomaly[]>                           │
│  • applyCorrection(anomalyId, type, value): Promise<Result>             │
│  • getSystemHealth(): Promise<Health>                                    │
│  • getAnomalyHistory(days): Promise<Anomaly[]>                           │
│  • exportAnalysis(): Promise<JSON>                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│        COUCHE 4: FRONTEND (React + Realtime Subscriptions)              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  <SurveillanceLogiqueDashboard /> (Page PDG)                             │
│  ──────────────────────────────────────                                  │
│  • Real-time alerts (Supabase channels)                                  │
│  • System health overview                                                │
│  • Anomalies by domain (tabs)                                            │
│  • Correction interface                                                  │
│  • Audit trail                                                           │
│                                                                          │
│  useSurveillanceLogic() Hook                                             │
│  ────────────────────────                                                │
│  • detectAnomalies()                                                     │
│  • applyCorrection()                                                     │
│  • subscribeToAlerts()                                                   │
│  • getSystemHealth()                                                     │
│  • exportAnalysis()                                                      │
│                                                                          │
│  Real-time Channels:                                                     │
│  • logic_alerts:{pdgId}                                                  │
│  • logic_anomalies:pos                                                   │
│  • logic_anomalies:payments                                              │
│  • logic_anomalies:inventory                                             │
│  ... (1 channel par domaine)                                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 FLUX DE DÉTECTION D'ANOMALIE

```
1. ⏰ Trigger: Toutes les 1 minute (cron job)
   └─→ Appel: detect_all_anomalies()

2. 🔍 Détection: Pour chaque domaine, pour chaque règle
   └─→ Collecte données réelles
   └─→ Calcule résultat attendu
   └─→ Compare vs résultat réel
   └─→ Si mismatch → Anomalie détectée

3. 🚨 Création alerte
   └─→ INSERT dans logic_anomalies
   └─→ INSERT dans logic_audit (trace)
   └─→ Broadcast Supabase Realtime
   └─→ Toast notification (PDG)

4. 👀 PDG voit anomalie
   └─→ Dashboard actualise
   └─→ Détails: attendu vs réel
   └─→ Boutons: Auto-corriger | Corriger manuellement

5. ✅ Correction appliquée
   └─→ INSERT dans logic_corrections
   └─→ UPDATE données affectées
   └─→ Logs atomique (immuable)
   └─→ Alerte : resolved_at = NOW()

6. 📊 Statistiques
   └─→ PDG voit % anomalies resolues
   └─→ Tendance (30 jours)
   └─→ Impact par domaine
```

---

## 🎯 EXEMPLE: RÈGLE POS_001 (Stock Decrement)

### Configuration

```sql
INSERT INTO logic_rules (
  rule_id, domain, name, severity, auto_correctable
) VALUES (
  'POS_001',
  'POS_SALES',
  'Stock must decrease on sale',
  'CRITICAL',
  true
);
```

### Exécution

```postgresql
FUNCTION verify_pos_001() RETURNS TABLE(...) AS $$
BEGIN
  -- Récupérer les commandes POS complétées (dernière heure)
  SELECT 
    o.id as order_id,
    oi.product_id,
    oi.quantity as expected_stock_decrease,
    p.stock_quantity as current_stock,
    -- Voir si le stock a diminué
    CASE 
      WHEN p.stock_quantity < (SELECT stock_quantity 
                               FROM products_snapshot 
                               WHERE id = oi.product_id 
                               AND created_at = o.created_at)
      THEN 'VALID'
      ELSE 'ANOMALY'
    END as result
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
  WHERE o.source = 'pos'
  AND o.status IN ('completed', 'confirmed', 'processing')
  AND o.created_at > NOW() - INTERVAL '5 minutes'
  AND result = 'ANOMALY';
END;
$$
```

### Détection

PDG voit dans dashboard:
```
❌ POS_001 - Stock must decrease on sale
   Domain: POS_SALES
   Severity: CRITICAL
   
   Order: #ORD-2026-0001
   Product: MacBook Pro
   Expected: stock -= 1 (was 10, should be 9)
   Actual: stock = 10 (NOT decreased!)
   
   ✅ Auto-correct  |  ⚙️ Manual
```

### Correction Auto

```postgresql
UPDATE products 
SET stock_quantity = stock_quantity - 1
WHERE id = (SELECT product_id FROM order_items WHERE order_id = #ORD-2026-0001);

INSERT INTO logic_corrections (...) VALUES (...);
INSERT INTO logic_audit (...) VALUES (...);
```

---

## 🗂️ TABLES DÉTAILLÉES

### logic_rules

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| rule_id | TEXT UNIQUE | "POS_001", "PAY_002", etc. |
| domain | ENUM | POS_SALES, PAYMENTS, INVENTORY, etc. |
| name | TEXT | Règle en langage clair |
| description | TEXT | Détails de la logique |
| expected_logic | JSONB | {action, conditions, expected_result} |
| detection_method | TEXT | Fonction ou query à exécuter |
| severity | ENUM | CRITICAL, HIGH, MEDIUM |
| auto_correctable | BOOLEAN | Peut être auto-corrected? |
| parameters | JSONB | Params dynamiques {threshold, tolerance} |
| enabled | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | |

### logic_results

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| rule_id | TEXT FK | Ref logic_rules |
| execution_date | TIMESTAMPTZ | Quand exécutée |
| status | ENUM | PASSED, FAILED, ERROR |
| expected_result | JSONB | Résultat attendu |
| actual_result | JSONB | Résultat réel |
| duration_ms | INTEGER | Temps execution |
| error_message | TEXT | Si error |
| created_at | TIMESTAMPTZ | |

### logic_anomalies

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| rule_id | TEXT FK | Ref logic_rules |
| domain | ENUM | POS_SALES, etc. |
| severity | ENUM | CRITICAL, HIGH, MEDIUM |
| expected_value | JSONB | Valeur attendue |
| actual_value | JSONB | Valeur observée |
| difference | JSONB | Écart |
| affected_entities | JSONB[] | [{type: 'order', id: '...'}, ...] |
| detected_at | TIMESTAMPTZ | Quand détectée |
| acknowledged_by | UUID FK | PDG qui a vu |
| acknowledged_at | TIMESTAMPTZ | |
| resolved_at | TIMESTAMPTZ | Si corrigée |
| resolution_type | ENUM | AUTO, MANUAL, IGNORED |
| created_at | TIMESTAMPTZ | |

### logic_corrections

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| anomaly_id | UUID FK | Ref logic_anomalies |
| rule_id | TEXT | Quelle règle |
| correction_type | ENUM | AUTO, MANUAL_APPROVED |
| old_state | JSONB | État avant correction |
| new_state | JSONB | État après correction |
| pdg_id | UUID | Qui a approuvé (si manual) |
| reason | TEXT | Raison de la correction (manual) |
| status | ENUM | PENDING, APPLIED, REVERTED |
| applied_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### logic_audit

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| correction_id | UUID FK | Ref logic_corrections |
| action | ENUM | DETECT, ALERT, CORRECT, VERIFY, EXPORT |
| actor_id | UUID | Qui a fait l'action (system ou PDG) |
| old_state | JSONB | Avant |
| new_state | JSONB | Après |
| reason | TEXT | Pourquoi |
| timestamp | TIMESTAMPTZ | Quand |
| ip_address | INET | D'où |
| is_immutable | BOOLEAN | = true (jamais supprimable) |
| deleted_at | TIMESTAMPTZ | = NULL (jamais modifiable) |

---

## 🔐 RLS POLICIES

```sql
-- logic_rules: Visible à PDG/Admin
ALTER TABLE logic_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PDG can view rules"
ON logic_rules FOR SELECT
USING (auth.jwt()->>'role' IN ('admin', 'pdg'));

-- logic_anomalies: Visible à PDG uniquement
ALTER TABLE logic_anomalies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PDG can view anomalies"
ON logic_anomalies FOR SELECT
USING (auth.jwt()->>'role' = 'pdg');

-- logic_audit: Immutable, audit trail
ALTER TABLE logic_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audit is immutable"
ON logic_audit
FOR ALL
USING (false) -- Personne ne peut modifier
WITH CHECK (false);

-- INSERT only from security_definer functions
```

---

## ⏱️ CRON JOBS REQUIS

| Cron | Fonction | Fréquence | Timeout |
|------|----------|-----------|---------|
| `*/1 * * * *` | detect_all_anomalies() | 1 min | 30s |
| `0 */1 * * *` | cleanup_old_results() | Hourly | 10s |
| `0 0 * * *` | generate_daily_report() | Daily | 60s |
| `0 0 * * 0` | generate_weekly_report() | Weekly | 120s |

---

## 📊 KPI POUR PDG

```
Dashboard affiche:
• Total anomalies (today/week/month)
• Anomalies by severity (CRITICAL/HIGH/MEDIUM pie chart)
• Anomalies by domain (bar chart)
• Resolution rate (% corrigées / % détectées)
• Average detection time (minutes)
• Average correction time (minutes)
• System health score (0-100%)
• Top 5 problematic rules
• Audit log (30 derniers jours)
```

---

## 🚀 DÉPLOIEMENT PHASES

### Phase 1: Infrastructure (Jour 1)
- Créer tables migration
- Déployer RPC functions
- Configurer RLS policies

### Phase 2: Detection (Jour 2)
- Implémenter service backend
- Configurer cron jobs
- Tester sur 1 domaine (POS)

### Phase 3: Frontend (Jour 3)
- Implémenter Dashboard PDG
- Realtime subscriptions
- Correction interface

### Phase 4: Testing (Jour 4)
- Tests automation (120 règles)
- End-to-end validation
- Performance tuning

### Phase 5: Production (Jour 5)
- Déploiement en production
- Formation PDG
- Monitoring 24/7
