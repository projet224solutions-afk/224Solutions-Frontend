-- ✅ Vérification post-déploiement — durcissement transfert international
-- À exécuter dans Supabase Dashboard → SQL Editor après la migration 20260607120000.
-- Les 3 blocs doivent tous renvoyer le résultat attendu indiqué en commentaire.

-- 1) La table de registre des commissions FX existe.
--    Attendu : une ligne avec la valeur 'public.platform_fx_commissions' (non NULL).
SELECT to_regclass('public.platform_fx_commissions') AS commission_table;

-- 2) La fonction FX durcie a bien 13 arguments (avec p_fee_amount) et la same-currency 8.
--    Attendu : execute_atomic_wallet_transfer_fx = 13, execute_atomic_wallet_transfer = 8.
--    (Aucune surcharge en double : exactement 1 ligne par fonction.)
SELECT proname, pronargs
FROM pg_proc
WHERE proname IN ('execute_atomic_wallet_transfer', 'execute_atomic_wallet_transfer_fx')
ORDER BY proname;

-- 3) Les dernières commissions gardées par la plateforme (vide tant qu'aucun transfert
--    international n'a eu lieu — c'est normal avant le 1er test).
SELECT id, transaction_id, sender_id, amount, currency, rate_used, created_at
FROM public.platform_fx_commissions
ORDER BY created_at DESC
LIMIT 10;
