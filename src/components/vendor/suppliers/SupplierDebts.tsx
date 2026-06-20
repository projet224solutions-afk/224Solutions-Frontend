import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/integrations/supabase/client';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DollarSign, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SupplierDebt {
  id: string;
  supplier_id: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  minimum_installment: number;
  status: string;
  due_date: string | null;
  created_at: string;
  currency?: string;
  supplier: { name: string } | null;
}

interface SupplierDebtsProps {
  vendorId: string;
}

export function SupplierDebts({ vendorId }: SupplierDebtsProps) {
  const { t } = useTranslation();
  const [debts, setDebts] = useState<SupplierDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [payDebt, setPayDebt] = useState<SupplierDebt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    loadDebts();
    const channel = supabase
      .channel('supplier_debts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_debts', filter: `vendor_id=eq.${vendorId}` }, () => loadDebts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const loadDebts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_debts')
        .select(`*, supplier:vendor_suppliers(name)`)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDebts((data || []) as any);
    } catch (error: any) {
      const m = (error?.message || '').toLowerCase();
      if (!(error?.code === '42501' || m.includes('permission denied') || m.includes('failed to fetch'))) {
        console.error('Erreur chargement dettes fournisseurs:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const openPay = (d: SupplierDebt) => {
    setPayDebt(d);
    setPayAmount(String(d.minimum_installment > 0 ? Math.min(d.minimum_installment, d.remaining_amount) : d.remaining_amount));
  };

  const submitPay = async () => {
    if (!payDebt) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Montant invalide'); return; }
    if (amount > payDebt.remaining_amount + 0.01) { toast.error('Le montant dépasse le restant dû'); return; }
    setPaying(true);
    try {
      const res = await backendFetch<any>('/api/inventory/pay-supplier-debt', {
        method: 'POST',
        body: { debt_id: payDebt.id, amount },
      });
      if (res.success === false) { toast.error(res.error || 'Échec du règlement'); return; }
      toast.success(`Règlement de ${formatAmount(amount)} effectué`);
      setPayDebt(null);
      await loadDebts();
    } catch { toast.error('Erreur réseau'); }
    finally { setPaying(false); }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: any }> = {
      in_progress: { label: 'En cours', variant: 'default' },
      paid: { label: 'Payée', variant: 'secondary' },
      overdue: { label: 'En retard', variant: 'destructive' },
      cancelled: { label: 'Annulée', variant: 'outline' },
    };
    const c = variants[status] || variants.in_progress;
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const formatAmount = (amount: number) => new Intl.NumberFormat('fr-FR').format(amount || 0) + ' GNF';
  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : 'Non définie');

  if (loading) return <div className="text-center py-8">{t('supplierDebts.chargementDesDettes')}</div>;
  if (debts.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">Aucune dette fournisseur pour le moment</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={loadDebts}>
          <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fournisseur</TableHead>
              <TableHead>{t('supplierDebts.montantTotal')}</TableHead>
              <TableHead>{t('supplierDebts.paye')}</TableHead>
              <TableHead>Restant</TableHead>
              <TableHead>Tranche Min</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date limite</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debts.map((debt) => (
              <TableRow key={debt.id}>
                <TableCell className="font-medium">{debt.supplier?.name || '—'}</TableCell>
                <TableCell>{formatAmount(debt.total_amount)}</TableCell>
                <TableCell className="text-[#ff4000]">{formatAmount(debt.paid_amount)}</TableCell>
                <TableCell className="text-orange-600 font-medium">{formatAmount(debt.remaining_amount)}</TableCell>
                <TableCell>{formatAmount(debt.minimum_installment)}</TableCell>
                <TableCell>{getStatusBadge(debt.status)}</TableCell>
                <TableCell>{formatDate(debt.due_date)}</TableCell>
                <TableCell className="text-right">
                  {(debt.status === 'in_progress' || debt.status === 'overdue') && debt.remaining_amount > 0 && (
                    <Button variant="default" size="sm" onClick={() => openPay(debt)}>
                      <DollarSign className="w-4 h-4 mr-1" /> Payer
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!payDebt} onOpenChange={(o) => !o && setPayDebt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Régler une tranche</DialogTitle>
            <DialogDescription>
              {payDebt?.supplier?.name} — restant dû : <strong>{payDebt ? formatAmount(payDebt.remaining_amount) : ''}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Montant à régler (GNF)</Label>
            <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            <p className="text-xs text-muted-foreground">Le montant sera débité de votre wallet et déduit de la dette.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDebt(null)} disabled={paying}>Annuler</Button>
            <Button onClick={submitPay} disabled={paying}>
              {paying ? 'Règlement…' : 'Confirmer le règlement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
