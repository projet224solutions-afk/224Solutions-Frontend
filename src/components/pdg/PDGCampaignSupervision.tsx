/**
 * 📢 PDG CAMPAIGN SUPERVISION - Supervision admin des campagnes vendeurs
 * 224Solutions - Admin Broadcast Oversight
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Megaphone, Search, ShieldAlert, Users, Send, XCircle,
  BarChart3, RefreshCw, AlertTriangle, CheckCircle, Eye,
  Ban, TrendingUp, Clock
} from 'lucide-react';
import {
  listAllCampaignsAdmin, suspendCampaignAdmin, getCampaignAnalytics,
  type VendorCampaign, type CampaignAnalytics,
} from '@/services/campaignBackendService';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  scheduled: 'bg-blue-100 text-blue-800',
  queued: 'bg-orange-100 text-[#ff4000]',
  sending: 'bg-orange-100 text-orange-800',
  sent: 'bg-orange-100 text-[#ff4000]',
  partial: 'bg-orange-100 text-[#ff4000]',
  failed: 'bg-orange-100 text-[#ff4000]',
  cancelled: 'bg-gray-100 text-gray-600',
};

export default function PDGCampaignSupervision() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState<(VendorCampaign & { vendors?: { business_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<VendorCampaign | null>(null);
  const [selectedAnalytics, setSelectedAnalytics] = useState<CampaignAnalytics | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listAllCampaignsAdmin({ limit: 100 });
      setCampaigns(data as any);
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const handleViewDetails = async (campaign: VendorCampaign) => {
    setSelectedCampaign(campaign);
    try {
      const analytics = await getCampaignAnalytics(campaign.id);
      setSelectedAnalytics(analytics);
    } catch {
      setSelectedAnalytics(null);
    }
    setShowDetailDialog(true);
  };

  const handleSuspend = async () => {
    if (!suspendTarget || !suspendReason.trim()) return;
    try {
      await suspendCampaignAdmin(suspendTarget, suspendReason);
      toast({ title: 'Campagne suspendue' });
      setShowSuspendDialog(false);
      setSuspendReason('');
      setSuspendTarget(null);
      loadCampaigns();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  const filtered = campaigns.filter(c =>
    !searchTerm || c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c as any).vendors?.business_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Global stats
  const globalStats = {
    total: campaigns.length,
    sent: campaigns.filter(c => c.status === 'sent').length,
    sending: campaigns.filter(c => ['sending', 'queued'].includes(c.status)).length,
    failed: campaigns.filter(c => c.status === 'failed').length,
    totalMessages: campaigns.reduce((s, c) => s + (c.total_sent || 0), 0),
    totalFailed: campaigns.reduce((s, c) => s + (c.total_failed || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Supervision Campagnes Vendeurs
          </h2>
          <p className="text-sm text-muted-foreground">
            Vue globale et contrôle des campagnes de diffusion
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadCampaigns} className="gap-1">
          <RefreshCw className="h-3 w-3" /> Actualiser
        </Button>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-3 pb-2 text-center">
            <p className="text-2xl font-bold">{globalStats.total}</p>
            <p className="text-[10px] text-muted-foreground">Total campagnes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 text-center">
            <p className="text-2xl font-bold text-[#ff4000]">{globalStats.sent}</p>
            <p className="text-[10px] text-muted-foreground">{t('pDGCampaignSupervision.envoyees')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 text-center">
            <p className="text-2xl font-bold text-orange-600">{globalStats.sending}</p>
            <p className="text-[10px] text-muted-foreground">En cours</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 text-center">
            <p className="text-2xl font-bold text-[#ff4000]">{globalStats.failed}</p>
            <p className="text-[10px] text-muted-foreground">{t('pDGCampaignSupervision.echouees')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 text-center">
            <p className="text-2xl font-bold text-blue-600">{globalStats.totalMessages.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{t('pDGCampaignSupervision.messagesEnvoyes')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 text-center">
            <p className="text-2xl font-bold text-[#ff4000]">{globalStats.totalFailed.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{t('pDGCampaignSupervision.echecsTotal')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t('pDGCampaignSupervision.rechercherParTitreOuVendeur')}
            className="pl-9"
          />
        </div>
      </div>

      {/* Campaign Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Toutes les campagnes ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><RefreshCw className="animate-spin h-5 w-5" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{t('pDGCampaignSupervision.aucuneCampagneTrouvee')}</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(campaign => (
                <div key={campaign.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm truncate">{campaign.title}</h4>
                      <Badge className={`text-[10px] ${STATUS_COLORS[campaign.status] || ''}`}>
                        {campaign.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">
                        {(campaign as any).vendors?.business_name || 'Vendeur'}
                      </span>
                      <span><Users className="inline h-3 w-3" /> {campaign.total_targeted} ciblés</span>
                      <span><Send className="inline h-3 w-3" /> {campaign.total_sent} envoyés</span>
                      <span>{campaign.total_failed > 0 && (
                        <span className="text-[#ff4000]"><AlertTriangle className="inline h-3 w-3" /> {campaign.total_failed} échecs</span>
                      )}</span>
                      <span>{new Date(campaign.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(campaign)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {!['cancelled', 'failed'].includes(campaign.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSuspendTarget(campaign.id); setShowSuspendDialog(true); }}
                      >
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={v => { if (!v) setShowDetailDialog(false); }}>
        <DialogContent className="max-w-xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedCampaign?.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {selectedCampaign && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Statut</Label>
                    <Badge className={`${STATUS_COLORS[selectedCampaign.status]}`}>{selectedCampaign.status}</Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Ciblage</Label>
                    <p className="text-sm">{selectedCampaign.target_type}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Message</Label>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedCampaign.message_body}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <p className="font-bold">{selectedCampaign.total_targeted}</p>
                    <p className="text-[10px] text-muted-foreground">{t('pDGCampaignSupervision.cibles')}</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <p className="font-bold">{selectedCampaign.total_eligible}</p>
                    <p className="text-[10px] text-muted-foreground">{t('pDGCampaignSupervision.eligibles')}</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <p className="font-bold text-[#ff4000]">{selectedCampaign.total_sent}</p>
                    <p className="text-[10px] text-muted-foreground">{t('pDGCampaignSupervision.envoyes')}</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <p className="font-bold text-[#ff4000]">{selectedCampaign.total_failed}</p>
                    <p className="text-[10px] text-muted-foreground">{t('pDGCampaignSupervision.echecs')}</p>
                  </div>
                </div>
                {selectedAnalytics && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">{t('pDGCampaignSupervision.tauxDePerformance')}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="text-center">
                        <p className="text-xl font-bold text-[#ff4000]">{selectedAnalytics.rates.delivery_rate}%</p>
                        <p className="text-[10px] text-muted-foreground">{t('pDGCampaignSupervision.delivrance')}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-blue-600">{selectedAnalytics.rates.read_rate}%</p>
                        <p className="text-[10px] text-muted-foreground">Lecture</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-[#ff4000]">{selectedAnalytics.rates.failure_rate}%</p>
                        <p className="text-[10px] text-muted-foreground">{t('pDGCampaignSupervision.echec')}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={showSuspendDialog} onOpenChange={v => { if (!v) { setShowSuspendDialog(false); setSuspendTarget(null); setSuspendReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> Suspendre la campagne
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('pDGCampaignSupervision.raisonDeLaSuspension')}</Label>
              <Textarea
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
                placeholder={t('pDGCampaignSupervision.exContenuInapproprieSpamViolation')}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowSuspendDialog(false); setSuspendTarget(null); }}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleSuspend} disabled={!suspendReason.trim()} className="gap-2">
                <Ban className="h-4 w-4" /> Suspendre
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
