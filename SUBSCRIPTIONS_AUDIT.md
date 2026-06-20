# SUBSCRIPTIONS_AUDIT.md — Audit des abonnements (PHASE 1)

> Vérifications demandées : paiement avant activation / expiration immédiate / limites
> côté serveur / pas de double renouvellement / notifications J-3 J-1.
> Date : 2026-06-15.

---

## 1. État du système (existant)

| Critère | État | Détail |
|---|---|---|
| **Paiement AVANT activation** | ✅ OK | `purchase_service_subscription_atomic` débite le wallet PUIS insère l'abonnement dans la MÊME transaction (ROLLBACK si échec). Idem vendor/driver. |
| **Expiration** | ✅ OK | Job `subscriptions.expire-check` (`backend/src/jobs/jobQueue.ts`) passe vendeur/chauffeur/**service** à `expired` quand `current_period_end < now`. |
| **Limites côté serveur** | ✅ OK | `get_active_service_subscription_limits()` + `get_service_subscription()` (SECURITY DEFINER) ; le front lit, le serveur tranche (`max_products`, `max_bookings_per_month`…). |
| **Pas de double renouvellement** | ✅ OK | Index unique partiel `idx_service_subs_one_active_paid` (migration `20260603130000`) = un seul abonnement payant actif par service. Le RPC expire l'ancien AVANT d'insérer. |
| **Notifications J-3 / J-1** | 🔴 MANQUANT | Aucun rappel avant expiration pour les abonnements **service** (les drivers ont un bandeau `isExpiringSoon`, mais pas de notif push J-3/J-1). |
| **Plans PAR service** | 🔴 MANQUANT | Seuls 4 tiers **génériques** (`service_type_id` NULL) existent. Le prompt définit des prix/limites **spécifiques par métier**. |
| **Commission par plan** | 🔴 MANQUANT | `service_plans` n'a pas de colonne `commission_rate` ; le prompt veut une commission dégressive par plan (ex. resto 15%→5%, e-commerce 10%→3%). |

**Conclusion** : la mécanique de base (paiement atomique, expiration, limites, anti-doublon) est **saine**. Il manque (a) les **plans par service**, (b) la **commission par plan**, (c) les **rappels J-3/J-1**.

---

## 2. Corrections appliquées (PHASE 1)

### 2.1 Migration `20260615100000_service_plans_per_service.sql` (À LANCER)
- `ALTER TABLE service_plans ADD COLUMN commission_rate numeric(5,2)` (commission marketplace selon le plan).
- Index unique `(service_type_id, name)` pour rejouabilité.
- **Seed des plans par service** (prix/limites/commissions du prompt) pour : agriculture, restaurant, beaute, ecommerce, construction, education, location (immobilier), maison, media (photo), freelance, reparation. 4 tiers chacun (free/basic/pro/premium).

### 2.2 Front — `serviceSubscriptionService.getPlans`
Préfère les **plans spécifiques** au service quand ils existent (sinon retombe sur les génériques) → l'écran d'abonnement n'affiche plus 8 plans (typés + génériques) mais les **4 du métier**.

### 2.3 Backend — rappels J-3 / J-1
Nouveau handler de job `subscriptions.expiry-reminders` (`jobQueue.ts`) : chaque jour, repère les abonnements service `active` dont `current_period_end` tombe dans **~3 jours** ou **~1 jour** et crée une **notification** (table `notifications`) idempotente (1 rappel par palier).

---

## 3. Reste (câblage par service, PHASE 3)
- **Application de la commission par plan** dans le flux de paiement marketplace (commande) : lire `commission_rate` du plan actif du vendeur/prestataire au moment du règlement. Fait service par service car chaque flux (resto, e-commerce, BTP…) a sa propre RPC de paiement.
- Tiers digitaux (e-commerce digital : liens 24h, watermark) = au service E-commerce.
