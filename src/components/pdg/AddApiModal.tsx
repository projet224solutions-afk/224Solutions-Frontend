/**
 * ➕ MODAL AJOUT API - 224SOLUTIONS
 * Permet d'ajouter rapidement une API avec chiffrement automatique
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiMonitoringService } from '@/services/apiMonitoring';
import { encryptApiKey } from '@/services/apiEncryption';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AddApiModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddApiModal({ open, onClose, onSuccess }: AddApiModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    api_name: '',
    api_provider: '',
    api_type: 'other' as 'payment' | 'sms' | 'email' | 'storage' | 'other',
    api_key: '',
    base_url: '',
    tokens_limit: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.api_name || !formData.api_provider || !formData.api_key) {
      toast.error(t('addApiModal.veuillezRemplirTousLesChamps'));
      return;
    }

    setLoading(true);
    try {
      // Récupérer l'utilisateur actuel
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('addApiModal.vousDevezEtreConnecte'));
        return;
      }

      // Chiffrer la clé API
      const { encrypted, iv } = encryptApiKey(formData.api_key);

      // Créer la connexion API
      const apiConnection = {
        api_name: formData.api_name,
        api_provider: formData.api_provider,
        api_type: formData.api_type,
        api_key_encrypted: encrypted,
        encryption_iv: iv,
        base_url: formData.base_url || undefined,
        tokens_limit: formData.tokens_limit ? parseInt(formData.tokens_limit) : undefined,
        tokens_used: 0,
        status: 'active' as const,
        created_by: user.id,
        metadata: {
          added_via: 'pdg_interface',
          added_at: new Date().toISOString(),
        },
      };

      const result = await ApiMonitoringService.addApiConnection(apiConnection);

      if (result) {
        const healthCheck = await backendFetch(`/api/core/supervision/api-connections/${result.id}/health-check`, {
          method: 'POST',
        });

        if (healthCheck.success) {
          const payload = healthCheck.data as {
            isWorking?: boolean;
            httpStatus?: number | null;
            error?: string | null;
          };

          if (payload?.isWorking) {
            toast.success(`API testee avec succes${payload.httpStatus ? ` (HTTP ${payload.httpStatus})` : ''}`);
          } else {
            toast.warning(`API ajoutee mais test de sante en echec${payload?.error ? `: ${payload.error}` : ''}`);
          }
        } else {
          toast.warning(t('addApiModal.apiAjouteeMaisTestDe'));
        }

        toast.success(t('addApiModal.apiAjouteeAvecSucces'));
        onSuccess();
        onClose();

        // Réinitialiser le formulaire
        setFormData({
          api_name: '',
          api_provider: '',
          api_type: 'other',
          api_key: '',
          base_url: '',
          tokens_limit: '',
        });
      }
    } catch (error) {
      console.error('Erreur ajout API:', error);
      toast.error(t('addApiModal.erreurLorsDeLAjout'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('addApiModal.ajouterUneNouvelleApi')}</DialogTitle>
          <DialogDescription>
            Connectez une nouvelle API à 224SOLUTIONS avec chiffrement AES-256
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="api_name">{t('addApiModal.nomDeLApi')}</Label>
            <Input
              id="api_name"
              placeholder="Ex: OpenAI GPT-4"
              value={formData.api_name}
              onChange={(e) => setFormData({ ...formData, api_name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_provider">Fournisseur *</Label>
            <Input
              id="api_provider"
              placeholder="Ex: OpenAI, Stripe, Twilio"
              value={formData.api_provider}
              onChange={(e) => setFormData({ ...formData, api_provider: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_type">Type d'API *</Label>
            <Select
              value={formData.api_type}
              onValueChange={(value) => setFormData({ ...formData, api_type: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="payment">{t('addApiModal.paiement')}</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="storage">Stockage</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_key">{t('addApiModal.cleApi')}</Label>
            <Input
              id="api_key"
              type="password"
              placeholder={t('addApiModal.votreCleApiSeraChiffree')}
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              🔒 Sera chiffrée avec AES-256 avant stockage
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="base_url">{t('addApiModal.urlDeBaseOptionnel')}</Label>
            <Input
              id="base_url"
              placeholder="https://api.exemple.com"
              value={formData.base_url}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tokens_limit">{t('addApiModal.limiteDeTokensOptionnel')}</Label>
            <Input
              id="tokens_limit"
              type="number"
              placeholder="Ex: 1000000"
              value={formData.tokens_limit}
              onChange={(e) => setFormData({ ...formData, tokens_limit: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter l'API
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
