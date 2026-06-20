import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePromoCodes } from "@/hooks/useVendorData";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { supabase } from "@/integrations/supabase/client";
import { broadcastToClients } from "@/services/campaignBackendService";
import {
  Megaphone, Tag, Mail, Eye, MousePointer, Plus, Copy, Edit, BarChart3
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TrafficAnalyticsSection } from "./TrafficAnalyticsSection";

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  created_at: string;
}

const campaignTypeLabels = {
  email: 'Email',
  sms: 'SMS',
  notification: 'Notification',
  social: 'Réseaux sociaux'
};

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-orange-100 text-[#ff4000]',
  paused: 'bg-orange-100 text-[#ff4000]',
  completed: 'bg-blue-100 text-blue-800'
};

const statusLabels = {
  draft: 'Brouillon',
  active: 'Active',
  paused: 'En pause',
  completed: 'Terminée'
};

export default function MarketingManagement() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { user } = useAuth();
  const { vendorId, loading: vendorLoading } = useCurrentVendor();
  const { toast } = useToast();
  const { promoCodes, loading: promoLoading, error: _promoError, createPromoCode } = usePromoCodes();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [isPromoDialogOpen, setIsPromoDialogOpen] = useState(false);
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  const [promoForm, setPromoForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed_amount',
    discount_value: 0,
    minimum_order_amount: 0,
    usage_limit: 100,
    valid_until: ''
  });

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    type: 'email' as Campaign['type'],
    target_audience: '',
    content: ''
  });

  useEffect(() => {
    if (vendorLoading) return;
    if (!vendorId && !user) return;
    fetchCampaigns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, vendorId, vendorLoading]);

  const fetchCampaigns = async () => {
    try {
      let resolvedVendorId = vendorId;
      if (!resolvedVendorId && user?.id) {
        const { data: vendor } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', user.id)
          .single();
        resolvedVendorId = vendor?.id || null;
      }

      if (!resolvedVendorId) return;

      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('vendor_id', resolvedVendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (_error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les campagnes.",
        variant: "destructive"
      });
    } finally {
      setCampaignsLoading(false);
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPromoCode({
        ...promoForm,
        valid_from: new Date().toISOString(),
        is_active: true
      });

      toast({
        title: "Code promo créé",
        description: "Le code promotionnel a été créé avec succès."
      });

      setIsPromoDialogOpen(false);
      setPromoForm({
        code: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 0,
        minimum_order_amount: 0,
        usage_limit: 100,
        valid_until: ''
      });
    } catch (_error) {
      // Error handled in hook
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingCampaign) return; // anti double-soumission (évite 2 campagnes + 2 diffusions)
    setCreatingCampaign(true);
    try {
      let resolvedVendorId = vendorId;
      if (!resolvedVendorId && user?.id) {
        const { data: vendor } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', user.id)
          .single();
        resolvedVendorId = vendor?.id || null;
      }

      if (!resolvedVendorId) throw new Error('Vendor not found');

      const { data, error } = await supabase
        .from('marketing_campaigns')
        .insert([{
          ...campaignForm,
          vendor_id: resolvedVendorId,
          content: { message: campaignForm.content },
          target_audience: { segment: campaignForm.target_audience }
        }])
        .select()
        .single();

      if (error) throw error;

      // ENVOI RÉEL via la diffusion durcie (idempotente) — email/SMS uniquement.
      const type = campaignForm.type as string;
      if (type === 'email' || type === 'sms') {
        const idem = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `mkt-${Date.now()}`;
        try {
          const r = await broadcastToClients(
            { channel: type as 'email' | 'sms', subject: campaignForm.name, message: campaignForm.content },
            idem,
          );
          const sent = (r.email_sent || 0) + (r.sms_sent || 0);
          await supabase.from('marketing_campaigns').update({ sent_count: sent, status: 'completed' }).eq('id', data.id);
          setCampaigns(prev => [{ ...data, sent_count: sent, status: 'completed' }, ...prev]);
          toast({
            title: "Campagne envoyée",
            description: `${r.email_sent} email(s), ${r.sms_sent} SMS${r.sms_error ? ` — SMS : ${r.sms_error}` : ''}`,
          });
        } catch (sendErr: any) {
          setCampaigns(prev => [data, ...prev]);
          toast({ title: "Campagne créée, mais envoi échoué", description: sendErr?.message || 'Erreur diffusion', variant: 'destructive' });
        }
      } else {
        // notification / réseaux sociaux : enregistrés seulement (pas d'envoi auto)
        setCampaigns(prev => [data, ...prev]);
        toast({ title: "Campagne enregistrée", description: "Envoi automatique disponible pour Email et SMS uniquement." });
      }

      setIsCampaignDialogOpen(false);
      setCampaignForm({
        name: '',
        type: 'email',
        target_audience: '',
        content: ''
      });
    } catch (_error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer la campagne.",
        variant: "destructive"
      });
    } finally {
      setCreatingCampaign(false);
    }
  };

  const copyPromoCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code copié",
      description: "Le code promotionnel a été copié dans le presse-papiers."
    });
  };

  const generateRandomCode = () => {
    const code = 'PROMO' + Math.random().toString(36).substr(2, 6).toUpperCase();
    setPromoForm(prev => ({ ...prev, code }));
  };

  const totalSent = campaigns.reduce((acc, c) => acc + c.sent_count, 0);
  const totalOpened = campaigns.reduce((acc, c) => acc + c.opened_count, 0);
  const totalClicked = campaigns.reduce((acc, c) => acc + c.clicked_count, 0);
  const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0';
  const clickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : '0';

  if (promoLoading || campaignsLoading) {
    return <div className="p-4">{t('marketingManagement.chargementDesDonneesMarketing')}</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Tabs defaultValue="traffic" className="w-full">
        <TabsList className="w-full h-auto flex p-1 mb-4 sm:mb-6">
          <TabsTrigger value="traffic" className="flex-1 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
            <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Trafic</span>
          </TabsTrigger>
          <TabsTrigger value="marketing" className="flex-1 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
            <Megaphone className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Marketing</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="traffic" className="space-y-4 sm:space-y-6">
          <TrafficAnalyticsSection />
        </TabsContent>

        <TabsContent value="marketing" className="space-y-4 sm:space-y-6">
          {/* Header - Mobile optimized */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-bold">Marketing & Promotions</h2>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{t('marketingManagement.gerezVosCampagnesEtCodes')}</p>
            </div>
            <div className="flex gap-2">
          <Dialog open={isPromoDialogOpen} onOpenChange={setIsPromoDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none text-xs sm:text-sm">
                <Tag className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="truncate">Code promo</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('marketingManagement.creerUnCodePromotionnel')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreatePromo} className="space-y-4">
                <div>
                  <Label htmlFor="code">Code promotionnel *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="code"
                      value={promoForm.code}
                      onChange={(e) => setPromoForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      placeholder="PROMO2024"
                      required
                    />
                    <Button type="button" variant="outline" onClick={generateRandomCode}>
                      Générer
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={promoForm.description}
                    onChange={(e) => setPromoForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('marketingManagement.promotionDeFinDAnnee')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="discount_type">{t('marketingManagement.typeDeRemise')}</Label>
                    <Select
                      value={promoForm.discount_type}
                      onValueChange={(value: 'percentage' | 'fixed_amount') =>
                        setPromoForm(prev => ({ ...prev, discount_type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Pourcentage</SelectItem>
                        <SelectItem value="fixed_amount">{t('marketingManagement.montantFixe')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="discount_value">
                      Valeur {promoForm.discount_type === 'percentage' ? '(%)' : '(GNF)'}
                    </Label>
                    <Input
                      id="discount_value"
                      type="number"
                      value={promoForm.discount_value}
                      onChange={(e) => setPromoForm(prev => ({ ...prev, discount_value: Number(e.target.value) }))}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minimum_order">{t('marketingManagement.commandeMinimumGnf')}</Label>
                    <Input
                      id="minimum_order"
                      type="number"
                      value={promoForm.minimum_order_amount}
                      onChange={(e) => setPromoForm(prev => ({ ...prev, minimum_order_amount: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="usage_limit">Limite d'utilisation</Label>
                    <Input
                      id="usage_limit"
                      type="number"
                      value={promoForm.usage_limit}
                      onChange={(e) => setPromoForm(prev => ({ ...prev, usage_limit: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="valid_until">Valide jusqu'au</Label>
                  <Input
                    id="valid_until"
                    type="datetime-local"
                    value={promoForm.valid_until}
                    onChange={(e) => setPromoForm(prev => ({ ...prev, valid_until: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">{t('marketingManagement.creerLeCodePromo')}</Button>
                  <Button type="button" variant="outline" onClick={() => setIsPromoDialogOpen(false)}>
                    Annuler
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex-1 sm:flex-none text-xs sm:text-sm">
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="truncate">Campagne</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('marketingManagement.creerUneCampagneMarketing')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateCampaign} className="space-y-4">
                <div>
                  <Label htmlFor="name">{t('marketingManagement.nomDeLaCampagne')}</Label>
                  <Input
                    id="name"
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Campagne Black Friday 2024"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">{t('marketingManagement.typeDeCampagne')}</Label>
                  <Select
                    value={campaignForm.type}
                    onValueChange={(value: Campaign['type']) =>
                      setCampaignForm(prev => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="notification">Notification</SelectItem>
                      <SelectItem value="social">{t('marketingManagement.reseauxSociaux')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="target">Audience cible</Label>
                  <Input
                    id="target"
                    value={campaignForm.target_audience}
                    onChange={(e) => setCampaignForm(prev => ({ ...prev, target_audience: e.target.value }))}
                    placeholder="Clients VIP, Nouveaux clients, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="content">{t('marketingManagement.contenuDuMessage')}</Label>
                  <Textarea
                    id="content"
                    value={campaignForm.content}
                    onChange={(e) => setCampaignForm(prev => ({ ...prev, content: e.target.value }))}
                    placeholder={t('marketingManagement.votreMessagePromotionnel')}
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={creatingCampaign}>{creatingCampaign ? 'Envoi en cours…' : 'Créer et envoyer'}</Button>
                  <Button type="button" variant="outline" onClick={() => setIsCampaignDialogOpen(false)}>
                    Annuler
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistiques marketing */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">{t('marketingManagement.messagesEnvoyes')}</p>
                <p className="text-2xl font-bold">{totalSent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#ff4000]" />
              <div>
                <p className="text-sm text-muted-foreground">Taux d'ouverture</p>
                <p className="text-2xl font-bold">{openRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <MousePointer className="w-5 h-5 text-[#04439e]" />
              <div>
                <p className="text-sm text-muted-foreground">{t('marketingManagement.tauxDeClic')}</p>
                <p className="text-2xl font-bold">{clickRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Codes promo actifs</p>
                <p className="text-2xl font-bold">{promoCodes.filter(p => p.is_active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Codes promotionnels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Codes promotionnels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {promoCodes.map((promo) => (
              <div key={promo.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-lg">{promo.code}</h4>
                    <Badge variant={promo.is_active ? "default" : "secondary"}>
                      {promo.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                  {promo.description && (
                    <p className="text-sm text-muted-foreground mb-2">{promo.description}</p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Remise</p>
                      <p className="font-medium">
                        {promo.discount_type === 'percentage'
                          ? `${promo.discount_value}%`
                          : fc(promo.discount_value)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Utilisations</p>
                      <p className="font-medium">
                        {promo.used_count} / {promo.usage_limit || '∞'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('marketingManagement.commandeMin')}</p>
                      <p className="font-medium">{fc(promo.minimum_order_amount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('marketingManagement.expireLe')}</p>
                      <p className="font-medium">
                        {promo.valid_until
                          ? new Date(promo.valid_until).toLocaleDateString('fr-FR')
                          : 'Jamais'
                        }
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button size="sm" variant="outline" onClick={() => copyPromoCode(promo.code)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {promoCodes.length === 0 && (
            <div className="text-center py-8">
              <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('marketingManagement.aucunCodePromotionnel')}</h3>
              <p className="text-muted-foreground">
                Créez votre premier code promotionnel pour attirer plus de clients.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campagnes marketing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Campagnes marketing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{campaign.name}</h4>
                    <Badge className={statusColors[campaign.status]}>
                      {statusLabels[campaign.status]}
                    </Badge>
                    <Badge variant="outline">
                      {campaignTypeLabels[campaign.type]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mt-2">
                    <div>
                      <p className="text-muted-foreground">{t('marketingManagement.envoyes')}</p>
                      <p className="font-medium">{campaign.sent_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ouverts</p>
                      <p className="font-medium">{campaign.opened_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Clics</p>
                      <p className="font-medium">{campaign.clicked_count}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button size="sm" variant="outline">
                    Voir détails
                  </Button>
                  {campaign.status === 'draft' && (
                    <Button size="sm">
                      Lancer
                    </Button>
                  )}
                  {campaign.status === 'active' && (
                    <Button size="sm" variant="outline">
                      Pause
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {campaigns.length === 0 && (
            <div className="text-center py-8">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('marketingManagement.aucuneCampagne')}</h3>
              <p className="text-muted-foreground">
                Créez votre première campagne marketing pour promouvoir vos produits.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
