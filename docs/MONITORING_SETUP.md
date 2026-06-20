# 🛰️ MONITORING 24/7 (SANS GOOGLE)

Ce guide configure une **surveillance continue** sans dépendance Google. Tout est basé sur:
- ✅ Supabase Logs & Metrics
- ✅ Notifications internes (table `notifications`)
- ✅ Webhooks externes (Slack/Discord/Email/SMS) **non-Google**
- ✅ Uptime self-hosted (optionnel) avec **Uptime Kuma**

---

## ✅ Objectifs

- Exécuter **un contrôle complet chaque minute** (toutes les règles)
- Détecter une panne en **< 60s**
- Alerter le PDG immédiatement pour les anomalies critiques
- Garder une trace d’audit immuable

---

## 1) Vérifier le Cron (Chaque Minute)

- **Function**: `detect-surveillance-anomalies`
- **Schedule**: `*/1 * * * *`
- **Timezone**: UTC

Guide complet: [Configuration Cron](CRON_CONFIGURATION.md)

---

## 2) Logs et Métriques Supabase

### Où voir les logs

- Supabase Dashboard → **Edge Functions → Logs**
- Supabase Dashboard → **Database → Logs**

### Ce que vous devez voir

```
⏰ [timestamp] Cron job triggered
✅ Detection completed in XXms
📊 Results: 120 rules checked
```

---

## 3) Alertes internes (Notifications)

Le système écrit les alertes critiques dans la table `notifications`:

```sql
SELECT *
FROM notifications
WHERE type = 'critical_alert'
ORDER BY created_at DESC
LIMIT 20;
```

Utiliser ce flux pour:
- Afficher les alertes dans l’UI PDG
- Déclencher un webhook côté backend

---

## 4) Webhooks d’alerte (sans Google)

### Slack / Discord / Email / SMS

Configurer vos webhooks ici:
- Slack: Incoming Webhooks
- Discord: Webhook URL
- Email: SMTP (ex: Mailgun / Sendgrid / Postmark)
- SMS: Twilio / Vonage

Le hook d’alerte est dans:
- `supabase/functions/detect-surveillance-anomalies/index.ts`

Ajoutez l’appel webhook dans `sendAlert()`.

---

## 5) Uptime Kuma (Self-hosted, recommandé)

Uptime Kuma permet une surveillance 24/7 **sans dépendre de Google**.

### Installation rapide (Docker)

```bash
# Exemple d’installation locale
# docker run -d --restart=always -p 3001:3001 --name uptime-kuma louislam/uptime-kuma:1
```

### Points à monitorer

- **Edge Function**: `https://<project>.supabase.co/functions/v1/detect-surveillance-anomalies`
- **UI PDG**: `/pdg/surveillance`
- **DB Health**: `SELECT 1;`

---

## 6) Check de Santé Système (toutes les minutes)

Le cron exécute:
1. `detect_all_anomalies()`
2. `get_system_health()`

Donc **chaque minute**, l’état global est recalculé.

---

## 7) Workflow PDG (sécurisé)

Avant toute correction:
- Le système **re-vérifie la règle** (`verify_logic_rule`)
- Si l’anomalie est déjà résolue → correction annulée

---

## ✅ Résultat

- 120 règles vérifiées **chaque minute**
- Détection en temps réel
- Alerte immédiate pour anomalies critiques
- Aucun service Google requis

---

**Fichier lié:**
- [Alerting Rules](ALERTING_RULES.md)
- [SLA Tracking](SLA_TRACKING.md)
