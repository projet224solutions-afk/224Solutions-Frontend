# CONFIGURATION DES CRON JOBS - SYSTÈME DE SURVEILLANCE LOGIQUE

## 📋 Vue d'ensemble

Les cron jobs automatisent la détection d'anomalies toutes les **1 minute** via Supabase Edge Functions.

---

## ÉTAPE 1: Créer une Edge Function

### Via Supabase CLI

```bash
# Créer la fonction
supabase functions new detect-surveillance-anomalies

# Structure créée:
# supabase/functions/detect-surveillance-anomalies/
# ├── index.ts
# └── deno.json
```

### Via Supabase Dashboard

1. Aller à: **Supabase Dashboard → Functions**
2. Cliquer: **Create a new function**
3. Nom: `detect-surveillance-anomalies`
4. Copier le code ci-dessous

---

## ÉTAPE 2: Implémenter la fonction

### Code de la fonction

Créer/éditer le fichier `supabase/functions/detect-surveillance-anomalies/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

// Types
interface DetectionResult {
  rule_id: string;
  domain: string;
  status: string;
  anomaly_count: number;
}

interface HealthResult {
  overall_status: string;
  total_rules: number;
  total_anomalies: number;
  critical_anomalies: number;
  recent_anomalies_24h: number;
  resolution_rate: number;
}

// Service de détection
class SurveillanceService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );
  }

  async detectAllAnomalies(): Promise<DetectionResult[]> {
    console.log("🔍 Starting surveillance detection...");
    const startTime = performance.now();

    try {
      // Appeler la RPC function
      const { data, error } = await this.supabase.rpc(
        "detect_all_anomalies"
      );

      if (error) throw error;

      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);

      console.log(`✅ Detection completed in ${duration}ms`);
      console.log(`📊 Results: ${data?.length || 0} rules checked`);

      return data || [];
    } catch (error) {
      console.error("❌ Detection error:", error);
      throw error;
    }
  }

  async getSystemHealth(): Promise<HealthResult> {
    console.log("🏥 Fetching system health...");

    try {
      const { data, error } = await this.supabase.rpc(
        "get_system_health"
      );

      if (error) throw error;

      return data?.[0] || {
        overall_status: "UNKNOWN",
        total_rules: 0,
        total_anomalies: 0,
        critical_anomalies: 0,
        recent_anomalies_24h: 0,
        resolution_rate: 0,
      };
    } catch (error) {
      console.error("❌ Health check error:", error);
      throw error;
    }
  }

  async sendAlert(health: HealthResult): Promise<void> {
    // Si des anomalies CRITICAL, envoyer une alerte
    if (health.critical_anomalies > 0) {
      console.warn(
        `🚨 ALERT: ${health.critical_anomalies} critical anomalies detected!`
      );

      // Vous pouvez ajouter ici:
      // - Notification Slack/Discord
      // - Email au PDG
      // - SMS d'urgence
      // - Webhook externe

      // Exemple: Envoyer une notification via Supabase
      try {
        const { error } = await this.supabase.from("notifications").insert({
          type: "critical_alert",
          title: "🚨 Anomalies Critiques Détectées",
          message: `${health.critical_anomalies} anomalies critiques nécessitent une action immédiate`,
          severity: "critical",
          data: health,
          created_at: new Date().toISOString(),
        });

        if (error) console.warn("Could not create notification:", error);
      } catch (e) {
        console.warn("Notification creation failed:", e);
      }
    }

    // Si WARNING: quelques anomalies
    if (
      health.total_anomalies > 0 &&
      health.critical_anomalies === 0
    ) {
      console.log(
        `⚠️  WARNING: ${health.total_anomalies} anomalies detected`
      );
    }

    // Si OK
    if (health.total_anomalies === 0) {
      console.log("✅ System is healthy - no anomalies");
    }
  }

  logMetrics(health: HealthResult, duration: number): void {
    console.log("\n📊 ═══════════════════════════════════════════");
    console.log("   SURVEILLANCE METRICS");
    console.log("═══════════════════════════════════════════");
    console.log(`   Overall Status: ${health.overall_status}`);
    console.log(`   Total Rules: ${health.total_rules}`);
    console.log(`   Total Anomalies: ${health.total_anomalies}`);
    console.log(`   Critical Anomalies: 🔴 ${health.critical_anomalies}`);
    console.log(`   Recent (24h): ${health.recent_anomalies_24h}`);
    console.log(`   Resolution Rate: ${health.resolution_rate.toFixed(1)}%`);
    console.log(`   Detection Duration: ${duration.toFixed(2)}ms`);
    console.log("═══════════════════════════════════════════\n");
  }
}

// Main handler
serve(async (req: Request) => {
  console.log(`\n⏰ [${new Date().toISOString()}] Cron job triggered`);

  // Vérifier le header d'authentification Cron
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("🚫 Unauthorized cron request");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const service = new SurveillanceService();
    const startTime = performance.now();

    // 1. Détecter les anomalies
    const detectionResults = await service.detectAllAnomalies();

    // 2. Récupérer la santé du système
    const health = await service.getSystemHealth();

    // 3. Envoyer les alertes si nécessaire
    await service.sendAlert(health);

    // 4. Logger les métriques
    const duration = performance.now() - startTime;
    service.logMetrics(health, duration);

    // 5. Retourner le résultat
    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        detectionResults: detectionResults.length,
        health: health,
        duration: `${duration.toFixed(2)}ms`,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("❌ Cron job failed:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
```

---

## ÉTAPE 3: Déployer la fonction

### Via CLI

```bash
# Déployer localement d'abord (test)
supabase functions serve detect-surveillance-anomalies

# En production
supabase functions deploy detect-surveillance-anomalies --project-ref YOUR_PROJECT_ID

# Afficher les logs
supabase functions logs detect-surveillance-anomalies --project-ref YOUR_PROJECT_ID
```

### Via Supabase Dashboard

1. Copier le code dans l'éditeur
2. Cliquer: **Deploy**
3. Vérifier dans les logs

---

## ÉTAPE 4: Configurer le Cron Job

### Créer le horaire (Schedule)

#### Option A: Via Supabase Dashboard (Recommandé)

1. Aller à: **Supabase Dashboard → Edge Functions**
2. Chercher: `detect-surveillance-anomalies`
3. Cliquer: **Add Schedule**

**Configurer le Schedule:**

```
Schedule Name:     detect-surveillance-anomalies-1min
Function:          detect-surveillance-anomalies
Cron Expression:   */1 * * * *
Timezone:          UTC
Enabled:           ✓ Oui
```

**Signification du Cron:**

```
*/1 * * * *
│   │ │ │ │
│   │ │ │ └─ Jour de la semaine (0-6)
│   │ │ └─── Mois (1-12)
│   │ └───── Jour du mois (1-31)
│   └─────── Heure (0-23)
└─────────── Minute (0-59)

*/1 = Toutes les 1 minute
*   = Chaque heure/jour/mois/jour de la semaine
```

#### Option B: Horaires alternatifs

Si vous voulez une fréquence différente:

```
# Chaque minute
*/1 * * * *

# Chaque 2 minutes
*/2 * * * *

# Chaque heure
0 * * * *

# 2x par jour (09:00 et 21:00 UTC)
0 9,21 * * *

# Chaque jour à 00:00
0 0 * * *

# Chaque lundi à 10:00
0 10 * * 1

# Lundi-Vendredi à 08:00 (heures de bureau)
0 8 * * 1-5
```

---

## ÉTAPE 5: Tester le Cron Job

### Test manuel

#### Via Supabase Dashboard

1. Aller à: **Edge Functions → detect-surveillance-anomalies**
2. Cliquer: **Invoke**
3. Vérifier la réponse dans les logs

#### Via CLI

```bash
# Tester la fonction localement
curl http://localhost:54321/functions/v1/detect-surveillance-anomalies \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Vérifier les logs
supabase functions logs detect-surveillance-anomalies
```

#### Via cURL en production

```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/detect-surveillance-anomalies \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Réponse attendue:**

```json
{
  "success": true,
  "timestamp": "2026-02-01T10:15:30Z",
  "detectionResults": 120,
  "health": {
    "overall_status": "OK",
    "total_rules": 120,
    "total_anomalies": 0,
    "critical_anomalies": 0,
    "recent_anomalies_24h": 0,
    "resolution_rate": 100
  },
  "duration": "123.45ms"
}
```

---

## ÉTAPE 6: Vérifier l'exécution

### Afficher les dernières exécutions

```bash
# Voir les logs en temps réel
supabase functions logs detect-surveillance-anomalies --project-ref YOUR_PROJECT_ID --follow

# Afficher l'historique
supabase functions logs detect-surveillance-anomalies --project-ref YOUR_PROJECT_ID --limit 50
```

### Vérifier la table de statut

```sql
-- Voir les exécutions du cron job (si table exists)
SELECT 
  created_at,
  success,
  duration_ms,
  anomalies_detected,
  error_message
FROM cron_job_logs
WHERE function_name = 'detect_surveillance_anomalies'
ORDER BY created_at DESC
LIMIT 10;
```

---

## ÉTAPE 7: Configuration des Alertes

### Slack Integration (Optionnel)

Modifier la fonction pour envoyer des alertes Slack:

```typescript
async sendSlackAlert(health: HealthResult): Promise<void> {
  if (health.critical_anomalies === 0) return;

  const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
  if (!webhookUrl) return;

  const message = {
    text: "🚨 Surveillance Alert",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Surveillance Logique - Anomalies Critiques*\n\n🔴 ${health.critical_anomalies} anomalies critiques\n⚠️ ${health.total_anomalies} anomalies totales\n📊 Santé: ${health.overall_status}`,
        },
      },
    ],
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
}
```

### Email Notifications (Optionnel)

Ajouter l'envoi d'email au PDG:

```typescript
async sendEmailAlert(health: HealthResult): Promise<void> {
  if (health.critical_anomalies === 0) return;

  const { error } = await this.supabase.functions.invoke('send-email', {
    body: {
      to: 'pdg@vista-flows.com',
      subject: `🚨 ${health.critical_anomalies} Anomalies Critiques Détectées`,
      html: `
        <h1>Alerte de Surveillance</h1>
        <p>Anomalies critiques détectées: ${health.critical_anomalies}</p>
        <p><a href="https://vista-flows.com/pdg/surveillance">Voir le dashboard</a></p>
      `
    }
  });
}
```

---

## 📊 Monitoring du Cron Job

### KPIs à surveiller

```
Métriques importantes:
- Temps d'exécution: < 500ms (target)
- Anomalies détectées: Nombre/24h
- Taux de résolution: > 95%
- Succès du cron: 100%
- Alertes critiques: 0 (idéal)
```

### Santé du système

Voir dans le Dashboard PDG:
- **System Health Status** (OK/WARNING/CRITICAL)
- **Anomalies Chart** (24h)
- **Resolution Rate** (%)
- **Cron Job Status** (Active/Paused)

---

## 🚀 Checklist Final

- [ ] Edge Function créée et déployée
- [ ] Cron schedule configuré (*/1 * * * *)
- [ ] Test manuel réussi
- [ ] Logs visibles dans Supabase
- [ ] Alertes configurées (Slack/Email)
- [ ] PDG Dashboard accessible
- [ ] Permissions RLS vérifiées
- [ ] Backup de la configuration effectuée

---

## 📞 Troubleshooting

### Cron job ne s'exécute pas

```bash
# Vérifier le statut
supabase functions list

# Vérifier les logs pour les erreurs
supabase functions logs detect-surveillance-anomalies --follow

# Rédeployer
supabase functions deploy detect-surveillance-anomalies
```

### Erreur: "Function not found"

- Vérifier que la fonction est déployée
- Vérifier le PROJECT_ID
- Vérifier les permissions d'authentification

### Erreur: "RPC function not found"

- Vérifier que la migration SQL est déployée
- Vérifier que `detect_all_anomalies` existe dans la BD
- Exécuter la migration manuellement si nécessaire

### Performance lente (> 500ms)

- Vérifier les indexes de la BD
- Vérifier qu'il n'y a pas trop d'anomalies (> 10000)
- Réduire la fréquence du cron (*/5 au lieu de */1)

---

## 📝 Notes

- Le cron job utilise le `SERVICE_ROLE_KEY` pour contourner les RLS
- Les anomalies sont stockées de manière immuable
- L'historique est conservé pour l'audit
- Les corrections auto sont appliquées si `auto_correctable = true`

---

**✅ Configuration complète du Cron Job - Prêt pour la production!**
