import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AlertCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { DisputeService, CreateDisputeRequest } from '@/services/DisputeService';

interface OpenDisputeButtonProps {
  order_id: string;
  escrow_id?: string;
  vendor_id: string;
  onDisputeCreated?: () => void;
}

export function OpenDisputeButton({ order_id, escrow_id, vendor_id, onDisputeCreated }: OpenDisputeButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateDisputeRequest>>({
    order_id,
    escrow_id,
    vendor_id,
    dispute_type: 'not_received',
    request_type: 'full_refund',
    description: '',
    evidence_urls: []
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || formData.description.length < 20) {
      toast.error(t('openDisputeButton.veuillezFournirUneDescriptionDetaillee'));
      return;
    }

    setLoading(true);

    try {
      const result = await DisputeService.createDispute(formData as CreateDisputeRequest);

      if (result.success) {
        toast.success('Litige ouvert', {
          description: `Votre litige a été créé avec succès. Numéro: ${result.dispute?.dispute_number}`
        });
        setOpen(false);
        onDisputeCreated?.();
      } else {
        toast.error('Erreur', {
          description: result.error || 'Impossible d\'ouvrir le litige'
        });
      }
    } catch (error) {
      console.error('[OpenDisputeButton] Error:', error);
      toast.error('Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <AlertCircle className="mr-2 h-4 w-4" />
          Ouvrir un litige
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('openDisputeButton.ouvrirUnLitige')}</DialogTitle>
          <DialogDescription>
            Si vous rencontrez un problème avec votre commande, ouvrez un litige pour le résoudre avec le vendeur.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="dispute_type">{t('openDisputeButton.typeDeProbleme')}</Label>
            <Select
              value={formData.dispute_type}
              onValueChange={(value) => setFormData({ ...formData, dispute_type: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_received">{t('openDisputeButton.produitNonRecu')}</SelectItem>
                <SelectItem value="defective">{t('openDisputeButton.produitDefectueux')}</SelectItem>
                <SelectItem value="incomplete">{t('openDisputeButton.commandeIncomplete')}</SelectItem>
                <SelectItem value="wrong_item">Mauvais article</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">{t('openDisputeButton.descriptionDetaillee')}</Label>
            <Textarea
              id="description"
              placeholder={t('openDisputeButton.expliquezLeProblemeEnDetail')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formData.description?.length || 0} / 20 caractères minimum
            </p>
          </div>

          <div>
            <Label htmlFor="request_type">{t('openDisputeButton.queSouhaitezVous')}</Label>
            <Select
              value={formData.request_type}
              onValueChange={(value) => setFormData({ ...formData, request_type: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_refund">Remboursement complet</SelectItem>
                <SelectItem value="partial_refund">Remboursement partiel</SelectItem>
                <SelectItem value="replacement">Remplacement</SelectItem>
                <SelectItem value="resend">Renvoi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.request_type === 'partial_refund' && (
            <div>
              <Label htmlFor="requested_amount">{t('openDisputeButton.montantDemandeGnf')}</Label>
              <Input
                id="requested_amount"
                type="number"
                placeholder="0"
                value={formData.requested_amount || ''}
                onChange={(e) => setFormData({ ...formData, requested_amount: parseFloat(e.target.value) })}
              />
            </div>
          )}

          <div>
            <Label>{t('openDisputeButton.preuvesPhotosVideos')}</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">
                Glissez vos fichiers ici ou cliquez pour sélectionner
              </p>
              <p className="text-xs text-muted-foreground">
                Photos, vidéos, captures d'écran
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Création...' : 'Ouvrir le litige'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}