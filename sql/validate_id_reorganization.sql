-- =====================================================
-- VALIDATION SCRIPT: ID REORGANIZATION + DUPLICATE REPAIR
-- Usage:
--   1) Run this file before reorganization (baseline)
--   2) Execute: SELECT * FROM public.reorganize_user_ids_from_db(NULL);
--   3) Run this file again (post-check)
-- =====================================================

-- 1) Global audit from existing integrity function (if available)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'audit_user_identity_integrity'
  ) THEN
    RAISE NOTICE 'audit_user_identity_integrity() is available';
  ELSE
    RAISE NOTICE 'audit_user_identity_integrity() is NOT available in this DB';
  END IF;
END $$;

-- 2) Hard checks: duplicates by user_id and custom_id
SELECT
  'duplicate_user_ids_by_user_id' AS check_name,
  COUNT(*) AS affected_count
FROM (
  SELECT user_id
  FROM public.user_ids
  GROUP BY user_id
  HAVING COUNT(*) > 1
) t
UNION ALL
SELECT
  'duplicate_user_ids_by_custom_id' AS check_name,
  COUNT(*) AS affected_count
FROM (
  SELECT custom_id
  FROM public.user_ids
  WHERE custom_id IS NOT NULL AND BTRIM(custom_id) <> ''
  GROUP BY custom_id
  HAVING COUNT(*) > 1
) t
UNION ALL
SELECT
  'duplicate_profiles_public_id' AS check_name,
  COUNT(*) AS affected_count
FROM (
  SELECT public_id
  FROM public.profiles
  WHERE public_id IS NOT NULL AND BTRIM(public_id) <> ''
  GROUP BY public_id
  HAVING COUNT(*) > 1
) t;

-- 3) Sync checks between profiles/user_ids/vendors
SELECT
  'profiles_vs_user_ids_mismatch' AS check_name,
  COUNT(*) AS affected_count
FROM public.profiles p
JOIN public.user_ids ui ON ui.user_id = p.id
WHERE p.public_id IS NOT NULL
  AND BTRIM(p.public_id) <> ''
  AND ui.custom_id IS DISTINCT FROM p.public_id
UNION ALL
SELECT
  'profiles_vs_profiles_custom_id_mismatch' AS check_name,
  COUNT(*) AS affected_count
FROM public.profiles p
WHERE p.public_id IS NOT NULL
  AND BTRIM(p.public_id) <> ''
  AND p.custom_id IS DISTINCT FROM p.public_id
UNION ALL
SELECT
  'vendors_vs_profiles_public_id_mismatch' AS check_name,
  COUNT(*) AS affected_count
FROM public.vendors v
JOIN public.profiles p ON p.id = v.user_id
WHERE p.public_id IS NOT NULL
  AND BTRIM(p.public_id) <> ''
  AND v.vendor_code IS DISTINCT FROM p.public_id;

-- 4) Missing identity rows
SELECT
  'profiles_missing_public_id' AS check_name,
  COUNT(*) AS affected_count
FROM public.profiles
WHERE public_id IS NULL OR BTRIM(public_id) = ''
UNION ALL
SELECT
  'profiles_missing_user_ids_row' AS check_name,
  COUNT(*) AS affected_count
FROM public.profiles p
LEFT JOIN public.user_ids ui ON ui.user_id = p.id
WHERE ui.user_id IS NULL;

-- 4b) Prefix helper alignment + remaining legacy prefixes
SELECT
  public.identity_role_prefix('client') AS client_generation_prefix,
  public.identity_role_to_prefix('client') AS client_reorganization_prefix,
  public.identity_role_prefix('bureau') AS bureau_generation_prefix,
  public.identity_role_to_prefix('bureau') AS bureau_reorganization_prefix;

SELECT
  'legacy_cli_profiles_or_custom_ids' AS check_name,
  COUNT(*) AS affected_count
FROM public.profiles
WHERE COALESCE(public_id, '') LIKE 'CLI%'
   OR COALESCE(custom_id, '') LIKE 'CLI%'
UNION ALL
SELECT
  'legacy_cli_user_ids' AS check_name,
  COUNT(*) AS affected_count
FROM public.user_ids
WHERE COALESCE(custom_id, '') LIKE 'CLI%'
UNION ALL
SELECT
  'legacy_syn_profiles_or_custom_ids' AS check_name,
  COUNT(*) AS affected_count
FROM public.profiles
WHERE COALESCE(public_id, '') LIKE 'SYN%'
   OR COALESCE(custom_id, '') LIKE 'SYN%'
UNION ALL
SELECT
  'legacy_syn_user_ids' AS check_name,
  COUNT(*) AS affected_count
FROM public.user_ids
WHERE COALESCE(custom_id, '') LIKE 'SYN%';

-- 5) Sequence continuity audit by role prefix
WITH role_prefix AS (
  SELECT
    p.id,
    LOWER(BTRIM(COALESCE(p.role::TEXT, ''))) AS role_type,
    CASE LOWER(BTRIM(COALESCE(p.role::TEXT, '')))
      WHEN 'vendeur' THEN 'VND'
      WHEN 'vendor' THEN 'VND'
      WHEN 'client' THEN 'CLT'
      WHEN 'agent' THEN 'AGT'
      WHEN 'pdg' THEN 'PDG'
      WHEN 'livreur' THEN 'LIV'
      WHEN 'taxi' THEN 'TAX'
      WHEN 'driver' THEN 'DRV'
      WHEN 'chauffeur' THEN 'DRV'
      WHEN 'transitaire' THEN 'TRS'
      WHEN 'bureau' THEN 'BST'
      WHEN 'syndicat' THEN 'BST'
      WHEN 'worker' THEN 'WRK'
      ELSE NULL
    END AS prefix,
    p.public_id
  FROM public.profiles p
),
normalized AS (
  SELECT
    role_type,
    prefix,
    public_id,
    CASE
      WHEN prefix IS NOT NULL
        AND public_id IS NOT NULL
        AND public_id ~ ('^' || prefix || '[0-9]{4}$')
      THEN CAST(RIGHT(public_id, 4) AS INTEGER)
      ELSE NULL
    END AS num
  FROM role_prefix
  WHERE prefix IS NOT NULL
),
aggregated AS (
  SELECT
    prefix,
    COUNT(*) AS total_rows,
    COUNT(num) AS well_formatted_rows,
    COALESCE(MIN(num), 0) AS min_num,
    COALESCE(MAX(num), 0) AS max_num
  FROM normalized
  GROUP BY prefix
),
series AS (
  SELECT
    a.prefix,
    g.n
  FROM aggregated a
  JOIN LATERAL generate_series(
    CASE WHEN a.max_num = 0 THEN 1 ELSE 1 END,
    CASE WHEN a.max_num = 0 THEN 1 ELSE a.max_num END
  ) AS g(n) ON TRUE
),
missing AS (
  SELECT s.prefix, COUNT(*) AS missing_numbers
  FROM series s
  LEFT JOIN normalized n ON n.prefix = s.prefix AND n.num = s.n
  WHERE n.num IS NULL
  GROUP BY s.prefix
)
SELECT
  a.prefix,
  a.total_rows,
  a.well_formatted_rows,
  a.min_num,
  a.max_num,
  COALESCE(m.missing_numbers, 0) AS gap_count
FROM aggregated a
LEFT JOIN missing m ON m.prefix = a.prefix
ORDER BY a.prefix;

-- 6) Optional: detailed sample of remaining mismatches (top 20)
SELECT
  p.id AS user_id,
  p.role,
  p.public_id,
  p.custom_id,
  ui.custom_id AS user_ids_custom_id,
  v.vendor_code
FROM public.profiles p
LEFT JOIN public.user_ids ui ON ui.user_id = p.id
LEFT JOIN public.vendors v ON v.user_id = p.id
WHERE (p.public_id IS NOT NULL AND BTRIM(p.public_id) <> '' AND ui.custom_id IS DISTINCT FROM p.public_id)
   OR (p.public_id IS NOT NULL AND BTRIM(p.public_id) <> '' AND p.custom_id IS DISTINCT FROM p.public_id)
   OR (v.id IS NOT NULL AND p.public_id IS NOT NULL AND BTRIM(p.public_id) <> '' AND v.vendor_code IS DISTINCT FROM p.public_id)
ORDER BY p.created_at DESC NULLS LAST
LIMIT 20;
