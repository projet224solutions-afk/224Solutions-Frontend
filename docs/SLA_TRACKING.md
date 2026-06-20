# 📈 SLA TRACKING (SURVEILLANCE LOGIQUE)

Définition des délais d’intervention et objectifs de performance.

---

## 🎯 SLA Cibles

| Niveau | Détection | Alerte | Correction |
|--------|-----------|--------|------------|
| CRITICAL | ≤ 1 min | ≤ 1 min | ≤ 15 min |
| HIGH | ≤ 1 min | ≤ 5 min | ≤ 1 h |
| MEDIUM | ≤ 1 min | ≤ 1 h | ≤ 24 h |
| LOW | ≤ 1 min | Rapport | ≤ 7 jours |

---

## 📊 KPI Suivis

- Temps moyen de détection (ms)
- Temps moyen d’alerte (s)
- Temps moyen de correction (min)
- Taux de résolution (%)
- Nombre d’anomalies par domaine

---

## ✅ Collecte des données

- `logic_anomalies.detected_at`
- `logic_anomalies.resolved_at`
- `logic_corrections.applied_at`
- `logic_audit.timestamp`

---

## 🔍 Requêtes utiles

### Temps moyen de correction (CRITICAL)

```sql
SELECT
  AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 60) AS avg_minutes
FROM logic_anomalies
WHERE severity = 'CRITICAL'
  AND resolved_at IS NOT NULL;
```

### Taux de résolution global

```sql
SELECT
  COUNT(*) FILTER (WHERE resolved_at IS NOT NULL) * 100.0 / COUNT(*) AS resolution_rate
FROM logic_anomalies;
```

---

## 📌 Gouvernance

- Rapport SLA hebdomadaire au PDG
- Audit mensuel (compliance)
- Revue trimestrielle des seuils

---

**Voir aussi:**
- [Monitoring Setup](MONITORING_SETUP.md)
- [Alerting Rules](ALERTING_RULES.md)
