/**
 * BROWSE MODAL - Fenêtre de navigation rapide
 * Affiche catégories, produits récents, vendeurs et fournisseurs certifiés
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Store, ShieldCheck, LayoutGrid, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LocalPrice } from "@/components/ui/LocalPrice";
import { getFlagEmoji, getCurrencyForCountry } from "@/data/countryMappings";
import { useTranslation } from "@/hooks/useTranslation";

/** Pays distincts d'une liste de vendeurs, triés (A→Z), sans pays → « Autres ». */
function distinctVendorCountries(items: VendorItem[]): string[] {
  const set = new Set<string>();
  for (const v of items) set.add((v.country || '').trim() || 'Autres');
  return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
}

interface BrowseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCategory: (categoryId: string) => void;
  onSelectProduct: (productId: string) => void;
  onSelectVendor: (vendorId: string) => void;
  categories: { id: string; name: string; image_url?: string; is_active: boolean; productCount?: number }[];
  /** Filtres géographiques hérités du marketplace ('all' = aucun filtre). */
  country?: string;
  city?: string;
}

interface VendorItem {
  id: string;
  business_name: string;
  logo_url?: string;
  country?: string;
  city?: string;
  user_id?: string;
  is_certified?: boolean;
  rating?: number;
}

interface ProductItem {
  id: string;
  name: string;
  price: number;
  currency?: string;
  images?: string[];
}

export function BrowseModal({
  open,
  onOpenChange,
  onSelectCategory,
  onSelectProduct,
  onSelectVendor,
  categories,
  country = 'all',
  city = 'all',
}: BrowseModalProps) {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [certifiedVendors, setCertifiedVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(false);
  // Pays sélectionné DANS la modale (rangée de chips sous l'onglet) — 'all' = tous
  const [browseCountry, setBrowseCountry] = useState('all');
  // Onglet Catégories : catégorie active + ses produits (volet de droite)
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [catProducts, setCatProducts] = useState<ProductItem[]>([]);
  const [catLoading, setCatLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setBrowseCountry('all'); // réinitialiser le filtre pays interne à chaque ouverture
    let cancelled = false;

    const hasCountry = country && country !== 'all';
    const hasCity = city && city !== 'all';

    // Applique les filtres marketplace cohérents : vendeurs en ligne/hybride + pays + ville (exact).
    const applyVendorFilters = (q: any) => {
      q = q.eq('is_active', true).in('business_type', ['online', 'hybrid']);
      if (hasCountry) q = q.ilike('country', country);
      if (hasCity) q = q.ilike('city', city);
      return q;
    };

    (async () => {
      // 1) Vendeurs (boutiques) — en ligne/hybride, filtrés pays/ville
      const vendorsRes = await applyVendorFilters(
        supabase.from('vendors').select('id, business_name, logo_url, country, city, rating, user_id')
      ).order('rating', { ascending: false }).limit(30);

      // 2) Boutiques CERTIFIÉES PAR LE PDG (vendor_certifications.status = 'CERTIFIE')
      //    vendor_certifications.vendor_id = vendors.user_id (= profil du vendeur).
      const { data: certRows } = await supabase
        .from('vendor_certifications').select('vendor_id').eq('status', 'CERTIFIE');
      const certifiedUserIds = [...new Set((certRows || []).map((c: any) => c.vendor_id).filter(Boolean))];
      let certifiedVendorsData: any[] = [];
      if (certifiedUserIds.length > 0) {
        // Toutes les boutiques certifiées PDG (répertoire de confiance) — sans restriction
        // business_type, mais filtrées pays/ville comme le reste.
        let cq: any = supabase
          .from('vendors').select('id, business_name, logo_url, country, city, rating, user_id')
          .eq('is_active', true).in('user_id', certifiedUserIds);
        if (hasCountry) cq = cq.ilike('country', country);
        if (hasCity) cq = cq.ilike('city', city);
        const certRes = await cq.order('rating', { ascending: false }).limit(30);
        certifiedVendorsData = (certRes.data as any[]) || [];
      }


      if (cancelled) return;

      // Badge « Certifié » fiable : marquer les vendeurs certifiés par le PDG
      const certifiedSet = new Set(certifiedUserIds);
      const markCertified = (arr: any[]) => (arr || []).map((v) => ({
        ...v, is_certified: certifiedSet.has(v.user_id),
      }));

      setVendors(markCertified((vendorsRes.data as any[]) || []));
      setCertifiedVendors(markCertified(certifiedVendorsData));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [open, country, city]);

  // Charge les produits d'une catégorie (volet droit), filtrés pays/ville (exact) + en ligne/hybride.
  const openCategory = async (catId: string) => {
    setActiveCatId(catId);
    setCatLoading(true);
    setCatProducts([]);
    const hasCountry = country && country !== 'all';
    const hasCity = city && city !== 'all';
    const safe = (s: string) => (s || '').replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
    let pq: any = supabase
      .from('products')
      .select('id, name, price, images, seller_currency, vendors!inner(business_type, country, city)')
      .eq('is_active', true)
      .eq('category_id', catId)
      .in('vendors.business_type', ['online', 'hybrid']);
    if (hasCountry) pq = pq.or(`country.ilike.${safe(country)}`, { referencedTable: 'vendors' });
    if (hasCity) pq = pq.or(`city.ilike.${safe(city)}`, { referencedTable: 'vendors' });
    const { data } = await pq.order('created_at', { ascending: false }).limit(40);
    setCatProducts((data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      images: p.images,
      currency: getCurrencyForCountry(p.vendors?.country || '') || p.seller_currency || 'GNF',
    })));
    setCatLoading(false);
  };

  // Auto-sélection de la 1ʳᵉ catégorie à l'ouverture / au changement de pays/ville.
  useEffect(() => {
    if (!open) { setActiveCatId(null); setCatProducts([]); return; }
    const first = categories.find((c) => c.id !== 'all');
    if (first) openCategory(first.id);
    else { setActiveCatId(null); setCatProducts([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, categories, country, city]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-h-[92vh] sm:max-h-[85vh] p-0 gap-0" style={{ maxWidth: '768px' }}>
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
          <DialogTitle className="text-lg sm:text-xl font-bold">{t('marketplace.exploreTitle')}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="categories" className="w-full">
          <div className="px-4 sm:px-6 pb-3 sm:pb-4 overflow-x-auto">
            <TabsList className="inline-flex h-10 sm:h-11 w-full bg-muted/60 rounded-xl p-1 gap-1">
              <TabsTrigger value="categories" className="flex-1 min-w-0 text-[11px] sm:text-sm gap-1 sm:gap-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md font-medium transition-all px-2 sm:px-3 whitespace-nowrap">
                <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> <span className="truncate">{t('marketplace.categories')}</span>
              </TabsTrigger>
              <TabsTrigger value="vendors" className="flex-1 min-w-0 text-[11px] sm:text-sm gap-1 sm:gap-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md font-medium transition-all px-2 sm:px-3 whitespace-nowrap">
                <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> <span className="truncate">{t('marketplace.vendors')}</span>
              </TabsTrigger>
              <TabsTrigger value="certified" className="flex-1 min-w-0 text-[11px] sm:text-sm gap-1 sm:gap-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md font-medium transition-all px-2 sm:px-3 whitespace-nowrap">
                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> <span className="truncate">{t('marketplace.certified')}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[62vh] sm:h-[55vh] px-3 sm:px-6 pb-4 sm:pb-6">
            {/* CATÉGORIES — 2 volets : liste à gauche, produits de la catégorie à droite */}
            <TabsContent value="categories" className="mt-0">
              {categories.filter(c => c.id !== "all").length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t('marketplace.noCategories')}</p>
              ) : (
                <div className="flex gap-2.5">
                  {/* Gauche : catégories (colonne étroite) */}
                  <div className="w-[30%] sm:w-[26%] shrink-0 space-y-1 max-h-[50vh] overflow-y-auto pr-0.5">
                    {categories.filter(c => c.id !== "all").map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => openCategory(cat.id)}
                        className={`w-full flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${activeCatId === cat.id ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/40'}`}
                      >
                        {cat.image_url ? (
                          <img src={cat.image_url} alt={cat.name} className="w-6 h-6 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <LayoutGrid className="w-3.5 h-3.5 text-primary" />
                          </div>
                        )}
                        <span className="flex-1 text-[11px] font-medium text-foreground line-clamp-2 leading-tight">{cat.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Droite : produits de la catégorie active */}
                  <div className="flex-1 min-w-0 max-h-[50vh] overflow-y-auto">
                    {catLoading ? (
                      <p className="text-xs text-muted-foreground text-center py-10">{t('common.loading')}</p>
                    ) : catProducts.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-10">{t('marketplace.noCategoryProducts')}</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {catProducts.map((product) => {
                          const img = Array.isArray(product.images) ? product.images[0] : undefined;
                          return (
                            <button
                              key={product.id}
                              onClick={() => { onSelectProduct(product.id); onOpenChange(false); }}
                              className="flex flex-col rounded-xl border border-border/50 hover:border-primary/40 hover:shadow-md transition-all overflow-hidden text-left group"
                            >
                              <div className="h-32 bg-muted flex items-center justify-center overflow-hidden">
                                {img ? (
                                  <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                ) : (
                                  <Package className="w-8 h-8 text-muted-foreground" />
                                )}
                              </div>
                              <div className="p-2.5 space-y-1">
                                <p className="text-xs font-medium line-clamp-2 text-foreground leading-tight">{product.name}</p>
                                <LocalPrice amount={product.price} currency={product.currency || 'GNF'} size="sm" className="text-xs font-bold" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* VENDEURS — rangée de pays (sous l'onglet) + liste filtrée */}
            <TabsContent value="vendors" className="mt-0">
              {(() => {
                const countries = distinctVendorCountries(vendors);
                const filtered = browseCountry === 'all'
                  ? vendors
                  : vendors.filter((v) => ((v.country || '').trim() || 'Autres') === browseCountry);
                return (
                  <>
                    {countries.length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                        <button onClick={() => setBrowseCountry('all')}
                          className={`shrink-0 px-2.5 h-7 rounded-full text-[11px] font-medium border transition-all ${browseCountry === 'all' ? 'bg-[#04439e] text-white border-transparent' : 'bg-white text-[#04439e] border border-[#04439e]/25 hover:bg-[#04439e]/5'}`}>
                          Tous
                        </button>
                        {countries.map((c) => (
                          <button key={c} onClick={() => setBrowseCountry(c)}
                            className={`shrink-0 px-2.5 h-7 rounded-full text-[11px] font-medium border transition-all whitespace-nowrap flex items-center gap-1 ${browseCountry === c ? 'bg-[#04439e] text-white border-transparent' : 'bg-white text-[#04439e] border border-[#04439e]/25 hover:bg-[#04439e]/5'}`}>
                            <span aria-hidden>{getFlagEmoji(c) || '🌍'}</span> {c}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2 mt-2">
                      {filtered.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => { onSelectVendor(v.id); onOpenChange(false); }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-primary/40 hover:bg-accent/50 transition-all text-left group"
                        >
                          {v.logo_url ? (
                            <img src={v.logo_url} alt={v.business_name} className="w-10 h-10 rounded-full object-cover border border-border" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Store className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground line-clamp-1">{v.business_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {v.city && <span className="text-[11px] text-muted-foreground">{v.city}</span>}
                              {(v.rating ?? 0) > 0 && (
                                <span className="text-[11px] text-[#ff4000] flex items-center gap-0.5">
                                  <Star className="w-3 h-3 fill-[#ff4000] text-[#ff4000]" /> {(v.rating ?? 0).toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                          {v.is_certified && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              <ShieldCheck className="w-3 h-3 mr-0.5" /> {t('marketplace.certifiedBadge')}
                            </Badge>
                          )}
                        </button>
                      ))}
                      {filtered.length === 0 && !loading && (
                        <p className="text-sm text-muted-foreground text-center py-8">{t('marketplace.noVendors')}</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </TabsContent>

            {/* BOUTIQUES CERTIFIÉES PAR LE PDG — rangée de pays (sous l'onglet) + liste filtrée */}
            <TabsContent value="certified" className="mt-0">
              {certifiedVendors.length > 0 ? (() => {
                const countries = distinctVendorCountries(certifiedVendors);
                const filtered = browseCountry === 'all'
                  ? certifiedVendors
                  : certifiedVendors.filter((v) => ((v.country || '').trim() || 'Autres') === browseCountry);
                return (
                  <>
                    {countries.length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                        <button onClick={() => setBrowseCountry('all')}
                          className={`shrink-0 px-2.5 h-7 rounded-full text-[11px] font-medium border transition-all ${browseCountry === 'all' ? 'bg-[#04439e] text-white border-transparent' : 'bg-white text-[#04439e] border border-[#04439e]/25 hover:bg-[#04439e]/5'}`}>
                          Tous
                        </button>
                        {countries.map((c) => (
                          <button key={c} onClick={() => setBrowseCountry(c)}
                            className={`shrink-0 px-2.5 h-7 rounded-full text-[11px] font-medium border transition-all whitespace-nowrap flex items-center gap-1 ${browseCountry === c ? 'bg-[#04439e] text-white border-transparent' : 'bg-white text-[#04439e] border border-[#04439e]/25 hover:bg-[#04439e]/5'}`}>
                            <span aria-hidden>{getFlagEmoji(c) || '🌍'}</span> {c}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2 mt-2">
                      {filtered.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => { onSelectVendor(v.id); onOpenChange(false); }}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-orange-200 bg-orange-50/50 dark:border-[#ff4000]/50 dark:bg-[#ff4000]/20 hover:border-[#ff4000] hover:shadow-md transition-all text-left group"
                        >
                          {v.logo_url ? (
                            <img src={v.logo_url} alt={v.business_name} className="w-10 h-10 rounded-full object-cover border-2 border-orange-300" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-[#ff4000]/40 flex items-center justify-center">
                              <ShieldCheck className="w-5 h-5 text-[#ff4000]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground line-clamp-1">{v.business_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {v.city && <span className="text-[11px] text-muted-foreground">{v.city}</span>}
                              {(v.rating ?? 0) > 0 && (
                                <span className="text-[11px] text-[#ff4000] flex items-center gap-0.5">
                                  <Star className="w-3 h-3 fill-[#ff4000] text-[#ff4000]" /> {(v.rating ?? 0).toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge className="bg-[#ff4000] text-white text-[10px] shrink-0">
                            <ShieldCheck className="w-3 h-3 mr-0.5" /> Certifié
                          </Badge>
                        </button>
                      ))}
                      {filtered.length === 0 && !loading && (
                        <p className="text-sm text-muted-foreground text-center py-8">{t('marketplace.noCertifiedInCountry')}</p>
                      )}
                    </div>
                  </>
                );
              })() : (
                <p className="text-sm text-muted-foreground text-center py-8">{t('marketplace.noCertifiedYet')}</p>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
