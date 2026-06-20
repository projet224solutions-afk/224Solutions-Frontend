/**
 * 🔒 GESTION ESCROW PDG
 * Interface complète de gestion des transactions escrow pour le PDG
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEscrowTransactions } from '@/hooks/useEscrowTransactions';
import { useAuth } from '@/hooks/useAuth';
import {
  Shield, AlertCircle, CheckCircle, Clock, XCircle, Bell,
  RefreshCw, Search, Filter, Download, TrendingUp, DollarSign
} from 'lucide-react';
import PDGEscrowDisputes from './PDGEscrowDisputes';
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
import { useToast } from '@/hooks/use-toast';

const statusConfig = {
  pending: {
    label: 'En attente',
    className: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
    icon: Clock,
    color: 'text-[#ff4000]'
  },
  held: {
    label: 'Bloqué',
    className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    icon: AlertCircle,
    color: 'text-orange-600'
  },
  released: {
    label: 'Libéré',
    className: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
    icon: CheckCircle,
    color: 'text-[#ff4000]'
  },
  refunded: {
    label: 'Remboursé',
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    icon: XCircle,
    color: 'text-blue-600'
  },
  dispute: {
    label: 'Litige',
    className: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20',
    icon: AlertCircle,
    color: 'text-[#ff4000]'
  }
};

export default function PDGEscrowManagement() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { profile } = useAuth();
  const { toast } = useToast();
  const { transactions, loading, releaseEscrow, refundEscrow, disputeEscrow } = useEscrowTransactions({ scope: 'admin' });
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'release' | 'refund' | 'dispute' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isAdmin = profile?.role === 'admin';

  // Statistiques
  const stats = {
    total: transactions.length,
    pending: transactions.filter(t => t.status === 'pending' || t.status === 'held').length,
    released: transactions.filter(t => t.status === 'released').length,
    refunded: transactions.filter(t => t.status === 'refunded').length,
    dispute: transactions.filter(t => (t as any).dispute || t.status === 'dispute').length,
    totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
    commission: transactions
      .filter(t => t.status === 'released')
      .reduce((sum, t) => sum + t.commission_amount, 0)
  };

  // Filtrage
  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = !searchTerm ||
      transaction.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleAction = async () => {
    if (!selectedTransaction) return;

    try {
      switch (actionType) {
        case 'release':
          await releaseEscrow(selectedTransaction);
          toast({
            title: "✅ Fonds libérés",
            description: "Les fonds ont été transférés au vendeur avec commission."
          });
          break;
        case 'refund':
          await refundEscrow(selectedTransaction);
          toast({
            title: "✅ Remboursement effectué",
            description: "Les fonds ont été retournés au payeur."
          });
          break;
        case 'dispute':
          await disputeEscrow(selectedTransaction);
          toast({
            title: "⚠️ Litige ouvert",
            description: "La transaction a été marquée en litige."
          });
          break;
      }
      setSelectedTransaction(null);
      setActionType(null);
    } catch (error) {
      console.error('Erreur lors de l\'action escrow:', error);
      toast({
        title: "❌ Erreur",
        description: error instanceof Error ? error.message : "Échec de l'action",
        variant: "destructive"
      });
    }
  };

  const openActionDialog = (transactionId: string, action: 'release' | 'refund' | 'dispute') => {
    setSelectedTransaction(transactionId);
    setActionType(action);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simuler un rechargement
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
    toast({
      title: "🔄 Données actualisées",
      description: `${transactions.length} transactions chargées`
    });
  };

  return (
    <>
      <Tabs defaultValue="transactions" className="space-y-6">
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              Gestion Escrow
            </h2>
            <p className="text-muted-foreground mt-1">
              Gérez toutes les transactions sécurisées avec escrow
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <TabsList>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="disputes" className="text-destructive">
                🚨 Litiges ({stats.dispute})
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <Shield className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#ff4000]/10 to-[#ff4000]/10 border-[#ff4000]/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">En attente</p>
                <Clock className="w-4 h-4 text-[#ff4000]" />
              </div>
              <p className="text-3xl font-bold text-[#ff4000]">{stats.pending}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#ff4000]/10 to-[#ff4000]/10 border-[#ff4000]/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">{t('pDGEscrowManagement.liberees')}</p>
                <CheckCircle className="w-4 h-4 text-[#ff4000]" />
              </div>
              <p className="text-3xl font-bold text-[#ff4000]">{stats.released}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#04439e]/10 to-[#04439e]/10 border-[#04439e]/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Commission totale</p>
                <TrendingUp className="w-4 h-4 text-[#04439e]" />
              </div>
              <p className="text-2xl font-bold text-[#04439e]">
                {fc(stats.commission)}
              </p>
            </CardContent>
          </Card>
        </div>

        <TabsContent value="transactions">
        {/* Filtres */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('pDGEscrowManagement.rechercherParIdCommandeOu')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('all')}
                  size="sm"
                >
                  Tous ({stats.total})
                </Button>
                <Button
                  variant={statusFilter === 'pending' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('pending')}
                  size="sm"
                  className="border-[#ff4000]/30"
                >
                  En attente ({stats.pending})
                </Button>
                <Button
                  variant={statusFilter === 'released' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('released')}
                  size="sm"
                  className="border-[#ff4000]/30"
                >
                  Libérées ({stats.released})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Liste des transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Transactions Escrow ({filteredTransactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">{t('pDGEscrowManagement.chargementDesTransactions')}</p>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-12 text-center">
                <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchTerm || statusFilter !== 'all'
                    ? 'Aucun résultat'
                    : 'Aucune transaction escrow'}
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== 'all'
                    ? 'Essayez de modifier vos filtres'
                    : 'Les transactions escrow apparaîtront ici'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTransactions.map((transaction) => {
                  const config = statusConfig[transaction.status as keyof typeof statusConfig] || statusConfig.pending;
                  const StatusIcon = config.icon;

                  return (
                    <Card key={transaction.id} className="border-2 hover:shadow-lg transition-all">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h4 className="font-bold text-lg">
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

                          {/* Informations Vendeur */}
                          {transaction.receiver && (
                            <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3 mb-3">
                              <h5 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
                                🏪 Informations Vendeur
                              </h5>
                              <div className="text-sm space-y-1">
                                <p>
                                  <span className="text-muted-foreground">Nom:</span>{' '}
                                  <span className="font-semibold text-foreground">
                                    {transaction.receiver.business_name || 'Non spécifié'}
                                  </span>
                                </p>
                                <p>
                                  <span className="text-muted-foreground">{t('pDGEscrowManagement.idVendeur')}</span>{' '}
                                  <span className="font-mono text-xs bg-white px-2 py-0.5 rounded">
                                    {transaction.receiver.id ? String(transaction.receiver.id).slice(0, 12) + '...' : 'N/A'}
                                  </span>
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 rounded-lg p-4">
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">{t('pDGEscrowManagement.montant')}</p>
                              <p className="text-xl font-bold text-foreground">
                                {transaction.amount.toLocaleString()} {transaction.currency}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Commission</p>
                              <p className="font-semibold text-foreground">
                                {transaction.commission_percent}% ({transaction.commission_amount.toLocaleString()} {transaction.currency})
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">ID Transaction</p>
                              <p className="text-xs font-mono bg-background px-2 py-1 rounded">
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

                          {isAdmin && (transaction.status === 'pending' || transaction.status === 'held') && (
                            <div className="flex flex-col gap-2 ml-6">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => openActionDialog(transaction.id, 'release')}
                                className="bg-[#ff4000] hover:bg-[#ff4000]"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Libérer
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openActionDialog(transaction.id, 'refund')}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Rembourser
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openActionDialog(transaction.id, 'dispute')}
                              >
                                <AlertCircle className="w-4 h-4 mr-2" />
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
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="disputes">
          <PDGEscrowDisputes />
        </TabsContent>
      </div>

      {/* Dialog de confirmation */}
      <AlertDialog open={!!actionType} onOpenChange={() => {
        setActionType(null);
        setSelectedTransaction(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {actionType === 'release' && <><CheckCircle className="w-5 h-5 text-[#ff4000]" />{t('pDGEscrowManagement.libererLesFondsAdmin')}</>}
              {actionType === 'refund' && <><XCircle className="w-5 h-5 text-blue-600" />{t('pDGEscrowManagement.rembourserLaTransaction')}</>}
              {actionType === 'dispute' && <><AlertCircle className="w-5 h-5 text-[#ff4000]" />{t('pDGEscrowManagement.ouvrirUnLitige')}</>}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'release' && '⚠️ Les fonds seront transférés au vendeur avec une commission de 2.5%. Cette action est irréversible.'}
              {actionType === 'refund' && '⚠️ Les fonds seront retournés intégralement au payeur. Cette action est irréversible.'}
              {actionType === 'dispute' && '⚠️ Un litige sera ouvert sur cette transaction. Elle sera mise en attente de résolution.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('pDGEscrowManagement.annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction} className={
              actionType === 'release' ? 'bg-[#ff4000] hover:bg-[#ff4000]' :
              actionType === 'refund' ? 'bg-blue-600 hover:bg-blue-700' :
              'bg-[#ff4000] hover:bg-[#ff4000]'
            }>
              Confirmer l'action
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </Tabs>
    </>
  );
}
