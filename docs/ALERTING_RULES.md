# 🚨 ALERTING RULES (SANS GOOGLE)

Ce document définit les règles d’alerte pour le système de surveillance.

---

## 🎯 Objectifs

- Alerter le PDG **en moins de 1 minute**
- Prioriser les anomalies critiques
- Éviter les faux positifs

---

## 🔴 CRITICAL

**Déclenchement immédiat** si:
- `critical_anomalies > 0`
- OU `overall_status = 'CRITICAL'`

**Canaux:**
- Notification UI PDG
- Slack/Discord webhook
- Email
- SMS (si configuré)

**Exemples:**
- Stock négatif
- Wallet désynchronisé
- Paiement confirmé sans transaction

---

## 🟠 HIGH

**Déclenchement** si:
- `total_anomalies > 0` ET `critical_anomalies = 0`
- Anomalies non résolues > 10 minutes

**Canaux:**
- Notification UI PDG
- Email

---

## 🟡 MEDIUM

**Déclenchement** si:
- Anomalies non résolues > 24h

**Canaux:**
- Notification UI PDG
- Rapport quotidien

---

## 🟢 LOW

**Déclenchement** si:
- Statistiques anormales (non critiques)

**Canaux:**
- Rapport hebdo

---

## 🔁 Suppression des doublons

- Une alerte identique n’est envoyée qu’une fois par intervalle de 10 minutes
- Utiliser un cache en mémoire / table `alert_dedup`

---

## ✅ Intégration

Les alertes sont générées dans:
- `supabase/functions/detect-surveillance-anomalies/index.ts`

Ajoutez vos webhooks dans `sendAlert()`.

---

**Voir aussi:**
- [Monitoring Setup](MONITORING_SETUP.md)
- [SLA Tracking](SLA_TRACKING.md)
