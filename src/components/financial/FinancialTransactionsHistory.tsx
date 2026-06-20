import { useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFinancialTransactions } from '@/hooks/useFinancialTransactions';
import { ArrowUpRight, ArrowDownRight, Smartphone, CreditCard, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function FinancialTransactionsHistory() {
  const { t } = useTranslation();
  const { transactions, loadTransactions } = useFinancialTransactions();

  useEffect(() => {
    loadTransactions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'card_to_om':
        return <Smartphone className="h-4 w-4" />;
      case 'wallet_to_card':
        return <CreditCard className="h-4 w-4" />;
      case 'card_to_wallet':
        return <Wallet className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'card_to_om':
        return 'Carte → Orange Money';
      case 'wallet_to_card':
        return 'Wallet → Carte';
      case 'card_to_wallet':
        return 'Carte → Wallet';
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      pending: 'secondary',
      failed: 'destructive',
      cancelled: 'outline'
    };

    const labels = {
      completed: 'Complété',
      pending: 'En attente',
      failed: 'Échoué',
      cancelled: 'Annulé'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] as any}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Aucune transaction pour le moment
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('financialTransactionsHistory.historiqueDesTransactionsFinancieres')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  {getTransactionIcon(transaction.transaction_type)}
                </div>
                <div>
                  <p className="font-medium">
                    {getTransactionLabel(transaction.transaction_type)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(transaction.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                  </p>
                  {transaction.destination_reference && (
                    <p className="text-xs text-muted-foreground">
                      Vers: {transaction.destination_reference}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right space-y-1">
                <p className="font-bold text-lg">
                  {transaction.amount.toLocaleString()} {transaction.currency}
                </p>
                {transaction.fees > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Frais: {transaction.fees.toLocaleString()} {transaction.currency}
                  </p>
                )}
                {getStatusBadge(transaction.status)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
