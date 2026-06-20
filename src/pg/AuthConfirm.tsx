import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Status = 'verifying' | 'success' | 'error';

export default function AuthConfirm() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendEmail, setResendEmail] = useState('');

  useEffect(() => {
    const confirm = async () => {
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');
      const errorDesc = searchParams.get('error_description');

      // Erreur explicite renvoyée par Supabase dans l'URL
      if (errorParam) {
        setStatus('error');
        setErrorMessage(errorDesc || errorParam);
        return;
      }

      // ── Cas 1 : PKCE code exchange ──────────────────────────────────
      // Supabase en mode PKCE (production) redirige avec ?code=XXX après
      // avoir vérifié l'email côté serveur. On échange le code contre une session.
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus('error');
          setErrorMessage(error.message || 'Lien invalide ou expiré.');
        } else {
          setStatus('success');
          setTimeout(() => navigate('/home', { replace: true }), 2000);
        }
        return;
      }

      // ── Cas 2 : token_hash OTP (template custom) ─────────────────────
      // Le template confirmation.html construit l'URL avec token_hash + type.
      if (tokenHash) {
        // Supabase attend exactement le type retourné dans l'URL.
        // On essaie d'abord avec le type de l'URL, puis avec les alternatives.
        const otpType = (type as any) || 'email';

        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });

        if (!error) {
          setStatus('success');
          setTimeout(() => navigate('/home', { replace: true }), 2000);
          return;
        }

        // Fallback : si le type 'email' échoue, essayer 'signup' (ancien format Supabase)
        if (otpType === 'email') {
          const { error: err2 } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'signup' });
          if (!err2) {
            setStatus('success');
            setTimeout(() => navigate('/home', { replace: true }), 2000);
            return;
          }
        }

        setStatus('error');
        setErrorMessage(error.message || 'Lien invalide ou expiré. Il est peut-être déjà utilisé ou périmé (24h).');
        return;
      }

      // ── Cas 3 : fragment hash (implicit flow héritage) ────────────────
      // detectSessionInUrl: true dans le client gère ce cas automatiquement.
      // On attend un court instant puis on vérifie si une session existe.
      if (window.location.hash.includes('access_token')) {
        await new Promise(r => setTimeout(r, 1000));
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setStatus('success');
          setTimeout(() => navigate('/home', { replace: true }), 2000);
        } else {
          setStatus('error');
          setErrorMessage('Impossible d\'établir la session. Veuillez vous connecter manuellement.');
        }
        return;
      }

      // Aucun paramètre reconnu
      setStatus('error');
      setErrorMessage('Lien de confirmation invalide ou manquant.');
    };

    confirm();
  }, [searchParams, navigate]);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: resendEmail });
      if (error) throw error;
      setErrorMessage('Un nouvel email de confirmation a été envoyé.');
    } catch {
      setErrorMessage('Impossible de renvoyer l\'email. Vérifiez l\'adresse saisie.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">

        {/* Vérification en cours */}
        {status === 'verifying' && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">{t('authConfirm.verificationEnCours')}</h1>
            <p className="text-muted-foreground text-sm">
              Nous confirmons votre adresse email, veuillez patienter.
            </p>
          </div>
        )}

        {/* Succès */}
        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-orange-50 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-[#ff4000]" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">{t('authConfirm.emailConfirme')}</h1>
            <p className="text-muted-foreground text-sm">
              Votre compte est activé. Vous allez être redirigé vers l'accueil…
            </p>
            <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
              <div className="bg-[#ff4000] h-1 animate-[progress_2s_linear_forwards]" style={{ width: '100%', animationName: 'none', transition: 'width 2s linear' }} />
            </div>
          </div>
        )}

        {/* Erreur */}
        {status === 'error' && (
          <div className="space-y-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-orange-50 flex items-center justify-center">
              <XCircle className="w-9 h-9 text-[#ff4000]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground mb-2">Lien invalide</h1>
              <p className="text-muted-foreground text-sm">{errorMessage}</p>
            </div>

            {/* Renvoyer l'email */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium">{t('authConfirm.renvoyerLEmailDeConfirmation')}</p>
              </div>
              <input
                type="email"
                placeholder={t('authConfirm.votreAdresseEmail')}
                value={resendEmail}
                onChange={e => setResendEmail(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                onClick={handleResend}
                disabled={resendLoading || !resendEmail}
                className="w-full gap-2"
                size="sm"
              >
                {resendLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />}
                Renvoyer l'email
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Se connecter
              </Link>
              <Link
                to="/auth"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Créer un nouveau compte
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
