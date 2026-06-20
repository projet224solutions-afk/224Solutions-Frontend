import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { useVendorCurrency } from '@/hooks/useVendorCurrency';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Wallet, Plus, Banknote, Smartphone, Building,
  ArrowUpRight, ArrowDownLeft, RefreshCw, MoreVertical,
  TrendingUp, TrendingDown
} from 'lucide-react';

interface CollectionAccount {
  id: string;
  account_name: string;
  account_type: 'cash' | 'orange_money' | 'mtn_money' | 'bank' | 'other';
  account_number?: string;
  balance: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

interface AccountTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description?: string;
  created_at: string;
}

const accountTypeConfig = {
  cash: { icon: Banknote, label: 'Caisse', color: 'bg-orange-100 text-[#ff4000]' },
  orange_money: { icon: Smartphone, label: 'Orange Money', color: 'bg-orange-100 text-orange-800' },
  mtn_money: { icon: Smartphone, label: 'MTN Money', color: 'bg-orange-100 text-[#ff4000]' },
  bank: { icon: Building, label: 'Banque', color: 'bg-blue-100 text-blue-800' },
  other: { icon: Wallet, label: 'Autre', color: 'bg-gray-100 text-gray-800' }
};

export default function CollectionAccountsManager() {
  const { t } = useTranslation();
  const { vendorId } = useCurrentVendor();
  const { toast } = useToast();
  const { currency, convert } = useVendorCurrency();
  const [accounts, setAccounts] = useState<CollectionAccount[]>([]);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<CollectionAccount | null>(null);

  const [newAccount, setNewAccount] = useState({
    account_name: '',
    account_type: 'cash' as const,
    account_number: '',
    is_default: false
  });

  const [newTransaction, setNewTransaction] = useState({
    type: 'deposit' as 'deposit' | 'withdrawal',
    amount: '',
    description: ''
  });

  const loadAccounts = async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vendor_collection_accounts')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts((data || []).map(acc => ({
        ...acc,
        account_type: acc.account_type as CollectionAccount['account_type']
      })));
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (accountId: string) => {
    try {
      const { data, error } = await supabase
        .from('vendor_account_transactions')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  useEffect(() => {
    loadAccounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const createAccount = async () => {
    if (!vendorId || !newAccount.account_name) {
      toast({ title: 'Nom du compte requis', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('vendor_collection_accounts')
        .insert([{
          vendor_id: vendorId,
          ...newAccount
        }]);

      if (error) throw error;

      toast({ title: '✅ Compte créé avec succès' });
      setIsCreateOpen(false);
      setNewAccount({ account_name: '', account_type: 'cash', account_number: '', is_default: false });
      loadAccounts();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const recordTransaction = async () => {
    if (!selectedAccount || !newTransaction.amount) {
      toast({ title: 'Montant requis', variant: 'destructive' });
      return;
    }

    const amount = parseFloat(newTransaction.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Montant invalide', variant: 'destructive' });
      return;
    }

    const balanceBefore = selectedAccount.balance;
    const balanceAfter = newTransaction.type === 'deposit'
      ? balanceBefore + amount
      : balanceBefore - amount;

    if (balanceAfter < 0 && newTransaction.type === 'withdrawal') {
      toast({ title: 'Solde insuffisant', variant: 'destructive' });
      return;
    }

    try {
      // Créer la transaction
      const { error: txError } = await supabase
        .from('vendor_account_transactions')
        .insert([{
          account_id: selectedAccount.id,
          transaction_type: newTransaction.type,
          amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description: newTransaction.description
        }]);

      if (txError) throw txError;

      // Mettre à jour le solde du compte
      const { error: updateError } = await supabase
        .from('vendor_collection_accounts')
        .update({ balance: balanceAfter })
        .eq('id', selectedAccount.id);

      if (updateError) throw updateError;

      toast({ title: '✅ Transaction enregistrée' });
      setIsTransactionOpen(false);
      setNewTransaction({ type: 'deposit', amount: '', description: '' });
      loadAccounts();
      if (selectedAccount) loadTransactions(selectedAccount.id);
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  if (loading) {
    return <div className="p-4 text-center">{t('collectionAccountsManager.chargementDesComptes')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6" />
            Comptes d'Encaissement
          </h2>
          <p className="text-sm text-muted-foreground">
            Gérez vos différentes caisses et comptes
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau compte
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('collectionAccountsManager.creerUnCompteDEncaissement')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('collectionAccountsManager.nomDuCompte')}</label>
                <Input
                  placeholder="Ex: Caisse principale"
                  value={newAccount.account_name}
                  onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('collectionAccountsManager.typeDeCompte')}</label>
                <select
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  value={newAccount.account_type}
                  onChange={(e) => setNewAccount({ ...newAccount, account_type: e.target.value as any })}
                >
                  <option value="cash">Caisse interne</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="mtn_money">MTN Mobile Money</option>
                  <option value="bank">Compte bancaire</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">{t('collectionAccountsManager.numeroDeCompteOptionnel')}</label>
                <Input
                  placeholder="Ex: 620XXXXXX"
                  value={newAccount.account_number}
                  onChange={(e) => setNewAccount({ ...newAccount, account_number: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{t('collectionAccountsManager.annuler')}</Button>
                <Button onClick={createAccount}>{t('collectionAccountsManager.creer')}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Total */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('collectionAccountsManager.soldeTotal')}</p>
              <p className="text-3xl font-bold">{Math.round(convert(totalBalance)).toLocaleString('fr-FR')} {currency}</p>
            </div>
            <Wallet className="w-12 h-12 text-primary/50" />
          </div>
        </CardContent>
      </Card>

      {/* Comptes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((account) => {
          const config = accountTypeConfig[account.account_type];
          const Icon = config.icon;

          return (
            <Card key={account.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{account.account_name}</p>
                      <Badge variant="outline" className="text-xs">
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                  {account.is_default && (
                    <Badge className="bg-primary/10 text-primary text-xs">{t('collectionAccountsManager.parDefaut')}</Badge>
                  )}
                </div>

                <p className="text-2xl font-bold mb-4">
                  {Math.round(convert(account.balance)).toLocaleString('fr-FR')} {currency}
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedAccount(account);
                      setNewTransaction({ type: 'deposit', amount: '', description: '' });
                      setIsTransactionOpen(true);
                      loadTransactions(account.id);
                    }}
                  >
                    <ArrowDownLeft className="w-3 h-3 mr-1 text-[#ff4000]" />
                    Entrée
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedAccount(account);
                      setNewTransaction({ type: 'withdrawal', amount: '', description: '' });
                      setIsTransactionOpen(true);
                      loadTransactions(account.id);
                    }}
                  >
                    <ArrowUpRight className="w-3 h-3 mr-1 text-[#ff4000]" />
                    Sortie
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {accounts.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="p-12 text-center">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">{t('collectionAccountsManager.aucunCompteDEncaissement')}</p>
              <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                Créer mon premier compte
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog Transaction */}
      <Dialog open={isTransactionOpen} onOpenChange={setIsTransactionOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {newTransaction.type === 'deposit' ? 'Enregistrer une entrée' : 'Enregistrer une sortie'}
            </DialogTitle>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Compte</p>
                <p className="font-semibold">{selectedAccount.account_name}</p>
                <p className="text-sm">Solde actuel: {Math.round(convert(selectedAccount.balance)).toLocaleString('fr-FR')} {currency}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant={newTransaction.type === 'deposit' ? 'default' : 'outline'}
                  onClick={() => setNewTransaction({ ...newTransaction, type: 'deposit' })}
                  className="flex-1"
                >
                  <ArrowDownLeft className="w-4 h-4 mr-2" />
                  Entrée
                </Button>
                <Button
                  variant={newTransaction.type === 'withdrawal' ? 'default' : 'outline'}
                  onClick={() => setNewTransaction({ ...newTransaction, type: 'withdrawal' })}
                  className="flex-1"
                >
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  Sortie
                </Button>
              </div>

              <div>
                <label className="text-sm font-medium">Montant ({currency})</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description (optionnel)</label>
                <Input
                  placeholder={t('collectionAccountsManager.exVenteClientX')}
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsTransactionOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={recordTransaction}>
                  Enregistrer
                </Button>
              </div>

              {/* Historique récent */}
              {transactions.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">{t('collectionAccountsManager.historiqueRecent')}</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {transactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2">
                          {tx.transaction_type === 'deposit' ? (
                            <TrendingUp className="w-3 h-3 text-[#ff4000]" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-[#ff4000]" />
                          )}
                          <span className="text-muted-foreground truncate max-w-[120px]">
                            {tx.description || tx.transaction_type}
                          </span>
                        </div>
                        <span className={tx.transaction_type === 'deposit' ? 'text-[#ff4000]' : 'text-[#ff4000]'}>
                          {tx.transaction_type === 'deposit' ? '+' : '-'}{tx.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
