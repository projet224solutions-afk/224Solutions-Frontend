import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🔐 PAGE ESCROW VENDEUR (route /vendeur/escrow, accessible depuis la barre de menu Finance)
 * - Liste les transactions escrow du vendeur (les siennes uniquement, via le backend Node scoped).
 * - Le LITIGE est intégré DANS la section escrow : pour chaque transaction en litige, le fil
 *   tripartite (EscrowDisputeThread, currentParty="vendor") s'affiche inline → le vendeur donne
 *   sa version et suit l'évolution en temps réel, sans quitter la page.
 * - Le vendeur peut demander la libération, et ouvrir un litige (VendorDisputeDialog).
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useEscrowTransactions } from '@/hooks/useEscrowTransactions';
import { useAuth } from '@/hooks/useAuth';
import { AlertCircle, CheckCircle, Clock, XCircle, Bell, ShieldCheck, RefreshCw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { VendorDisputeDialog } from './VendorDisputeDialog';
import { EscrowDisputeThread } from '@/components/disputes/EscrowDisputeThread';

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: 'En attente', className: 'bg-orange-100 text-[#ff4000]', icon: Clock },
  held: { label: 'Bloqué', className: 'bg-orange-100 text-orange-800', icon: AlertCircle },
  released: { label: 'Libéré', className: 'bg-green-100 text-green-700', icon: CheckCircle },
  refunded: { label: 'Remboursé', className: 'bg-blue-100 text-blue-800', icon: XCircle },
  dispute: { label: 'Litige', className: 'bg-red-100 text-red-700', icon: AlertCircle },
};

export default function VendorEscrowPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { transactions, loading, releaseEscrow, refundEscrow, requestRelease, refresh } = useEscrowTransactions();
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | undefined>(undefined);
  const [actionType, setActionType] = useState<'release' | 'refund' | 'request' | null>(null);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'ceo';

  const handleAction = async () => {
    if (!selectedTransaction) return;
    try {
      if (actionType === 'release') await releaseEscrow(selectedTransaction);
      else if (actionType === 'refund') await refundEscrow(selectedTransaction);
      else if (actionType === 'request') await requestRelease(selectedTransaction);
      setSelectedTransaction(null);
      setActionType(null);
    } catch (error) {
      console.error('Erreur lors de l\'action escrow:', error);
    }
  };

  const openActionDialog = (transactionId: string, action: 'release' | 'refund' | 'request') => {
    setSelectedTransaction(transactionId);
    setActionType(action);
  };

  const openDisputeDialog = (transactionId: string, orderNumber?: string) => {
    setSelectedTransaction(transactionId);
    setSelectedOrderNumber(orderNumber);
    setDisputeDialogOpen(true);
  };

  return (
    <div className="space-y-4 p-3 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[#ff4000]" />
          <div>
            <h1 className="text-lg sm:text-2xl font-bold">Escrow & Litiges</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Transactions sécurisées et gestion des litiges
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">{t('vendorEscrowPage.chargementDesTransactions')}</div>
      ) : transactions.length === 0 ? (
        <div className="py-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('vendorEscrowPage.aucuneTransactionEscrow')}</h3>
          <p className="text-muted-foreground">{t('vendorEscrowPage.lesTransactionsEscrowApparaitrontIci')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((transaction) => {
            const dispute = (transaction as any).dispute as { id: string; status: string } | null;
            const config = statusConfig[transaction.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            const actionable = transaction.status === 'pending' || transaction.status === 'held';

            return (
              <Card key={transaction.id} className={dispute ? 'border-red-300' : undefined}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h4 className="font-medium">
                          {transaction.order?.order_number
                            ? `Commande: ${transaction.order.order_number}`
                            : transaction.order_id
                              ? `ID: ${String(transaction.order_id).slice(0, 8)}…`
                              : 'Commande sans ID'}
                        </h4>
                        <Badge className={config.className}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {config.label}
                        </Badge>
                        {dispute && (
                          <Badge className="bg-red-100 text-red-700">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {dispute.status === 'resolved' ? 'Litige résolu' : 'Litige en cours'}
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                          Montant : <span className="font-semibold text-foreground">
                            {transaction.amount.toLocaleString()} {transaction.currency}
                          </span>
                        </p>
                        <p>
                          Commission : {transaction.commission_percent}%
                          ({transaction.commission_amount.toLocaleString()} {transaction.currency})
                        </p>
                        <p className="text-xs">
                          ⏰ {new Date(transaction.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>

                    {actionable && (
                      <div className="flex flex-wrap gap-2">
                        {isAdmin ? (
                          <Button size="sm" onClick={() => openActionDialog(transaction.id, 'release')}>
                            Libérer (Admin)
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => openActionDialog(transaction.id, 'request')}>
                            <Bell className="w-4 h-4 mr-2" />
                            Demander libération
                          </Button>
                        )}
                        {!dispute && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openDisputeDialog(transaction.id, transaction.order?.order_number)}
                          >
                            Ouvrir un litige
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 🧵 LITIGE intégré dans la section escrow : le vendeur donne sa version
                      et suit l'évolution en temps réel, sans quitter la page. */}
                  {dispute && (
                    <div className="mt-4 border-t pt-3">
                      <EscrowDisputeThread
                        escrowDisputeId={dispute.id}
                        currentParty="vendor"
                        readOnly={dispute.status === 'resolved'}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!actionType} onOpenChange={() => { setActionType(null); setSelectedTransaction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'release' && 'Libérer les fonds (Admin)'}
              {actionType === 'request' && 'Demander la libération'}
              {actionType === 'refund' && 'Rembourser la transaction'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'release' && 'Les fonds seront transférés au vendeur avec commission. Action irréversible.'}
              {actionType === 'request' && 'Une notification sera envoyée à l\'administrateur. Le client peut aussi confirmer la réception pour libérer automatiquement.'}
              {actionType === 'refund' && 'Les fonds seront retournés au payeur. Action irréversible.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('vendorEscrowPage.annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedTransaction && (
        <VendorDisputeDialog
          open={disputeDialogOpen}
          onOpenChange={setDisputeDialogOpen}
          escrowId={selectedTransaction}
          orderNumber={selectedOrderNumber}
          onSuccess={() => { refresh(); setSelectedTransaction(null); }}
        />
      )}
    </div>
  );
}
