# ATOMIC_FUNCTIONS_INVENTORY — RPC atomiques existantes

> ⚠️ **Pourquoi ce fichier et PAS `supabase/migrations/atomic_functions.sql`** : les fonctions
> atomiques demandées par la PHASE 4 **existent déjà** (~290 RPC PostgreSQL, certaines corrigées
> au fil de plusieurs migrations). Générer une nouvelle migration qui les **redéfinit** écraserait
> potentiellement les versions corrigées par des versions périmées → **régression argent**.
> On **inventorie** donc l'existant au lieu de régénérer. Pour ajouter une fonction réellement
> manquante, créer une migration **datée et ciblée**, jamais un dump global.

## Mapping PHASE 4 → RPC existant

| Opération demandée | RPC existant(s) | Garanties |
|--------------------|-----------------|-----------|
| **Paiement d'une course** (débit client + crédit chauffeur + commission) | `process_taxi_card_payment`, `calculate_taxi_fare`, `acquire_taxi_lock`/`release_taxi_lock`, `log_taxi_action` | Verrou + tarif serveur + audit |
| **Achat marketplace** (débit + crédit vendeur + stock) | `create_order_core`, `create_marketplace_order_secure`, `create_online_order`, `process_wallet_order_payment`, `decrement_stock_batch`, `adjust_product_stock_atomic` | `FOR UPDATE`, tout-ou-rien, escrow |
| **Activation abonnement** (paiement + activation + log) | `purchase_vendor_subscription_atomic`, `purchase_driver_subscription_atomic`, `purchase_service_subscription_atomic`, `wallet_debit_internal`, `record_subscription_payment` | 1 transaction, ROLLBACK, idempotence |
| **Transfert d'argent entre wallets** | `execute_atomic_wallet_transfer`, `execute_atomic_wallet_transfer_fx`, `process_wallet_transfer_with_fees`, `credit_user_wallet_safe`, `wallet_debit_internal` | Débit+crédit+frais atomiques, idempotence |
| **Remboursement commande annulée** | `cancel_order_and_refund_wallet`, `refund_order_escrow`, `refund_escrow`, `restore_stock_on_order_cancel`, `increment_stock_batch` | Crédit acheteur + restock atomiques |

## Briques transverses (déjà présentes)

- **Idempotence** : middleware `idempotencyGuard` (Node) + `wallet_idempotency_keys` /
  `idempotency_keys` (base) + clé d'idempotence dans les RPC sensibles (`DUPLICATE_PAYMENT`).
- **Verrous** : `acquire_taxi_lock`/`release_taxi_lock` (DB, TTL) ; `SELECT … FOR UPDATE`
  (wallet, stock) ; helper Redis `locks` (SET NX) pour les jobs de fond.
- **Saga / compensation** : remboursements de compensation côté Node remplacés par RPC
  transactionnelles (ex. abonnements : plus de fenêtre débit-sans-activation).
- **Audit immuable** : `prevent_transaction_modification`, `prevent_transaction_deletion`,
  `prevent_audit_modification`, `log_security_event`, `log_taxi_action`, `audit_logs`.
- **Validation serveur** : prix/tarif/commission recalculés serveur (`calculate_taxi_fare`,
  `marketplacePrice.routes`, `get_*_commission_percent`).
- **Surveillance** : `run_global_anomaly_detection` + `*_monitor_report`.

## Vérifier l'existant en base (au lieu de régénérer)

```sql
-- Lister toutes les fonctions atomiques présentes
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname ~ '(atomic|escrow|wallet|order_core|subscription|stock|taxi_lock)'
ORDER BY proname;

-- Vérifier qu'une fonction utilise bien un verrou
SELECT prosrc FROM pg_proc WHERE proname = 'wallet_debit_internal';
```
