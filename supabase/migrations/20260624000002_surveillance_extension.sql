-- ============================================================================
-- EXTENSION SURVEILLANCE — carte virtuelle (#1), identité (#2), suppression (#3)
-- ----------------------------------------------------------------------------
-- Étend la surveillance (audit_logs + system_alerts) aux opérations sensibles
-- restantes, dans le même esprit que la couche rôles (20260624000001).
--   #1 carte virtuelle : trace de chaque création.
--   #2 identité (public_id/custom_id) : trace + alerte si une identité DÉJÀ
--      définie est modifiée (l'identité doit être set-once ; écritures backend
--      only + triggers de garde déjà en place — ici on AJOUTE la surveillance).
--   #3 suppression de compte : trace + alerte sur tout DELETE de profil.
-- L'audit #2/#3 est best-effort (n'annule JAMAIS l'opération métier).
-- ============================================================================

-- ── #1 Carte virtuelle : audit de création ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_virtual_card_secure(
  p_user_id     uuid,
  p_holder_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_caller_role text;
  v_last4       text;
  v_card_number text;
  v_cvv         text;
  v_expiry      text;
  v_future      date;
  v_existing    uuid;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  IF p_user_id <> v_caller THEN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller;
    IF COALESCE(v_caller_role, '') NOT IN ('admin', 'pdg', 'ceo') THEN
      RETURN jsonb_build_object('success', false, 'error', 'forbidden');
    END IF;
  END IF;

  SELECT id INTO v_existing FROM public.virtual_cards WHERE user_id = p_user_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_exists', true);
  END IF;

  v_last4       := lpad((floor(random() * 9999 + 1))::int::text, 4, '0');
  v_card_number := '4*** **** **** ' || v_last4;
  v_cvv         := lpad((floor(random() * 900 + 100))::int::text, 3, '0');
  v_future      := CURRENT_DATE + INTERVAL '3 years';
  v_expiry      := to_char(v_future, 'MM/YY');

  INSERT INTO public.virtual_cards (
    user_id, card_number, holder_name, expiry_date, cvv, daily_limit, monthly_limit
  ) VALUES (
    p_user_id, v_card_number,
    COALESCE(NULLIF(btrim(p_holder_name), ''), 'Titulaire 224'),
    v_expiry, v_cvv, 500000, 2000000
  );

  -- 🔎 SURVEILLANCE : trace de la création (même transaction = atomique).
  INSERT INTO public.audit_logs (action, actor_id, target_id, target_type, data_json)
  VALUES ('virtual_card.created', v_caller, p_user_id, 'virtual_cards',
          jsonb_build_object('last4', v_last4, 'for_other', (p_user_id <> v_caller)));

  RETURN jsonb_build_object('success', true, 'card_number', v_card_number,
                            'expiry', v_expiry, 'already_exists', false);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'already_exists', true);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ── #2 Identité : surveillance des changements de public_id / custom_id ──────
CREATE OR REPLACE FUNCTION public.audit_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.public_id IS NOT DISTINCT FROM OLD.public_id
     AND NEW.custom_id IS NOT DISTINCT FROM OLD.custom_id THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.audit_logs (action, actor_id, target_id, target_type, data_json)
    VALUES ('identity.changed', v_actor, NEW.id, 'profiles',
            jsonb_build_object('public_id_from', OLD.public_id, 'public_id_to', NEW.public_id,
                               'custom_id_from', OLD.custom_id, 'custom_id_to', NEW.custom_id,
                               'by_service_role', (v_actor IS NULL)));

    -- Alerte si une identité DÉJÀ DÉFINIE change (anormal : set-once attendu).
    IF (OLD.public_id IS NOT NULL AND NEW.public_id IS DISTINCT FROM OLD.public_id)
       OR (OLD.custom_id IS NOT NULL AND NEW.custom_id IS DISTINCT FROM OLD.custom_id) THEN
      INSERT INTO public.system_alerts (title, message, severity, module, status, created_by, metadata)
      VALUES ('Modification d''une identité existante',
              format('Profil %s : identité modifiée', NEW.id),
              'high', 'security', 'active', v_actor,
              jsonb_build_object('public_id_from', OLD.public_id, 'public_id_to', NEW.public_id,
                                 'custom_id_from', OLD.custom_id, 'custom_id_to', NEW.custom_id,
                                 'actor', v_actor, 'by_service_role', (v_actor IS NULL),
                                 'kind', 'identity_mutation'));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Best-effort : ne jamais bloquer le provisioning d'identité pour un échec d'audit.
    RAISE WARNING 'audit_identity_change: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_identity_change ON public.profiles;
CREATE TRIGGER trg_audit_identity_change
  AFTER UPDATE OF public_id, custom_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_identity_change();

-- ── #3 Suppression de compte : surveillance de tout DELETE de profil ─────────
CREATE OR REPLACE FUNCTION public.audit_profile_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  BEGIN
    INSERT INTO public.audit_logs (action, actor_id, target_id, target_type, data_json)
    VALUES ('profile.deleted', v_actor, OLD.id, 'profiles',
            jsonb_build_object('email', OLD.email, 'role', OLD.role, 'by_service_role', (v_actor IS NULL)));

    INSERT INTO public.system_alerts (title, message, severity, module, status, created_by, metadata)
    VALUES ('Suppression de compte',
            format('Compte %s (%s) supprimé', OLD.email, OLD.role),
            'high', 'security', 'active', v_actor,
            jsonb_build_object('user_id', OLD.id, 'email', OLD.email, 'role', OLD.role,
                               'actor', v_actor, 'by_service_role', (v_actor IS NULL),
                               'kind', 'account_deletion'));
  EXCEPTION WHEN OTHERS THEN
    -- Best-effort : ne JAMAIS empêcher une suppression à cause d'un échec d'audit.
    RAISE WARNING 'audit_profile_deletion: %', SQLERRM;
  END;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profile_deletion ON public.profiles;
CREATE TRIGGER trg_audit_profile_deletion
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_profile_deletion();

COMMENT ON FUNCTION public.audit_identity_change() IS
  'Surveillance : journalise (audit_logs) et alerte (system_alerts) toute modification de public_id/custom_id. Best-effort.';
COMMENT ON FUNCTION public.audit_profile_deletion() IS
  'Surveillance : journalise et alerte toute suppression de profil. Best-effort (ne bloque jamais la suppression).';
