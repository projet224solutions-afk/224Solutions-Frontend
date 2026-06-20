import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Gate global: si un utilisateur connecté via OAuth (Google/Facebook)
 * n'a pas encore défini un mot de passe, on force l'affichage
 * de la page /auth/set-password.
 *
 * IMPORTANT: Ce composant vérifie maintenant la colonne `has_password` en BDD
 * au lieu de localStorage pour une persistance fiable.
 *
 * WORKFLOW:
 * - Utilisateur OAuth sans mot de passe → Rediriger vers /auth/set-password
 * - Utilisateur OAuth avec mot de passe (has_password=true) → Laisser passer
 * - Utilisateur email/password → Laisser passer (marquer has_password=true)
 */
export default function OAuthPasswordGate() {
  const { user, session, loading, profile, profileLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, _setIsChecking] = useState(false);

  useEffect(() => {
    const checkPasswordStatus = async () => {
      // Attendre que tout soit chargé
      if (loading || profileLoading) return;
      if (!user || !session) return;
      if (isChecking) return;

      // Ne pas boucler si on est déjà sur la page cible
      if (location.pathname === "/auth/set-password") return;

      // ⚡ VÉRIFICATION PRIORITAIRE: localStorage (cache rapide)
      const localStatus = localStorage.getItem(`oauth_password_set_${user.id}`);
      if (localStatus === "true" || localStatus === "skipped") {
        console.log("✅ [OAuthPasswordGate] Étape mot de passe déjà traitée (localStorage)", { status: localStatus });
        localStorage.removeItem("needs_oauth_password");
        return;
      }

      // ⚡ Vérifier le AMR (Authentication Methods Reference) pour savoir
      // COMMENT l'utilisateur s'est connecté dans cette session
      const amr = (session.user as any)?.amr as Array<{ method?: string }> | undefined;
      const currentAuthMethod = amr?.[0]?.method;

      // ✅ Si l'utilisateur s'est connecté avec email/password, il a DÉJÀ un mot de passe
      // → Ne PAS afficher la page de définition de mot de passe
      if (currentAuthMethod === "password") {
        console.log("🔐 [OAuthPasswordGate] Connexion par mot de passe détectée, bypass de la gate");

        // Marquer has_password = true en BDD (async, non-bloquant)
        if (profile && profile.has_password !== true) {
          supabase
            .from('profiles')
            .update({ has_password: true })
            .eq('id', user.id)
            .then(() => {
              console.log("✅ [OAuthPasswordGate] has_password mis à jour en BDD");
            });
        }

        // Nettoyer les flags localStorage et marquer comme traité
        localStorage.removeItem("needs_oauth_password");
        localStorage.setItem(`oauth_password_set_${user.id}`, "true");
        return;
      }

      // Vérifier si c'est un utilisateur OAuth
      const appProvider = session.user?.app_metadata?.provider;
      const identities = (session.user as any)?.identities as Array<{ provider?: string }> | undefined;
      const identityProviders = (identities || []).map((i) => i?.provider).filter(Boolean);

      const hasOAuthIdentity =
        identityProviders.includes("google") ||
        identityProviders.includes("facebook");

      // Si l'utilisateur n'a PAS d'identité OAuth, ne pas appliquer la gate
      if (!hasOAuthIdentity) {
        console.log("🔐 [OAuthPasswordGate] Pas d'identité OAuth, pas de gate");
        return;
      }

      // Vérifier si la méthode actuelle est OAuth
      const isCurrentSessionOAuth = currentAuthMethod === "oauth" ||
        appProvider === "google" ||
        appProvider === "facebook";

      // Si l'utilisateur ne s'est pas connecté via OAuth dans cette session, ignorer
      if (!isCurrentSessionOAuth) {
        console.log("🔐 [OAuthPasswordGate] Session non-OAuth, pas de redirection");
        return;
      }

      // ✅ Vérifier has_password dans le profil (source de vérité = BDD)
      if (profile?.has_password === true) {
        console.log("✅ [OAuthPasswordGate] Mot de passe déjà défini (BDD), pas de redirection");
        localStorage.removeItem("needs_oauth_password");
        localStorage.setItem(`oauth_password_set_${user.id}`, "true");
        return;
      }

      // L'utilisateur OAuth n'a pas de mot de passe → rediriger
      console.log("🔐 [OAuthPasswordGate] OAuth user sans mot de passe -> /auth/set-password", {
        from: location.pathname,
        provider: appProvider,
        currentAuthMethod,
        hasPassword: profile?.has_password,
      });

      localStorage.setItem("needs_oauth_password", "true");
      navigate("/auth/set-password", { replace: true, state: { from: location.pathname } });
    };

    checkPasswordStatus();
  }, [loading, profileLoading, user, session, profile, location.pathname, navigate, isChecking]);

  return null;
}
