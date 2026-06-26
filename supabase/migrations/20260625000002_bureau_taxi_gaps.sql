-- ============================================================================
-- Corrections consolidées 25/06/2026 — partie SQL (schéma RÉEL vérifié)
-- NB : les migrations 1A–1D du prompt d'origine référençaient des
--      colonnes/tables inexistantes (taxi_notifications.title/body/ride_id,
--      taxi_ratings.customer_id, syndicate_bureaus, syndicate_vehicles,
--      bureaus.president_user_id, taxi_drivers.vehicle_number) → réécrites ici.
--      update_taxi_trip_status / get_taxi_platform_config sont DÉJÀ appliquées.
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Note du client (par le chauffeur) sur taxi_trips
--    cancel_reason existe déjà → seul customer_rating_stars est ajouté.
-- ----------------------------------------------------------------------------
ALTER TABLE public.taxi_trips
  ADD COLUMN IF NOT EXISTS customer_rating_stars SMALLINT
    CHECK (customer_rating_stars BETWEEN 1 AND 5);

CREATE OR REPLACE FUNCTION public.get_customer_avg_rating(p_customer_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(ROUND(AVG(customer_rating_stars)::numeric, 1), 4.5)
  FROM public.taxi_trips
  WHERE customer_id = p_customer_id
    AND customer_rating_stars IS NOT NULL
    AND status = 'completed';
$$;
REVOKE ALL ON FUNCTION public.get_customer_avg_rating(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_avg_rating(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2) GPS unifié : positions syndicat (vehicle_gps_tracking) + positions taxi
--    (taxi_ride_tracking, rapproché par la plaque du chauffeur)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_vehicle_unified_gps AS
SELECT vgt.vehicle_id,
       vgt.latitude::numeric            AS latitude,
       vgt.longitude::numeric           AS longitude,
       vgt.accuracy::numeric            AS accuracy,
       vgt.speed::numeric               AS speed,
       vgt.created_at::timestamptz      AS created_at,
       'syndicat'::text                 AS source
FROM public.vehicle_gps_tracking vgt
UNION ALL
SELECT v.id,
       trt.latitude::numeric,
       trt.longitude::numeric,
       NULL::numeric,
       NULL::numeric,
       trt."timestamp"::timestamptz     AS created_at,
       'taxi'::text                     AS source
FROM public.taxi_ride_tracking trt
JOIN public.taxi_drivers td ON trt.driver_id = td.id
JOIN public.vehicles v
  ON v.license_plate = td.vehicle_plate
  OR v.serial_number = td.vehicle_plate;

GRANT SELECT ON public.v_vehicle_unified_gps TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_vehicle_unified_gps(p_vehicle_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE(latitude numeric, longitude numeric, accuracy numeric, speed numeric,
              created_at timestamptz, source text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT latitude, longitude, accuracy, speed, created_at, source
  FROM public.v_vehicle_unified_gps
  WHERE vehicle_id = p_vehicle_id
  ORDER BY created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 500));
$$;
REVOKE ALL ON FUNCTION public.get_vehicle_unified_gps(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vehicle_unified_gps(uuid,integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3) Trigger : déclaration de vol → notifie le chauffeur + le met hors-ligne.
--    100% défensif : ne doit JAMAIS faire échouer l'UPDATE de déclaration.
--    taxi_notifications réel = (user_id, driver_id, type, payload, created_at).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_driver_vehicle_stolen()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_driver record; v_plate text; v_bureau text;
BEGIN
  BEGIN
    IF NEW.stolen_status = 'stolen'
       AND COALESCE(OLD.stolen_status,'') IS DISTINCT FROM 'stolen' THEN
      v_plate := COALESCE(NEW.license_plate, NEW.serial_number);
      SELECT commune INTO v_bureau FROM public.bureaus WHERE id = NEW.bureau_id;
      SELECT td.id, td.user_id INTO v_driver
      FROM public.taxi_drivers td WHERE td.vehicle_plate = v_plate LIMIT 1;

      IF v_driver.user_id IS NOT NULL THEN
        INSERT INTO public.taxi_notifications (user_id, driver_id, type, payload, created_at)
        VALUES (v_driver.user_id, v_driver.id, 'vehicle_stolen',
          jsonb_build_object(
            'title', '🚨 Votre moto a été signalée volée',
            'body',  format('Le bureau %s a déclaré votre véhicule %s comme volé. Contactez votre bureau syndicat.',
                            COALESCE(v_bureau,'syndicat'), COALESCE(v_plate,'inconnu')),
            'vehicle_id', NEW.id, 'plate', v_plate, 'bureau_id', NEW.bureau_id),
          NOW());
        UPDATE public.taxi_drivers
        SET is_online = false, can_work = false, updated_at = NOW()
        WHERE id = v_driver.id;
      END IF;

    ELSIF NEW.stolen_status = 'recovered' AND OLD.stolen_status = 'stolen' THEN
      v_plate := COALESCE(NEW.license_plate, NEW.serial_number);
      SELECT td.id, td.user_id INTO v_driver
      FROM public.taxi_drivers td WHERE td.vehicle_plate = v_plate LIMIT 1;

      IF v_driver.user_id IS NOT NULL THEN
        INSERT INTO public.taxi_notifications (user_id, driver_id, type, payload, created_at)
        VALUES (v_driver.user_id, v_driver.id, 'vehicle_recovered',
          jsonb_build_object(
            'title', '✅ Votre moto a été récupérée',
            'body',  'Votre véhicule est récupéré. Contactez votre bureau pour réactivation.',
            'vehicle_id', NEW.id, 'plate', v_plate),
          NOW());
        UPDATE public.taxi_drivers SET can_work = true, updated_at = NOW()
        WHERE id = v_driver.id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_driver_vehicle_stolen ignoré: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_notify_driver_vehicle_stolen ON public.vehicles;
CREATE TRIGGER trigger_notify_driver_vehicle_stolen
  AFTER UPDATE OF stolen_status ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.notify_driver_vehicle_stolen();

-- ----------------------------------------------------------------------------
-- 4) Trésorerie du bureau : cotisations + agrégat réel
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bureau_cotisations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bureau_id      UUID NOT NULL,
  driver_id      UUID NOT NULL REFERENCES public.taxi_drivers(id) ON DELETE CASCADE,
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  month          SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year           SMALLINT NOT NULL CHECK (year >= 2024),
  paid_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method TEXT NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash','orange_money','mtn_money','wallet')),
  notes          TEXT,
  recorded_by    UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bureau_id, driver_id, month, year)
);

ALTER TABLE public.bureau_cotisations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cotisations_manage" ON public.bureau_cotisations;
CREATE POLICY "cotisations_manage" ON public.bureau_cotisations FOR ALL TO authenticated
  USING      (auth.uid() = (SELECT user_id FROM public.bureaus WHERE id = bureau_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM public.bureaus WHERE id = bureau_id));

CREATE OR REPLACE FUNCTION public.get_bureau_treasury(
  p_bureau_id uuid,
  p_month integer DEFAULT EXTRACT(MONTH FROM NOW())::integer,
  p_year  integer DEFAULT EXTRACT(YEAR  FROM NOW())::integer
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_balance numeric := 0; v_cotis numeric := 0; v_drivers integer := 0; v_paid integer := 0;
BEGIN
  SELECT COALESCE(balance,0) INTO v_balance
  FROM public.bureau_wallets WHERE bureau_id = p_bureau_id;
  SELECT COALESCE(SUM(amount),0) INTO v_cotis
  FROM public.bureau_cotisations WHERE bureau_id = p_bureau_id AND year = p_year AND month = p_month;
  SELECT COUNT(*) INTO v_drivers
  FROM public.taxi_drivers WHERE bureau_id = p_bureau_id;
  SELECT COUNT(DISTINCT driver_id) INTO v_paid
  FROM public.bureau_cotisations WHERE bureau_id = p_bureau_id AND year = p_year AND month = p_month;
  RETURN jsonb_build_object(
    'balance', v_balance, 'monthly_cotis', v_cotis, 'monthly_expenses', 0,
    'pending_count', GREATEST(0, v_drivers - v_paid), 'total_drivers', v_drivers
  );
END; $$;
REVOKE ALL ON FUNCTION public.get_bureau_treasury(uuid,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bureau_treasury(uuid,integer,integer) TO authenticated;

-- Diffusion d'un message du bureau à tous ses chauffeurs
CREATE OR REPLACE FUNCTION public.broadcast_bureau_message(
  p_bureau_id uuid, p_title text, p_body text, p_type text DEFAULT 'bureau_announcement'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.taxi_notifications (user_id, driver_id, type, payload, created_at)
  SELECT td.user_id, td.id, p_type,
    jsonb_build_object('title', p_title, 'body', p_body, 'bureau_id', p_bureau_id), NOW()
  FROM public.taxi_drivers td
  WHERE td.bureau_id = p_bureau_id AND td.user_id IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'drivers_notified', v_count);
END; $$;
REVOKE ALL ON FUNCTION public.broadcast_bureau_message(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_bureau_message(uuid,text,text,text) TO authenticated;

-- Badges expirant bientôt (sur la table réelle `vehicles`)
CREATE OR REPLACE FUNCTION public.get_expiring_badges(p_bureau_id uuid, p_days_ahead integer DEFAULT 30)
RETURNS TABLE(vehicle_id uuid, serial_number text, license_plate text, owner_member_id uuid,
              badge_generated_at timestamptz, badge_expires_at timestamptz, days_until_expiry integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id, v.serial_number, v.license_plate, v.owner_member_id,
    v.badge_generated_at::timestamptz,
    (v.badge_generated_at + INTERVAL '1 year')::timestamptz AS badge_expires_at,
    EXTRACT(DAY FROM (v.badge_generated_at + INTERVAL '1 year') - NOW())::integer
  FROM public.vehicles v
  WHERE v.bureau_id = p_bureau_id
    AND v.badge_generated_at IS NOT NULL
    AND v.badge_generated_at + INTERVAL '1 year' <= NOW() + (p_days_ahead || ' days')::interval
  ORDER BY v.badge_generated_at ASC;
$$;
REVOKE ALL ON FUNCTION public.get_expiring_badges(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_expiring_badges(uuid,integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- Vérification atomique
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='get_vehicle_unified_gps') OR
     NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='get_bureau_treasury') OR
     NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='broadcast_bureau_message') OR
     NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='get_expiring_badges') OR
     NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='get_customer_avg_rating') OR
     NOT EXISTS (SELECT 1 FROM pg_views WHERE viewname='v_vehicle_unified_gps') OR
     NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename='bureau_cotisations') OR
     NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trigger_notify_driver_vehicle_stolen')
  THEN RAISE EXCEPTION 'MIGRATION 20260625000002 INCOMPLÈTE'; END IF;
  RAISE NOTICE '✅ Migration 20260625000002 OK';
END; $$;

COMMIT;
