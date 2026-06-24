/**
 * 🔐 Page dédiée de réinitialisation de mot de passe
 * Route: /reset-password
 * Détecte les tokens dans l'URL (hash ou query), établit la session,
 * et affiche le formulaire de nouveau mot de passe.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, KeyRound, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";

type PageState = "loading" | "form" | "expired" | "success";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [state, setState] = useState<PageState>("loading");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);

  // Detect tokens and establish session
  useEffect(() => {
    const init = async () => {
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);

      // Check for error in URL
      const errorDesc = hashParams.get("error_description") || queryParams.get("error_description");
      if (errorDesc) {
        console.error("✕ [ResetPassword] Error in URL:", errorDesc);
        setState("expired");
        setError(decodeURIComponent(errorDesc));
        window.history.replaceState({}, document.title, "/reset-password");
        return;
      }

      // Extract tokens from hash or query
      const accessToken = hashParams.get("access_token") || queryParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token");
      const code = queryParams.get("code");
      const tokenHash = queryParams.get("token_hash");
      const type = hashParams.get("type") || queryParams.get("type");

      console.log("🔍 [ResetPassword] Detecting tokens:", {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        hasCode: !!code,
        hasTokenHash: !!tokenHash,
        type,
      });

      // Supabase PKCE flow: exchange code for session
      if (code) {
        try {
          const { data, error: codeError } = await supabase.auth.exchangeCodeForSession(code);
          if (codeError) throw codeError;

          if (data.session) {
            console.log("✓ [ResetPassword] Session established from code");
            setState("form");
            window.history.replaceState({}, document.title, "/reset-password");
            return;
          }
        } catch (e) {
          console.error("✕ [ResetPassword] exchangeCodeForSession failed:", e);
        }
      }

      // Supabase token_hash flow: verify OTP recovery token
      if (tokenHash) {
        try {
          const { data, error: otpError } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: tokenHash,
          });

          if (otpError) throw otpError;

          if (data.session) {
            console.log("✓ [ResetPassword] Session established from token_hash");
            setState("form");
            window.history.replaceState({}, document.title, "/reset-password");
            return;
          }
        } catch (e) {
          console.error("✕ [ResetPassword] verifyOtp failed:", e);
        }
      }

      // If we have tokens, set the session
      if (accessToken && refreshToken) {
        try {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) throw sessionError;

          if (data.session) {
            console.log("✓ [ResetPassword] Session established");
            setState("form");
            window.history.replaceState({}, document.title, "/reset-password");
            return;
          }
        } catch (e) {
          console.error("✕ [ResetPassword] setSession failed:", e);
        }
      }

      // Fallback: check if there's already an active recovery session
      // (Supabase may have auto-processed the hash)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log("✓ [ResetPassword] Existing session found");
        setState("form");
        window.history.replaceState({}, document.title, "/reset-password");
        return;
      }

      // Also listen for PASSWORD_RECOVERY event briefly
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && type === "recovery")) {
          console.log("🔐 [ResetPassword] PASSWORD_RECOVERY event");
          setState("form");
          window.history.replaceState({}, document.title, "/reset-password");
          subscription.unsubscribe();
        }
      });

      // Give Supabase a moment to process
      await new Promise((r) => setTimeout(r, 1500));

      // Final check
      const { data: { session: finalSession } } = await supabase.auth.getSession();
      if (finalSession) {
        setState("form");
      } else {
        setState("expired");
      }

      window.history.replaceState({}, document.title, "/reset-password");
      subscription.unsubscribe();
    };

    init();
  }, []);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return "Le mot de passe doit faire au moins 8 caractères";
    if (!/[A-Z]/.test(pwd)) return "Le mot de passe doit contenir au moins une majuscule";
    if (!/[a-z]/.test(pwd)) return "Le mot de passe doit contenir au moins une minuscule";
    if (!/[0-9]/.test(pwd)) return "Le mot de passe doit contenir au moins un chiffre";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const validationError = validatePassword(newPassword);
      if (validationError) throw new Error(validationError);

      if (newPassword !== confirmPassword) {
        throw new Error("Les mots de passe ne correspondent pas");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Session expirée. Veuillez demander un nouveau lien.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      console.log("✓ [ResetPassword] Password updated");
      await supabase.auth.signOut();
      setState("success");

      toast({
        title: t('resetPassword.motDePasseMisA'),
        description: t('resetPassword.vousPouvezMaintenantVousConnecter'),
      });

      setTimeout(() => navigate("/auth"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message: t('resetPassword.uneErreurEstSurvenue'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!resendEmail.trim()) {
      setError("Veuillez saisir votre adresse email");
      return;
    }
    setResending(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resendEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: t('resetPassword.lienEnvoye'),
        description: t('resetPassword.unNouveauLienDeReinitialisation'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message: t('resetPassword.erreurLorsDeLEnvoi'));
    } finally {
      setResending(false);
    }
  };

  const passwordStrength = (() => {
    if (!newPassword) return { score: 0, label: "", color: "" };
    let s = 0;
    if (newPassword.length >= 8) s++;
    if (newPassword.length >= 12) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[a-z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    if (s <= 2) return { score: s, label: "Faible", color: "bg-destructive" };
    if (s <= 4) return { score: s, label: "Moyen", color: "bg-[#ff4000]" };
    return { score: s, label: "Fort", color: "bg-[#ff4000]" };
  })();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold text-foreground">
            {state === "success"
              ? "Mot de passe mis à jour !"
              : state === "expired"
              ? "Lien expiré"
              : "Nouveau mot de passe"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {state === "loading" && "Vérification du lien..."}
            {state === "form" && "Choisissez un nouveau mot de passe sécurisé"}
            {state === "expired" && "Ce lien n'est plus valide. Demandez-en un nouveau."}
            {state === "success" && "Redirection vers la connexion..."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Loading */}
          {state === "loading" && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t('resetPassword.verificationEnCours')}</p>
            </div>
          )}

          {/* Success */}
          {state === "success" && (
            <div className="flex flex-col items-center py-8 gap-3">
              <CheckCircle2 className="w-12 h-12 text-[#ff4000]" />
              <p className="text-sm text-muted-foreground">{t('resetPassword.redirectionVersLaConnexion')}</p>
            </div>
          )}

          {/* Expired / Invalid */}
          {state === "expired" && (
            <div className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="resend-email">{t('resetPassword.votreAdresseEmail')}</Label>
                <Input
                  id="resend-email"
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                />
              </div>
              <Button onClick={handleResend} disabled={resending} className="w-full">
                {resending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Envoi...</>
                ) : (
                  "Renvoyer un lien de réinitialisation"
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/auth")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Retour à la connexion
              </Button>
            </div>
          )}

          {/* Password Form */}
          {state === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="new-password">{t('resetPassword.nouveauMotDePasse')}</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPassword && (
                  <div className="space-y-1">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{passwordStrength.label}</p>
                  </div>
                )}
                <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
                  <li className={newPassword.length >= 8 ? "text-[#ff4000]" : ""}>
                    • Au moins 8 caractères
                  </li>
                  <li className={/[A-Z]/.test(newPassword) ? "text-[#ff4000]" : ""}>
                    • Une majuscule
                  </li>
                  <li className={/[a-z]/.test(newPassword) ? "text-[#ff4000]" : ""}>
                    • Une minuscule
                  </li>
                  <li className={/[0-9]/.test(newPassword) ? "text-[#ff4000]" : ""}>
                    • Un chiffre
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('resetPassword.confirmerLeMotDePasse')}</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">{t('resetPassword.lesMotsDePasseNe')}</p>
                )}
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('resetPassword.miseAJour')}</>
                ) : (
                  "Mettre à jour le mot de passe"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
