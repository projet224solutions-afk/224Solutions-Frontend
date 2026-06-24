-- ============================================================================
-- CRITIQUE 2 (renforcement) — Whitelist des rôles auto-assignables
-- ----------------------------------------------------------------------------
-- L'audit d'isolation a montré que la 1re version du trigger ne bloquait que
-- {admin, pdg, ceo, actionnaire}. Or un utilisateur pouvait s'auto-assigner un
-- rôle PROVISIONNÉ (agent, vendor_agent, restaurant_agent, syndicat) en posant
-- localStorage.oauth_intent_role = 'agent' puis en repassant par la correction
-- OAuth de useAuth (UPDATE profiles.role sous son propre JWT) → escalade.
--
-- Ces rôles ne sont JAMAIS attribués par un UPDATE client légitime :
--   • agent / restaurant_agent → créés par `auth.signUp` (metadata role) =>
--     INSERT via handle_new_user (le présent trigger BEFORE UPDATE ne s'applique pas) ;
--   • vendor_agent / syndicat → provisionnés côté backend (service_role,
--     auth.uid() NULL => autorisé ici) ou par un admin.
--
-- On passe donc d'une liste NOIRE à une liste BLANCHE : un appelant non-admin ne
-- peut faire évoluer son rôle QUE vers un rôle d'inscription publique
-- (self-service). Tout le reste est refusé. Aucune régression sur les flux
-- légitimes (inscription OAuth client→vendeur/livreur/taxi/transitaire/prestataire,
-- activation agent par signUp, provisioning backend, attribution admin).
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
  -- Rôles qu'un utilisateur peut s'auto-attribuer (= ceux offerts à l'inscription publique)
  v_self_service text[] := ARRAY['client', 'vendeur', 'livreur', 'taxi', 'transitaire', 'prestataire'];
BEGIN
  -- Pas de changement de rôle → rien à contrôler.
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- Écritures backend (service_role) : auth.uid() est NULL → de confiance.
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Un admin/pdg/ceo peut attribuer n'importe quel rôle.
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller;
  IF COALESCE(v_caller_role, '') IN ('admin', 'pdg', 'ceo') THEN
    RETURN NEW;
  END IF;

  -- Non-admin : uniquement vers un rôle d'inscription publique.
  IF NEW.role = ANY (v_self_service) THEN
    RETURN NEW;
  END IF;

  -- Tout autre rôle (agent, vendor_agent, restaurant_agent, syndicat, admin,
  -- pdg, ceo, actionnaire…) est refusé pour un appelant non-admin.
  RAISE EXCEPTION 'Auto-attribution du rôle "%" non autorisée (% -> %)',
    NEW.role, OLD.role, NEW.role
    USING ERRCODE = '42501';
END;
$$;

-- Le trigger trg_prevent_role_self_escalation (migration 20260623000002) reste en
-- place et pointe vers cette fonction redéfinie : pas besoin de le recréer.

COMMENT ON FUNCTION public.prevent_role_self_escalation() IS
  'Liste blanche : un non-admin ne peut faire évoluer son rôle que vers un rôle self-service (client/vendeur/livreur/taxi/transitaire/prestataire). Bloque l''auto-assignation de agent/vendor_agent/restaurant_agent/syndicat et des rôles privilégiés.';
