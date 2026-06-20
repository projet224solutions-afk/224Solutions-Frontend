/**
 * 📢 VENDOR CAMPAIGN CENTER - Centre de campagnes vendeur
 * 224Solutions - Système de diffusion multicanal
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Megaphone, Plus, Send, Users, Mail, MessageSquare, Bell,
  Smartphone, BarChart3, Clock, CheckCircle, XCircle, AlertTriangle,
  Eye, TrendingUp, Filter, Calendar, Pause, RefreshCw, Target
} from 'lucide-react';
import {
  listCampaigns, createCampaign, sendCampaign, cancelCampaign,
  getCampaign, getCampaignAnalytics, previewAudience,
  type VendorCampaign, type CampaignChannel, type CampaignTargetType,
  type AudiencePreview, type CampaignAnalytics, type CreateCampaignPayload,
} from '@/services/campaignBackendService';

// ==================== CONSTANTS (libellés = clés i18n, traduits au rendu) ====================

const TARGET_TYPES: { value: CampaignTargetType; labelKey: string; descKey: string }[] = [
  { value: 'all_clients', labelKey: 'campaignCenter.targetAllClients', descKey: 'campaignCenter.targetAllClientsDesc' },
  { value: 'digital_only', labelKey: 'campaignCenter.targetDigital', descKey: 'campaignCenter.targetDigitalDesc' },
  { value: 'physical_only', labelKey: 'campaignCenter.targetPhysical', descKey: 'campaignCenter.targetPhysicalDesc' },
  { value: 'hybrid', labelKey: 'campaignCenter.targetHybrid', descKey: 'campaignCenter.targetHybridDesc' },
  { value: 'active', labelKey: 'campaignCenter.targetActive', descKey: 'campaignCenter.targetActiveDesc' },
  { value: 'inactive', labelKey: 'campaignCenter.targetInactive', descKey: 'campaignCenter.targetInactiveDesc' },
  { value: 'recent_buyers', labelKey: 'campaignCenter.targetRecent', descKey: 'campaignCenter.targetRecentDesc' },
  { value: 'dormant', labelKey: 'campaignCenter.targetDormant', descKey: 'campaignCenter.targetDormantDesc' },
  { value: 'vip', labelKey: 'campaignCenter.targetVip', descKey: 'campaignCenter.targetVipDesc' },
  { value: 'custom', labelKey: 'campaignCenter.targetCustom', descKey: 'campaignCenter.targetCustomDesc' },
];

const CHANNELS: { id: CampaignChannel; labelKey: string; icon: typeof Mail; descKey: string }[] = [
  { id: 'in_app', labelKey: 'campaignCenter.chInApp', icon: Bell, descKey: 'campaignCenter.chInAppDesc' },
  { id: 'push', labelKey: 'campaignCenter.chPush', icon: Smartphone, descKey: 'campaignCenter.chPushDesc' },
  { id: 'email', labelKey: 'campaignCenter.chEmail', icon: Mail, descKey: 'campaignCenter.chEmailDesc' },
  { id: 'sms', labelKey: 'campaignCenter.chSms', icon: MessageSquare, descKey: 'campaignCenter.chSmsDesc' },
];

const MESSAGE_TYPES = [
  { value: 'announcement', labelKey: 'campaignCenter.msgAnnouncement' },
  { value: 'promotion', labelKey: 'campaignCenter.msgPromotion' },
  { value: 'alert', labelKey: 'campaignCenter.msgAlert' },
  { value: 'update', labelKey: 'campaignCenter.msgUpdate' },
  { value: 'newsletter', labelKey: 'campaignCenter.msgNewsletter' },
  { value: 'reminder', labelKey: 'campaignCenter.msgReminder' },
];

const STATUS_CONFIG: Record<string, { labelKey: string; color: string; icon: typeof CheckCircle }> = {
  draft: { labelKey: 'campaignCenter.statusDraft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200', icon: Clock },
  scheduled: { labelKey: 'campaignCenter.statusScheduled', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Calendar },
  queued: { labelKey: 'campaignCenter.statusQueued', color: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000] dark:text-orange-200', icon: Clock },
  sending: { labelKey: 'campaignCenter.statusSending', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: Send },
  sent: { labelKey: 'campaignCenter.statusSent', color: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000] dark:text-orange-200', icon: CheckCircle },
  partial: { labelKey: 'campaignCenter.statusPartial', color: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000] dark:text-orange-200', icon: AlertTriangle },
  failed: { labelKey: 'campaignCenter.statusFailed', color: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000] dark:text-orange-200', icon: XCircle },
  cancelled: { labelKey: 'campaignCenter.statusCancelled', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: Pause },
};

// ==================== MAIN COMPONENT ====================

export default function VendorCampaignCenter() {
  const { t } = useTranslation();
  const { vendorId, loading: vendorLoading } = useCurrentVendor();
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState<VendorCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<VendorCampaign | null>(null);
  const [selectedAnalytics, setSelectedAnalytics] = useState<CampaignAnalytics | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // ==================== DATA LOADING ====================

  const loadCampaigns = useCallback(async () => {
    if (!vendorId) return;
    try {
      setLoading(true);
      const data = await listCampaigns(statusFilter);
      setCampaigns(data);
    } catch (err: any) {
      toast({ title: t('campaignCenter.error'), description: err.message || t('campaignCenter.loadError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [vendorId, statusFilter, toast, t]);

  useEffect(() => {
    if (!vendorLoading && vendorId) loadCampaigns();
  }, [vendorLoading, vendorId, loadCampaigns]);

  // ==================== ACTIONS ====================

  const handleSendCampaign = async (campaignId: string) => {
    try {
      const result = await sendCampaign(campaignId);
      toast({
        title: t('campaignCenter.campaignLaunched'),
        description: `${result.total_eligible} ${t('campaignCenter.eligibleRecipients')}, ${result.total_deliveries} ${t('campaignCenter.deliveriesInProgress')}`,
      });
      loadCampaigns();
    } catch (err: any) {
      toast({ title: t('campaignCenter.error'), description: err.message || t('campaignCenter.sendError'), variant: 'destructive' });
    }
  };

  const handleCancelCampaign = async (campaignId: string) => {
    try {
      await cancelCampaign(campaignId);
      toast({ title: t('campaignCenter.campaignCancelled') });
      loadCampaigns();
    } catch (err: any) {
      toast({ title: t('campaignCenter.error'), description: err.message || t('campaignCenter.cancelError'), variant: 'destructive' });
    }
  };

  const handleViewDetail = async (campaign: VendorCampaign) => {
    try {
      const [detail, analytics] = await Promise.all([
        getCampaign(campaign.id),
        getCampaignAnalytics(campaign.id),
      ]);
      setSelectedCampaign(detail);
      setSelectedAnalytics(analytics);
      setShowDetailDialog(true);
    } catch {
      setSelectedCampaign(campaign);
      setSelectedAnalytics(null);
      setShowDetailDialog(true);
    }
  };

  // ==================== STATS ====================

  const stats = {
    total: campaigns.length,
    sent: campaigns.filter(c => c.status === 'sent').length,
    draft: campaigns.filter(c => c.status === 'draft').length,
    sending: campaigns.filter(c => ['sending', 'queued'].includes(c.status)).length,
    totalReach: campaigns.reduce((sum, c) => sum + c.total_sent, 0),
  };

  // ==================== RENDER ====================

  if (vendorLoading) return <div className="flex justify-center p-8"><RefreshCw className="animate-spin h-6 w-6" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            {t('campaignCenter.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('campaignCenter.subtitle')}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('campaignCenter.newCampaign')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Megaphone className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">{t('campaignCenter.statCampaigns')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-[#ff4000]/30">
                <CheckCircle className="h-4 w-4 text-[#ff4000]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sent}</p>
                <p className="text-xs text-muted-foreground">{t('campaignCenter.statSent')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.draft}</p>
                <p className="text-xs text-muted-foreground">{t('campaignCenter.statDrafts')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-[#04439e]/30">
                <Users className="h-4 w-4 text-[#04439e]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalReach.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{t('campaignCenter.statMessagesSent')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('campaignCenter.allCampaigns')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('campaignCenter.filterAll')}</SelectItem>
            <SelectItem value="draft">{t('campaignCenter.statDrafts')}</SelectItem>
            <SelectItem value="sending">{t('campaignCenter.filterSending')}</SelectItem>
            <SelectItem value="sent">{t('campaignCenter.statSent')}</SelectItem>
            <SelectItem value="failed">{t('campaignCenter.filterFailed')}</SelectItem>
            <SelectItem value="cancelled">{t('campaignCenter.filterCancelled')}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={loadCampaigns} className="gap-1">
          <RefreshCw className="h-3 w-3" /> {t('campaignCenter.refresh')}
        </Button>
      </div>

      {/* Campaign List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('campaignCenter.myCampaigns')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><RefreshCw className="animate-spin h-5 w-5 text-muted-foreground" /></div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">{t('campaignCenter.noCampaign')}</p>
              <p className="text-sm mt-1">{t('campaignCenter.noCampaignDesc')}</p>
              <Button onClick={() => setShowCreateDialog(true)} className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> {t('campaignCenter.createCampaign')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map(campaign => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  onView={() => handleViewDetail(campaign)}
                  onSend={() => handleSendCampaign(campaign.id)}
                  onCancel={() => handleCancelCampaign(campaign.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <CreateCampaignDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={() => { setShowCreateDialog(false); loadCampaigns(); }}
      />

      {/* Detail Dialog */}
      <CampaignDetailDialog
        open={showDetailDialog}
        campaign={selectedCampaign}
        analytics={selectedAnalytics}
        onClose={() => setShowDetailDialog(false)}
      />
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

function CampaignRow({ campaign, onView, onSend, onCancel }: {
  campaign: VendorCampaign;
  onView: () => void;
  onSend: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const statusCfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium truncate">{campaign.title}</h3>
          <Badge className={`text-[10px] ${statusCfg.color}`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {t(statusCfg.labelKey)}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {campaign.total_targeted} {t('campaignCenter.targeted')}
          </span>
          <span className="flex items-center gap-1">
            <Send className="h-3 w-3" />
            {campaign.total_sent} {t('campaignCenter.sentCount')}
          </span>
          <span className="flex items-center gap-1">
            {campaign.selected_channels?.map(ch => {
              const chCfg = CHANNELS.find(c => c.id === ch);
              if (!chCfg) return null;
              const Icon = chCfg.icon;
              return <Icon key={ch} className="h-3 w-3" />;
            })}
          </span>
          <span>{new Date(campaign.created_at).toLocaleDateString('fr-FR')}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onView}>
          <Eye className="h-4 w-4" />
        </Button>
        {['draft', 'scheduled'].includes(campaign.status) && (
          <Button size="sm" onClick={onSend} className="gap-1">
            <Send className="h-3 w-3" /> {t('campaignCenter.send')}
          </Button>
        )}
        {['draft', 'scheduled', 'sending', 'queued'].includes(campaign.status) && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <XCircle className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ==================== CREATE CAMPAIGN DIALOG ====================

function CreateCampaignDialog({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [form, setForm] = useState<CreateCampaignPayload>({
    title: '',
    message_body: '',
    message_type: 'announcement',
    target_type: 'all_clients',
    target_filters: {},
    selected_channels: ['in_app'],
  });

  const resetForm = () => {
    setStep(1);
    setForm({
      title: '',
      message_body: '',
      message_type: 'announcement',
      target_type: 'all_clients',
      target_filters: {},
      selected_channels: ['in_app'],
    });
    setAudiencePreview(null);
    setPreviewFailed(false);
    setPreviewError(null);
  };

  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const loadPreview = async () => {
    setLoadingPreview(true);
    setPreviewFailed(false);
    setPreviewError(null);
    try {
      const preview = await previewAudience(form.target_type, form.target_filters);
      setAudiencePreview(preview);
    } catch (err: any) {
      setPreviewFailed(true);
      setAudiencePreview(null);
      setPreviewError(err?.message || t('campaignCenter.audienceError'));
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (step === 2) loadPreview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.target_type]);

  const handleToggleChannel = (channel: CampaignChannel) => {
    setForm(prev => {
      const current = prev.selected_channels;
      const updated = current.includes(channel)
        ? current.filter(c => c !== channel)
        : [...current, channel];
      return { ...prev, selected_channels: updated.length > 0 ? updated : current };
    });
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.message_body.trim() || form.selected_channels.length === 0) {
      toast({ title: t('campaignCenter.requiredFields'), description: t('campaignCenter.requiredFieldsDesc'), variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      await createCampaign(form);
      toast({ title: t('campaignCenter.campaignCreated'), description: t('campaignCenter.campaignCreatedDesc') });
      resetForm();
      onCreated();
    } catch (err: any) {
      toast({ title: t('campaignCenter.error'), description: err.message || t('campaignCenter.createError'), variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            {t('campaignCenter.newCampaign')}
            <Badge variant="outline" className="ml-2">{t('campaignCenter.step')} {step}/3</Badge>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          {step === 1 && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t('campaignCenter.campaignTitle')}</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder={t('campaignCenter.campaignTitlePlaceholder')}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('campaignCenter.emailSubject')}</Label>
                <Input
                  value={form.subject || ''}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder={t('campaignCenter.emailSubjectPlaceholder')}
                  maxLength={500}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('campaignCenter.message')}</Label>
                <Textarea
                  value={form.message_body}
                  onChange={e => setForm(p => ({ ...p, message_body: e.target.value }))}
                  placeholder={t('campaignCenter.messagePlaceholder')}
                  rows={5}
                  maxLength={5000}
                />
                <p className="text-xs text-muted-foreground">{form.message_body.length}/5000</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('campaignCenter.messageType')}</Label>
                  <Select value={form.message_type} onValueChange={v => setForm(p => ({ ...p, message_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MESSAGE_TYPES.map(mt => <SelectItem key={mt.value} value={mt.value}>{t(mt.labelKey)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('campaignCenter.imageUrl')}</Label>
                  <Input
                    value={form.image_url || ''}
                    onChange={e => setForm(p => ({ ...p, image_url: e.target.value || undefined }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('campaignCenter.link')}</Label>
                  <Input
                    value={form.link_url || ''}
                    onChange={e => setForm(p => ({ ...p, link_url: e.target.value || undefined }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('campaignCenter.linkText')}</Label>
                  <Input
                    value={form.link_text || ''}
                    onChange={e => setForm(p => ({ ...p, link_text: e.target.value || undefined }))}
                    placeholder={t('campaignCenter.linkTextPlaceholder')}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!form.title.trim() || !form.message_body.trim()}>
                  {t('campaignCenter.nextAudience')}
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Target className="h-4 w-4" /> {t('campaignCenter.audienceTargeting')}
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {TARGET_TYPES.map(tt => (
                    <div
                      key={tt.value}
                      onClick={() => setForm(p => ({ ...p, target_type: tt.value }))}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        form.target_type === tt.value
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'hover:border-muted-foreground/30'
                      }`}
                    >
                      <p className="font-medium text-sm">{t(tt.labelKey)}</p>
                      <p className="text-xs text-muted-foreground">{t(tt.descKey)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {form.target_type === 'custom' && (
                <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                  <Label>{t('campaignCenter.customFilters')}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">{t('campaignCenter.minOrders')}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.target_filters?.min_orders || ''}
                        onChange={e => setForm(p => ({ ...p, target_filters: { ...p.target_filters, min_orders: e.target.value ? parseInt(e.target.value) : undefined } }))}
                        placeholder="Ex: 3"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{t('campaignCenter.minSpent')}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.target_filters?.min_spent || ''}
                        onChange={e => setForm(p => ({ ...p, target_filters: { ...p.target_filters, min_spent: e.target.value ? parseInt(e.target.value) : undefined } }))}
                        placeholder="Ex: 100000"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Audience Preview */}
              {audiencePreview && (
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-medium">{t('campaignCenter.estimatedAudience')} {audiencePreview.total} {t('campaignCenter.clients')}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      {CHANNELS.map(ch => {
                        const count = audiencePreview.channels[ch.id] || 0;
                        const Icon = ch.icon;
                        return (
                          <div key={ch.id} className="p-2 rounded-md bg-background">
                            <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-sm font-bold">{count}</p>
                            <p className="text-[10px] text-muted-foreground">{t(ch.labelKey)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
              {loadingPreview && <p className="text-sm text-muted-foreground text-center">{t('campaignCenter.calculatingAudience')}</p>}
              {previewFailed && (
                <div className="flex items-center gap-2 text-sm text-[#ff4000] dark:text-[#ff4000] bg-orange-50 dark:bg-[#ff4000]/30 p-3 rounded-lg">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{previewError || t('campaignCenter.audienceError')}</span>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>{t('campaignCenter.back')}</Button>
                <Button onClick={() => setStep(3)} disabled={loadingPreview || (!previewFailed && !audiencePreview) || (audiencePreview !== null && audiencePreview.total === 0)}>
                  {t('campaignCenter.nextChannels')}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Send className="h-4 w-4" /> {t('campaignCenter.broadcastChannels')}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {CHANNELS.map(ch => {
                    const Icon = ch.icon;
                    const selected = form.selected_channels.includes(ch.id);
                    const available = audiencePreview?.channels[ch.id] || 0;
                    return (
                      <div
                        key={ch.id}
                        onClick={() => handleToggleChannel(ch.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={selected} />
                          <Icon className="h-5 w-5" />
                          <div>
                            <p className="font-medium text-sm">{t(ch.labelKey)}</p>
                            <p className="text-xs text-muted-foreground">{available} {t('campaignCenter.eligible')}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary */}
              <Card className="bg-muted/30">
                <CardContent className="pt-4 pb-3">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Eye className="h-4 w-4" /> {t('campaignCenter.summaryBeforeSend')}
                  </h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">{t('campaignCenter.sumTitle')}</span> {form.title}</p>
                    <p><span className="text-muted-foreground">{t('campaignCenter.sumAudience')}</span> {audiencePreview?.total || 0} {t('campaignCenter.clients')}</p>
                    <p><span className="text-muted-foreground">{t('campaignCenter.sumChannels')}</span> {form.selected_channels.map(ch => { const c = CHANNELS.find(x => x.id === ch); return c ? t(c.labelKey) : ch; }).join(', ')}</p>
                    <p><span className="text-muted-foreground">{t('campaignCenter.sumType')}</span> {(() => { const mt = MESSAGE_TYPES.find(x => x.value === form.message_type); return mt ? t(mt.labelKey) : form.message_type; })()}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>{t('campaignCenter.back')}</Button>
                <Button onClick={handleSubmit} disabled={creating} className="gap-2">
                  {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {t('campaignCenter.createCampaignBtn')}
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ==================== DETAIL DIALOG ====================

function CampaignDetailDialog({ open, campaign, analytics, onClose }: {
  open: boolean;
  campaign: VendorCampaign | null;
  analytics: CampaignAnalytics | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!campaign) return null;

  const statusCfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            {campaign.title}
            <Badge className={`${statusCfg.color} ml-2`}>{t(statusCfg.labelKey)}</Badge>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">{t('campaignCenter.tabOverview')}</TabsTrigger>
              <TabsTrigger value="analytics" className="flex-1">{t('campaignCenter.tabAnalytics')}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('campaignCenter.message')}</Label>
                    <p className="text-sm">{campaign.message_body}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('campaignCenter.targeting')}</Label>
                      <p className="text-sm font-medium">
                        {(() => { const tt = TARGET_TYPES.find(x => x.value === campaign.target_type); return tt ? t(tt.labelKey) : campaign.target_type; })()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('campaignCenter.channels')}</Label>
                      <div className="flex gap-1 mt-1">
                        {campaign.selected_channels?.map(ch => {
                          const chCfg = CHANNELS.find(c => c.id === ch);
                          if (!chCfg) return null;
                          return <Badge key={ch} variant="outline" className="text-[10px]">{t(chCfg.labelKey)}</Badge>;
                        })}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('campaignCenter.createdOn')}</Label>
                      <p className="text-sm">{new Date(campaign.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <StatBox label={t('campaignCenter.targeted')} value={campaign.total_targeted} />
                    <StatBox label={t('campaignCenter.eligible')} value={campaign.total_eligible} />
                    <StatBox label={t('campaignCenter.sentCount')} value={campaign.total_sent} color="text-[#ff4000]" />
                    <StatBox label={t('campaignCenter.failedCount')} value={campaign.total_failed} color="text-[#ff4000]" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4 mt-4">
              {analytics ? (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-3xl font-bold text-[#ff4000]">{analytics.rates.delivery_rate}%</p>
                        <p className="text-xs text-muted-foreground">{t('campaignCenter.deliveryRate')}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-3xl font-bold text-blue-600">{analytics.rates.read_rate}%</p>
                        <p className="text-xs text-muted-foreground">{t('campaignCenter.readRate')}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-3xl font-bold text-[#ff4000]">{analytics.rates.failure_rate}%</p>
                        <p className="text-xs text-muted-foreground">{t('campaignCenter.failureRate')}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* By Channel */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">{t('campaignCenter.channelPerformance')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(analytics.by_channel).map(([channel, stats]) => {
                          const chCfg = CHANNELS.find(c => c.id === channel);
                          const deliveryRate = stats.total > 0 ? Math.round(((stats.delivered || 0) / stats.total) * 100) : 0;
                          return (
                            <div key={channel} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{chCfg ? t(chCfg.labelKey) : channel}</span>
                                <span className="text-muted-foreground">
                                  {stats.sent || 0} {t('campaignCenter.sentCount')} / {stats.total} {t('campaignCenter.total')} ({deliveryRate}%)
                                </span>
                              </div>
                              <Progress value={deliveryRate} className="h-2" />
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>{t('campaignCenter.analyticsAfterSend')}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted/50">
      <p className={`text-xl font-bold ${color || ''}`}>{value.toLocaleString()}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
