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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEscrowTransactions } from '@/hooks/useEscrowTransactions';

interface VendorDisputeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  escrowId: string;
  orderNumber?: string;
  onSuccess?: () => void;
}

type DisputeReason =
  | 'client_no_response'
  | 'payment_issue'
  | 'delivery_dispute'
  | 'product_returned_damaged'
  | 'fraudulent_claim'
  | 'other';

const disputeReasons: Record<DisputeReason, string> = {
  client_no_response: 'Client ne répond plus',
  payment_issue: 'Problème de paiement',
  delivery_dispute: 'Litige sur la livraison',
  product_returned_damaged: 'Produit retourné endommagé',
  fraudulent_claim: 'Réclamation frauduleuse suspectée',
  other: 'Autre raison'
};

export function VendorDisputeDialog({
  open,
  onOpenChange,
  escrowId,
  orderNumber,
  onSuccess
}: VendorDisputeDialogProps) {
  const { t } = useTranslation();
  const { disputeEscrow } = useEscrowTransactions();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState<DisputeReason>('client_no_response');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description || description.length < 20) {
      toast.error(t('vendorDisputeDialog.veuillezFournirUneDescriptionDetaillee'));
      return;
    }

    setLoading(true);

    try {
      const fullReason = `[${disputeReasons[reason]}] ${description}`;
      await disputeEscrow(escrowId, fullReason);

      toast.success(t('vendorDisputeDialog.litigeOuvertAvecSucces'), {
        description: t('vendorDisputeDialog.unAdministrateurExamineraVotreDemande')
      });

      // Reset form
      setReason('client_no_response');
      setDescription('');

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('[VendorDisputeDialog] Error:', error);
      toast.error(t('vendorDisputeDialog.erreurLorsDeL'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReason('client_no_response');
      setDescription('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Ouvrir un litige
          </DialogTitle>
          <DialogDescription>
            {orderNumber
              ? `Signaler un problème avec la commande ${orderNumber}`
              : 'Signaler un problème avec cette transaction'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Raison du litige */}
          <div className="space-y-2">
            <Label htmlFor="reason">{t('vendorDisputeDialog.raisonDuLitige')}</Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as DisputeReason)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('vendorDisputeDialog.selectionnezUneRaison')} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(disputeReasons).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description détaillée */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('vendorDisputeDialog.descriptionDetaillee')}</Label>
            <Textarea
              id="description"
              placeholder={t('vendorDisputeDialog.expliquezLeProblemeEnDetail')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/20 caractères minimum
            </p>
          </div>

          {/* Avertissement */}
          <div className="bg-orange-50 dark:bg-[#ff4000]/20 border border-orange-200 dark:border-[#ff4000] rounded-lg p-3">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-[#ff4000] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[#ff4000] dark:text-orange-200">
                <p className="font-medium mb-1">Important</p>
                <p>{t('vendorDisputeDialog.unLitigeBloqueraLaTransaction')}</p>
              </div>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="flex-1"
              disabled={loading || description.length < 20}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Ouverture...
                </>
              ) : (
                'Ouvrir le litige'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
