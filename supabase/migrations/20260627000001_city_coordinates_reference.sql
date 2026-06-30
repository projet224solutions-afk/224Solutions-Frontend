-- ============================================================================
-- GÉOCODAGE RÉTROACTIF DES SERVICES DE PROXIMITÉ
-- ----------------------------------------------------------------------------
-- PROBLÈME : professional_services.latitude/longitude (et vendors) sont NULL
-- pour tous les services inscrits avant l'ajout de la capture GPS. Le filtre
-- rayon 20 km de ServicesProximite.tsx (logique VOULUE) élimine donc tout
-- service sans coordonnées → page proximité vide malgré un GPS utilisateur actif.
--
-- SOLUTION : rétro-remplir latitude/longitude depuis le champ `city` déjà
-- présent, via une table de référence ville → centre-ville. On REMPLIT
-- uniquement les NULL (une position GPS précise existante est PRÉSERVÉE).
--
-- DURCISSEMENT vs prompt d'origine (vérifié contre le schéma réel) :
--   * `unaccent` n'est pas activé dans ce projet → normalisation via translate()
--     (déterministe, IMMUTABLE, sans extension).
--   * `professional_services.location_accuracy` n'existe pas → ajoutée ici
--     (additif, nullable) pour marquer une position « niveau ville ».
--   * REVOKE EXECUTE FROM PUBLIC sur les RPC SECURITY DEFINER (règle repo).
-- Idempotente : CREATE IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT DO NOTHING.
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- 0. Colonne de précision (niveau ville vs GPS précis) — additif
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.professional_services
  ADD COLUMN IF NOT EXISTS location_accuracy numeric;  -- mètres ; ~5000 = niveau ville

COMMENT ON COLUMN public.professional_services.location_accuracy IS
  'Rayon d''incertitude en mètres. ~5000 = position déduite de la ville (centre-ville). '
  'NULL ou faible = position GPS précise placée par le prestataire.';

-- ════════════════════════════════════════════════════════════
-- 1. Normalisation de ville (minuscule + sans accent + espaces collapsés)
--    Sans dépendance à l'extension unaccent : translate() couvre les
--    diacritiques français/ouest-africains usuels.
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.normalize_city_key(p_city text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(
    translate(
      lower(trim(COALESCE(p_city, ''))),
      'àâäáãèéêëìîïíòôöóõùûüúçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '\s+', ' ', 'g'
  );
$$;

-- ════════════════════════════════════════════════════════════
-- 2. Table de référence ville → coordonnées centre-ville
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.city_coordinates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_key     TEXT NOT NULL UNIQUE,          -- ville normalisée (normalize_city_key)
  city_label   TEXT NOT NULL,                 -- libellé d'affichage
  country_code TEXT,                          -- ISO (GN, SN, ML, CI...)
  latitude     DECIMAL(10, 8) NOT NULL,
  longitude    DECIMAL(11, 8) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- city_coordinates est une donnée de référence publique (pas de PII) : lecture
-- ouverte, écriture réservée au backend / admin. RLS lecture seule.
ALTER TABLE public.city_coordinates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS city_coordinates_read ON public.city_coordinates;
CREATE POLICY city_coordinates_read ON public.city_coordinates
  FOR SELECT USING (true);

-- ════════════════════════════════════════════════════════════
-- 3. Seed des villes (Guinée + grandes villes de la zone)
--    Coordonnées du centre-ville. Étendre la liste au besoin.
-- ════════════════════════════════════════════════════════════
INSERT INTO public.city_coordinates (city_key, city_label, country_code, latitude, longitude) VALUES
  -- ── GUINÉE (marché principal) ──
  ('conakry',      'Conakry',      'GN',  9.64120000, -13.57840000),
  ('kankan',       'Kankan',       'GN', 10.38540000,  -9.30580000),
  ('labe',         'Labé',         'GN', 11.31820000, -12.28330000),
  ('nzerekore',    'Nzérékoré',    'GN',  7.75640000,  -8.81790000),
  ('kindia',       'Kindia',       'GN', 10.05670000, -12.86530000),
  ('boke',         'Boké',         'GN', 10.93250000, -14.29350000),
  ('mamou',        'Mamou',        'GN', 10.37550000, -12.09150000),
  ('faranah',      'Faranah',      'GN', 10.04030000, -10.74270000),
  ('kissidougou',  'Kissidougou',  'GN',  9.18500000, -10.10000000),
  ('gueckedou',    'Guéckédou',    'GN',  8.56000000, -10.13330000),
  ('siguiri',      'Siguiri',      'GN', 11.41850000,  -9.16670000),
  ('macenta',      'Macenta',      'GN',  8.54600000,  -9.47200000),
  ('kerouane',     'Kérouané',     'GN',  9.26670000,  -9.01670000),
  ('dabola',       'Dabola',       'GN', 10.74830000, -11.10830000),
  ('dalaba',       'Dalaba',       'GN', 10.68330000, -12.25000000),
  ('pita',         'Pita',         'GN', 11.05670000, -12.39670000),
  ('telimele',     'Télimélé',     'GN', 10.90080000, -13.03330000),
  ('forecariah',   'Forécariah',   'GN',  9.43060000, -13.08720000),
  ('coyah',        'Coyah',        'GN',  9.70000000, -13.38330000),
  ('dubreka',      'Dubréka',      'GN',  9.79000000, -13.51670000),
  -- ── ZONE XOF (francophone Ouest) ──
  ('dakar',        'Dakar',        'SN', 14.69280000, -17.44670000),
  ('bamako',       'Bamako',       'ML', 12.63920000,  -8.00290000),
  ('abidjan',      'Abidjan',      'CI',  5.35990000,  -4.00830000),
  ('ouagadougou',  'Ouagadougou',  'BF', 12.37140000,  -1.51970000),
  ('cotonou',      'Cotonou',      'BJ',  6.36540000,   2.41830000),
  ('lome',         'Lomé',         'TG',  6.13190000,   1.22280000),
  ('niamey',       'Niamey',       'NE', 13.51160000,   2.11540000),
  ('bissau',       'Bissau',       'GW', 11.86360000, -15.59770000),
  -- ── AUTRES GRANDES VILLES (extensibles) ──
  ('lagos',        'Lagos',        'NG',  6.52440000,   3.37920000),
  ('accra',        'Accra',        'GH',  5.60370000,  -0.18700000)
ON CONFLICT (city_key) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- 4. RPC : géocode les services existants depuis leur ville
--    Réservé admin/pdg/ceo. Ne touche QUE les services sans GPS (lat/lng NULL).
--    location_accuracy = 5000 (5 km) → marque une position « niveau ville ».
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.backfill_services_geolocation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role            text;
  v_ps_updated      integer := 0;
  v_vendors_updated integer := 0;
BEGIN
  -- Garde de rôle (convention repo : profiles.id = auth.uid())
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF COALESCE(v_role, '') NOT IN ('admin', 'pdg', 'ceo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  -- 1. professional_services SANS GPS → géocoder depuis city
  WITH geocoded AS (
    UPDATE public.professional_services ps
    SET
      latitude          = cc.latitude,
      longitude         = cc.longitude,
      location_accuracy = 5000,        -- ~niveau ville (à distinguer d'un GPS précis)
      updated_at        = now()
    FROM public.city_coordinates cc
    WHERE (ps.latitude IS NULL OR ps.longitude IS NULL)   -- ne touche QUE les NULL
      AND ps.city IS NOT NULL
      AND public.normalize_city_key(ps.city) = cc.city_key
    RETURNING ps.id
  )
  SELECT count(*) INTO v_ps_updated FROM geocoded;

  -- 2. vendors SANS GPS → géocoder depuis city
  WITH geocoded_v AS (
    UPDATE public.vendors v
    SET
      latitude   = cc.latitude,
      longitude  = cc.longitude,
      updated_at = now()
    FROM public.city_coordinates cc
    WHERE (v.latitude IS NULL OR v.longitude IS NULL)     -- ne touche QUE les NULL
      AND v.city IS NOT NULL
      AND public.normalize_city_key(v.city) = cc.city_key
    RETURNING v.id
  )
  SELECT count(*) INTO v_vendors_updated FROM geocoded_v;

  -- Audit de l'opération
  INSERT INTO public.audit_logs (actor_id, action, target_type, data_json, created_at)
  VALUES (
    auth.uid(),
    'services_geolocation_backfilled',
    'system',
    jsonb_build_object(
      'professional_services_updated', v_ps_updated,
      'vendors_updated', v_vendors_updated
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'professional_services_updated', v_ps_updated,
    'vendors_updated', v_vendors_updated
  );
END;
$$;

REVOKE ALL    ON FUNCTION public.backfill_services_geolocation() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.backfill_services_geolocation() TO authenticated;
-- (contrôle de rôle interne ; authenticated nécessaire pour auth.uid())

-- ════════════════════════════════════════════════════════════
-- 5. RPC d'aide : lister les villes NON géocodées (pour compléter la table)
--    Réservé admin/pdg/ceo (filtre EXISTS → 0 ligne pour les autres).
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.list_ungeocoded_cities()
RETURNS TABLE(city_raw text, normalized text, occurrences bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    src.city                              AS city_raw,
    public.normalize_city_key(src.city)   AS normalized,
    count(*)                              AS occurrences
  FROM (
    SELECT city FROM public.professional_services
      WHERE city IS NOT NULL AND (latitude IS NULL OR longitude IS NULL)
    UNION ALL
    SELECT city FROM public.vendors
      WHERE city IS NOT NULL AND (latitude IS NULL OR longitude IS NULL)
  ) src
  WHERE NOT EXISTS (
      SELECT 1 FROM public.city_coordinates cc
      WHERE cc.city_key = public.normalize_city_key(src.city)
    )
    -- Garde de rôle : non-admin → aucune ligne
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'pdg', 'ceo')
    )
  GROUP BY src.city
  ORDER BY count(*) DESC;
$$;

REVOKE ALL    ON FUNCTION public.list_ungeocoded_cities() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_ungeocoded_cities() TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 6. Garde-fou
-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.city_coordinates WHERE city_key = 'conakry')
    THEN RAISE EXCEPTION 'Seed villes incomplet (conakry absent)'; END IF;
  IF public.normalize_city_key('  CONAKRY ') <> 'conakry'
    THEN RAISE EXCEPTION 'normalize_city_key cassée (% != conakry)', public.normalize_city_key('  CONAKRY '); END IF;
  IF public.normalize_city_key('Nzérékoré') <> 'nzerekore'
    THEN RAISE EXCEPTION 'normalize_city_key accents cassés (% != nzerekore)', public.normalize_city_key('Nzérékoré'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'backfill_services_geolocation')
    THEN RAISE EXCEPTION 'RPC backfill absente'; END IF;
  RAISE NOTICE '✅ Migration city_coordinates_reference OK';
END; $$;

COMMIT;
