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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVirtualCard } from '@/hooks/useVirtualCard';
import { CreditCard, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// La carte virtuelle opère en GNF (devise débitée par process_card_payment).
const gnf = (v: number) => `${(Number(v) || 0).toLocaleString('fr-FR')} GNF`;

interface CardPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  walletBalance: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  onSuccess?: () => void;
}

const merchantCategories = [
  { value: 'shopping', label: 'Shopping' },
  { value: 'food', label: 'Alimentation' },
  { value: 'transport', label: 'Transport' },
  { value: 'services', label: 'Services' },
  { value: 'fuel', label: 'Carburant' },
  { value: 'other', label: 'Autre' }
];

export function CardPaymentDialog({
  open,
  onOpenChange,
  cardId,
  walletBalance,
  dailyRemaining,
  monthlyRemaining,
  onSuccess
}: CardPaymentDialogProps) {
  const { t } = useTranslation();
  const { processPayment, loading } = useVirtualCard();
  const [amount, setAmount] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const maxAmount = Math.min(walletBalance, dailyRemaining, monthlyRemaining);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const paymentAmount = parseFloat(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      setResult({ success: false, message: 'Montant invalide' });
      return;
    }

    if (!merchantName.trim()) {
      setResult({ success: false, message: 'Nom du marchand requis' });
      return;
    }

    if (paymentAmount > maxAmount) {
      setResult({
        success: false,
        message: `Montant maximum: ${gnf(maxAmount)}`
      });
      return;
    }

    const paymentResult = await processPayment(
      cardId,
      paymentAmount,
      merchantName.trim(),
      category,
      description.trim() || undefined
    );

    if (paymentResult.success) {
      setResult({
        success: true,
        message: `Paiement de ${gnf(paymentAmount)} effectué !`
      });

      // Reset et fermer après succès
      setTimeout(() => {
        setAmount('');
        setMerchantName('');
        setCategory('other');
        setDescription('');
        setResult(null);
        onOpenChange(false);
        onSuccess?.();
      }, 1500);
    } else {
      setResult({ success: false, message: paymentResult.error || 'Paiement refusé' });
    }
  };

  const handleClose = () => {
    if (!loading) {
      setAmount('');
      setMerchantName('');
      setCategory('other');
      setDescription('');
      setResult(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-white/10 text-white sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#04439e]" />
            Effectuer un paiement
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Simuler un paiement avec votre carte virtuelle
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className={cn(
            "p-6 rounded-lg text-center",
            result.success ? "bg-[#ff4000]/20" : "bg-[#ff4000]/20"
          )}>
            {result.success ? (
              <CheckCircle2 className="w-12 h-12 text-[#ff4000] mx-auto mb-3" />
            ) : (
              <XCircle className="w-12 h-12 text-[#ff4000] mx-auto mb-3" />
            )}
            <p className={cn(
              "font-medium",
              result.success ? "text-[#ff4000]" : "text-[#ff4000]"
            )}>
              {result.message}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Limites info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-white/5 rounded-lg text-center text-xs">
              <div>
                <p className="text-white/50">{t('cardPaymentDialog.solde')}</p>
                <p className="text-white font-medium">{gnf(walletBalance)}</p>
              </div>
              <div>
                <p className="text-white/50">Limite jour</p>
                <p className="text-white font-medium">{gnf(dailyRemaining)}</p>
              </div>
              <div>
                <p className="text-white/50">Limite mois</p>
                <p className="text-white font-medium">{gnf(monthlyRemaining)}</p>
              </div>
            </div>

            {/* Montant */}
            <div className="space-y-2">
              <Label className="text-white/80">{t('cardPaymentDialog.montantGnf')}</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                min="1"
                max={maxAmount}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                required
              />
              <p className="text-xs text-white/50">
                Maximum: {gnf(maxAmount)}
              </p>
            </div>

            {/* Marchand */}
            <div className="space-y-2">
              <Label className="text-white/80">{t('cardPaymentDialog.nomDuMarchand')}</Label>
              <Input
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder={t('cardPaymentDialog.exSupermarcheAbc')}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                required
              />
            </div>

            {/* Catégorie */}
            <div className="space-y-2">
              <Label className="text-white/80">{t('cardPaymentDialog.categorie')}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {merchantCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-white/80">Description (optionnel)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Note..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            {/* Boutons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1 border-white/20 text-white hover:bg-white/10"
                disabled={loading}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#04439e] hover:bg-[#04439e] shadow-lg shadow-[#04439e]/40"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  'Payer'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
