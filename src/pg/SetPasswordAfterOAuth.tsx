/**
 * Page de définition de mot de passe pour les utilisateurs OAuth
 * Affichée après la première connexion via Google/Facebook
 *
 * WORKFLOW:
 * - Utilisateur OAuth (Google/Facebook) → DOIT définir un mot de passe (obligatoire)
 * - Utilisateur email/password → Redirigé automatiquement vers son dashboard
 * - Une fois le mot de passe défini, l'utilisateur ne reverra jamais cette page
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Lock, Eye, EyeOff, Loader2, CheckCircle2, Shield,
  AlertCircle, Mail, ArrowRight, ChevronDown, ChevronUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardRoute } from '@/hooks/useRoleRedirect';
import { resolvePostAuthRoute } from '@/utils/postAuthRoute';
import { useTranslation } from '@/hooks/useTranslation';

export default function SetPasswordAfterOAuth() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile, loading: authLoading, profileLoading } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(true);
  const submitRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Observer pour détecter si le bouton submit est visible
  useEffect(() => {
    if (!submitRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowScrollDown(!entry.isIntersecting),
      { threshold: 0.5 }
    );
    observer.observe(submitRef.current);
    return () => observer.disconnect();
  }, [checkingStatus, success]);

  const handleScrollToggle = () => {
    if (showScrollDown) {
      submitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Vérifications de sécurité du mot de passe
  const passwordChecks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    matches: password === confirmPassword && password.length > 0,
  };

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  // Fonction pour rediriger vers le bon dashboard (service-aware)
  const redirectToProperDashboard = async () => {
    const oauthShopType = localStorage.getItem('oauth_vendor_shop_type');
    let targetRoute = getDashboardRoute(profile?.role);

    if (user?.id && profile?.role) {
      targetRoute = await resolvePostAuthRoute({
        userId: user.id,
        role: profile.role,
        vendorShopType: oauthShopType,
      });
    }

    // Nettoyer les flags après utilisation
    localStorage.removeItem('oauth_vendor_shop_type');
    localStorage.removeItem('oauth_service_type');

    console.log(`🚀 [SetPasswordAfterOAuth] Redirection vers ${targetRoute}`);
    navigate(targetRoute, { replace: true });
  };

  // Vérifier si l'utilisateur doit voir cette page
  useEffect(() => {
    const checkUserStatus = async () => {
      // Attendre que l'auth soit chargée
      if (authLoading) return;

      // Pas d'utilisateur → rediriger vers /auth
      if (!user) {
        navigate('/auth', { replace: true });
        return;
      }

      // Attendre que le profil soit chargé
      if (profileLoading) return;

      // ⚠ Récupérer la session actuelle pour vérifier la méthode de connexion
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      // ⚠ Vérifier le AMR (Authentication Methods Reference) pour savoir
      // COMMENT l'utilisateur s'est connecté dans cette session
      const amr = (session?.user as any)?.amr as Array<{ method?: string }> | undefined;
      const currentAuthMethod = amr?.[0]?.method;

      const provider = user.app_metadata?.provider;
      const isOAuthProvider = provider === 'google' || provider === 'facebook';

      // ✓ Si l'utilisateur s'est connecté avec mot de passe (peu importe le provider d'origine)
      // → Il a DÉJÀ un mot de passe, rediriger directement
      if (currentAuthMethod === 'password') {
        console.log('🔐 [SetPasswordAfterOAuth] Connexion par mot de passe détectée, mise à jour et redirection...');

        // Marquer has_password = true en BDD
        if (profile?.has_password !== true) {
          await supabase
            .from('profiles')
            .update({ has_password: true })
            .eq('id', user.id);
        }

        localStorage.removeItem('needs_oauth_password');
        localStorage.setItem(`oauth_password_set_${user.id}`, 'true');
        redirectToProperDashboard();
        return;
      }

      console.log('🔍 [SetPasswordAfterOAuth] Vérification:', {
        provider,
        isOAuthProvider,
        currentAuthMethod,
        hasPassword: profile?.has_password
      });

      // ✓ Si ce n'est PAS un utilisateur OAuth d'origine, rediriger directement
      if (!isOAuthProvider) {
        console.log('🔐 [SetPasswordAfterOAuth] Utilisateur email d\'origine, redirection...');
        localStorage.removeItem('needs_oauth_password');
        redirectToProperDashboard();
        return;
      }

      // ✓ Si l'utilisateur OAuth a déjà défini un mot de passe (vérifié en BDD)
      if (profile?.has_password === true) {
        console.log('✓ [SetPasswordAfterOAuth] Mot de passe déjà défini (BDD), redirection...');
        localStorage.removeItem('needs_oauth_password');
        localStorage.setItem(`oauth_password_set_${user.id}`, 'true');
        redirectToProperDashboard();
        return;
      }

      // ✓ Fallback: si l'utilisateur a déjà validé/ignoré cette étape en local
      const localStatus = localStorage.getItem(`oauth_password_set_${user.id}`);
      if (localStatus === 'true' || localStatus === 'skipped') {
        console.log('✓ [SetPasswordAfterOAuth] Étape déjà traitée (localStorage), redirection...', { localStatus });
        localStorage.removeItem('needs_oauth_password');
        redirectToProperDashboard();
        return;
      }

      // L'utilisateur OAuth doit définir son mot de passe
      console.log('🔐 [SetPasswordAfterOAuth] Utilisateur OAuth sans mot de passe, affichage du formulaire');
      setCheckingStatus(false);
    };

    checkUserStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, authLoading, profileLoading, navigate]);

  const _handleSkipPassword = async () => {
    if (!user) return;

    // Marquer has_password = true en BDD même si "skipped" pour ne plus revoir cette page
    try {
      await supabase
        .from('profiles')
        .update({ has_password: true })
        .eq('id', user.id);
    } catch (err) {
      console.error('Erreur mise à jour profil:', err);
    }

    localStorage.removeItem('needs_oauth_password');
    localStorage.setItem(`oauth_password_set_${user.id}`, 'skipped');
    toast.message(t('auth.setPassword.skipMessage'));
    redirectToProperDashboard();
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid) {
      setError(t('auth.setPassword.criteriaError'));
      return;
    }

    setLoading(true);

    try {
      // 1. Mettre à jour le mot de passe dans Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      // 2. Marquer has_password = true dans le profil (persisté en BDD)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ has_password: true })
        .eq('id', user?.id);

      if (profileError) {
        console.error('Erreur mise à jour profil (has_password):', profileError);
        // Ne pas bloquer, le mot de passe est déjà défini dans Auth
      }

      // 3. Nettoyer les flags localStorage (backup)
      localStorage.removeItem('needs_oauth_password');
      localStorage.setItem(`oauth_password_set_${user?.id}`, 'true');

      setSuccess(true);
      toast.success(t('auth.setPassword.success'));

      // Rediriger après un court délai
      setTimeout(() => {
        redirectToProperDashboard();
      }, 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message: t('setPasswordAfterOAuth.erreurLorsDeLaDefinition');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Affichage pendant la vérification
  if (checkingStatus || authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('auth.setPassword.checking')}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-[#ff4000]" />
            </div>
            <h2 className="text-xl font-bold text-[#ff4000]">{t('auth.setPassword.success')}</h2>
            <p className="text-muted-foreground">
              {t('auth.setPassword.successDesc')}
            </p>
            <div className="pt-4">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">{t('auth.setPassword.redirecting')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div ref={topRef} className="absolute top-0" />
      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
        <CardHeader className="bg-primary/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">{t('auth.setPassword.title')}</CardTitle>
              <CardDescription>{t('auth.setPassword.subtitle')}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Message d'information - OBLIGATOIRE */}
          <Alert className="bg-orange-50 border-orange-200">
            <Shield className="h-4 w-4 text-[#ff4000]" />
            <AlertDescription className="text-[#ff4000]">
              <strong>{t('auth.setPassword.mandatory')}</strong><br />
              {t('auth.setPassword.mandatoryDesc')}
              <br /><br />
              <span className="text-sm opacity-90">
                {t('auth.setPassword.mandatoryHint')}
              </span>
            </AlertDescription>
          </Alert>

          {/* Email affiché */}
          <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{t('auth.setPassword.accountEmail')}</p>
              <p className="font-medium">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSetPassword} className="space-y-4">
            {/* Nouveau mot de passe */}
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.setPassword.newPassword')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="h-12 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirmer mot de passe */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('auth.setPassword.confirmPassword')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="h-12 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Indicateurs de sécurité */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {t('auth.setPassword.securityCriteria')}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <PasswordCheck
                  valid={passwordChecks.minLength}
                  label={t('auth.setPassword.minChars')}
                />
                <PasswordCheck
                  valid={passwordChecks.hasUppercase}
                  label={t('auth.setPassword.uppercase')}
                />
                <PasswordCheck
                  valid={passwordChecks.hasLowercase}
                  label={t('auth.setPassword.lowercase')}
                />
                <PasswordCheck
                  valid={passwordChecks.hasNumber}
                  label={t('auth.setPassword.number')}
                />
                <PasswordCheck
                  valid={passwordChecks.matches}
                  label={t('auth.setPassword.match')}
                  className="col-span-2"
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Bouton d'action */}
            <div className="pt-2" ref={submitRef}>
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold"
                disabled={loading || !isPasswordValid}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t('auth.setPassword.saving')}
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-5 w-5" />
                    {t('auth.setPassword.submit')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Bouton flottant de défilement */}
      <button
        type="button"
        onClick={handleScrollToggle}
        className="fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 flex items-center justify-center hover:bg-primary/90 transition-all active:scale-95"
        aria-label={showScrollDown ? 'Défiler vers le bas' : 'Défiler vers le haut'}
      >
        {showScrollDown ? <ChevronDown className="h-6 w-6" /> : <ChevronUp className="h-6 w-6" />}
      </button>
    </div>
  );
}

function PasswordCheck({
  valid,
  label,
  className = ''
}: {
  valid: boolean;
  label: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
        valid ? 'bg-orange-100 text-[#ff4000]' : 'bg-muted text-muted-foreground'
      }`}>
        {valid ? (
          <CheckCircle2 className="h-3 w-3" />
        ) : (
          <div className="w-1.5 h-1.5 bg-current rounded-full" />
        )}
      </div>
      <span className={valid ? 'text-[#ff4000]' : 'text-muted-foreground'}>
        {label}
      </span>
    </div>
  );
}
