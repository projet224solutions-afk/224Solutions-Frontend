import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, Smartphone, Building, _Globe, CheckCircle, XCircle,
  _Clock, AlertTriangle, Plus, _Download, Eye, RefreshCw, Send
} from "lucide-react";

interface PaymentMethod {
  id: string;
  name: string;
  type: 'card' | 'mobile_money' | 'bank_transfer' | 'cash' | 'crypto';
  icon: unknown;
  available: boolean;
  fees: string;
  processing_time: string;
}

interface Transaction {
  id: string;
  order_id: string;
  amount: number;
  method: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  created_at: string;
  reference?: string;
  customer_email?: string;
  notes?: string;
}

const paymentMethods: PaymentMethod[] = [
  {
    id: 'visa_mastercard',
    name: 'Visa/Mastercard',
    type: 'card',
    icon: CreditCard,
    available: true,
    fees: '2.9% + 100 GNF',
    processing_time: 'Instantané'
  },
  {
    id: 'orange_money',
    name: 'Orange Money',
    type: 'mobile_money',
    icon: Smartphone,
    available: true,
    fees: '1.5%',
    processing_time: '2-5 minutes'
  },
  {
    id: 'mtn_money',
    name: 'MTN Mobile Money',
    type: 'mobile_money',
    icon: Smartphone,
    available: true,
    fees: '1.5%',
    processing_time: '2-5 minutes'
  },
  {
    id: 'wave',
    name: 'Wave',
    type: 'mobile_money',
    icon: Smartphone,
    available: true,
    fees: '1%',
    processing_time: 'Instantané'
  },
  {
    id: 'bank_transfer',
    name: 'Virement bancaire',
    type: 'bank_transfer',
    icon: Building,
    available: true,
    fees: '500 GNF',
    processing_time: '1-3 jours ouvrés'
  },
  {
    id: 'stripe',
    name: 'Stripe',
    type: 'card',
    icon: CreditCard,
    available: true,
    fees: '2.9% + 100 GNF',
    processing_time: 'Instantané'
  }
];

const statusColors = {
  pending: 'bg-orange-100 text-[#ff4000]',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-orange-100 text-[#ff4000]',
  failed: 'bg-orange-100 text-[#ff4000]',
  refunded: 'bg-gray-100 text-gray-800'
};

const statusLabels = {
  pending: 'En attente',
  processing: 'En cours',
  completed: 'Terminé',
  failed: 'Échec',
  refunded: 'Remboursé'
};

export default function PaymentProcessor() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { user: authUser } = useAuth();
  const { userId: vendorUserId, isAgent } = useCurrentVendor();
  // En mode agent, utiliser le user_id du vendeur pour les transactions
  const user = isAgent && vendorUserId ? { ...authUser, id: vendorUserId } : authUser;
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string>('');
  const [paymentData, setPaymentData] = useState({
    amount: '',
    method: '',
    customer_email: '',
    notes: ''
  });

  useEffect(() => {
    if (!user) return;
    fetchTransactions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchTransactions = async () => {
    try {
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user?.id)
        .single();
      if (!vendor) return;

      const { data: vendorOrders } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('vendor_id', vendor.id);
      const orderById = new Map((vendorOrders || []).map((o: any) => [o.id, o.order_number]));

      const { data, error } = await supabase
        .from('transactions')
        .select('id, order_id, amount, method, status, created_at, reference_number')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const formatted: Transaction[] = (data || [])
        .filter((t: any) => !t.order_id || orderById.has(t.order_id))
        .map((t: any) => ({
          id: t.id,
          order_id: (t.order_id && orderById.get(t.order_id)) ? orderById.get(t.order_id) : (t.order_id || '—'),
          amount: Number(t.amount || 0),
          method: String(t.method || ''),
          status: String(t.status || 'pending') as Transaction['status'],
          created_at: t.created_at,
          reference: t.reference_number || undefined,
        }));

      setTransactions(formatted);
    } catch (_error) {
      toast({
        title: "Erreur",
        description: t('paymentProcessor.impossibleDeChargerLesTransactions'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async () => {
    try {
      const amountNumber = parseFloat(paymentData.amount);
      if (!selectedOrder || !amountNumber || !paymentData.method) return;

      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user?.id)
        .single();
      if (!vendor) return;

      const { data: order } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('vendor_id', vendor.id)
        .or(`order_number.eq.${selectedOrder},id.eq.${selectedOrder}`)
        .maybeSingle();
      const orderId = order?.id || null;

      const normalizeMethod = (name: string) => {
        const n = (name || '').toLowerCase();
        if (n.includes('orange')) return 'orange_money';
        if (n.includes('mtn')) return 'mtn';
        if (n.includes('wave')) return 'wave';
        if (n.includes('visa') || n.includes('mastercard') || n.includes('card')) return 'card';
        if (n.includes('virement') || n.includes('bank')) return 'wallet';
        return 'wallet';
      };

      const { data: inserted, error } = await supabase
        .from('transactions')
        .insert({
          amount: amountNumber,
          method: normalizeMethod(paymentData.method) as any,
          status: 'processing' as any,
          order_id: orderId,
          reference_number: `REF${Date.now()}`,
          user_id: user?.id,
          description: paymentData.notes || null,
        })
        .select()
        .single();
      if (error) throw error;

      const newTransaction: Transaction = {
        id: inserted.id,
        order_id: order?.order_number || inserted.order_id || '—',
        amount: inserted.amount,
        method: inserted.method,
        status: inserted.status,
        created_at: inserted.created_at,
        reference: inserted.reference_number || undefined,
        customer_email: paymentData.customer_email,
        notes: paymentData.notes,
      };

      setTransactions(prev => [newTransaction, ...prev]);

      setShowPaymentDialog(false);
      setPaymentData({ amount: '', method: '', customer_email: '', notes: '' });
      toast({ title: t('paymentProcessor.paiementInitie'), description: t('paymentProcessor.leTraitementDuPaiementA') });
    } catch (_error) {
      toast({
        title: "Erreur",
        description: t('paymentProcessor.impossibleDeTraiterLePaiement'),
        variant: "destructive"
      });
    }
  };

  const retryPayment = async (transactionId: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'processing' as any })
        .eq('id', transactionId);
      if (error) throw error;
      setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, status: 'processing' } : t));
      toast({ title: t('paymentProcessor.nouvelleTentative'), description: t('paymentProcessor.uneNouvelleTentativeDePaiement') });
    } catch (_error) {
      toast({
        title: "Erreur",
        description: t('paymentProcessor.impossibleDeRelancerLePaiement'),
        variant: "destructive"
      });
    }
  };

  const refundPayment = async (transactionId: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'refunded' as any })
        .eq('id', transactionId);
      if (error) throw error;
      setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, status: 'refunded' } : t));
      toast({ title: t('paymentProcessor.remboursementEffectue'), description: t('paymentProcessor.leRemboursementAEteTraite') });
    } catch (_error) {
      toast({
        title: "Erreur",
        description: t('paymentProcessor.impossibleDeTraiterLeRemboursement'),
        variant: "destructive"
      });
    }
  };

  const totalTransactions = transactions.length;
  const completedTransactions = transactions.filter(t => t.status === 'completed').length;
  const totalAmount = transactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);
  const successRate = totalTransactions > 0 ? (completedTransactions / totalTransactions) * 100 : 0;

  if (loading) return <div className="p-4">{t('paymentProcessor.chargementDuProcesseurDePaiement')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('paymentProcessor.processeurDePaiement')}</h2>
          <p className="text-muted-foreground">{t('paymentProcessor.interfaceDePaiementStyleAlibaba')}</p>
        </div>
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogTrigger asChild>
            <Button className="bg-vendeur-gradient hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau paiement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('paymentProcessor.traiterUnPaiement')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="order">{t('paymentProcessor.commande')}</Label>
                <Input
                  id="order"
                  placeholder={t('paymentProcessor.numeroDeCommande')}
                  value={selectedOrder}
                  onChange={(e) => setSelectedOrder(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="amount">{t('paymentProcessor.montantGnf')}</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="method">{t('paymentProcessor.methodeDePaiement')}</Label>
                <Select value={paymentData.method} onValueChange={(value) => setPaymentData(prev => ({ ...prev, method: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('paymentProcessor.selectionnerUneMethode')} />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.filter(m => m.available).map((method) => (
                      <SelectItem key={method.id} value={method.name}>
                        {method.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="email">{t('paymentProcessor.emailClient')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('paymentProcessor.clientExampleCom')}
                  value={paymentData.customer_email}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, customer_email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes (optionnel)</Label>
                <Input
                  id="notes"
                  placeholder={t('paymentProcessor.notesSurLePaiement')}
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <Button
                onClick={processPayment}
                className="w-full bg-vendeur-gradient hover:opacity-90"
                disabled={!selectedOrder || !paymentData.amount || !paymentData.method}
              >
                <Send className="w-4 h-4 mr-2" />
                Traiter le paiement
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold">{totalTransactions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#ff4000]" />
              <div>
                <p className="text-sm text-muted-foreground">{t('paymentProcessor.reussies')}</p>
                <p className="text-2xl font-bold text-[#ff4000]">{completedTransactions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-[#ff4000] rounded-full" />
              <div>
                <p className="text-sm text-muted-foreground">{t('paymentProcessor.montantTotal')}</p>
                <p className="text-2xl font-bold">{fc(totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">{t('paymentProcessor.tauxDeReussite')}</p>
                <p className="text-2xl font-bold">{successRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Méthodes de paiement disponibles */}
      <Card>
        <CardHeader>
          <CardTitle>{t('paymentProcessor.methodesDePaiementDisponibles')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paymentMethods.map((method) => {
              const IconComponent = method.icon as unknown;
              return (
                <div key={method.id} className={`p-4 border rounded-lg ${method.available ? 'bg-background' : 'bg-gray-50 opacity-50'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <IconComponent className="w-6 h-6" />
                    <div>
                      <h4 className="font-semibold">{method.name}</h4>
                      <Badge variant={method.available ? "default" : "secondary"}>
                        {method.available ? "Disponible" : "Bientôt"}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Frais: {method.fees}</p>
                    <p>Délai: {method.processing_time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Transactions récentes */}
      <Card>
        <CardHeader>
          <CardTitle>{t('paymentProcessor.transactionsRecentes')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{transaction.order_id}</h4>
                    <Badge className={statusColors[transaction.status]}>
                      {statusLabels[transaction.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{transaction.method}</span>
                    <span>{new Date(transaction.created_at).toLocaleString('fr-FR')}</span>
                    {transaction.reference && <span>Réf: {transaction.reference}</span>}
                  </div>
                  {transaction.customer_email && (
                    <p className="text-sm text-muted-foreground">{transaction.customer_email}</p>
                  )}
                  {transaction.notes && (
                    <p className="text-sm text-orange-600 mt-1">{transaction.notes}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg">{fc(transaction.amount)}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  {transaction.status === 'failed' && (
                    <Button size="sm" variant="outline" onClick={() => retryPayment(transaction.id)}>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Retry
                    </Button>
                  )}
                  {transaction.status === 'completed' && (
                    <Button size="sm" variant="outline" onClick={() => refundPayment(transaction.id)}>
                      <XCircle className="w-4 h-4 mr-1" />
                      Rembourser
                    </Button>
                  )}
                  <Button size="sm" variant="outline">
                    <Eye className="w-4 h-4 mr-1" />
                    Détails
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {transactions.length === 0 && (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('paymentProcessor.aucuneTransaction')}</h3>
              <p className="text-muted-foreground">
                Vous n'avez pas encore traité de paiements.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}