-- 🩺 SANTÉ ESCROW — à lancer quand tu veux pour détecter toute anomalie (lecture seule).
-- Tout doit renvoyer 0 ligne (ou des compteurs cohérents). Si une requête remonte des lignes → à investiguer.

-- 1. Escrows 'released' SANS ligne d'historique de libération (libération sans trace = anomalie)
SELECT e.id, e.order_id, e.amount, e.currency, e.released_at
FROM public.escrow_transactions e
WHERE e.status = 'released'
  AND NOT EXISTS (
    SELECT 1 FROM public.wallet_transactions wt
    WHERE wt.transaction_type = 'escrow_release'
      AND (wt.reference_id = e.id OR wt.metadata->>'escrow_id' = e.id::text))
  AND e.released_at > now() - interval '30 days'
LIMIT 50;

-- 2. Transactions où net_amount <> amount - fee (la contrainte devrait l'empêcher ; double-contrôle)
SELECT transaction_id, transaction_type, amount, fee, net_amount, currency, created_at
FROM public.wallet_transactions
WHERE COALESCE(net_amount,0) <> COALESCE(amount,0) - COALESCE(fee,0)
ORDER BY created_at DESC LIMIT 50;

-- 3. Libérations escrow où la devise de la ligne ≠ devise de l'escrow (incohérence de devise)
SELECT wt.transaction_id, wt.currency AS tx_cur, e.currency AS escrow_cur, wt.amount, wt.created_at
FROM public.wallet_transactions wt
JOIN public.escrow_transactions e ON e.id::text = wt.metadata->>'escrow_id'
WHERE wt.transaction_type = 'escrow_release'
  AND wt.currency <> COALESCE(e.currency, 'GNF')
ORDER BY wt.created_at DESC LIMIT 50;

-- 4. Escrows 'held' échus depuis > 14 jours (devraient être auto-libérés — cron en panne ?)
SELECT e.id, e.order_id, e.amount, e.currency, e.auto_release_at, o.status AS order_status
FROM public.escrow_transactions e
JOIN public.orders o ON o.id = e.order_id
WHERE e.status = 'held'
  AND e.auto_release_at IS NOT NULL
  AND e.auto_release_at < now() - interval '14 days'
ORDER BY e.auto_release_at ASC LIMIT 50;

-- 5. Anciennes libérations NON converties restantes (Edge Function) — devraient être nettoyées
SELECT count(*) AS liberations_cassees_restantes
FROM public.wallet_transactions
WHERE transaction_type = 'payment' AND description LIKE 'Libération escrow%';

-- 6. Récap : libérations correctes (type escrow_release) des 7 derniers jours
SELECT date_trunc('day', created_at) AS jour, count(*) AS nb, sum(net_amount) AS total_brut
FROM public.wallet_transactions
WHERE transaction_type = 'escrow_release' AND created_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 1 DESC;
