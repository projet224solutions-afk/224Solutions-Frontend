-- ============================================================================
-- CRITIQUE 2 — Empêcher l'auto-élévation de rôle (privilege escalation)
-- ----------------------------------------------------------------------------
-- Problème : un utilisateur peut, via un UPDATE sur son propre profil
-- (localStorage oauth_intent_role, ou appel direct PostgREST), tenter de
-- définir role = 'admin' / 'pdg' / 'ceo' / 'actionnaire'.
--
-- ⚠️ Pourquoi un TRIGGER et pas la policy proposée initialement :
--   La policy "profiles_update_admin" avec `WITH CHECK (true)` aurait été
--   combinée en OR avec la policy utilisateur → le `true` aurait ANNULÉ la
--   protection (un client aurait pu passer admin). De plus, une WITH CHECK ne
--   voit que la NOUVELLE ligne : impossible de distinguer « garder son rôle
--   privilégié » de « s'élever vers ce rôle » → un actionnaire/admin légitime
--   n'aurait plus pu modifier son propre profil.
--
-- Le trigger BEFORE UPDATE compare OLD.role / NEW.role :
--   • rôle inchangé                       → autorisé (modif nom/avatar/etc.)
--   • appelant service_role (auth.uid NULL)→ autorisé (backend de confiance,
--                                            contourne déjà la RLS)
--   • appelant admin/pdg/ceo              → autorisé (attribution légitime)
--   • non-admin, NEW.role privilégié      → REFUSÉ (l'attaque)
--   • non-admin, NEW.role non privilégié  → autorisé (ex: OAuth client→vendeur)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_caller_role text;
BEGIN
  -- Pas de changement de rôle → rien à contrôler.
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- Écritures backend (service_role) : auth.uid() est NULL, on laisse passer.
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Un admin/pdg/ceo peut attribuer n'importe quel rôle.
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller;
  IF COALESCE(v_caller_role, '') IN ('admin', 'pdg', 'ceo') THEN
    RETURN NEW;
  END IF;

  -- Non-admin : interdiction de s'élever vers un rôle privilégié.
  IF NEW.role IN ('admin', 'pdg', 'ceo', 'actionnaire') THEN
    RAISE EXCEPTION 'Modification du rôle vers un rôle privilégié non autorisée (% -> %)',
      OLD.role, NEW.role
      USING ERRCODE = '42501';
  END IF;

  -- Changement vers un rôle NON privilégié (ex: OAuth client→vendeur) : OK.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_escalation();

COMMENT ON FUNCTION public.prevent_role_self_escalation() IS
  'Bloque l''auto-attribution de rôles privilégiés (admin/pdg/ceo/actionnaire) par un non-admin, sans gêner les changements légitimes (OAuth, admin, backend).';
