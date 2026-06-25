-- ============================================================================
-- RPC: count_nearby_services
-- Compte boutiques / taxi / livraison / restaurants dans un rayon (km) côté
-- serveur, en 4 COUNT, au lieu de 4 requêtes client non bornées (qui
-- rapatriaient toutes les lignes pour filtrer en JS).
--
-- Distance : haversine pur (aucune extension PostGIS/earthdistance installée).
-- Sécurité : SECURITY DEFINER (les tables sont sous RLS) mais ne renvoie que
--            des compteurs agrégés — aucune PII. Exécutable par anon (page
--            d'accueil publique) + authenticated.
-- ============================================================================

-- Helper haversine (km) — pur, immuable. Renvoie NULL si une coord manque.
CREATE OR REPLACE FUNCTION public._haversine_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
    ELSE 6371.0 * acos(
      -- clamp [-1,1] pour éviter les NaN dus aux erreurs d'arrondi
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
        + sin(radians(lat1)) * sin(radians(lat2))
      ))
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.count_nearby_services(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_boutiques   integer := 0;
  v_taxi        integer := 0;
  v_livraison   integer := 0;
  v_restaurants integer := 0;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN jsonb_build_object('boutiques', 0, 'taxi', 0, 'livraison', 0, 'restaurants', 0);
  END IF;

  -- Boutiques actives géolocalisées
  SELECT count(*) INTO v_boutiques
  FROM vendors v
  WHERE v.is_active IS TRUE
    AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
    AND public._haversine_km(p_lat, p_lng, v.latitude, v.longitude) <= p_radius_km;

  -- Taxis-motos en ligne et disponibles
  SELECT count(*) INTO v_taxi
  FROM taxi_drivers t
  WHERE t.is_online IS TRUE
    AND t.status IN ('online', 'available')
    AND t.last_lat IS NOT NULL AND t.last_lng IS NOT NULL
    AND public._haversine_km(p_lat, p_lng, t.last_lat, t.last_lng) <= p_radius_km;

  -- Livreurs actifs (current_location prioritaire, sinon last_location).
  -- current_location / last_location sont des `point` : [0]=x=lng, [1]=y=lat.
  SELECT count(*) INTO v_livraison
  FROM drivers d
  WHERE (d.is_online IS TRUE OR d.status IN ('active', 'online', 'on_trip'))
    AND public._haversine_km(
          p_lat, p_lng,
          COALESCE((d.current_location::point)[1], (d.last_location::point)[1]),
          COALESCE((d.current_location::point)[0], (d.last_location::point)[0])
        ) <= p_radius_km;

  -- Restaurants actifs géolocalisés
  SELECT count(*) INTO v_restaurants
  FROM professional_services ps
  JOIN service_types st ON st.id = ps.service_type_id
  WHERE ps.status = 'active'
    AND st.code = 'restaurant'
    AND ps.latitude IS NOT NULL AND ps.longitude IS NOT NULL
    AND public._haversine_km(p_lat, p_lng, ps.latitude, ps.longitude) <= p_radius_km;

  RETURN jsonb_build_object(
    'boutiques',   COALESCE(v_boutiques, 0),
    'taxi',        COALESCE(v_taxi, 0),
    'livraison',   COALESCE(v_livraison, 0),
    'restaurants', COALESCE(v_restaurants, 0)
  );
END;
$$;

-- Respecte la règle de durcissement : pas d'EXECUTE implicite à PUBLIC.
REVOKE ALL ON FUNCTION public.count_nearby_services(double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_nearby_services(double precision, double precision, double precision) TO anon, authenticated;
