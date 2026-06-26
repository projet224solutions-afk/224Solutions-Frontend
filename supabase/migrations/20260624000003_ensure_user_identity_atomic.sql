-- ============================================================================
-- IDENTITÉ (#2) — RPC atomique anti-race pour /api/identity/ensure
-- ----------------------------------------------------------------------------
-- L'endpoint backend faisait 2 écritures séparées (upsert user_ids puis update
-- profiles.public_id) + une lecture-puis-génération NON sérialisée → deux appels
-- concurrents pouvaient générer 2 custom_id différents et désynchroniser
-- user_ids.custom_id ↔ profiles.public_id.
--
-- Ce RPC règle tout en UNE transaction :
--   • verrou applicatif par utilisateur (pg_advisory_xact_lock) → anti-race ;
--   • idempotent (si un custom_id existe déjà, on le renvoie sans réécrire) ;
--   • écriture user_ids + synchro profiles.public_id atomiques (tout-ou-rien) ;
--   • backend-only : REVOKE public/anon/authenticated, GRANT service_role.
-- L'autorisation reste assurée par verifyJWT côté backend (passe req.user.id).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_user_identity(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing  text;
  v_role      text;
  v_public_id text;
  v_custom_id text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_user');
  END IF;

  -- Sérialise les appels concurrents pour CE user (libéré en fin de transaction).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- Idempotence : un custom_id existe déjà → on le renvoie.
  SELECT custom_id INTO v_existing FROM public.user_ids WHERE user_id = p_user_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'custom_id', v_existing, 'created', false);
  END IF;

  SELECT role, public_id INTO v_role, v_public_id FROM public.profiles WHERE id = p_user_id;
  v_role      := COALESCE(v_role, 'client');
  v_custom_id := v_public_id; -- réutilise un public_id déjà attribué si présent

  IF v_custom_id IS NULL THEN
    v_custom_id := public.generate_custom_id_with_role(v_role);
  END IF;

  IF v_custom_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'id_generation_failed');
  END IF;

  -- Écriture atomique user_ids + synchro profiles.public_id.
  INSERT INTO public.user_ids (user_id, custom_id)
  VALUES (p_user_id, v_custom_id)
  ON CONFLICT (user_id) DO UPDATE SET custom_id = EXCLUDED.custom_id
  RETURNING custom_id INTO v_custom_id;

  UPDATE public.profiles
  SET public_id = v_custom_id
  WHERE id = p_user_id AND (public_id IS NULL OR public_id <> v_custom_id);

  RETURN jsonb_build_object('success', true, 'custom_id', v_custom_id, 'created', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_identity(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_user_identity(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ensure_user_identity(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_identity(uuid) TO service_role;

COMMENT ON FUNCTION public.ensure_user_identity(uuid) IS
  'Garantit l''identité (user_ids.custom_id + profiles.public_id) de façon atomique, idempotente et anti-race. Backend-only (service_role).';
