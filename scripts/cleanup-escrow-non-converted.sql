-- 🧹 RESET CIBLÉ (option a) — remettre à 0 les wallets de test faussés par les libérations escrow
-- NON CONVERTIES (Edge Function 'confirm-delivery', supprimée).
--
-- Le bug créditait le wallet vendeur du montant escrow BRUT (GNF) sur un solde d'une autre devise (EUR)
-- → vendeur sur-crédité. Trace : wallet_transactions.transaction_type='payment' + description
-- LIKE 'Libération escrow%'. On NE recalcule PAS le fantôme (il a circulé via retraits/transferts) :
-- on remet simplement à 0 les wallets touchés + le wallet PDG. ⚠️ DONNÉES DE TEST.
--
-- Pour mettre une autre valeur que 0, remplace `balance = 0` ci-dessous.
-- ROLLBACK par défaut : vérifie les soldes (PART B, dernière requête) puis remplace ROLLBACK par COMMIT.

-- ─────────────────────────── PART A : INSPECTION (lecture seule) ───────────────────────────
-- Wallets concernés (vendeurs sur-crédités + PDG) AVANT reset
SELECT w.id, w.user_id, w.currency, w.balance
FROM public.wallets w
WHERE w.user_id IN (
        SELECT DISTINCT receiver_user_id FROM public.wallet_transactions
        WHERE transaction_type = 'payment' AND description LIKE 'Libération escrow%'
      )
   OR w.user_id = (SELECT user_id FROM public.pdg_management WHERE is_active = true LIMIT 1);

-- ─────────────────────── PART B : RESET À 0 (ROLLBACK par défaut) ───────────────────────
BEGIN;
  -- B1. Reset des wallets touchés (vendeurs) + PDG
  UPDATE public.wallets
  SET balance = 0, updated_at = now()
  WHERE user_id IN (
          SELECT DISTINCT receiver_user_id FROM public.wallet_transactions
          WHERE transaction_type = 'payment' AND description LIKE 'Libération escrow%'
        )
     OR user_id = (SELECT user_id FROM public.pdg_management WHERE is_active = true LIMIT 1);

  -- B2. Marquer les libérations fautives dans metadata (traçabilité ; status enum laissé tel quel,
  --     'reversed' n'existe pas dans l'enum transaction_status)
  UPDATE public.wallet_transactions
  SET metadata = COALESCE(metadata, '{}'::jsonb)
                 || '{"reversed":true,"reason":"non_converted_escrow_release_cleanup"}'::jsonb
  WHERE transaction_type = 'payment' AND description LIKE 'Libération escrow%';

  -- B3. Vérification APRÈS reset (doit afficher balance = 0)
  SELECT w.id, w.user_id, w.currency, w.balance
  FROM public.wallets w
  WHERE w.user_id IN (
          SELECT DISTINCT receiver_user_id FROM public.wallet_transactions
          WHERE transaction_type = 'payment' AND description LIKE 'Libération escrow%'
        )
     OR w.user_id = (SELECT user_id FROM public.pdg_management WHERE is_active = true LIMIT 1);

ROLLBACK; -- ⚠️ Vérifie les soldes ci-dessus (= 0), puis remplace par COMMIT pour appliquer.
