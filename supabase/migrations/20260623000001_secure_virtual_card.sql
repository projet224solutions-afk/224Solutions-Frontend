-- ============================================================================
-- CRITIQUE 1 — Création sécurisée de carte virtuelle côté serveur
-- ----------------------------------------------------------------------------
-- Remplace la génération Math.random() côté client (valeurs prédictibles).
-- - Idempotent : ne crée jamais deux cartes pour le même utilisateur.
-- - Anti-usurpation : un utilisateur ne peut créer une carte QUE pour lui-même
--   (p_user_id = auth.uid()), sauf admin/pdg/ceo. Indispensable car la fonction
--   est SECURITY DEFINER et accordée à `authenticated` : sans ce contrôle,
--   n'importe quel utilisateur authentifié pourrait créer une carte pour autrui.
-- - REVOKE FROM PUBLIC/anon : seuls les utilisateurs authentifiés l'exécutent.
-- ============================================================================

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
  -- ── Autorisation : soi-même, ou admin/pdg/ceo ───────────────────────────
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  IF p_user_id <> v_caller THEN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller;
    IF COALESCE(v_caller_role, '') NOT IN ('admin', 'pdg', 'ceo') THEN
      RETURN jsonb_build_object('success', false, 'error', 'forbidden');
    END IF;
  END IF;

  -- ── Idempotence : une seule carte par utilisateur ───────────────────────
  SELECT id INTO v_existing
  FROM public.virtual_cards
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_exists', true);
  END IF;

  -- ── Génération côté serveur ─────────────────────────────────────────────
  -- (cartes fictives masquées — pas de vrai PAN. random() serveur suffit ici
  --  et n'est pas exposé au client, contrairement à Math.random().)
  v_last4       := lpad((floor(random() * 9999 + 1))::int::text, 4, '0');
  v_card_number := '4*** **** **** ' || v_last4;
  v_cvv         := lpad((floor(random() * 900 + 100))::int::text, 3, '0');
  v_future      := CURRENT_DATE + INTERVAL '3 years';
  v_expiry      := to_char(v_future, 'MM/YY');

  INSERT INTO public.virtual_cards (
    user_id,
    card_number,
    holder_name,
    expiry_date,
    cvv,            -- En prod : remplacer par crypt(v_cvv, gen_salt('bf'))
    daily_limit,
    monthly_limit
  ) VALUES (
    p_user_id,
    v_card_number,
    COALESCE(NULLIF(btrim(p_holder_name), ''), 'Titulaire 224'),
    v_expiry,
    v_cvv,
    500000,
    2000000
  );

  RETURN jsonb_build_object(
    'success',        true,
    'card_number',    v_card_number,
    'expiry',         v_expiry,
    'already_exists', false
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'already_exists', true);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- N'autoriser l'exécution qu'aux utilisateurs authentifiés (jamais anon/public).
REVOKE ALL ON FUNCTION public.create_virtual_card_secure(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_virtual_card_secure(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_virtual_card_secure(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.create_virtual_card_secure(uuid, text) IS
  'Crée une carte virtuelle côté serveur (idempotent, soi-même ou admin). Remplace la génération Math.random() côté client.';
