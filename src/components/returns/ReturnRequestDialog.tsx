import { useTranslation } from "@/hooks/useTranslation";
import { useState } from 'react';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Undo2 } from 'lucide-react';

const REASONS = [
  { value: 'defective', label: 'Produit défectueux' },
  { value: 'not_as_described', label: 'Non conforme à la description' },
  { value: 'wrong_item', label: 'Mauvais article reçu' },
  { value: 'no_longer_needed', label: 'Plus besoin' },
  { value: 'other', label: 'Autre' },
];

interface Props {
  orderId: string;
  orderNumber?: string;
  onCreated?: () => void;
}

/** Bouton + dialogue : le client demande un retour/remboursement d'une commande livrée. */
export function ReturnRequestDialog({ orderId, orderNumber, onCreated }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason) { toast.error(t('returnRequestDialog.choisissezUnMotifDeRetour')); return; }
    setSubmitting(true);
    try {
      const res = await backendFetch<{ success: boolean; error?: string }>('/api/returns', {
        method: 'POST',
        body: { order_id: orderId, reason, comment: comment.trim() || undefined },
      });
      if (res.success) {
        toast.success(t('returnRequestDialog.demandeDeRetourEnvoyeeLe'));
        setOpen(false);
        setReason(''); setComment('');
        onCreated?.();
      } else {
        toast.error(res.error || 'Échec de la demande');
      }
    } catch {
      toast.error(t('returnRequestDialog.erreurReseau'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Undo2 className="w-4 h-4" /> Demander un retour
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('returnRequestDialog.demanderUnRetour')}</DialogTitle>
          <DialogDescription>
            Commande {orderNumber || ''} — votre demande sera examinée par le vendeur. Le remboursement
            est effectué à la réception du produit retourné.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Motif *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder={t('returnRequestDialog.choisirUnMotif')} /></SelectTrigger>
              <SelectContent>
                {REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Commentaire (optionnel)</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
              placeholder={t('returnRequestDialog.precisezLeProbleme')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>{t('returnRequestDialog.annuler')}</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? 'Envoi…' : 'Envoyer la demande'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReturnRequestDialog;
