/**
 * COMPOSANT: File d'attente de révision des paiements (Admin)
 * 224SOLUTIONS - Système de déblocage intelligent des fonds
 */

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  Clock,
  TrendingUp,
  User,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PendingPayment {
  transaction_id: string;
  stripe_payment_intent_id: string;
  amount: number;
  seller_net_amount: number;
  payment_created_at: string;
  trust_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  decision: string;
  random_review: boolean;
  auto_blocked: boolean;
  block_reasons: string[];
  release_id: string;
  scheduled_release_at: string;
  release_status: string;
  seller_email: string;
  seller_name: string;
  buyer_email: string;
  buyer_name: string;
  seller_kyc_status: string;
  unresolved_fraud_signals: number;
}

export function PaymentReviewQueue() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  useEffect(() => {
    fetchPendingPayments();

    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchPendingPayments, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_payment_review_queue')
        .select('*')
        .order('payment_created_at', { ascending: false });

      if (error) throw error;

      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      toast.error(t('paymentReviewQueue.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedPayment) return;

    setActionLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await supabase.functions.invoke('admin-review-payment', {
        body: {
          action: 'approve',
          releaseId: selectedPayment.release_id,
          adminId: user.id,
          notes: approvalNotes || null,
        },
      });

      if (response.error) throw response.error;

      toast.success(t('paymentReviewQueue.paiementApprouveEtFondsLiberes'), {
        description: `${(selectedPayment.seller_net_amount / 100).toFixed(2)} XOF crédités`,
      });

      setShowApproveDialog(false);
      setApprovalNotes('');
      setSelectedPayment(null);
      fetchPendingPayments();

    } catch (error) {
      console.error('Error approving payment:', error);
      toast.error(t('paymentReviewQueue.erreurLorsDeLApprobation'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayment || !rejectionReason.trim()) {
      toast.error(t('paymentReviewQueue.veuillezFournirUneRaisonDe'));
      return;
    }

    setActionLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await supabase.functions.invoke('admin-review-payment', {
        body: {
          action: 'reject',
          releaseId: selectedPayment.release_id,
          adminId: user.id,
          reason: rejectionReason,
        },
      });

      if (response.error) throw response.error;

      toast.success(t('paymentReviewQueue.paiementRejeteEtRemboursementInitie'), {
        description: 'L\'acheteur sera remboursé sous 5-10 jours',
      });

      setShowRejectDialog(false);
      setRejectionReason('');
      setSelectedPayment(null);
      fetchPendingPayments();

    } catch (error) {
      console.error('Error rejecting payment:', error);
      toast.error(t('paymentReviewQueue.erreurLorsDuRejet'));
    } finally {
      setActionLoading(false);
    }
  };

  const getRiskLevelBadge = (level: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      LOW: { variant: 'default', icon: CheckCircle },
      MEDIUM: { variant: 'secondary', icon: AlertTriangle },
      HIGH: { variant: 'destructive', icon: AlertTriangle },
      CRITICAL: { variant: 'destructive', icon: XCircle },
    };

    const config = variants[level] || variants.MEDIUM;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {level}
      </Badge>
    );
  };

  const getTrustScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#ff4000]';
    if (score >= 60) return 'text-[#ff4000]';
    return 'text-[#ff4000]';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                File d'attente de révision des paiements
              </CardTitle>
              <CardDescription>
                Paiements nécessitant une validation manuelle
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {payments.length} en attente
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <CheckCircle className="h-16 w-16 mb-4" />
              <p className="text-lg font-medium">{t('paymentReviewQueue.aucunPaiementEnAttente')}</p>
              <p className="text-sm">{t('paymentReviewQueue.tousLesPaiementsOntEte')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>{t('paymentReviewQueue.vendeur')}</TableHead>
                  <TableHead>Acheteur</TableHead>
                  <TableHead className="text-right">{t('paymentReviewQueue.montant')}</TableHead>
                  <TableHead>Trust Score</TableHead>
                  <TableHead>Risque</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Signaux</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.transaction_id}>
                    {/* Date */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm">
                          {formatDistanceToNow(new Date(payment.payment_created_at), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </div>
                      </div>
                      {payment.random_review && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          Contrôle aléatoire
                        </Badge>
                      )}
                    </TableCell>

                    {/* Vendeur */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{payment.seller_name || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">
                            {payment.seller_email}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Acheteur */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{payment.buyer_name || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">
                            {payment.buyer_email}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Montant */}
                    <TableCell className="text-right">
                      <div className="font-bold text-lg">
                        {(payment.seller_net_amount / 100).toFixed(2)} XOF
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total: {(payment.amount / 100).toFixed(2)} XOF
                      </div>
                    </TableCell>

                    {/* Trust Score */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        <span className={`font-bold text-lg ${getTrustScoreColor(payment.trust_score)}`}>
                          {payment.trust_score}/100
                        </span>
                      </div>
                    </TableCell>

                    {/* Risque */}
                    <TableCell>
                      {getRiskLevelBadge(payment.risk_level)}
                    </TableCell>

                    {/* KYC */}
                    <TableCell>
                      <Badge
                        variant={payment.seller_kyc_status === 'verified' ? 'default' : 'secondary'}
                      >
                        {payment.seller_kyc_status === 'verified' ? '✓ Vérifié' : 'Non vérifié'}
                      </Badge>
                    </TableCell>

                    {/* Signaux de fraude */}
                    <TableCell>
                      {payment.unresolved_fraud_signals > 0 ? (
                        <Badge variant="destructive">
                          {payment.unresolved_fraud_signals} signal{payment.unresolved_fraud_signals > 1 ? 'aux' : ''}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">{t('paymentReviewQueue.aucun')}</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowApproveDialog(true);
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowRejectDialog(true);
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rejeter
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog d'approbation */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('paymentReviewQueue.approuverLePaiement')}</DialogTitle>
            <DialogDescription>
              Les fonds seront immédiatement libérés sur le wallet du vendeur.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">{t('paymentReviewQueue.montant2')}</span>
                  <span className="font-bold">
                    {(selectedPayment.seller_net_amount / 100).toFixed(2)} XOF
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Trust Score:</span>
                  <span className={getTrustScoreColor(selectedPayment.trust_score)}>
                    {selectedPayment.trust_score}/100
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">{t('paymentReviewQueue.vendeur2')}</span>
                  <span>{selectedPayment.seller_name}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optionnel)</label>
                <Textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder={t('paymentReviewQueue.raisonDeLApprobationManuelle')}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowApproveDialog(false);
                setApprovalNotes('');
              }}
              disabled={actionLoading}
            >
              Annuler
            </Button>
            <Button onClick={handleApprove} disabled={actionLoading}>
              {actionLoading ? 'Traitement...' : 'Approuver et libérer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de rejet */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('paymentReviewQueue.rejeterLePaiement')}</DialogTitle>
            <DialogDescription>
              Un remboursement sera automatiquement initié via Stripe.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="bg-destructive/10 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">{t('paymentReviewQueue.montantARembourser')}</span>
                  <span className="font-bold">
                    {(selectedPayment.amount / 100).toFixed(2)} XOF
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Acheteur:</span>
                  <span>{selectedPayment.buyer_name}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-destructive">
                  Raison du rejet *
                </label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={t('paymentReviewQueue.expliquezPourquoiCePaiementEst')}
                  rows={4}
                  required
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason('');
              }}
              disabled={actionLoading}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading || !rejectionReason.trim()}
            >
              {actionLoading ? 'Traitement...' : 'Rejeter et rembourser'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
