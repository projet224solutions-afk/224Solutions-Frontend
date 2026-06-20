---
name: Agent Commission System Architecture
description: Architecture du système de commissions agents — tables, flux, bugs corrigés
type: project
---

## Flux de commission (fonctionnel)

`triggerAffiliateCommission(userId, amount, type, txId)` → RPC SQL `credit_agent_commission` → `credit_agent_wallet_gnf(agent_id, amount)`

**Déclenché depuis:**
- `subscriptions.routes.ts` — achat abonnement
- `orders.routes.ts` — achat marketplace (physique + digital)
- `webhooks.routes.ts` — confirmation Stripe (anti-doublon via transaction_id)
- `wallet.v2.routes.ts` — dépôt wallet
- `payments.routes.ts` — paiement via lien

## Bug critique corrigé (2026-05-01)

**Problème 1:** `credit_agent_wallet_gnf` écrivait dans `agent_wallets` uniquement, mais l'interface lit depuis `wallets`. Les commissions étaient invisibles.

**Fix:** Migration `20260501100000_fix_agent_commission_credits_wallets.sql` — la fonction crédite maintenant les deux tables + sync rétroactif des soldes.

**Problème 2:** `create-user-by-agent` edge function créait `agent_created_users` mais pas `user_agent_affiliations`. Or `credit_agent_commission` lit uniquement `user_agent_affiliations` via `get_user_agent()` → aucune commission déclenchée pour les utilisateurs créés par agent.

**Fix:** Edge function corrigée — insert dans `user_agent_affiliations` avec `is_verified=true` immédiatement après création.

## Tables impliquées

- `user_agent_affiliations` — lien user↔agent (LU par credit_agent_commission)
- `agent_created_users` — tracking des créations (stats seulement)
- `agent_commissions_log` — journal avec anti-doublon sur (agent_id, transaction_id)
- `agent_wallets` — balance historique (ÉCRIT par credit_agent_wallet_gnf)
- `wallets` — SOURCE DE VÉRITÉ balance (AUSSI ÉCRIT maintenant par credit_agent_wallet_gnf)

## Why: comment trouver l'agent d'un utilisateur

```sql
SELECT * FROM get_user_agent(p_user_id)
-- Lit depuis user_agent_affiliations WHERE user_id = p_user_id
```

Si l'utilisateur n'est pas dans `user_agent_affiliations`, `has_agent = false` → pas de commission.
