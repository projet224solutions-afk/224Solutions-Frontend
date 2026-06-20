import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { sendDebtCreatedNotification } from '@/utils/debtNotifications';

interface CreateDebtFormProps {
  vendorId: string;
  onSuccess: () => void;
}

export function CreateDebtForm({ vendorId, onSuccess }: CreateDebtFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_id: '',
    total_amount: '',
    minimum_installment: '',
    description: '',
    due_date: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error(t('createDebtForm.vousDevezEtreConnecte'));
      return;
    }

    // Validation
    if (!formData.customer_name || !formData.customer_phone || !formData.total_amount || !formData.minimum_installment) {
      toast.error(t('createDebtForm.veuillezRemplirTousLesChamps'));
      return;
    }

    const totalAmount = parseFloat(formData.total_amount);
    const minInstallment = parseFloat(formData.minimum_installment);

    if (totalAmount <= 0 || minInstallment <= 0) {
      toast.error(t('createDebtForm.lesMontantsDoiventEtreSuperieurs'));
      return;
    }

    if (minInstallment > totalAmount) {
      toast.error(t('createDebtForm.laTrancheMinimaleNePeut'));
      return;
    }

    setLoading(true);

    try {
      const { _data, error } = await supabase
        .from('debts')
        .insert({
          vendor_id: vendorId,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_id: formData.customer_id || null,
          total_amount: totalAmount,
          remaining_amount: totalAmount,
          minimum_installment: minInstallment,
          description: formData.description || null,
          due_date: formData.due_date || null,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Envoyer notification au client
      await sendDebtCreatedNotification(
        formData.customer_id || null,
        formData.customer_name,
        formData.customer_phone,
        totalAmount,
        'Votre vendeur' // TODO: récupérer le nom du vendeur
      );

      toast.success(t('createDebtForm.detteCreeeAvecSucces'));

      // Reset form
      setFormData({
        customer_name: '',
        customer_phone: '',
        customer_id: '',
        total_amount: '',
        minimum_installment: '',
        description: '',
        due_date: ''
      });

      onSuccess();
    } catch (error: any) {
      console.error('Erreur création dette:', error);
      toast.error(error.message || 'Erreur lors de la création de la dette');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="customer_name">{t('createDebtForm.nomDuClient')}</Label>
          <Input
            id="customer_name"
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            placeholder={t('createDebtForm.nomCompletDuClient')}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer_phone">{t('createDebtForm.numeroDuClient')}</Label>
          <Input
            id="customer_phone"
            value={formData.customer_phone}
            onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
            placeholder="+224 XXX XXX XXX"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer_id">{t('createDebtForm.idClientOptionnel')}</Label>
          <Input
            id="customer_id"
            value={formData.customer_id}
            onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
            placeholder={t('createDebtForm.idDuClientDansLe')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="total_amount">{t('createDebtForm.montantTotalGnf')}</Label>
          <Input
            id="total_amount"
            type="number"
            min="1"
            step="1"
            value={formData.total_amount}
            onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
            placeholder="100000"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="minimum_installment">Tranche minimale (GNF) *</Label>
          <Input
            id="minimum_installment"
            type="number"
            min="1"
            step="1"
            value={formData.minimum_installment}
            onChange={(e) => setFormData({ ...formData, minimum_installment: e.target.value })}
            placeholder="10000"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_date">Date limite (optionnel)</Label>
          <Input
            id="due_date"
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optionnel)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder={t('createDebtForm.detailsDeLaDette')}
          rows={3}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Création en cours...' : 'Créer la dette'}
      </Button>
    </form>
  );
}
