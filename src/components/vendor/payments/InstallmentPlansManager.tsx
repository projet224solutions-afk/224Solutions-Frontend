/**
 * GESTIONNAIRE PAIEMENTS ÉCHELONNÉS
 * Créer et suivre les plans de paiement en plusieurs fois
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar, DollarSign, Plus, Clock, CheckCircle2,
  AlertCircle, User, CreditCard, ChevronDown, ChevronUp
} from 'lucide-react';

interface InstallmentPlan {
  id: string;
  customer_name: string;
  order_id?: string;
  total_amount: number;
  number_of_installments: number;
  installment_amount: number;
  remaining_amount: number;
  start_date: string;
  status: string;
  created_at: string;
}

interface InstallmentPayment {
  id: string;
  plan_id: string;
  installment_number: number;
  amount_due: number;
  amount_paid: number | null;
  due_date: string;
  payment_date: string | null;
  status: string;
}

export default function InstallmentPlansManager() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { vendorId } = useCurrentVendor();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [payments, setPayments] = useState<Record<string, InstallmentPayment[]>>({});
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [newPlan, setNewPlan] = useState({
    customer_name: '',
    total_amount: '',
    number_of_installments: '3',
    start_date: ''
  });

  const loadData = async () => {
    if (!vendorId) return;
    setLoading(true);

    try {
      // Charger les plans
      const { data: plansData, error: plansError } = await supabase
        .from('installment_plans')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (plansError) throw plansError;

      const formattedPlans = (plansData || []).map(p => ({
        id: p.id,
        customer_name: p.customer_name || 'Client',
        order_id: p.order_id || undefined,
        total_amount: p.total_amount,
        number_of_installments: p.number_of_installments,
        installment_amount: p.installment_amount,
        remaining_amount: p.remaining_amount,
        start_date: p.start_date,
        status: p.status,
        created_at: p.created_at
      }));

      setPlans(formattedPlans);

      // Charger les paiements pour chaque plan
      const paymentsMap: Record<string, InstallmentPayment[]> = {};
      for (const plan of formattedPlans) {
        const { data: paymentsData } = await supabase
          .from('installment_payments')
          .select('*')
          .eq('plan_id', plan.id)
          .order('installment_number');

        paymentsMap[plan.id] = (paymentsData || []).map(p => ({
          id: p.id,
          plan_id: p.plan_id,
          installment_number: p.installment_number,
          amount_due: p.amount_due,
          amount_paid: p.amount_paid,
          due_date: p.due_date,
          payment_date: p.payment_date,
          status: p.status
        }));
      }
      setPayments(paymentsMap);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const createPlan = async () => {
    if (!vendorId || !newPlan.customer_name || !newPlan.total_amount || !newPlan.start_date) {
      toast({ title: t('installmentPlansManager.veuillezRemplirTousLesChamps'), variant: 'destructive' });
      return;
    }

    const totalAmount = parseFloat(newPlan.total_amount);
    const numInstallments = parseInt(newPlan.number_of_installments);
    const installmentAmount = Math.ceil(totalAmount / numInstallments);

    try {
      // Créer le plan
      const { data: planData, error: planError } = await supabase
        .from('installment_plans')
        .insert([{
          vendor_id: vendorId,
          customer_name: newPlan.customer_name,
          total_amount: totalAmount,
          number_of_installments: numInstallments,
          installment_amount: installmentAmount,
          remaining_amount: totalAmount,
          start_date: newPlan.start_date,
          status: 'active'
        }])
        .select()
        .single();

      if (planError) throw planError;

      // Créer les échéances
      const installments = [];
      const firstDate = new Date(newPlan.start_date);

      for (let i = 0; i < numInstallments; i++) {
        const dueDate = new Date(firstDate);
        dueDate.setMonth(dueDate.getMonth() + i);

        installments.push({
          plan_id: planData.id,
          installment_number: i + 1,
          amount_due: i === numInstallments - 1
            ? totalAmount - (installmentAmount * (numInstallments - 1))
            : installmentAmount,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'pending'
        });
      }

      const { error: installmentsError } = await supabase
        .from('installment_payments')
        .insert(installments);

      if (installmentsError) throw installmentsError;

      toast({ title: t('installmentPlansManager.planDePaiementCree') });
      setIsCreateOpen(false);
      setNewPlan({ customer_name: '', total_amount: '', number_of_installments: '3', start_date: '' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const markAsPaid = async (paymentId: string, _planId: string, _amountDue: number) => {
    try {
      // Règlement ATOMIQUE côté serveur (verrou + recalcul du restant depuis la source) :
      // remplace l'ancien double-UPDATE client qui pouvait corrompre remaining_amount (lost-update).
      const { data, error } = await supabase.rpc('pay_installment_atomic' as any, { p_installment_id: paymentId });
      if (error) throw error;
      const res = data as any;
      toast({ title: res?.already_paid ? 'Échéance déjà réglée' : '✅ Paiement enregistré' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  // Stats
  const activePlans = plans.filter(p => p.status === 'active').length;
  const totalExpected = plans.reduce((sum, p) => sum + p.total_amount, 0);
  const totalReceived = plans.reduce((sum, p) => sum + (p.total_amount - p.remaining_amount), 0);
  const overduePayments = Object.values(payments).flat().filter(p =>
    p.status === 'pending' && new Date(p.due_date) < new Date()
  ).length;

  if (loading) {
    return <div className="p-4 text-center">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            Paiements Échelonnés
          </h2>
          <p className="text-sm text-muted-foreground">
            Gérez les paiements en plusieurs fois
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('installmentPlansManager.creerUnPlanDePaiement')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('installmentPlansManager.nomDuClient')}</label>
                <Input
                  placeholder={t('installmentPlansManager.nomDuClient2')}
                  value={newPlan.customer_name}
                  onChange={(e) => setNewPlan({ ...newPlan, customer_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('installmentPlansManager.montantTotalGnf')}</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newPlan.total_amount}
                  onChange={(e) => setNewPlan({ ...newPlan, total_amount: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('installmentPlansManager.nombreDEcheances')}</label>
                <select
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  value={newPlan.number_of_installments}
                  onChange={(e) => setNewPlan({ ...newPlan, number_of_installments: e.target.value })}
                >
                  <option value="2">2 fois</option>
                  <option value="3">3 fois</option>
                  <option value="4">4 fois</option>
                  <option value="6">6 fois</option>
                  <option value="12">12 fois</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">{t('installmentPlansManager.datePremiereEcheance')}</label>
                <Input
                  type="date"
                  value={newPlan.start_date}
                  onChange={(e) => setNewPlan({ ...newPlan, start_date: e.target.value })}
                />
              </div>

              {newPlan.total_amount && newPlan.number_of_installments && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <strong>{parseInt(newPlan.number_of_installments)}</strong> versements de{' '}
                    <strong>
                      {fc(Math.ceil(parseFloat(newPlan.total_amount || '0') / parseInt(newPlan.number_of_installments)))}
                    </strong>
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{t('installmentPlansManager.annuler')}</Button>
                <Button onClick={createPlan}>{t('installmentPlansManager.creer')}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Plans actifs</p>
                <p className="text-lg font-bold">{activePlans}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#ff4000]" />
              <div>
                <p className="text-xs text-muted-foreground">{t('installmentPlansManager.recu')}</p>
                <p className="text-lg font-bold text-[#ff4000]">{totalReceived.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">En attente</p>
                <p className="text-lg font-bold text-orange-600">{(totalExpected - totalReceived).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className={`w-5 h-5 ${overduePayments > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-xs text-muted-foreground">En retard</p>
                <p className={`text-lg font-bold ${overduePayments > 0 ? 'text-destructive' : ''}`}>{overduePayments}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des plans */}
      <div className="space-y-4">
        {plans.map((plan) => {
          const isExpanded = expandedPlan === plan.id;
          const planPayments = payments[plan.id] || [];
          const paidCount = planPayments.filter(p => p.status === 'paid').length;
          const progress = (paidCount / plan.number_of_installments) * 100;

          return (
            <Card key={plan.id}>
              <CardContent className="p-4">
                {/* En-tête du plan */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${plan.status === 'completed' ? 'bg-orange-100 dark:bg-[#ff4000]/30' : 'bg-primary/10'}`}>
                      <User className={`w-4 h-4 ${plan.status === 'completed' ? 'text-[#ff4000]' : 'text-primary'}`} />
                    </div>
                    <div>
                      <p className="font-semibold">{plan.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {paidCount}/{plan.number_of_installments} versements
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold">{fc(plan.total_amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {fc(plan.installment_amount)}/mois
                      </p>
                    </div>
                    <Badge variant={plan.status === 'completed' ? 'default' : 'secondary'}>
                      {plan.status === 'completed' ? 'Terminé' : 'Actif'}
                    </Badge>
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {/* Barre de progression */}
                <div className="mt-3">
                  <Progress value={progress} className="h-2" />
                </div>

                {/* Détails des échéances */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    {planPayments.map((payment) => {
                      const isOverdue = payment.status === 'pending' && new Date(payment.due_date) < new Date();

                      return (
                        <div
                          key={payment.id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            payment.status === 'paid'
                              ? 'bg-orange-50 dark:bg-[#ff4000]/20'
                              : isOverdue
                                ? 'bg-destructive/10'
                                : 'bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {payment.status === 'paid' ? (
                              <CheckCircle2 className="w-5 h-5 text-[#ff4000]" />
                            ) : isOverdue ? (
                              <AlertCircle className="w-5 h-5 text-destructive" />
                            ) : (
                              <Clock className="w-5 h-5 text-muted-foreground" />
                            )}
                            <div>
                              <p className="font-medium">Échéance {payment.installment_number}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(payment.due_date).toLocaleDateString('fr-FR')}
                                {payment.payment_date && ` - Payé le ${new Date(payment.payment_date).toLocaleDateString('fr-FR')}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold">{fc(payment.amount_due)}</span>
                            {payment.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsPaid(payment.id, plan.id, payment.amount_due);
                                }}
                              >
                                Marquer payé
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {plans.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">{t('installmentPlansManager.aucunPlanDePaiement')}</p>
              <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                Créer mon premier plan
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
