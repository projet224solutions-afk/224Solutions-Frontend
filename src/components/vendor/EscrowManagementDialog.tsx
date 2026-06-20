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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useEscrowTransactions } from '@/hooks/useEscrowTransactions';
import { useAuth } from '@/hooks/useAuth';
import { AlertCircle, CheckCircle, Clock, XCircle, Bell } from 'lucide-react';
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

interface EscrowManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig = {
  pending: {
    label: 'En attente',
    className: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-orange-300',
    icon: Clock
  },
  held: {
    label: 'Bloqué',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    icon: AlertCircle
  },
  released: {
    label: 'Libéré',
    className: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-orange-300',
    icon: CheckCircle
  },
  refunded: {
    label: 'Remboursé',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    icon: XCircle
  },
  dispute: {
    label: 'Litige',
    className: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-orange-300',
    icon: AlertCircle
  }
};

export default function EscrowManagementDialog({
  open,
  onOpenChange
}: EscrowManagementDialogProps) {
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
      switch (actionType) {
        case 'release':
          await releaseEscrow(selectedTransaction);
          break;
        case 'refund':
          await refundEscrow(selectedTransaction);
          break;
        case 'request':
          await requestRelease(selectedTransaction);
          break;
      }
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('escrowManagementDialog.gestionDesTransactionsEscrow')}</DialogTitle>
            <DialogDescription>
              Gérez les transactions sécurisées avec escrow
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="py-8 text-center">{t('escrowManagementDialog.chargementDesTransactions')}</div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('escrowManagementDialog.aucuneTransactionEscrow')}</h3>
              <p className="text-muted-foreground">
                Les transactions escrow apparaîtront ici
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => {
                const config = statusConfig[transaction.status as keyof typeof statusConfig] || statusConfig.pending;
                const StatusIcon = config.icon;

                return (
                  <Card key={transaction.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">
                              {transaction.order?.order_number
                                ? `Commande: ${transaction.order.order_number}`
                                : transaction.order_id
                                  ? `ID: ${transaction.order_id.slice(0, 8)}...`
                                  : 'Commande sans ID'}
                            </h4>
                            <Badge className={config.className}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {config.label}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                            <div>
                              <p>{t('escrowManagementDialog.montant')} <span className="font-semibold text-foreground">
                                {transaction.amount.toLocaleString()} {transaction.currency}
                              </span></p>
                              <p>Commission: {transaction.commission_percent}%
                                ({transaction.commission_amount.toLocaleString()} {transaction.currency})
                              </p>
                            </div>
                            <div>
                              <p>ID Transaction:</p>
                              <p className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                {transaction.id ? String(transaction.id).slice(0, 16) + '...' : 'N/A'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 text-sm text-muted-foreground grid grid-cols-2 gap-2">
                            <div>
                              ⏰ Créé: {new Date(transaction.created_at).toLocaleString('fr-FR', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}
                            </div>
                            <div>
                              🔄 Maj: {new Date(transaction.updated_at).toLocaleString('fr-FR', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}
                            </div>
                          </div>
                        </div>

                        {(transaction.status === 'pending' || transaction.status === 'held') && (
                          <div className="flex gap-2 ml-4">
                            {isAdmin ? (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => openActionDialog(transaction.id, 'release')}
                              >
                                Libérer (Admin)
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openActionDialog(transaction.id, 'request')}
                              >
                                <Bell className="w-4 h-4 mr-2" />
                                Demander libération
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openActionDialog(transaction.id, 'refund')}
                            >
                              Rembourser
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openDisputeDialog(transaction.id, transaction.order?.order_number)}
                            >
                              Litige
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!actionType} onOpenChange={() => {
        setActionType(null);
        setSelectedTransaction(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'release' && 'Libérer les fonds (Admin)'}
              {actionType === 'request' && 'Demander la libération'}
              {actionType === 'refund' && 'Rembourser la transaction'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'release' && 'Les fonds seront transférés au vendeur avec commission. Cette action est irréversible.'}
              {actionType === 'request' && 'Une notification sera envoyée à l\'administrateur pour demander la libération des fonds. Le client peut aussi confirmer la réception pour libérer automatiquement.'}
              {actionType === 'refund' && 'Les fonds seront retournés au payeur. Cette action est irréversible.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('escrowManagementDialog.annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog litige avec formulaire complet */}
      {selectedTransaction && (
        <VendorDisputeDialog
          open={disputeDialogOpen}
          onOpenChange={setDisputeDialogOpen}
          escrowId={selectedTransaction}
          orderNumber={selectedOrderNumber}
          onSuccess={() => {
            refresh();
            setSelectedTransaction(null);
          }}
        />
      )}
    </>
  );
}
