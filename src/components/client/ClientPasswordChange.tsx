/**
 * CLIENT PASSWORD CHANGE - 224SOLUTIONS
 * Permet aux clients Supabase Auth de changer leur mot de passe
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface PasswordStrength {
  score: number;
  message: string;
  color: string;
}

const ClientPasswordChange: React.FC = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    message: '',
    color: ''
  });

  // Vérifier la force du mot de passe
  useEffect(() => {
    const password = formData.newPassword;

    if (!password) {
      setPasswordStrength({ score: 0, message: '', color: '' });
      return;
    }

    const timeoutId = setTimeout(() => {
      let score = 0;
      const messages: string[] = [];

      // Longueur
      if (password.length >= 8) score++;
      if (password.length >= 12) score++;
      else messages.push('Au moins 8 caractères');

      // Majuscules
      if (/[A-Z]/.test(password)) score++;
      else messages.push('Une majuscule');

      // Minuscules
      if (/[a-z]/.test(password)) score++;
      else messages.push('Une minuscule');

      // Chiffres
      if (/[0-9]/.test(password)) score++;
      else messages.push('Un chiffre');

      // Caractères spéciaux
      if (/[^A-Za-z0-9]/.test(password)) score++;
      else messages.push('Un caractère spécial');

      const strengthMap: Record<number, { message: string; color: string }> = {
        0: { message: t('clientPasswordChange.tresFaible'), color: 'text-destructive' },
        1: { message: 'Faible', color: 'text-destructive' },
        2: { message: 'Moyen', color: 'text-muted-foreground' },
        3: { message: 'Bon', color: 'text-primary' },
        4: { message: 'Fort', color: 'text-primary' },
        5: { message: t('clientPasswordChange.tresFort'), color: 'text-primary' },
        6: { message: 'Excellent', color: 'text-primary' }
      };

      const strength = strengthMap[Math.min(score, 6)] || { message: '', color: '' };

      setPasswordStrength({
        score,
        message: messages.length > 0 && score < 4 ? `Manquant: ${messages.join(', ')}` : strength.message,
        color: strength.color
      });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [formData.newPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (formData.newPassword.length < 8) {
      toast.error(t('clientPasswordChange.leMotDePasseDoit'));
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error(t('clientPasswordChange.lesMotsDePasseNe'));
      return;
    }

    if (passwordStrength.score < 3) {
      toast.error(t('clientPasswordChange.leMotDePasseEst'));
      return;
    }

    setIsLoading(true);
    try {
      // Utiliser l'API Supabase Auth pour changer le mot de passe
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword
      });

      if (error) {
        console.error('[ClientPasswordChange] Erreur:', error);
        throw error;
      }

      setSuccess(true);
      setFormData({ newPassword: '', confirmPassword: '' });
      toast.success(t('clientPasswordChange.motDePasseModifieAvec'));

      // Réinitialiser après 3 secondes
      setTimeout(() => {
        setSuccess(false);
      }, 3000);

    } catch (error: any) {
      console.error('[ClientPasswordChange] Erreur complète:', error);

      // Gestion des erreurs spécifiques
      if (error.message?.includes('same as the old')) {
        toast.error(t('clientPasswordChange.leNouveauMotDePasse'));
      } else if (error.message?.includes('weak')) {
        toast.error(t('clientPasswordChange.leMotDePasseEst'));
      } else {
        toast.error(error.message || 'Erreur lors du changement de mot de passe');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthBarWidth = () => {
    return `${(passwordStrength.score / 6) * 100}%`;
  };

  const getStrengthBarColor = () => {
    if (passwordStrength.score <= 1) return 'bg-destructive';
    if (passwordStrength.score <= 2) return 'bg-muted-foreground';
    if (passwordStrength.score <= 3) return 'bg-primary';
    return 'bg-primary';
  };

  if (success) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle className="w-16 h-16 text-primary mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Mot de passe modifié !
            </h3>
            <p className="text-sm text-muted-foreground">
              Votre mot de passe a été changé avec succès.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Changer le mot de passe
        </CardTitle>
        <CardDescription>
          Définissez un nouveau mot de passe sécurisé pour votre compte
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nouveau mot de passe */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('clientPasswordChange.nouveauMotDePasse')}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                placeholder="••••••••"
                className="pl-10 pr-10"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>

            {/* Indicateur de force */}
            {formData.newPassword && (
              <div className="space-y-1">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${getStrengthBarColor()}`}
                    style={{ width: getStrengthBarWidth() }}
                  />
                </div>
                <p className={`text-xs ${passwordStrength.color}`}>
                  {passwordStrength.message}
                </p>
              </div>
            )}
          </div>

          {/* Confirmer le mot de passe */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('clientPasswordChange.confirmerLeMotDePasse')}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="••••••••"
                className="pl-10 pr-10"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>

            {/* Vérification de correspondance */}
            {formData.confirmPassword && (
              <p className={`text-xs flex items-center gap-1 ${
                formData.newPassword === formData.confirmPassword
                  ? 'text-[#ff4000]'
                  : 'text-destructive'
              }`}>
                {formData.newPassword === formData.confirmPassword ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    Les mots de passe correspondent
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    Les mots de passe ne correspondent pas
                  </>
                )}
              </p>
            )}
          </div>

          {/* Conseils de sécurité */}
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Utilisez au moins 8 caractères avec des majuscules, minuscules, chiffres et caractères spéciaux.
            </AlertDescription>
          </Alert>

          {/* Bouton de soumission */}
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || passwordStrength.score < 3 || formData.newPassword !== formData.confirmPassword}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Modification...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Changer le mot de passe
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ClientPasswordChange;
