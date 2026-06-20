import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVirtualCard, CardTransaction } from '@/hooks/useVirtualCard';
import {
  ShoppingBag,
  Coffee,
  Utensils,
  Fuel,
  Car,
  Package,
  RefreshCw,
  Receipt,
  ArrowDownLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardTransactionsHistoryProps {
  cardId: string;
  className?: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  shopping: <ShoppingBag className="w-4 h-4" />,
  food: <Utensils className="w-4 h-4" />,
  coffee: <Coffee className="w-4 h-4" />,
  fuel: <Fuel className="w-4 h-4" />,
  transport: <Car className="w-4 h-4" />,
  default: <Package className="w-4 h-4" />
};

export function CardTransactionsHistory({ cardId, className }: CardTransactionsHistoryProps) {
  const { t } = useTranslation();
  const { loadTransactions } = useVirtualCard();
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    setLoading(true);
    const data = await loadTransactions(cardId, 20);
    setTransactions(data);
    setLoading(false);
  };

  useEffect(() => {
    if (cardId) {
      fetchTransactions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCategoryIcon = (category: string | null) => {
    if (!category) return categoryIcons.default;
    return categoryIcons[category.toLowerCase()] || categoryIcons.default;
  };

  if (loading) {
    return (
      <Card className={cn("bg-white/5 border-white/10", className)}>
        <CardContent className="p-6 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-white/60 mx-auto" />
          <p className="text-white/60 mt-2 text-sm">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-white/5 border-white/10", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#04439e]" />
            Historique des transactions
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTransactions}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <ArrowDownLeft className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/60 text-sm">{t('cardTransactionsHistory.aucuneTransaction')}</p>
            <p className="text-white/40 text-xs mt-1">
              Vos paiements par carte apparaîtront ici
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="p-2 rounded-full bg-[#04439e]/20 text-[#04439e]">
                    {getCategoryIcon(tx.merchant_category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {tx.merchant_name}
                    </p>
                    <p className="text-white/50 text-xs">
                      {formatDate(tx.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#ff4000] font-semibold text-sm">
                      -{formatAmount(tx.amount)}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5",
                        tx.status === 'completed'
                          ? "text-[#ff4000] border-[#ff4000]/30"
                          : "text-[#ff4000] border-[#ff4000]/30"
                      )}
                    >
                      {tx.status === 'completed' ? 'Complété' : tx.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
