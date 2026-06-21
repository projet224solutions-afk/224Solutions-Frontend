import { useTranslation } from "@/hooks/useTranslation";
/**
 * Dialogs pour modification email et mot de passe bureau
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bureauId: string;
  onSuccess?: () => void;
}

export function ChangePasswordDialog({ open, onOpenChange, bureauId, onSuccess }: ChangePasswordDialogProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.new_password !== formData.confirm_password) {
      toast.error(t('bureauSettingsDialogs.lesMotsDePasseNe'));
      return;
    }

    if (formData.new_password.length < 8) {
      toast.error(t('bureauSettingsDialogs.leNouveauMotDePasse'));
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('change-bureau-password', {
        body: {
          bureau_id: bureauId,
          current_password: formData.current_password,
          new_password: formData.new_password
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(t('bureauSettingsDialogs.motDePasseModifieAvec'));
        setFormData({ current_password: '', new_password: '', confirm_password: '' });
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(data.message || 'Erreur lors de la modification');
      }
    } catch (error: any) {
      console.error('Erreur changement mot de passe:', error);
      toast.error(error.message || 'Erreur lors de la modification du mot de passe');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#ff4000]" />
            Modifier le mot de passe
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current_password">{t('bureauSettingsDialogs.motDePasseActuel')}</Label>
            <div className="relative">
              <Input
                id="current_password"
                type={showCurrentPassword ? 'text' : 'password'}
                required
                value={formData.current_password}
                onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new_password">{t('bureauSettingsDialogs.nouveauMotDePasseMin')}</Label>
            <div className="relative">
              <Input
                id="new_password"
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={formData.new_password}
                onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">{t('bureauSettingsDialogs.confirmerLeNouveauMotDe')}</Label>
            <div className="relative">
              <Input
                id="confirm_password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-[#ff4000] to-[#ff4000]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Modification...
                </>
              ) : (
                'Modifier le mot de passe'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ChangeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bureauId: string;
  currentEmail: string;
  onSuccess?: () => void;
}

export function ChangeEmailDialog({ open, onOpenChange, bureauId, currentEmail, onSuccess }: ChangeEmailDialogProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEmail.trim()) {
      toast.error(t('bureauSettingsDialogs.veuillezEntrerUnEmail'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error('Format d\'email invalide');
      return;
    }

    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      toast.error(t('bureauSettingsDialogs.leNouvelEmailDoitEtre'));
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-bureau-email', {
        body: {
          bureau_id: bureauId,
          new_email: newEmail.toLowerCase()
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(t('bureauSettingsDialogs.emailModifieAvecSucces'));
        setNewEmail('');
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(data.error || 'Erreur lors de la modification');
      }
    } catch (error: any) {
      console.error('Erreur changement email:', error);
      toast.error(error.message || 'Erreur lors de la modification de l\'email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Modifier l'email
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Email actuel</Label>
            <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded">{currentEmail}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new_email">Nouvel email *</Label>
            <Input
              id="new_email"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t('bureauSettingsDialogs.nouveauEmailCom')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-[#04439e]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Modification...
                </>
              ) : (
                'Modifier l\'email'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
