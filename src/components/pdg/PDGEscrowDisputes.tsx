/**
 * 🚨 GESTION DES LITIGES ESCROW - PDG
 * Interface pour consulter et résoudre les litiges
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EscrowDisputeThread } from '@/components/disputes/EscrowDisputeThread';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';
import { LocalPrice } from '@/components/ui/LocalPrice';
import {
  AlertTriangle, CheckCircle, XCircle, User, Phone, Mail,
  DollarSign, Clock, Shield, RefreshCw
} from 'lucide-react';
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

interface EscrowDispute {
  id: string;
  escrow_id: string;
  initiator_user_id: string;
  initiator_role: string;
  reason: string;
  status: string;
  resolution: string | null;
  resolution_notes: string | null;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
  // Enriched
  initiator_profile?: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
  };
  escrow?: {
    amount: number;
    currency: string | null;
    payer_id: string;
    receiver_id: string;
    order_id: string | null;
    status: string | null;
  };
  buyer_profile?: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
  };
  seller_profile?: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
  };
}

export default function PDGEscrowDisputes() {
  const { t } = useTranslation();
  const [disputes, setDisputes] = useState<EscrowDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveDialog, setResolveDialog] = useState<{
    disputeId: string;
    resolution: 'release_to_seller' | 'refund_to_buyer';
  } | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const loadDisputes = async () => {
    setLoading(true);
    try {
      // ⚠️ Chargement via le BACKEND NODE (service_role). La RLS de escrow_disputes
      // ne montre au client QUE ses propres litiges (initiator = auth.uid()) : le PDG
      // n'étant pas l'initiateur, il ne voyait RIEN. Le backend contourne ça et
      // renvoie TOUS les litiges déjà enrichis (escrow + profils + emails) en 1 appel.
      const res = await backendFetch<any[]>('/api/admin/disputes/list', { method: 'GET' });
      if (!res.success) throw new Error(res.error || 'Erreur');
      setDisputes(res.data || []);
    } catch (err) {
      console.error('Error loading disputes:', err);
      toast.error(t('pDGEscrowDisputes.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDisputes();
  }, []);

  const handleResolve = async () => {
    if (!resolveDialog) return;
    setResolving(true);
    try {
      // Résolution via le backend Node.js (RPC atomique resolve_escrow_dispute).
      const res = await backendFetch<{ resolution: string }>('/api/admin/disputes/resolve', {
        method: 'POST',
        body: {
          dispute_id: resolveDialog.disputeId,
          resolution: resolveDialog.resolution,
          resolution_notes: resolutionNotes,
        },
      });
      if (!res.success) throw new Error(res.error || 'Erreur');

      toast.success(t('pDGEscrowDisputes.litigeResoluAvecSucces'));
      setResolveDialog(null);
      setResolutionNotes('');
      await loadDisputes();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la résolution');
    } finally {
      setResolving(false);
    }
  };

  const openDisputes = disputes.filter(d => d.status === 'open');
  const resolvedDisputes = disputes.filter(d => d.status === 'resolved');

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              Litiges Escrow
            </h2>
            <p className="text-muted-foreground text-sm">
              {openDisputes.length} litige(s) en attente de résolution
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadDisputes} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Open disputes */}
        {openDisputes.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-destructive">🔴 Litiges ouverts</h3>
            {openDisputes.map((dispute) => (
              <Card key={dispute.id} className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">Ouvert</Badge>
                        <Badge variant="outline">
                          {dispute.initiator_role === 'buyer' ? '🛒 Acheteur' : '🏪 Vendeur'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(dispute.created_at).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <p className="font-semibold text-lg">
                        Montant: <LocalPrice amount={dispute.escrow?.amount || 0} currency={dispute.escrow?.currency || 'GNF'} size="lg" />
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-[#ff4000] hover:bg-[#ff4000]"
                        onClick={() => setResolveDialog({ disputeId: dispute.id, resolution: 'release_to_seller' })}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Libérer au vendeur
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setResolveDialog({ disputeId: dispute.id, resolution: 'refund_to_buyer' })}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Rembourser l'acheteur
                      </Button>
                    </div>
                  </div>

                  <div className="bg-background/80 rounded-lg p-4">
                    <p className="text-sm font-medium mb-1">{t('pDGEscrowDisputes.raisonDuLitige')}</p>
                    <p className="text-sm text-muted-foreground">{dispute.reason}</p>
                  </div>

                  {/* Fil tripartite : le PDG arbitre et peut écrire aux 2 parties */}
                  <EscrowDisputeThread escrowDisputeId={dispute.id} currentParty="admin" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Initiator info */}
                    <div className="bg-background border rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-primary uppercase">
                        {dispute.initiator_role === 'buyer' ? '🛒 Acheteur (Déclencheur)' : '🏪 Vendeur (Déclencheur)'}
                      </p>
                      <div className="space-y-1 text-sm">
                        <p className="flex items-center gap-2">
                          <User className="w-3 h-3" />
                          {dispute.initiator_profile?.full_name || 'N/A'}
                        </p>
                        <p className="flex items-center gap-2">
                          <Phone className="w-3 h-3" />
                          {dispute.initiator_profile?.phone || 'N/A'}
                        </p>
                        <p className="flex items-center gap-2">
                          <Mail className="w-3 h-3" />
                          {dispute.initiator_profile?.email || 'N/A'}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground">
                          ID: {dispute.initiator_user_id.slice(0, 12)}...
                        </p>
                      </div>
                    </div>

                    {/* Other party */}
                    <div className="bg-background border rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-primary uppercase">
                        {dispute.initiator_role === 'buyer' ? '🏪 Vendeur' : '🛒 Acheteur'}
                      </p>
                      {(() => {
                        const otherProfile = dispute.initiator_role === 'buyer'
                          ? dispute.seller_profile
                          : dispute.buyer_profile;
                        return (
                          <div className="space-y-1 text-sm">
                            <p className="flex items-center gap-2">
                              <User className="w-3 h-3" />
                              {otherProfile?.full_name || 'N/A'}
                            </p>
                            <p className="flex items-center gap-2">
                              <Phone className="w-3 h-3" />
                              {otherProfile?.phone || 'N/A'}
                            </p>
                            <p className="flex items-center gap-2">
                              <Mail className="w-3 h-3" />
                              {otherProfile?.email || 'N/A'}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Resolved disputes */}
        {resolvedDisputes.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-muted-foreground">✅ Litiges résolus ({resolvedDisputes.length})</h3>
            {resolvedDisputes.slice(0, 10).map((dispute) => (
              <Card key={dispute.id} className="opacity-80">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">
                        {dispute.resolution === 'release_to_seller' ? '→ Vendeur' : '← Acheteur'}
                      </Badge>
                      <span className="text-sm">
                        <LocalPrice amount={dispute.escrow?.amount || 0} currency={dispute.escrow?.currency || 'GNF'} size="sm" />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Résolu le {dispute.resolved_at ? new Date(dispute.resolved_at).toLocaleDateString('fr-FR') : 'N/A'}
                      </span>
                    </div>
                    {dispute.resolution_notes && (
                      <p className="text-xs text-muted-foreground max-w-xs truncate">
                        {dispute.resolution_notes}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {disputes.length === 0 && !loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-semibold">{t('pDGEscrowDisputes.aucunLitige')}</p>
              <p className="text-muted-foreground text-sm">{t('pDGEscrowDisputes.tousLesPaiementsEscrowSe')}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Resolve dialog */}
      <AlertDialog open={!!resolveDialog} onOpenChange={() => { setResolveDialog(null); setResolutionNotes(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {resolveDialog?.resolution === 'release_to_seller'
                ? <><CheckCircle className="w-5 h-5 text-[#ff4000]" />{t('pDGEscrowDisputes.libererLesFondsAuVendeur')}</>
                : <><XCircle className="w-5 h-5 text-blue-600" />Rembourser l'acheteur</>
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resolveDialog?.resolution === 'release_to_seller'
                ? 'Les fonds seront transférés au vendeur avec la commission. Cette action est irréversible.'
                : 'Les fonds seront intégralement remboursés à l\'acheteur. Cette action est irréversible.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={t('pDGEscrowDisputes.notesDeResolutionOptionnel')}
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            className="min-h-[80px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resolving}>{t('pDGEscrowDisputes.annuler')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResolve}
              disabled={resolving}
              className={resolveDialog?.resolution === 'release_to_seller' ? 'bg-[#ff4000] hover:bg-[#ff4000]' : 'bg-blue-600 hover:bg-blue-700'}
            >
              {resolving ? 'Traitement...' : 'Confirmer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
