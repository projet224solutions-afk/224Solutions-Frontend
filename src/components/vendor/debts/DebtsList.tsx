import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, DollarSign, RefreshCw, User, Phone, Calendar } from 'lucide-react';
import { DebtDetailsDialog } from './DebtDetailsDialog';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import { useIsMobile } from '@/hooks/use-mobile';

interface Debt {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_id: string | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  minimum_installment: number;
  description: string | null;
  status: string;
  due_date: string | null;
  created_at: string;
}

interface DebtsListProps {
  vendorId: string;
}

export function DebtsList({ vendorId }: DebtsListProps) {
  const { t } = useTranslation();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const isMobile = useIsMobile();

  const loadDebts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDebts(data || []);
    } catch (error: any) {
      const errorMessage = error?.message?.toLowerCase() || '';
      const isRlsOrNetworkError =
        error?.code === 'PGRST301' ||
        error?.code === '42501' ||
        errorMessage.includes('permission denied') ||
        errorMessage.includes('rls') ||
        errorMessage.includes('failed to fetch') ||
        errorMessage.includes('networkerror');

      if (!isRlsOrNetworkError) {
        console.error('Erreur chargement dettes:', error);
        toast.error(t('debtsList.erreurLorsDuChargementDes'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDebts();

    const channel = supabase
      .channel('debts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'debts',
          filter: `vendor_id=eq.${vendorId}`
        },
        () => {
          loadDebts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      in_progress: { label: 'En cours', variant: 'default' },
      paid: { label: 'Payée', variant: 'secondary' },
      overdue: { label: 'En retard', variant: 'destructive' },
      cancelled: { label: 'Annulée', variant: 'outline' }
    };

    const config = variants[status] || variants.in_progress;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Non définie';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  if (loading) {
    return <div className="text-center py-8 text-sm">{t('debtsList.chargementDesDettes')}</div>;
  }

  if (debts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Aucune dette enregistrée pour le moment
      </div>
    );
  }

  // Mobile: Affichage en cartes
  if (isMobile) {
    return (
      <>
        <div className="flex justify-end mb-3">
          <Button variant="outline" size="sm" onClick={loadDebts} className="text-xs">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Actualiser
          </Button>
        </div>

        <div className="space-y-3">
          {debts.map((debt) => (
            <Card key={debt.id} className="overflow-hidden">
              <CardContent className="p-3">
                {/* Header: Nom client + Statut */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{debt.customer_name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        <span>{debt.customer_phone}</span>
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(debt.status)}
                </div>

                {/* Montants */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 p-2 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                    <p className="text-xs font-semibold">{formatAmount(debt.total_amount)}</p>
                  </div>
                  <div className="text-center border-x border-border">
                    <p className="text-[10px] text-muted-foreground uppercase">{t('debtsList.paye')}</p>
                    <p className="text-xs font-semibold text-[#ff4000]">{formatAmount(debt.paid_amount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Restant</p>
                    <p className="text-xs font-semibold text-orange-600">{formatAmount(debt.remaining_amount)}</p>
                  </div>
                </div>

                {/* Date limite */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Échéance: {formatDate(debt.due_date)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-9"
                    onClick={() => {
                      setSelectedDebt(debt);
                      setShowDetails(true);
                    }}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    Détails
                  </Button>
                  {debt.status === 'in_progress' && (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 text-xs h-9"
                      onClick={() => {
                        setSelectedDebt(debt);
                        setShowPayment(true);
                      }}
                    >
                      <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                      Encaisser
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedDebt && (
          <>
            <DebtDetailsDialog
              debt={selectedDebt}
              open={showDetails}
              onOpenChange={setShowDetails}
            />
            <RecordPaymentDialog
              debt={selectedDebt}
              open={showPayment}
              onOpenChange={setShowPayment}
              onSuccess={loadDebts}
            />
          </>
        )}
      </>
    );
  }

  // Desktop: Tableau classique
  return (
    <>
      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" onClick={loadDebts}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('debtsList.client')}</TableHead>
              <TableHead>{t('debtsList.telephone')}</TableHead>
              <TableHead>{t('debtsList.montantTotal')}</TableHead>
              <TableHead>{t('debtsList.paye')}</TableHead>
              <TableHead>Restant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date limite</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debts.map((debt) => (
              <TableRow key={debt.id}>
                <TableCell className="font-medium">{debt.customer_name}</TableCell>
                <TableCell>{debt.customer_phone}</TableCell>
                <TableCell>{formatAmount(debt.total_amount)}</TableCell>
                <TableCell className="text-[#ff4000]">{formatAmount(debt.paid_amount)}</TableCell>
                <TableCell className="text-orange-600 font-medium">
                  {formatAmount(debt.remaining_amount)}
                </TableCell>
                <TableCell>{getStatusBadge(debt.status)}</TableCell>
                <TableCell>{formatDate(debt.due_date)}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDebt(debt);
                      setShowDetails(true);
                    }}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Détails
                  </Button>
                  {debt.status === 'in_progress' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setSelectedDebt(debt);
                        setShowPayment(true);
                      }}
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                      Encaisser
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedDebt && (
        <>
          <DebtDetailsDialog
            debt={selectedDebt}
            open={showDetails}
            onOpenChange={setShowDetails}
          />
          <RecordPaymentDialog
            debt={selectedDebt}
            open={showPayment}
            onOpenChange={setShowPayment}
            onSuccess={loadDebts}
          />
        </>
      )}
    </>
  );
}
