-- ✅ VÉRIFICATION — robustesse devise produit (après migration 20260607180000)
-- À exécuter dans le SQL editor Supabase APRÈS avoir appliqué la migration.

-- 1. La fonction canonique répond correctement (échantillon)
SELECT
  public.resolve_country_currency('Guinée')   AS guinee,    -- attendu GNF
  public.resolve_country_currency('  guinee ')AS gn_norm,   -- attendu GNF (espaces/casse)
  public.resolve_country_currency('Sénégal')  AS senegal,   -- attendu XOF
  public.resolve_country_currency('Mali')     AS mali,      -- attendu XOF
  public.resolve_country_currency('Cameroun') AS cameroun,  -- attendu XAF
  public.resolve_country_currency('France')   AS france,    -- attendu EUR
  public.resolve_country_currency('Nigeria')  AS nigeria,   -- attendu NGN
  public.resolve_country_currency(NULL)       AS null_case; -- attendu GNF

-- 2. AUCUN produit ne doit être désynchronisé du pays de son vendeur (doit renvoyer 0 ligne)
SELECT p.id, p.name, v.country, p.seller_currency, public.resolve_country_currency(v.country) AS attendu
FROM public.products p
JOIN public.vendors v ON v.id = p.vendor_id
WHERE COALESCE(p.seller_currency, '') IS DISTINCT FROM public.resolve_country_currency(v.country)
LIMIT 50;

-- 3. Répartition des devises produit (contrôle de cohérence global)
SELECT p.seller_currency, count(*) AS nb
FROM public.products p
GROUP BY p.seller_currency
ORDER BY nb DESC;

-- 4. Les triggers sont bien en place (doit renvoyer 2 lignes)
SELECT tgname, tgrelid::regclass AS table_cible
FROM pg_trigger
WHERE tgname IN ('products_sync_currency', 'vendor_country_sync_products');

-- 5. Test atomique : changer le pays d'un vendeur doit redéfinir la devise de ses produits.
--    (à exécuter manuellement dans une transaction puis ROLLBACK pour ne rien modifier)
-- BEGIN;
--   UPDATE public.vendors SET country = 'Sénégal' WHERE id = '<vendor_id_test>';
--   SELECT id, seller_currency FROM public.products WHERE vendor_id = '<vendor_id_test>'; -- doit être XOF
-- ROLLBACK;
