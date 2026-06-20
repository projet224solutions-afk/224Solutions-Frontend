import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🌍 GESTION DES PRIX D'ABONNEMENT PAR PAYS / ZONE-DEVISE (PDG/Admin).
 *
 * Pilotée par le CATALOGUE RÉEL des plans (/admin/catalog) → TOUS les plans existants sont
 * listés (vendeur, services, driver), liés aux vrais abonnements, même sans prix de zone encore.
 * Séparation calquée sur les 2 systèmes existants :
 *   • VENDEUR (table plans)          → sous-onglet « Vendeur »
 *   • SERVICES (service_plans)       → sous-onglet « Services » + sélecteur de catégories
 *                                       (Vue Globale + par métier), comme PDGServiceSubscriptions
 *   • DRIVER (taxi/livreur)          → sous-onglet « Driver »
 *
 * Le prix édité est un prix de ZONE-devise (partagé par tous les pays de la devise → zone euro
 * = même prix). Enregistrement via POST /admin/prices (upsert robuste).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CountryFlag } from '@/components/CountryFlag';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';
import {
  Globe2, RefreshCw, Save, Plus, MapPin, Store, Bike, LayoutGrid,
  UtensilsCrossed, Home, Wrench, Car, Dumbbell, Scissors, Laptop,
  BookOpen, Truck, Camera, Leaf, Heart, Hammer, Sparkles, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Country {
  country_code: string; country_name: string; currency_code: string;
  currency_symbol: string; flag_emoji: string | null; payment_methods: string[]; is_active: boolean;
}
interface CatalogItem {
  group: 'vendor' | 'services' | 'driver';
  service_type: string; service_name: string;
  plan_code: string; plan_display: string;
  gnf_price: number; zone_price: number | null; zone_commission: number | null;
  max_products: number | null; max_secondary: number | null; secondary_label: string;
  features: string[]; display_order: number;
}

const SERVICE_ICONS: Record<string, any> = {
  restaurant: UtensilsCrossed, location: Home, construction: Hammer, vtc: Car, sport: Dumbbell,
  beaute: Scissors, informatique: Laptop, education: BookOpen, livraison: Truck, media: Camera,
  agriculture: Leaf, sante: Heart, reparation: Wrench, menage: Sparkles, ecommerce: Store,
  securite: Shield, pharmacie: Heart, clinique: Heart, freelance: Laptop, maison: Home,
};

export default function CountryPricingManagement() {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<Country[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [currencySym, setCurrencySym] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingCat, setLoadingCat] = useState(false);
  const [selectedCC, setSelectedCC] = useState<string>('');
  const [mode, setMode] = useState<'vendor' | 'digital' | 'services' | 'driver'>('vendor');
  const [serviceCat, setServiceCat] = useState<string>('all');
  const [drafts, setDrafts] = useState<Record<string, { price: string; commission: string }>>({});
  const [userChange, setUserChange] = useState({ user_id: '', new_country: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  // Liste des pays (une fois).
  const loadCountries = useCallback(async () => {
    setLoading(true);
    try {
      const cRes = await backendFetch<any>('/api/v2/country-pricing/admin/countries');
      const cs = (cRes as any)?.countries || [];
      setCountries(cs);
      if (!selectedCC && cs.length) setSelectedCC(cs.find((c: Country) => c.country_code === 'GN')?.country_code || cs[0].country_code);
    } catch { toast.error(t('countryPricingManagement.erreurDeChargementDesPays')); }
    finally { setLoading(false); }
  }, [selectedCC]);

  // Catalogue réel + prix de zone du pays sélectionné.
  const loadCatalog = useCallback(async (cc: string) => {
    if (!cc) return;
    setLoadingCat(true);
    try {
      const res = await backendFetch<any>(`/api/v2/country-pricing/admin/catalog?country_code=${cc}`);
      if ((res as any)?.items) {
        setItems((res as any).items as CatalogItem[]);
        setCurrencySym((res as any).currency_symbol || (res as any).currency || '');
        setDrafts({});
      } else if (res.success === false) {
        toast.error(res.error || 'Erreur catalogue');
        setItems([]);
      }
    } catch { toast.error(t('countryPricingManagement.erreurDeChargementDuCatalogue')); }
    finally { setLoadingCat(false); }
  }, []);

  useEffect(() => { void loadCountries(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedCC) void loadCatalog(selectedCC); }, [selectedCC, loadCatalog]);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.country_code === selectedCC) || null,
    [countries, selectedCC],
  );

  // Catégories de services présentes dans le catalogue (pour les onglets métiers).
  const serviceCategories = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of items) if (it.group === 'services') map.set(it.service_type, it.service_name);
    return [...map.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [items]);

  const visibleItems = useMemo(() => {
    // Le vendeur NUMÉRIQUE partage les plans du vendeur (même table `plans`) → on réutilise group 'vendor'.
    const groupFilter = mode === 'digital' ? 'vendor' : mode;
    let rows = items.filter((it) => it.group === groupFilter);
    if (mode === 'services' && serviceCat !== 'all') rows = rows.filter((it) => it.service_type === serviceCat);
    return rows.sort((a, b) =>
      a.service_name.localeCompare(b.service_name, 'fr') || (a.display_order - b.display_order)
      || a.plan_display.localeCompare(b.plan_display, 'fr'));
  }, [items, mode, serviceCat]);

  const stIcon = (code: string) => { const I = SERVICE_ICONS[code] || Store; return <I className="w-4 h-4" />; };
  const keyOf = (it: CatalogItem) => `${it.service_type}:${it.plan_code}`;

  const savePrice = async (it: CatalogItem) => {
    const d = drafts[keyOf(it)] || { price: it.zone_price != null ? String(it.zone_price) : '', commission: it.zone_commission != null ? String(it.zone_commission) : '' };
    const price = Number(d.price);
    if (d.price === '' || isNaN(price) || price < 0) { toast.error('Prix invalide'); return; }
    setSaving(true);
    try {
      const res = await backendFetch<any>('/api/v2/country-pricing/admin/prices', {
        method: 'POST',
        body: { country_code: selectedCC, service_type: it.service_type, plan_code: it.plan_code, price,
                commission_rate: d.commission !== '' ? Number(d.commission) : undefined },
      });
      if (res.success === false) { toast.error(res.error || 'Échec enregistrement'); return; }
      toast.success(`${it.service_name} · ${it.plan_display} = ${price} ${selectedCountry?.currency_code} (zone)`);
      await loadCatalog(selectedCC);
    } catch { toast.error(t('countryPricingManagement.erreurReseau')); }
    finally { setSaving(false); }
  };

  const seedFromCatalog = async () => {
    if (!selectedCC) return;
    setSaving(true);
    try {
      const res = await backendFetch<any>('/api/v2/country-pricing/admin/seed-country', { method: 'POST', body: { country_code: selectedCC, overwrite: false } });
      if (res.success === false) { toast.error(res.error || 'Échec'); return; }
      const r = (res as any).result || {};
      toast.success(`Zone ${r.currency || ''} : ${r.inserted ?? 0} ajoutés, ${r.updated ?? 0} mis à jour`);
      await loadCatalog(selectedCC);
    } finally { setSaving(false); }
  };

  const toggleCountry = async (cc: string, isActive: boolean) => {
    setSaving(true);
    try {
      const res = await backendFetch<any>(`/api/v2/country-pricing/admin/countries/${cc}/active`, { method: 'POST', body: { is_active: isActive } });
      if (res.success === false) { toast.error(res.error || 'Échec'); return; }
      toast.success(`${cc} ${isActive ? 'activé' : 'désactivé'}`);
      await loadCountries();
    } finally { setSaving(false); }
  };

  const changeUserCountry = async () => {
    const { user_id, new_country, reason } = userChange;
    if (!user_id || !new_country || reason.trim().length < 3) { toast.error(t('countryPricingManagement.userIdPaysEtMotif')); return; }
    setSaving(true);
    try {
      const res = await backendFetch<any>('/api/v2/country-pricing/admin/user-country', { method: 'POST', body: { user_id, new_country, reason } });
      if (res.success === false) { toast.error(res.error || 'Échec'); return; }
      toast.success(`Pays de l'utilisateur changé → ${new_country}`);
      setUserChange({ user_id: '', new_country: '', reason: '' });
    } finally { setSaving(false); }
  };

  const renderGrid = () => {
    const showService = mode === 'services' && serviceCat === 'all';
    const showLimits = mode !== 'driver';
    const showSecondary = mode !== 'driver';
    const secondaryHeader = mode === 'services' ? 'Réservations/mois' : 'Images/Produit';
    const cur = selectedCountry?.currency_code || '';
    const colCount = 1 /*plan*/ + 1 /*prix*/ + (showService ? 1 : 0)
      + (showLimits ? 1 : 0) /*produits*/ + (showSecondary ? 1 : 0) + (showLimits ? 1 : 0) /*features*/ + 1 /*actions*/;
    return (
      <div className="space-y-3">
        <div className="text-xs text-muted-foreground">{visibleItems.length} plan(s) · prix mensuel en <strong>{cur}</strong> (zone partagée). Limites/fonctionnalités = identiques au plan (gérées dans Abonnements/Services).</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {showService && <th className="py-2 pr-3">{t('countryPricingManagement.service')}</th>}
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 pr-3">Prix Mensuel ({cur})</th>
                {showLimits && <th className="py-2 pr-3">{t('countryPricingManagement.produitsMax')}</th>}
                {showSecondary && <th className="py-2 pr-3">{secondaryHeader}</th>}
                {showLimits && <th className="py-2 pr-3">{t('countryPricingManagement.fonctionnalites')}</th>}
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.length === 0 && (
                <tr><td colSpan={colCount} className="py-6 text-center text-muted-foreground">{t('countryPricingManagement.aucunPlanPourCetteSelection')}</td></tr>
              )}
              {visibleItems.map((it) => {
                const k = keyOf(it);
                const d = drafts[k] || { price: it.zone_price != null ? String(it.zone_price) : '', commission: '' };
                return (
                  <tr key={k} className="border-b">
                    {showService && (
                      <td className="py-2 pr-3"><span className="inline-flex items-center gap-1.5">{stIcon(it.service_type)} {it.service_name}</span></td>
                    )}
                    <td className="py-2 pr-3 font-medium">{it.plan_display}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1">
                        <Input className="h-8 w-28" type="number" placeholder="—" value={d.price}
                          onChange={(e) => setDrafts({ ...drafts, [k]: { ...d, price: e.target.value } })} />
                        <span className="text-xs text-muted-foreground">{cur}</span>
                      </div>
                      {it.gnf_price > 0 && <span className="text-[11px] text-muted-foreground">réf. {it.gnf_price.toLocaleString('fr-FR')} GNF</span>}
                    </td>
                    {showLimits && (
                      <td className="py-2 pr-3">{it.max_products == null ? <Badge variant="secondary">{t('countryPricingManagement.illimite')}</Badge> : <span className="font-medium">{it.max_products}</span>}</td>
                    )}
                    {showSecondary && (
                      <td className="py-2 pr-3">{it.max_secondary == null ? <Badge variant="secondary">{t('countryPricingManagement.illimite')}</Badge> : <span className="font-medium">{it.max_secondary}</span>}</td>
                    )}
                    {showLimits && (
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {it.features.length === 0 ? <span className="text-muted-foreground">—</span>
                            : it.features.map((f) => <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>)}
                        </div>
                      </td>
                    )}
                    <td className="py-2">
                      <Button size="sm" variant={it.zone_price == null ? 'default' : 'outline'} disabled={saving} onClick={() => savePrice({ ...it })}>
                        <Save className="w-4 h-4 mr-1" />{it.zone_price == null ? 'Définir Prix' : 'Modifier Prix'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Globe2 className="w-5 h-5 text-primary" /> Prix d'abonnement par pays</CardTitle>
              <CardDescription>Prix par <strong>zone-devise</strong> (zone euro = même prix). Vendeur / Services / Driver — tous les plans réels.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => { loadCountries(); loadCatalog(selectedCC); }} disabled={loading || saving}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading || loadingCat ? 'animate-spin' : ''}`} /> Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('countryPricingManagement.rechercherUnPaysOuUne')} className="max-w-md" />
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {countries
              .filter((c) => { const q = filter.trim().toLowerCase(); return !q || c.country_name.toLowerCase().includes(q) || c.country_code.toLowerCase().includes(q) || c.currency_code.toLowerCase().includes(q); })
              .slice(0, 60)
              .map((c) => (
                <button key={c.country_code} onClick={() => setSelectedCC(c.country_code)}
                  className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition',
                    selectedCC === c.country_code ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted', !c.is_active && 'opacity-50')}>
                  <CountryFlag country={c.country_code} size={14} /><span>{c.country_name}</span>
                  <Badge variant="outline" className="ml-1">{c.currency_code}</Badge>
                </button>
              ))}
          </div>
        </CardContent>
      </Card>

      {selectedCountry && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <CountryFlag country={selectedCountry.country_code} size={18} />
                {selectedCountry.country_name}
                <Badge>Zone {selectedCountry.currency_code} ({currencySym || selectedCountry.currency_symbol})</Badge>
                {loadingCat && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={seedFromCatalog} disabled={saving} title={t('countryPricingManagement.genereLesPrixManquantsDepuis')}>
                  <Plus className="w-4 h-4 mr-1" /> Générer (catalogue GN)
                </Button>
                <Button variant={selectedCountry.is_active ? 'outline' : 'default'} size="sm" onClick={() => toggleCountry(selectedCountry.country_code, !selectedCountry.is_active)} disabled={saving}>
                  {selectedCountry.is_active ? 'Désactiver' : 'Activer'}
                </Button>
              </div>
            </div>
            <CardDescription>{t('countryPricingManagement.prixDeLaZone')} <strong>{selectedCountry.currency_code}</strong> {t('countryPricingManagement.partagesParTousLesPays')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="space-y-4">
              <TabsList>
                <TabsTrigger value="vendor"><Store className="w-4 h-4 mr-1.5" /> Vendeur ({items.filter((i) => i.group === 'vendor').length})</TabsTrigger>
                <TabsTrigger value="digital"><Laptop className="w-4 h-4 mr-1.5" /> Numérique ({items.filter((i) => i.group === 'vendor').length})</TabsTrigger>
                <TabsTrigger value="services"><LayoutGrid className="w-4 h-4 mr-1.5" /> Services ({items.filter((i) => i.group === 'services').length})</TabsTrigger>
                <TabsTrigger value="driver"><Bike className="w-4 h-4 mr-1.5" /> Driver ({items.filter((i) => i.group === 'driver').length})</TabsTrigger>
              </TabsList>
              {(mode === 'vendor' || mode === 'digital') && (
                <p className="text-xs text-muted-foreground -mt-1">
                  💡 <strong>{t('countryPricingManagement.vendeurBoutique')}</strong> et <strong>{t('countryPricingManagement.vendeurNumerique')}</strong> {t('countryPricingManagement.partagentLesMemesPlansTable')} <code>plans</code>) : modifier un prix ici le change pour les deux. Le vendeur digital voit cette tarification présentée en 3 offres (Starter / Croissance / Scale).
                </p>
              )}

              {mode === 'services' && (
                <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
                  <div className="flex gap-2 pb-2 min-w-max">
                    <button onClick={() => setServiceCat('all')}
                      className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border',
                        serviceCat === 'all' ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-card text-muted-foreground border-border hover:bg-accent')}>
                      <LayoutGrid className="w-4 h-4" /> <span>Vue Globale</span>
                      <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{serviceCategories.length}</Badge>
                    </button>
                    {serviceCategories.map((st) => (
                      <button key={st.code} onClick={() => setServiceCat(st.code)}
                        className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border whitespace-nowrap',
                          serviceCat === st.code ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'bg-card text-muted-foreground border-border hover:bg-accent')}>
                        {stIcon(st.code)} <span>{st.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <TabsContent value="vendor">{renderGrid()}</TabsContent>
              <TabsContent value="digital">{renderGrid()}</TabsContent>
              <TabsContent value="services">{renderGrid()}</TabsContent>
              <TabsContent value="driver">{renderGrid()}</TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> {t('countryPricingManagement.changerLePaysDUn')}</CardTitle>
          <CardDescription>{t('countryPricingManagement.lePaysEstVerrouilleA')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs">ID utilisateur (UUID)</Label>
              <Input value={userChange.user_id} onChange={(e) => setUserChange({ ...userChange, user_id: e.target.value })} placeholder="uuid" />
            </div>
            <div>
              <Label className="text-xs">{t('countryPricingManagement.nouveauPays')}</Label>
              <select className="h-10 rounded-md border bg-background px-2 text-sm block" value={userChange.new_country}
                onChange={(e) => setUserChange({ ...userChange, new_country: e.target.value })}>
                <option value="">—</option>
                {countries.filter((c) => c.is_active).map((c) => <option key={c.country_code} value={c.country_code}>{c.country_name} ({c.country_code})</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs">Motif (obligatoire)</Label>
              <Input value={userChange.reason} onChange={(e) => setUserChange({ ...userChange, reason: e.target.value })} placeholder={t('countryPricingManagement.exDemenagementConfirmeKyc')} />
            </div>
            <Button onClick={changeUserCountry} disabled={saving}>Appliquer</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
