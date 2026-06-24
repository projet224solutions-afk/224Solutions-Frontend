/**
 * 💳 GESTIONNAIRE UNIFIÉ DE LIENS DE PAIEMENT
 * Supporte 4 types: payment, invoice, checkout, service
 * Pour vendeurs digitaux, vendeurs physiques et prestataires
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { usePaymentLinks, LinkType } from '@/hooks/usePaymentLinks';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { supabase } from '@/integrations/supabase/client';
import { tryNativeShare } from '@/utils/nativeShare';
import { getPublicBaseUrl } from '@/lib/site';
import { QRCodeSVG } from 'qrcode.react';
import {
  Link, Plus, Copy, Share2, RefreshCw,
  DollarSign, CheckCircle, Clock, XCircle, AlertCircle,
  ExternalLink, Calendar, User, Package, Edit, Trash2,
  CreditCard, FileText, ShoppingCart, Wrench, Eye,
  QrCode, Ban, MoreVertical, ArrowUpRight, Receipt,
  Smartphone, Store
} from 'lucide-react';

const LINK_TYPES: { value: LinkType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'payment', label: "Paiement simple", icon: <CreditCard className="w-4 h-4" />, desc: 'Montant + objet pour paiement rapide' },
  { value: 'invoice', label: 'Facture', icon: <FileText className="w-4 h-4" />, desc: 'Référence, description, montant, statut' },
  { value: 'checkout', label: "Checkout produit", icon: <ShoppingCart className="w-4 h-4" />, desc: 'Produit digital ou physique' },
  { value: 'service', label: 'Service / Prestation', icon: <Wrench className="w-4 h-4" />, desc: 'Restaurant, livraison, transport, prestation' },
];

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <Clock className="w-3.5 h-3.5" />, color: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-orange-300', label: 'En attente' },
  success: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-orange-300', label: "Payé" },
  paid: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-orange-300', label: "Payé" },
  failed: { icon: <XCircle className="w-3.5 h-3.5" />, color: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-orange-300', label: "Échoué" },
  expired: { icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'bg-muted text-muted-foreground', label: "Expiré" },
  cancelled: { icon: <Ban className="w-3.5 h-3.5" />, color: 'bg-muted text-muted-foreground', label: "Annulé" },
};

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  payment: { icon: <CreditCard className="w-3.5 h-3.5" />, color: 'bg-primary/10 text-primary', label: "Paiement" },
  invoice: { icon: <FileText className="w-3.5 h-3.5" />, color: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-orange-300', label: 'Facture' },
  checkout: { icon: <ShoppingCart className="w-3.5 h-3.5" />, color: 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-orange-300', label: 'Checkout' },
  service: { icon: <Wrench className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-[#04439e] dark:bg-[#04439e]/30 dark:text-blue-300', label: "Service" },
};

interface Product { id: string; name: string; price: number; description?: string; images?: string[]; stock_quantity?: number }
interface Service { id: string; business_name: string; description?: string; category?: string }

const initialForm = {
  linkType: 'payment' as LinkType,
  product_id: '',
  service_id: '',
  produit: '',
  title: '',
  description: '',
  montant: '',
  devise: 'GNF',
  reference: '',
  client_id: '',
  customer_email: '',
  customer_phone: '',
  remise: '0',
  type_remise: 'percentage' as 'percentage' | 'fixed',
  payment_type: 'full',
  is_single_use: true,
  expires_days: '7',
};

export default function PaymentLinksManager() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { toast } = useToast();
  const { userId: vendorUserId } = useCurrentVendor();
  const {
    paymentLinks, stats, loading, vendorId, ownerType,
    loadPaymentLinks, createPaymentLink, updatePaymentLink, updatePaymentLinkStatus, deletePaymentLink, getPaymentUrl
  } = usePaymentLinks();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState<string | null>(null);
  const [_showDetailModal, _setShowDetailModal] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [formData, setFormData] = useState(initialForm);

  const [filters, setFilters] = useState({ status: 'all', type: 'all', search: '' });
  const [activeTab, setActiveTab] = useState('all');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAssets(); }, [vendorId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPaymentLinks(filters); }, [filters.status, filters.search]);

  const loadAssets = async () => {
    if (vendorId) {
      const { data } = await supabase.from('products').select('id, name, price, description, images, stock_quantity')
        .eq('vendor_id', vendorId).eq('is_active', true).order('name');
      setProducts(data || []);
    }
    if (vendorUserId) {
      const { data } = await supabase.from('professional_services').select('id, business_name, description')
        .eq('user_id', vendorUserId).order('business_name');
      setServices((data || []).map((d: any) => ({ id: d.id, business_name: d.business_name, description: d.description })));
    }
  };

  const filteredLinks = useMemo(() => {
    let result = paymentLinks;
    if (activeTab !== 'all') result = result.filter(l => l.link_type === activeTab);
    if (filters.type !== 'all') result = result.filter(l => l.link_type === filters.type);
    return result;
  }, [paymentLinks, activeTab, filters.type]);

  // Panier multi-produits (type « checkout » = facture façon Alibaba)
  const [cart, setCart] = useState<{ product_id: string; name: string; price: number; qty: number; image?: string | null }[]>([]);
  const cartTotal = useMemo(() => cart.reduce((s, it) => s + it.price * it.qty, 0), [cart]);

  const addProduct = (p: Product) => {
    setCart(prev => {
      const existing = prev.find(it => it.product_id === p.id);
      if (existing) return prev.map(it => it.product_id === p.id ? { ...it, qty: it.qty + 1 } : it);
      return [...prev, { product_id: p.id, name: p.name, price: p.price, qty: 1, image: p.images?.[0] || null }];
    });
  };
  const setQty = (id: string, qty: number) => setCart(prev => prev.map(it => it.product_id === id ? { ...it, qty: Math.max(1, qty) } : it));
  const removeFromCart = (id: string) => setCart(prev => prev.filter(it => it.product_id !== id));

  const handleServiceSelect = (serviceId: string) => {
    const s = services.find(x => x.id === serviceId);
    if (s) {
      setFormData(f => ({ ...f, service_id: s.id, produit: s.business_name, title: s.business_name, description: s.description || '' }));
    }
  };

  const resetForm = () => {
    setShowCreateModal(false);
    setEditingPaymentId(null);
    setFormData(initialForm);
    setCart([]);
  };

  // Pré-remplit le formulaire à partir d'un lien existant (édition). Liens « pending » uniquement.
  const openEdit = (link: any) => {
    if (link.status !== 'pending') {
      toast({ title: "Non modifiable", description: t('paymentLinksManager.seulsLesLiensEnAttente'), variant: "destructive" });
      return;
    }
    setEditingPaymentId(link.payment_id);
    setFormData({
      ...initialForm,
      linkType: (link.link_type || 'payment') as LinkType,
      product_id: link.product_id || '',
      service_id: link.service_id || '',
      produit: link.produit || '',
      title: link.title || link.produit || '',
      description: link.description || '',
      montant: String(link.montant ?? ''),
      devise: link.devise || 'GNF',
      reference: link.reference || '',
      remise: String(link.remise ?? '0'),
      type_remise: (link.type_remise || 'percentage') as 'percentage' | 'fixed',
      payment_type: link.payment_type || 'full',
      is_single_use: link.is_single_use !== false,
    });
    const items = link.metadata?.items;
    setCart(Array.isArray(items) ? items.map((it: any) => ({
      product_id: it.product_id, name: it.name, price: Number(it.price) || 0, qty: Number(it.qty) || 1, image: it.image || null,
    })) : []);
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    // Panier multi-produits (checkout) → titre/montant dérivés des lignes.
    const hasCart = formData.linkType === 'checkout' && cart.length > 0;
    const produit = hasCart ? (cart.length === 1 ? cart[0].name : `${cart.length} produits`) : formData.produit;
    const montant = hasCart ? cartTotal : parseFloat(formData.montant);

    if (!produit || !montant || montant <= 0) {
      toast({ title: "Erreur", description: hasCart ? "Panier vide ou montant nul" : "Titre et montant requis", variant: "destructive" });
      return;
    }

    const payload = {
      linkType: formData.linkType,
      ownerType,
      items: hasCart ? cart.map(it => ({ product_id: it.product_id, name: it.name, price: it.price, qty: it.qty, image: it.image })) : undefined,
      produit,
      title: formData.title || produit,
      description: formData.description,
      montant,
      devise: formData.devise,
      reference: formData.reference || undefined,
      client_id: formData.client_id || undefined,
      remise: parseFloat(formData.remise),
      type_remise: formData.type_remise,
      product_id: hasCart && cart.length === 1 ? cart[0].product_id : (formData.product_id || undefined),
      service_id: formData.service_id || undefined,
      payment_type: formData.payment_type,
      is_single_use: formData.is_single_use,
      expires_days: parseInt(formData.expires_days) || 7,
    };

    try {
      setCreating(true);

      // ── MODE ÉDITION ──
      if (editingPaymentId) {
        const ok = await updatePaymentLink(editingPaymentId, payload);
        if (ok) resetForm();
        return;
      }

      // ── MODE CRÉATION ──
      const token = await createPaymentLink(payload);
      if (token) {
        const url = `${getPublicBaseUrl()}/pay/${encodeURIComponent(token)}`;
        navigator.clipboard.writeText(url);
        toast({ title: t('paymentLinksManager.lienCreeEtCopie'), description: url });
        resetForm();
      }
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (link: any) => {
    const url = getPaymentUrl(link);
    navigator.clipboard.writeText(url);
    toast({ title: t('paymentLinksManager.lienCopie') });
  };

  const shareLink = async (link: any) => {
    const url = getPaymentUrl(link);
    const result = await tryNativeShare({
      title: `Paiement - ${link.title || link.produit}`,
      text: 'Effectuez votre paiement sécurisé',
      url,
    });

    if (result === 'fallback') {
      copyLink(link);
    }
  };

  const cancelLink = async (link: any) => {
    if (!confirm(`Annuler le lien "${link.title || link.produit}" ?`)) return;
    await updatePaymentLinkStatus(link.payment_id, 'cancelled');
  };

  const removeLink = async (link: any) => {
    if (!confirm(`Supprimer définitivement "${link.title || link.produit}" ?`)) return;
    await deletePaymentLink(link.payment_id);
  };

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('fr-FR').format(amount) + ' ' + currency;

  // ─── RENDER ───
  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 shrink-0">
        {[
          { icon: <Link className="w-5 h-5 text-primary" />, label: 'Total', value: stats?.total_links || 0 },
          { icon: <CheckCircle className="w-5 h-5 text-[#ff4000]" />, label: t('paymentLinksManager.payes'), value: stats?.successful_payments || 0, color: 'text-[#ff4000]' },
          { icon: <Clock className="w-5 h-5 text-[#ff4000]" />, label: 'En attente', value: stats?.pending_payments || 0, color: 'text-[#ff4000]' },
          { icon: <XCircle className="w-5 h-5 text-[#ff4000]" />, label: t('paymentLinksManager.echoues'), value: stats?.failed_payments || 0, color: 'text-[#ff4000]' },
          { icon: <DollarSign className="w-5 h-5 text-primary" />, label: 'Revenus', value: formatCurrency(stats?.total_revenue || 0, 'GNF'), isRevenue: true },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-3 flex items-center gap-3">
              {s.icon}
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`font-bold ${s.isRevenue ? 'text-sm' : 'text-xl'} ${s.color || ''}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between shrink-0">
        <div className="flex gap-2 flex-1">
          <Input
            placeholder={t('paymentLinksManager.rechercher')}
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="sm:w-48"
          />
          <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
            <SelectTrigger className="sm:w-36"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('paymentLinksManager.tousStatuts')}</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="success">{t('paymentLinksManager.payes')}</SelectItem>
              <SelectItem value="failed">{t('paymentLinksManager.echoues')}</SelectItem>
              <SelectItem value="expired">{t('paymentLinksManager.expires')}</SelectItem>
              <SelectItem value="cancelled">{t('paymentLinksManager.annules')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => loadPaymentLinks(filters)} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Dialog open={showCreateModal} onOpenChange={(o) => { if (!o) resetForm(); else setShowCreateModal(true); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary hover:bg-primary/90"
                onClick={() => { setEditingPaymentId(null); setFormData(initialForm); setCart([]); }}>
                <Plus className="w-4 h-4 mr-1" />Créer un lien
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{editingPaymentId ? 'Modifier le lien de paiement' : t('paymentLinksManager.nouveauLienDePaiement')}</DialogTitle>
                <DialogDescription>{editingPaymentId ? 'Modifiez les détails puis enregistrez.' : t('paymentLinksManager.choisissezLeTypeEtRemplissez')}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 overflow-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                <div className="space-y-4 px-1 pr-4 pb-2">
                  {/* Link type selection */}
                  <div>
                    <Label className="mb-2 block">{t('paymentLinksManager.typeDeLien')}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {LINK_TYPES.map(lt => (
                        <button
                          key={lt.value}
                          type="button"
                          onClick={() => setFormData(f => ({ ...f, linkType: lt.value, product_id: '', service_id: '' }))}
                          className={`flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all ${
                            formData.linkType === lt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                          }`}
                        >
                          {lt.icon}
                          <div>
                            <p className="text-sm font-medium">{lt.label}</p>
                            <p className="text-xs text-muted-foreground">{lt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Panier multi-produits pour le type checkout (facture façon Alibaba) */}
                  {formData.linkType === 'checkout' && (
                    <div className="space-y-2">
                      <Label>{t('paymentLinksManager.selectionnezLesProduitsCliquezPour')}</Label>
                      {products.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1 border rounded-lg">
                          {products.map(p => {
                            const inCart = cart.find(it => it.product_id === p.id);
                            const outOfStock = (p.stock_quantity ?? 0) <= 0;
                            return (
                              <button type="button" key={p.id}
                                onClick={() => !outOfStock && addProduct(p)}
                                disabled={outOfStock}
                                title={outOfStock ? 'Indisponible — rupture de stock' : undefined}
                                className={`text-left border rounded-lg p-2 transition ${
                                  outOfStock
                                    ? 'opacity-60 cursor-not-allowed border-border'
                                    : `hover:border-primary hover:shadow-sm active:scale-95 ${inCart ? 'border-primary bg-primary/5' : 'border-border'}`
                                }`}>
                                <div className="relative w-full aspect-square rounded-md bg-muted overflow-hidden flex items-center justify-center mb-1.5">
                                  {p.images?.[0] ? (
                                    <img src={p.images[0]} alt={p.name} className={`w-full h-full object-cover ${outOfStock ? 'grayscale' : ''}`} />
                                  ) : (
                                    <Package className="w-7 h-7 text-muted-foreground" />
                                  )}
                                  {outOfStock && (
                                    <span className="absolute inset-0 bg-background/40 flex items-center justify-center">
                                      <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">Rupture</span>
                                    </span>
                                  )}
                                  {!outOfStock && inCart && (
                                    <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
                                      {inCart.qty}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-medium leading-tight line-clamp-2">{p.name}</p>
                                <p className="text-xs text-primary font-semibold mt-0.5">{fc(p.price)}</p>
                                {!outOfStock && (p.stock_quantity ?? 0) <= 5 && (
                                  <p className="text-[10px] text-[#ff4000] mt-0.5">Plus que {p.stock_quantity}</p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : <p className="text-xs text-muted-foreground">{t('paymentLinksManager.aucunProduitDisponible')}</p>}

                      {cart.length > 0 && (
                        <div className="border rounded-lg divide-y">
                          {cart.map(it => (
                            <div key={it.product_id} className="flex items-center gap-2 p-2 text-sm">
                              <div className="w-9 h-9 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0 border">
                                {it.image ? (
                                  <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                              <span className="flex-1 truncate">{it.name}</span>
                              <Input type="number" min={1} value={it.qty}
                                onChange={(e) => setQty(it.product_id, parseInt(e.target.value) || 1)}
                                className="w-16 h-8" />
                              <span className="w-28 text-right font-medium">{fc(it.price * it.qty)}</span>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => removeFromCart(it.product_id)}>✕</Button>
                            </div>
                          ))}
                          <div className="flex justify-between p-2 font-bold bg-muted/40">
                            <span>Total facture</span><span>{fc(cartTotal)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Service select for service type */}
                  {formData.linkType === 'service' && services.length > 0 && (
                    <div>
                      <Label>{t('paymentLinksManager.service')}</Label>
                      <Select value={formData.service_id} onValueChange={handleServiceSelect}>
                        <SelectTrigger><SelectValue placeholder={t('paymentLinksManager.selectionnerUnService')} /></SelectTrigger>
                        <SelectContent>
                          {services.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              <div className="flex items-center gap-2">
                                <Wrench className="w-3.5 h-3.5" />
                                {s.business_name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Title */}
                  <div>
                    <Label>Titre / Objet *</Label>
                    <Input
                      value={formData.produit}
                      onChange={(e) => setFormData(f => ({ ...f, produit: e.target.value, title: e.target.value }))}
                      placeholder={formData.linkType === 'service' ? 'Ex: Course taxi Kaloum' : 'Ex: Formation Marketing Digital'}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                      placeholder={t('paymentLinksManager.descriptionDuPaiement')}
                      rows={2}
                    />
                  </div>

                  {/* Amount & currency */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{t('paymentLinksManager.montant')}</Label>
                      <Input type="number" value={formData.montant}
                        onChange={(e) => setFormData(f => ({ ...f, montant: e.target.value }))} placeholder="0" />
                    </div>
                    <div>
                      <Label>Devise</Label>
                      <Select value={formData.devise} onValueChange={(v) => setFormData(f => ({ ...f, devise: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GNF">GNF</SelectItem>
                          <SelectItem value="FCFA">FCFA</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Reference (for invoice) */}
                  {(formData.linkType === 'invoice' || formData.linkType === 'service') && (
                    <div>
                      <Label>Référence / N° facture</Label>
                      <Input value={formData.reference}
                        onChange={(e) => setFormData(f => ({ ...f, reference: e.target.value }))}
                        placeholder="Ex: INV-2026-001" />
                    </div>
                  )}

                  {/* Payment type */}
                  <div>
                    <Label>{t('paymentLinksManager.typeDeReglement')}</Label>
                    <Select value={formData.payment_type} onValueChange={(v) => setFormData(f => ({ ...f, payment_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">{t('paymentLinksManager.paiementTotal')}</SelectItem>
                        <SelectItem value="deposit">Acompte</SelectItem>
                        <SelectItem value="balance">{t('paymentLinksManager.soldeRestant')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Client info (optional) */}
                  <div>
                    <Label>{t('paymentLinksManager.idClientOptionnel')}</Label>
                    <Input value={formData.client_id}
                      onChange={(e) => setFormData(f => ({ ...f, client_id: e.target.value }))}
                      placeholder="Ex: USR0002" />
                    <p className="text-xs text-muted-foreground mt-1">{t('paymentLinksManager.laissezVidePourUnLien')}</p>
                  </div>

                  {/* Discount */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Remise</Label>
                      <Input type="number" min="0" value={formData.remise}
                        onChange={(e) => setFormData(f => ({ ...f, remise: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Type remise</Label>
                      <Select value={formData.type_remise}
                        onValueChange={(v: 'percentage' | 'fixed') => setFormData(f => ({ ...f, type_remise: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">%</SelectItem>
                          <SelectItem value="fixed">Fixe</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Expiry & single use */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{t('paymentLinksManager.expireDansJours')}</Label>
                      <Input type="number" min="1" max="365" value={formData.expires_days}
                        onChange={(e) => setFormData(f => ({ ...f, expires_days: e.target.value }))} />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <Switch checked={formData.is_single_use}
                        onCheckedChange={(v) => setFormData(f => ({ ...f, is_single_use: v }))} />
                      <Label className="text-sm">Usage unique</Label>
                    </div>
                  </div>

                  {/* Summary */}
                  {formData.montant && (
                    <div className="p-3 bg-muted rounded-lg space-y-1">
                      <p className="text-sm font-semibold">{t('paymentLinksManager.resume')}</p>
                      {(() => {
                        const m = parseFloat(formData.montant) || 0;
                        const r = parseFloat(formData.remise) || 0;
                        let net = m;
                        if (r > 0) net = formData.type_remise === 'percentage' ? m * (1 - r / 100) : m - r;
                        return (
                          <>
                            <p className="text-xs text-muted-foreground">Montant: {formatCurrency(m, formData.devise)}</p>
                            {r > 0 && <p className="text-xs text-[#ff4000]">Remise: -{r}{formData.type_remise === 'percentage' ? '%' : ` ${formData.devise}`}</p>}
                            <p className="text-sm font-bold text-primary">À payer: {formatCurrency(net, formData.devise)}</p>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 pt-3 shrink-0">
                <Button variant="outline" onClick={resetForm}>{t('paymentLinksManager.annuler')}</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating
                    ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{editingPaymentId ? 'Enregistrement…' : t('paymentLinksManager.creation')}</>
                    : editingPaymentId
                      ? <><Edit className="w-4 h-4 mr-2" />{t('paymentLinksManager.enregistrerLesModifications')}</>
                      : <><Plus className="w-4 h-4 mr-2" />{t('paymentLinksManager.creerLeLien')}</>}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs by link type */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 w-full justify-start">
          <TabsTrigger value="all">{t('paymentLinksManager.tous')}</TabsTrigger>
          <TabsTrigger value="payment" className="gap-1"><CreditCard className="w-3.5 h-3.5" />{t('paymentLinksManager.paiements')}</TabsTrigger>
          <TabsTrigger value="invoice" className="gap-1"><FileText className="w-3.5 h-3.5" />Factures</TabsTrigger>
          <TabsTrigger value="checkout" className="gap-1"><ShoppingCart className="w-3.5 h-3.5" />Checkouts</TabsTrigger>
          <TabsTrigger value="service" className="gap-1"><Wrench className="w-3.5 h-3.5" />{t('paymentLinksManager.services')}</TabsTrigger>
        </TabsList>

        <Card className="flex-1 flex flex-col overflow-hidden mt-3">
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin mr-2 text-primary" />
                    <span className="text-muted-foreground">Chargement...</span>
                  </div>
                ) : filteredLinks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Link className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="font-medium">{t('paymentLinksManager.aucunLienDePaiement')}</p>
                    <p className="text-sm">{t('paymentLinksManager.creezVotrePremierLienPour')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredLinks.map((link) => {
                      const st = STATUS_CONFIG[link.status] || STATUS_CONFIG.pending;
                      const tp = TYPE_CONFIG[link.link_type] || TYPE_CONFIG.payment;
                      const url = getPaymentUrl(link);

                      return (
                        <div key={link.id} className="border rounded-xl p-4 hover:bg-accent/30 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {/* Badges */}
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <Badge variant="outline" className={`${tp.color} text-xs gap-1`}>
                                  {tp.icon}{tp.label}
                                </Badge>
                                <Badge variant="outline" className={`${st.color} text-xs gap-1`}>
                                  {st.icon}{st.label}
                                </Badge>
                                {link.payment_type && link.payment_type !== 'full' && (
                                  <Badge variant="outline" className="text-xs">
                                    {link.payment_type === 'deposit' ? 'Acompte' : 'Solde'}
                                  </Badge>
                                )}
                              </div>

                              {/* Title */}
                              <h3 className="font-semibold text-sm truncate">{link.title || link.produit}</h3>
                              {link.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{link.description}</p>
                              )}

                              {/* URL */}
                              <a href={url} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline flex items-center gap-1 mt-1.5 break-all">
                                <ExternalLink className="w-3 h-3 shrink-0" />{url}
                              </a>

                              {/* Meta row */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                                <span className="flex items-center gap-1 font-semibold text-foreground">
                                  <DollarSign className="w-3 h-3" />
                                  {formatCurrency(link.total || link.montant, link.devise)}
                                </span>
                                {link.reference && (
                                  <span className="flex items-center gap-1">
                                    <Receipt className="w-3 h-3" />Réf: {link.reference}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(link.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                </span>
                                {link.client && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />{link.client.name}
                                  </span>
                                )}
                                {link.payment_method && (
                                  <span className="flex items-center gap-1 capitalize">
                                    <Smartphone className="w-3 h-3" />{link.payment_method.replace('_', ' ')}
                                  </span>
                                )}
                                {link.wallet_credit_status && (
                                  <Badge variant="outline" className="text-xs">
                                    Crédit: {link.wallet_credit_status === 'credited' ? '✅' : '⏳'} {link.wallet_credit_status}
                                  </Badge>
                                )}
                              </div>

                              {/* Settlement info for paid links */}
                              {link.status === 'success' && link.net_amount && (
                                <div className="flex items-center gap-3 text-xs mt-2 p-2 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg">
                                  <span>Brut: {formatCurrency(link.gross_amount || link.montant, link.devise)}</span>
                                  <span className="text-muted-foreground">Commission: {formatCurrency(link.platform_fee || 0, link.devise)}</span>
                                  <span className="font-semibold text-[#ff4000] dark:text-[#ff4000]">Net: {formatCurrency(link.net_amount, link.devise)}</span>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(link)} title="Copier">
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shareLink(link)} title="Partager">
                                <Share2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowQrModal(url)} title="QR Code">
                                <QrCode className="w-4 h-4" />
                              </Button>
                              {link.status === 'pending' && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(link)} title={t('paymentLinksManager.modifier')}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              {link.status === 'pending' && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => cancelLink(link)} title={t('paymentLinksManager.annuler')}>
                                  <Ban className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => removeLink(link)}
                                title={t('paymentLinksManager.supprimer')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </Tabs>

      {/* QR Code Modal */}
      <Dialog open={!!showQrModal} onOpenChange={() => setShowQrModal(null)}>
        <DialogContent className="max-w-xs text-center max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('paymentLinksManager.qrCodeDuLien')}</DialogTitle>
            <DialogDescription>{t('paymentLinksManager.scannezPourAccederAuPaiement')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center p-4">
            {showQrModal && <QRCodeSVG value={showQrModal} size={200} />}
          </div>
          <Button onClick={() => { navigator.clipboard.writeText(showQrModal || ''); toast({ title: t('paymentLinksManager.lienCopie') }); }}>
            <Copy className="w-4 h-4 mr-2" />Copier le lien
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
