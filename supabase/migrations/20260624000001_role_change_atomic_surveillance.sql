-- ============================================================================
-- DURCISSEMENT IDENTITÉ/RÔLES — atomique + sous surveillance
-- ----------------------------------------------------------------------------
-- Objectif : rendre TOUT changement de rôle « ultra blindé »
--   • ATOMIQUE   : la correction de rôle passe par un RPC tout-ou-rien
--                  (plus d'UPDATE profiles.role direct depuis le client).
--   • AUTORISÉ   : un non-admin ne peut que client → rôle self-service.
--   • IDEMPOTENT : rejouer la même demande ne casse rien.
--   • SURVEILLÉ  : tout changement est journalisé (audit_logs) et toute
--                  attribution privilégiée / tentative refusée lève une
--                  alerte (system_alerts) visible par le PDG.
-- Réutilise l'infra existante : audit_logs + system_alerts.
-- Complète les triggers prevent_role_self_escalation (BEFORE, blocage dur)
-- des migrations 20260623000002/000003.
-- ============================================================================

-- ── 1) RPC ATOMIQUE de correction de rôle (signup OAuth) ────────────────────
CREATE OR REPLACE FUNCTION public.apply_signup_role(p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_current      text;
  v_self_service text[] := ARRAY['client', 'vendeur', 'livreur', 'taxi', 'transitaire', 'prestataire'];
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  SELECT role INTO v_current FROM public.profiles WHERE id = v_caller;
  IF v_current IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_profile');
  END IF;

  -- Idempotence : déjà le bon rôle → succès sans écriture.
  IF v_current = p_role THEN
    RETURN jsonb_build_object('success', true, 'already_applied', true, 'role', v_current);
  END IF;

  -- Autorisation : correction permise UNIQUEMENT client → rôle self-service.
  IF v_current <> 'client' OR NOT (p_role = ANY (v_self_service)) THEN
    -- Surveillance : tentative illégitime → audit + alerte (committés car on
    -- RETURNE proprement, sans exception).
    INSERT INTO public.audit_logs (action, actor_id, target_id, target_type, data_json)
    VALUES ('role.correction_denied', v_caller, v_caller, 'profiles',
            jsonb_build_object('from', v_current, 'requested', p_role));

    INSERT INTO public.system_alerts (title, message, severity, module, status, created_by, metadata)
    VALUES ('Tentative de correction de rôle refusée',
            format('Profil %s : tentative %s → %s refusée', v_caller, v_current, p_role),
            'high', 'security', 'active', v_caller,
            jsonb_build_object('from', v_current, 'requested', p_role, 'kind', 'role_correction_denied'));

    RETURN jsonb_build_object('success', false, 'error', 'role_not_allowed');
  END IF;

  -- Application atomique. Le trigger BEFORE revalide (backstop) et le trigger
  -- AFTER journalise. Si l'audit échoue, tout est annulé (fail-closed).
  UPDATE public.profiles SET role = p_role, updated_at = now() WHERE id = v_caller;

  RETURN jsonb_build_object('success', true, 'role', p_role);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_signup_role(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_signup_role(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_signup_role(text) TO authenticated;

COMMENT ON FUNCTION public.apply_signup_role(text) IS
  'Correction de rôle au signup (client→self-service), atomique/idempotent/autorisé/audité. Remplace l''UPDATE profiles.role direct côté client.';

-- ── 2) TRIGGER AFTER : journal + alerte de TOUT changement de rôle ──────────
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor      uuid := auth.uid();
  v_privileged text[] := ARRAY['admin', 'pdg', 'ceo', 'actionnaire', 'agent', 'vendor_agent', 'restaurant_agent', 'syndicat'];
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- Journal immuable de TOUT changement de rôle.
  INSERT INTO public.audit_logs (action, actor_id, target_id, target_type, data_json)
  VALUES ('role.changed', v_actor, NEW.id, 'profiles',
          jsonb_build_object('from', OLD.role, 'to', NEW.role, 'by_service_role', (v_actor IS NULL)));

  -- Alerte de surveillance si le NOUVEAU rôle est privilégié/provisionné.
  IF NEW.role = ANY (v_privileged) THEN
    INSERT INTO public.system_alerts (title, message, severity, module, status, created_by, metadata)
    VALUES ('Attribution d''un rôle privilégié',
            format('Profil %s : %s → %s', NEW.id, OLD.role, NEW.role),
            CASE WHEN NEW.role IN ('admin', 'pdg', 'ceo') THEN 'critical' ELSE 'high' END,
            'security', 'active', v_actor,
            jsonb_build_object('from', OLD.role, 'to', NEW.role, 'actor', v_actor,
                               'by_service_role', (v_actor IS NULL), 'kind', 'privileged_role_grant'));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_role_change ON public.profiles;
CREATE TRIGGER trg_audit_role_change
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_role_change();

COMMENT ON FUNCTION public.audit_role_change() IS
  'Journalise tout changement de profiles.role dans audit_logs et alerte (system_alerts) sur toute attribution de rôle privilégié/provisionné.';
