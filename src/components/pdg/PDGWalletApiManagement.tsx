import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Key, CheckCircle, XCircle, Clock, Shield, Activity,
  RefreshCw, Users, DollarSign, AlertTriangle, Eye, Ban
} from 'lucide-react';
import { WalletApiService, WalletApiRequest, WalletApiKey } from '@/services/walletApiService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function PDGWalletApiManagement() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<WalletApiRequest[]>([]);
  const [keys, setKeys] = useState<WalletApiKey[]>([]);
  const [stats, setStats] = useState({
    totalRequests: 0, pendingRequests: 0, approvedRequests: 0,
    activeKeys: 0, totalTransactions: 0, totalVolume: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState<WalletApiRequest | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [commissionRate, setCommissionRate] = useState('2.5');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqs, apiKeys, apiStats] = await Promise.all([
        WalletApiService.getAllRequests(),
        WalletApiService.getAllKeys(),
        WalletApiService.getApiStats(),
      ]);
      setRequests(reqs);
      setKeys(apiKeys);
      setStats(apiStats);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter(r => r.status === statusFilter);
  }, [requests, statusFilter]);

  const handleApprove = async (request: WalletApiRequest) => {
    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const rate = parseFloat(commissionRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        toast({ title: 'Taux de commission invalide', variant: 'destructive' });
        return;
      }

      const success = await WalletApiService.approveRequest(request.id, user.id, rate);
      if (success) {
        toast({ title: '✅ Demande approuvée', description: 'Les clés API ont été générées' });
        fetchData();
      } else {
        toast({ title: 'Erreur', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      toast({ title: 'Indiquez la raison du refus', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const success = await WalletApiService.rejectRequest(selectedRequest.id, user.id, rejectionReason);
      if (success) {
        toast({ title: 'Demande refusée' });
        setShowRejectDialog(false);
        setRejectionReason('');
        fetchData();
      }
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleKey = async (keyId: string, isActive: boolean) => {
    const success = await WalletApiService.toggleKey(keyId, isActive);
    if (success) {
      toast({ title: isActive ? 'Clé activée' : 'Clé désactivée' });
      fetchData();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-[#ff4000] border-[#ff4000]/50"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case 'approved': return <Badge className="bg-[#ff4000] text-white"><CheckCircle className="w-3 h-3 mr-1" />{t('pDGWalletApiManagement.approuvee')}</Badge>;
      case 'rejected': return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />{t('pDGWalletApiManagement.refusee')}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Key className="w-6 h-6 text-primary" />
            API 224Wallet — Gestion
          </h2>
          <p className="text-sm text-muted-foreground">{t('pDGWalletApiManagement.demandesDAccesClesApi')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Demandes</p>
            <p className="text-xl font-bold">{stats.totalRequests}</p>
          </CardContent>
        </Card>
        <Card className="border-[#ff4000]/30 bg-[#ff4000]/5">
          <CardContent className="p-3">
            <p className="text-xs text-[#ff4000]">En attente</p>
            <p className="text-xl font-bold text-[#ff4000]">{stats.pendingRequests}</p>
          </CardContent>
        </Card>
        <Card className="border-[#ff4000]/30 bg-[#ff4000]/5">
          <CardContent className="p-3">
            <p className="text-xs text-[#ff4000]">{t('pDGWalletApiManagement.approuvees')}</p>
            <p className="text-xl font-bold text-[#ff4000]">{stats.approvedRequests}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{t('pDGWalletApiManagement.clesActives')}</p>
            <p className="text-xl font-bold">{stats.activeKeys}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="text-xl font-bold">{stats.totalTransactions}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3">
            <p className="text-xs text-primary">Volume</p>
            <p className="text-lg font-bold text-primary">{WalletApiService.formatAmount(stats.totalVolume)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">
            <Users className="w-3.5 h-3.5 mr-1.5" />
            Demandes
            {stats.pendingRequests > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">{stats.pendingRequests}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="keys">
            <Key className="w-3.5 h-3.5 mr-1.5" />Clés API
          </TabsTrigger>
        </TabsList>

        {/* Demandes */}
        <TabsContent value="requests" className="space-y-4">
          {/* Filtres */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'Toutes', count: requests.length },
              { value: 'pending', label: 'En attente', count: requests.filter(r => r.status === 'pending').length },
              { value: 'approved', label: 'Approuvées', count: requests.filter(r => r.status === 'approved').length },
              { value: 'rejected', label: 'Refusées', count: requests.filter(r => r.status === 'rejected').length },
            ].map(f => (
              <Button
                key={f.value}
                variant={statusFilter === f.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label} ({f.count})
              </Button>
            ))}
          </div>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('pDGWalletApiManagement.service')}</TableHead>
                      <TableHead>Cas d'utilisation</TableHead>
                      <TableHead>{t('pDGWalletApiManagement.volumeEstime')}</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                          Aucune demande
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRequests.map(req => (
                        <TableRow key={req.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{req.business_name}</p>
                              {req.website_url && (
                                <a href={req.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                                  {req.website_url}
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <p className="text-xs truncate">{req.use_case}</p>
                          </TableCell>
                          <TableCell className="text-xs">{req.expected_volume || '-'}</TableCell>
                          <TableCell className="text-xs">
                            {format(new Date(req.created_at), 'dd MMM yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell>{getStatusBadge(req.status)}</TableCell>
                          <TableCell>
                            {req.status === 'pending' && (
                              <div className="flex gap-1">
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    step="0.5"
                                    value={commissionRate}
                                    onChange={e => setCommissionRate(e.target.value)}
                                    className="w-16 h-7 text-xs"
                                    title={t('pDGWalletApiManagement.tauxDeCommission')}
                                  />
                                  <span className="text-xs text-muted-foreground">%</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-[#ff4000] hover:text-[#ff4000] h-7"
                                  onClick={() => handleApprove(req)}
                                  disabled={submitting}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />Approuver
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive h-7"
                                  onClick={() => { setSelectedRequest(req); setShowRejectDialog(true); }}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />Refuser
                                </Button>
                              </div>
                            )}
                            {req.status === 'rejected' && req.rejection_reason && (
                              <span className="text-xs text-muted-foreground italic">{req.rejection_reason}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clés API */}
        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('pDGWalletApiManagement.clesApiActives')}</CardTitle>
              <CardDescription>{t('pDGWalletApiManagement.toutesLesClesApi224wallet')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>{t('pDGWalletApiManagement.cle')}</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Transactions</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                          Aucune clé API
                        </TableCell>
                      </TableRow>
                    ) : (
                      keys.map(key => (
                        <TableRow key={key.id}>
                          <TableCell className="font-medium text-sm">{key.key_name}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">{key.api_key.slice(0, 16)}...</code>
                          </TableCell>
                          <TableCell>
                            {key.is_test_mode ? (
                              <Badge variant="outline" className="text-[#ff4000] border-[#ff4000]/50 text-[10px]">
                                <AlertTriangle className="w-3 h-3 mr-0.5" /> Test
                              </Badge>
                            ) : (
                              <Badge className="bg-[#ff4000] text-white text-[10px]">Production</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{key.commission_rate}%</TableCell>
                          <TableCell className="font-medium">{key.total_transactions}</TableCell>
                          <TableCell className="text-sm">{WalletApiService.formatAmount(key.total_volume_gnf)}</TableCell>
                          <TableCell>
                            <Badge variant={key.is_active ? 'default' : 'secondary'}>
                              {key.is_active ? 'Actif' : 'Inactif'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleKey(key.id, !key.is_active)}
                              className={key.is_active ? 'text-destructive' : 'text-[#ff4000]'}
                            >
                              {key.is_active ? <Ban className="w-4 h-4 mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                              {key.is_active ? 'Désactiver' : 'Activer'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pDGWalletApiManagement.refuserLaDemande')}</DialogTitle>
            <DialogDescription>
              Refuser la demande API de {selectedRequest?.business_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{t('pDGWalletApiManagement.raisonDuRefus')}</Label>
            <Textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder={t('pDGWalletApiManagement.expliquezPourquoiLaDemandeEst')}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>{t('pDGWalletApiManagement.annuler')}</Button>
            <Button variant="destructive" onClick={handleReject} disabled={submitting || !rejectionReason.trim()}>
              {submitting ? 'Refus...' : 'Confirmer le refus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
