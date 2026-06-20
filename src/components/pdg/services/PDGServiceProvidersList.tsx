/**
 * PDGServiceProvidersList - Liste des prestataires inscrits par type de service
 * Affiche tous les services professionnels avec filtrage par type
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabaseClient';
import { backendFetch } from '@/services/backendApi';
import { ServiceSubscriptionService, ServicePlan } from '@/services/serviceSubscriptionService';
import {
  Search, Users, MapPin, Star, Phone, Mail, Eye,
  CheckCircle, Clock, XCircle, AlertTriangle, RefreshCw,
  TrendingUp, ShoppingBag, Store, Globe, Loader2, Gift, Crown, Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';

const COUNTRY_OPTIONS = [
  { code: 'GN', name: 'Guinée', currency: 'GNF', flag: '🇬🇳' },
  { code: 'SN', name: 'Sénégal', currency: 'XOF', flag: '🇸🇳' },
  { code: 'CI', name: 'Côte d\'Ivoire', currency: 'XOF', flag: '🇨🇮' },
  { code: 'ML', name: 'Mali', currency: 'XOF', flag: '🇲🇱' },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF', flag: '🇧🇫' },
  { code: 'NE', name: 'Niger', currency: 'XOF', flag: '🇳🇪' },
  { code: 'TG', name: 'Togo', currency: 'XOF', flag: '🇹🇬' },
  { code: 'BJ', name: 'Bénin', currency: 'XOF', flag: '🇧🇯' },
  { code: 'CM', name: 'Cameroun', currency: 'XAF', flag: '🇨🇲' },
  { code: 'GA', name: 'Gabon', currency: 'XAF', flag: '🇬🇦' },
  { code: 'CG', name: 'Congo', currency: 'XAF', flag: '🇨🇬' },
  { code: 'TD', name: 'Tchad', currency: 'XAF', flag: '🇹🇩' },
  { code: 'CF', name: 'Centrafrique', currency: 'XAF', flag: '🇨🇫' },
  { code: 'GQ', name: 'Guinée Équatoriale', currency: 'XAF', flag: '🇬🇶' },
  { code: 'SL', name: 'Sierra Leone', currency: 'SLL', flag: '🇸🇱' },
  { code: 'NG', name: 'Nigéria', currency: 'NGN', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', flag: '🇬🇭' },
  { code: 'MA', name: 'Maroc', currency: 'MAD', flag: '🇲🇦' },
  { code: 'DZ', name: 'Algérie', currency: 'DZD', flag: '🇩🇿' },
  { code: 'TN', name: 'Tunisie', currency: 'TND', flag: '🇹🇳' },
  { code: 'FR', name: 'France', currency: 'EUR', flag: '🇫🇷' },
  { code: 'BE', name: 'Belgique', currency: 'EUR', flag: '🇧🇪' },
  { code: 'US', name: 'États-Unis', currency: 'USD', flag: '🇺🇸' },
  { code: 'GB', name: 'Royaume-Uni', currency: 'GBP', flag: '🇬🇧' },
  { code: 'KE', name: 'Kenya', currency: 'KES', flag: '🇰🇪' },
  { code: 'ZA', name: 'Afrique du Sud', currency: 'ZAR', flag: '🇿🇦' },
];

interface PDGServiceProvidersListProps {
  activeServiceTab: string;
  serviceTypes: { id: string; code: string; name: string }[];
}

interface Provider {
  id: string;
  user_id: string;
  business_name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  verification_status: string;
  rating: number;
  total_reviews: number;
  total_orders: number;
  total_revenue: number;
  created_at: string;
  service_type_id: string;
  service_type?: { name: string; code: string } | null;
}

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  active: { label: 'Actif', icon: CheckCircle, className: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
  pending: { label: 'En attente', icon: Clock, className: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
  suspended: { label: 'Suspendu', icon: AlertTriangle, className: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
  rejected: { label: 'Rejeté', icon: XCircle, className: 'bg-destructive/10 text-destructive' },
};

export function PDGServiceProvidersList({ activeServiceTab, serviceTypes }: PDGServiceProvidersListProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyDialog, setCurrencyDialog] = useState<{
    open: boolean; provider: Provider | null; selectedCountry: string; saving: boolean; error: string | null;
  }>({ open: false, provider: null, selectedCountry: '', saving: false, error: null });

  // ── État dialog "Offrir abonnement" ──────────────────────────────────────────
  const [offerDialog, setOfferDialog] = useState<{
    open: boolean;
    provider: Provider | null;
    plans: ServicePlan[];
    selectedPlanId: string;
    days: string;
    saving: boolean;
    error: string | null;
  }>({ open: false, provider: null, plans: [], selectedPlanId: '', days: '30', saving: false, error: null });

  const openOfferDialog = async (provider: Provider) => {
    // Charger les plans disponibles pour ce type de service (+ plans globaux)
    const plans = await ServiceSubscriptionService.getPlans(provider.service_type_id || undefined);
    // Exclure le plan gratuit — on offre un plan payant gratuitement
    const paidPlans = plans.filter(p => p.monthly_price_gnf > 0 && p.is_active);
    setOfferDialog({
      open: true,
      provider,
      plans: paidPlans,
      selectedPlanId: paidPlans[0]?.id || '',
      days: '30',
      saving: false,
      error: null,
    });
  };

  const handleOfferSubscription = async () => {
    const { provider, selectedPlanId, days } = offerDialog;
    if (!provider || !selectedPlanId) {
      setOfferDialog(d => ({ ...d, error: 'Sélectionnez un plan' }));
      return;
    }
    const daysNum = parseInt(days, 10);
    if (isNaN(daysNum) || daysNum <= 0) {
      setOfferDialog(d => ({ ...d, error: 'Durée invalide (minimum 1 jour)' }));
      return;
    }
    setOfferDialog(d => ({ ...d, saving: true, error: null }));
    try {
      const success = await ServiceSubscriptionService.offerFreeSubscription(
        provider.id,
        provider.user_id,
        selectedPlanId,
        daysNum
      );
      if (!success) throw new Error("Échec de l'attribution de l'abonnement");
      const plan = offerDialog.plans.find(p => p.id === selectedPlanId);
      toast.success(
        `Abonnement ${plan?.display_name || ''} offert à ${provider.business_name} pour ${daysNum} jour(s)`,
        { duration: 5000 }
      );
      setOfferDialog(d => ({ ...d, open: false }));
    } catch (err: any) {
      setOfferDialog(d => ({ ...d, saving: false, error: err.message || 'Erreur inconnue' }));
    }
  };

  const handleServiceCurrencyChange = async () => {
    const { provider, selectedCountry } = currencyDialog;
    if (!provider || !selectedCountry) return;
    const country = COUNTRY_OPTIONS.find(c => c.code === selectedCountry);
    if (!country) return;
    setCurrencyDialog(d => ({ ...d, saving: true, error: null }));
    const result = await backendFetch<any>('/api/vendors/admin/change-currency', {
      method: 'POST',
      body: { vendor_id: provider.user_id, new_currency: country.currency, new_country_code: country.code, reason: 'Changement manuel PDG', entity_type: 'user' },
    });
    setCurrencyDialog(d => ({ ...d, saving: false }));
    if (!result.success) { setCurrencyDialog(d => ({ ...d, error: result.error || 'Erreur inconnue' })); return; }
    if (!result.changed) { toast.info(result.message); setCurrencyDialog(d => ({ ...d, open: false })); return; }
    toast.success(`Devise changée : ${result.old_currency} → ${result.new_currency}`, { duration: 6000 });
    setCurrencyDialog(d => ({ ...d, open: false }));
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('professional_services')
        .select('*, service_type:service_types(name, code)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Filtrer les boutiques/digital - ne garder que les services de proximité
      const EXCLUDED_CODES = ['ecommerce', 'dropshipping', 'digital_livre', 'digital_logiciel'];
      const filtered = (data || []).filter(
        (p: any) => !p.service_type || !EXCLUDED_CODES.includes(p.service_type.code)
      );
      setProviders(filtered as Provider[]);
    } catch (err) {
      console.error('Error fetching providers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = providers;
    if (activeServiceTab !== 'all') {
      list = list.filter(p => p.service_type_id === activeServiceTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.business_name.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.includes(q) ||
        p.address?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [providers, activeServiceTab, searchQuery]);

  const stats = useMemo(() => ({
    total: filtered.length,
    active: filtered.filter(p => p.status === 'active').length,
    pending: filtered.filter(p => p.status === 'pending').length,
    totalRevenue: filtered.reduce((s, p) => s + (p.total_revenue || 0), 0),
    totalOrders: filtered.reduce((s, p) => s + (p.total_orders || 0), 0),
    avgRating: filtered.length > 0
      ? (filtered.reduce((s, p) => s + (p.rating || 0), 0) / filtered.filter(p => p.rating > 0).length || 0).toFixed(1)
      : '0',
  }), [filtered]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const getStatus = (status: string) => {
    const cfg = statusConfig[status] || statusConfig.pending;
    const Icon = cfg.icon;
    return (
      <Badge className={`${cfg.className} gap-1`}>
        <Icon className="w-3 h-3" />{cfg.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Users className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Prestataires</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-5 h-5 text-[#ff4000] mx-auto mb-1" />
            <div className="text-2xl font-bold text-[#ff4000]">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Actifs</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Clock className="w-5 h-5 text-[#ff4000] mx-auto mb-1" />
            <div className="text-2xl font-bold text-[#ff4000]">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">En attente</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <ShoppingBag className="w-5 h-5 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">{t('pDGServiceProvidersList.commandes')}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
            <div className="text-lg font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">CA Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">
                {activeServiceTab !== 'all'
                  ? `Prestataires — ${serviceTypes.find(s => s.id === activeServiceTab)?.name}`
                  : 'Tous les Prestataires'}
              </CardTitle>
              <CardDescription>{filtered.length} prestataire(s)</CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('pDGServiceProvidersList.rechercher')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon" onClick={fetchProviders}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('pDGServiceProvidersList.service')}</TableHead>
                  {activeServiceTab === 'all' && <TableHead>Type</TableHead>}
                  <TableHead>Statut</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>{t('pDGServiceProvidersList.commandes')}</TableHead>
                  <TableHead>CA</TableHead>
                  <TableHead>{t('pDGServiceProvidersList.inscription')}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={activeServiceTab === 'all' ? 9 : 8} className="text-center py-12 text-muted-foreground">
                      <Store className="w-8 h-8 opacity-30 mx-auto mb-2" />
                      Aucun prestataire trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.business_name}</div>
                        {p.address && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />{p.address}
                          </div>
                        )}
                      </TableCell>
                      {activeServiceTab === 'all' && (
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {p.service_type?.name || '-'}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell>{getStatus(p.status)}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          {p.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</div>}
                          {p.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{p.email}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-[#ff4000] fill-[#ff4000]" />
                          <span className="font-medium">{p.rating?.toFixed(1) || '0.0'}</span>
                          <span className="text-xs text-muted-foreground">({p.total_reviews || 0})</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{p.total_orders || 0}</TableCell>
                      <TableCell className="font-semibold text-primary">{formatCurrency(p.total_revenue || 0)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(p.created_at), 'dd MMM yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrencyDialog({ open: true, provider: p, selectedCountry: '', saving: false, error: null })}
                            className="border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-500"
                          >
                            <Globe className="w-3.5 h-3.5 mr-1" />
                            Devise
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openOfferDialog(p)}
                            className="border-[#ff4000]/50 hover:bg-[#ff4000]/10 hover:text-[#ff4000]"
                          >
                            <Gift className="w-3.5 h-3.5 mr-1" />
                            Offrir
                          </Button>
                        </div>
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

      {/* ── Dialog : Offrir un abonnement ─────────────────────────────────────── */}
      <Dialog open={offerDialog.open} onOpenChange={open => setOfferDialog(d => ({ ...d, open }))}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-[#ff4000]" />
              Offrir un abonnement
            </DialogTitle>
            <DialogDescription>
              Attribution gratuite d'un plan payant au prestataire
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Infos service */}
            <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-1 text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <Store className="w-4 h-4 text-muted-foreground" />
                {offerDialog.provider?.business_name}
              </div>
              {offerDialog.provider?.service_type?.name && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {offerDialog.provider.service_type.name}
                  </Badge>
                </div>
              )}
              {offerDialog.provider?.address && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {offerDialog.provider.address}
                </div>
              )}
            </div>

            {/* Sélection du plan */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-primary" />
                Plan à offrir
              </Label>
              {offerDialog.plans.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Aucun plan payant disponible pour ce type de service.
                </p>
              ) : (
                <Select
                  value={offerDialog.selectedPlanId}
                  onValueChange={v => setOfferDialog(d => ({ ...d, selectedPlanId: v, error: null }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('pDGServiceProvidersList.choisirUnPlan')} />
                  </SelectTrigger>
                  <SelectContent>
                    {offerDialog.plans.map(plan => (
                      <SelectItem key={plan.id} value={plan.id}>
                        <div className="flex items-center justify-between gap-3 w-full">
                          <span className="font-medium">{plan.display_name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {fc(plan.monthly_price_gnf)}/mois
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Durée */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Durée (jours)
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={offerDialog.days}
                  onChange={e => setOfferDialog(d => ({ ...d, days: e.target.value, error: null }))}
                  className="w-28"
                  placeholder="30"
                />
                <div className="flex gap-1.5">
                  {[7, 30, 90, 365].map(d => (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={offerDialog.days === String(d) ? 'default' : 'outline'}
                      className="text-xs px-2"
                      onClick={() => setOfferDialog(s => ({ ...s, days: String(d), error: null }))}
                    >
                      {d === 365 ? '1 an' : `${d}j`}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Récapitulatif */}
            {offerDialog.selectedPlanId && offerDialog.days && (
              <div className="rounded-lg border border-[#ff4000]/30 bg-[#ff4000]/5 px-4 py-3 text-sm space-y-1">
                <p className="font-medium text-[#ff4000] dark:text-[#ff4000] flex items-center gap-1.5">
                  <Gift className="w-4 h-4" />
                  Récapitulatif de l'offre
                </p>
                <p className="text-muted-foreground">
                  Plan <strong>{offerDialog.plans.find(p => p.id === offerDialog.selectedPlanId)?.display_name}</strong> offert
                  gratuitement pendant <strong>{offerDialog.days} jour(s)</strong>.
                </p>
                <p className="text-xs text-muted-foreground">
                  Valeur : {(
                    (offerDialog.plans.find(p => p.id === offerDialog.selectedPlanId)?.monthly_price_gnf || 0)
                    * (parseInt(offerDialog.days, 10) / 30)
                  ).toLocaleString(undefined, { maximumFractionDigits: 0 })} GNF équivalent
                </p>
              </div>
            )}

            {/* Erreur */}
            {offerDialog.error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded p-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {offerDialog.error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOfferDialog(d => ({ ...d, open: false }))}
              disabled={offerDialog.saving}
            >
              Annuler
            </Button>
            <Button
              onClick={handleOfferSubscription}
              disabled={offerDialog.saving || !offerDialog.selectedPlanId || offerDialog.plans.length === 0}
              className="bg-[#ff4000] hover:bg-[#ff4000] text-white"
            >
              {offerDialog.saving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Attribution...</>
                : <><Gift className="w-4 h-4 mr-2" />Offrir gratuitement</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog changement de devise service de proximité */}
      <Dialog open={currencyDialog.open} onOpenChange={open => setCurrencyDialog(d => ({ ...d, open }))}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Changer la devise — Service
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{t('pDGServiceProvidersList.service2')} <strong>{currencyDialog.provider?.business_name}</strong></p>
            <div className="space-y-2">
              <Label>{t('pDGServiceProvidersList.paysDeResidence')}</Label>
              <Select value={currencyDialog.selectedCountry} onValueChange={v => setCurrencyDialog(d => ({ ...d, selectedCountry: v, error: null }))}>
                <SelectTrigger><SelectValue placeholder={t('pDGServiceProvidersList.selectionnerUnPays')} /></SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.name} — {c.currency}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {currencyDialog.error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded p-2">{currencyDialog.error}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCurrencyDialog(d => ({ ...d, open: false }))}>{t('pDGServiceProvidersList.annuler')}</Button>
            <Button onClick={handleServiceCurrencyChange} disabled={!currencyDialog.selectedCountry || currencyDialog.saving}>
              {currencyDialog.saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />En cours...</> : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
