import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Eye, EyeOff, CheckCircle2, XCircle, AlertCircle, Chrome } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';

const passwordSchema = z.string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères")
  .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
  .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre")
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/, "Le mot de passe doit contenir au moins un caractère spécial");

export default function VendorPasswordChange() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOAuthUser, setIsOAuthUser] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<string | null>(null);
  const [checkingAuthMethod, setCheckingAuthMethod] = useState(true);

  // ⚡ Détecter si l'utilisateur s'est connecté via OAuth (Google, Facebook, etc.)
  useEffect(() => {
    const checkAuthMethod = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Vérifier les identités de l'utilisateur (OAuth providers)
          const identities = user.identities || [];
          const oauthIdentity = identities.find(id =>
            id.provider === 'google' ||
            id.provider === 'facebook' ||
            id.provider === 'twitter' ||
            id.provider === 'github' ||
            id.provider === 'apple'
          );

          if (oauthIdentity) {
            setIsOAuthUser(true);
            setOauthProvider(oauthIdentity.provider);
            console.log('🔐 Utilisateur OAuth détecté:', oauthIdentity.provider);
          } else {
            // Vérifier aussi app_metadata.provider
            const provider = user.app_metadata?.provider;
            if (provider && provider !== 'email') {
              setIsOAuthUser(true);
              setOauthProvider(provider);
              console.log('🔐 Utilisateur OAuth (via app_metadata):', provider);
            }
          }
        }
      } catch (error) {
        console.error('Erreur vérification méthode auth:', error);
      } finally {
        setCheckingAuthMethod(false);
      }
    };

    checkAuthMethod();
  }, []);

  // Validation en temps réel
  const passwordChecks = {
    length: newPassword.length >= 8,
    lowercase: /[a-z]/.test(newPassword),
    uppercase: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword),
    match: newPassword === confirmPassword && newPassword.length > 0
  };

  const allChecksPass = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ⚡ Pour les utilisateurs OAuth, pas besoin de mot de passe actuel
    if (!isOAuthUser && !currentPassword.trim()) {
      toast.error(t('vendorPasswordChange.veuillezEntrerVotreMotDe'));
      return;
    }

    // Validation du nouveau mot de passe
    const validation = passwordSchema.safeParse(newPassword);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0];
      toast.error(firstIssue.message);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('vendorPasswordChange.lesMotsDePasseNe'));
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error(t('vendorPasswordChange.impossibleDeRecupererLesInformations'));
        return;
      }

      // ⚡ Pour les utilisateurs NON-OAuth, vérifier le mot de passe actuel
      if (!isOAuthUser) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword
        });

        if (signInError) {
          toast.error(t('vendorPasswordChange.leMotDePasseActuel'));
          setLoading(false);
          return;
        }
      }

      // Mettre à jour le mot de passe
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        toast.error(`Erreur: ${updateError.message}`);
        return;
      }

      toast.success(isOAuthUser
        ? "Mot de passe défini avec succès ! Vous pouvez maintenant vous connecter avec email + mot de passe."
        : "Mot de passe modifié avec succès"
      );

      // Réinitialiser les champs
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Si c'était un utilisateur OAuth, il a maintenant un mot de passe
      if (isOAuthUser) {
        setIsOAuthUser(false);
        setOauthProvider(null);
      }
    } catch (error: any) {
      console.error('Erreur changement mot de passe:', error);
      toast.error(t('vendorPasswordChange.uneErreurEstSurvenue'));
    } finally {
      setLoading(false);
    }
  };

  const PasswordCheck = ({ passed, label }: { passed: boolean; label: string }) => (
    <div className={`flex items-center gap-2 text-sm ${passed ? 'text-[#ff4000]' : 'text-muted-foreground'}`}>
      {passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      {label}
    </div>
  );

  const getProviderIcon = () => {
    switch (oauthProvider) {
      case 'google':
        return <Chrome className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getProviderName = () => {
    switch (oauthProvider) {
      case 'google':
        return 'Google';
      case 'facebook':
        return 'Facebook';
      case 'twitter':
        return 'Twitter';
      case 'github':
        return 'GitHub';
      case 'apple':
        return 'Apple';
      default:
        return oauthProvider || 'OAuth';
    }
  };

  if (checkingAuthMethod) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="text-sm text-muted-foreground">{t('vendorPasswordChange.verification')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          {isOAuthUser ? 'Définir un mot de passe' : 'Modifier le mot de passe'}
        </CardTitle>
        <CardDescription>
          {isOAuthUser
            ? 'Vous êtes connecté via ' + getProviderName() + '. Définissez un mot de passe pour pouvoir aussi vous connecter par email.'
            : 'Changez votre mot de passe de connexion'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* ⚡ Alerte pour les utilisateurs OAuth */}
        {isOAuthUser && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <div className="flex items-center gap-2">
              {getProviderIcon()}
              <AlertDescription className="text-blue-800">
                <strong>Compte {getProviderName()}</strong> - Vous n'avez pas encore de mot de passe.
                En définissant un mot de passe, vous pourrez aussi vous connecter avec votre email.
              </AlertDescription>
            </div>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mot de passe actuel - Seulement pour les utilisateurs NON-OAuth */}
          {!isOAuthUser && (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('vendorPasswordChange.motDePasseActuel')}</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('vendorPasswordChange.entrezVotreMotDePasse')}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Nouveau mot de passe */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">
              {isOAuthUser ? 'Nouveau mot de passe' : 'Nouveau mot de passe'}
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={isOAuthUser ? "Créez votre mot de passe" : "Entrez votre nouveau mot de passe"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Indicateurs de validation */}
          {newPassword.length > 0 && (
            <div className="grid grid-cols-2 gap-2 p-4 bg-muted/50 rounded-lg">
              <PasswordCheck passed={passwordChecks.length} label={t('vendorPasswordChange.t8CaracteresMinimum')} />
              <PasswordCheck passed={passwordChecks.lowercase} label={t('vendorPasswordChange.uneMinuscule')} />
              <PasswordCheck passed={passwordChecks.uppercase} label={t('vendorPasswordChange.uneMajuscule')} />
              <PasswordCheck passed={passwordChecks.number} label={t('vendorPasswordChange.unChiffre')} />
              <PasswordCheck passed={passwordChecks.special} label={t('vendorPasswordChange.unCaractereSpecial')} />
              <PasswordCheck passed={passwordChecks.match} label={t('vendorPasswordChange.motsDePasseIdentiques')} />
            </div>
          )}

          {/* Confirmation mot de passe */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('vendorPasswordChange.confirmerLeNouveauMotDe')}</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('vendorPasswordChange.confirmezVotreNouveauMotDe')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !allChecksPass || (!isOAuthUser && !currentPassword)}
            className="w-full"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {isOAuthUser ? 'Définition en cours...' : 'Modification en cours...'}
              </span>
            ) : (
              isOAuthUser ? "Définir le mot de passe" : "Modifier le mot de passe"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
