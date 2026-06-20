/**
 * Modal de détail pour chaque statistique client
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, TrendingUp, Heart, CreditCard, CheckCircle, XCircle, Clock, Truck, Plus, Search, Trash2, Store, Loader2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ClientStatDetailModalProps {
  open: boolean;
  onClose: () => void;
  statType: 'orders' | 'active' | 'favorites' | 'spent' | null;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fr-FR').format(price) + ' GNF';

export function ClientStatDetailModal({ open, onClose, statType }: ClientStatDetailModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [showAddFav, setShowAddFav] = useState(false);
  const [favSearch, setFavSearch] = useState('');
  const [_favResults, setFavResults] = useState<any[]>([]);
  const [_searchLoading, setSearchLoading] = useState(false);
  const [_addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !statType || !user?.id) return;
    loadData();
    setShowAddFav(false);
    setFavSearch('');
    setFavResults([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, statType, user?.id]);

  // Recherche de produits pour ajouter aux favoris
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) { setFavResults([]); return; }
    setSearchLoading(true);
    try {
      const existingIds = data.map((f: any) => f.product_id);
      const { data: products } = await supabase
        .from('products')
        .select('id, name, price, images')
        .eq('is_active', true)
        .ilike('name', `%${query}%`)
        .limit(10);
      setFavResults((products || []).filter(p => !existingIds.includes(p.id)));
    } catch { setFavResults([]); }
    finally { setSearchLoading(false); }
  }, [data]);

  useEffect(() => {
    const t = setTimeout(() => { if (favSearch) searchProducts(favSearch); else setFavResults([]); }, 300);
    return () => clearTimeout(t);
  }, [favSearch, searchProducts]);

  const _addToFavorites = async (productId: string) => {
    if (!user?.id) return;
    setAddingId(productId);
    try {
      const { error } = await supabase.from('wishlists').insert({
        user_id: user.id,
        product_id: productId,
      });
      if (error) throw error;
      toast.success(t('clientStatDetailModal.ajouteAuxFavoris'));
      loadData();
      setFavResults(prev => prev.filter(p => p.id !== productId));
    } catch (err: any) {
      if (err?.code === '23505') toast.info(t('clientStatDetailModal.dejaDansVosFavoris'));
      else toast.error(t('clientStatDetailModal.erreurLorsDeLAjout'));
    } finally { setAddingId(null); }
  };

  const removeFromFavorites = async (wishlistId: string) => {
    try {
      await supabase.from('wishlists').delete().eq('id', wishlistId);
      toast.success(t('clientStatDetailModal.retireDesFavoris'));
      setData(prev => prev.filter(f => f.id !== wishlistId));
    } catch { toast.error(t('clientStatDetailModal.erreurLorsDeLaSuppression')); }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Résoudre customer_id
      const { data: cust } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      const customerId = cust?.id;

      if (statType === 'orders') {
        if (!customerId) { setData([]); setSummary({ total: 0, completed: 0, cancelled: 0, pending: 0 }); return; }
        const { data: orders } = await supabase
          .from('orders')
          .select('id, status, total_amount, created_at, order_number')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false })
          .limit(50);
        setData(orders || []);
        const list = orders || [];
        setSummary({
          total: list.length,
          completed: list.filter(o => ['delivered', 'completed'].includes(o.status)).length,
          cancelled: list.filter(o => o.status === 'cancelled').length,
          pending: list.filter(o => ['pending', 'processing', 'confirmed'].includes(o.status)).length,
        });
      }

      if (statType === 'active') {
        if (!customerId) { setData([]); return; }
        const { data: orders } = await supabase
          .from('orders')
          .select('id, status, total_amount, created_at, order_number')
          .eq('customer_id', customerId)
          .in('status', ['pending', 'processing', 'confirmed', 'in_transit', 'preparing', 'ready'])
          .order('created_at', { ascending: false });
        setData(orders || []);
      }

      if (statType === 'favorites') {
        // Fetch product favorites
        const { data: productFavs } = await supabase
          .from('wishlists')
          .select('id, product_id, vendor_id, created_at, products:product_id(name, price, images)')
          .eq('user_id', user!.id)
          .not('product_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50);

        // Fetch vendor favorites
        const { data: vendorFavs } = await supabase
          .from('wishlists')
          .select('id, product_id, vendor_id, created_at')
          .eq('user_id', user!.id)
          .not('vendor_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50);

        // Enrich vendor favorites with vendor info
        let enrichedVendorFavs: any[] = [];
        if (vendorFavs && vendorFavs.length > 0) {
          const vendorIds = vendorFavs.map((f: any) => f.vendor_id);
          const { data: vendors } = await supabase
            .from('vendors')
            .select('id, business_name, logo_url')
            .in('id', vendorIds);
          const vendorMap = new Map((vendors || []).map((v: any) => [v.id, v]));
          enrichedVendorFavs = vendorFavs.map((f: any) => ({
            ...f,
            _type: 'vendor',
            vendor: vendorMap.get(f.vendor_id) || null,
          }));
        }

        const productList = (productFavs || []).map((f: any) => ({ ...f, _type: 'product' }));
        const combined = [...productList, ...enrichedVendorFavs].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setData(combined);
      }

      if (statType === 'spent') {
        if (!customerId) { setData([]); setSummary({ total: 0, avg: 0, count: 0, max: 0 }); return; }
        const { data: orders } = await supabase
          .from('orders')
          .select('id, status, total_amount, created_at, order_number')
          .eq('customer_id', customerId)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false });
        const list = orders || [];
        const total = list.reduce((s, o) => s + (o.total_amount || 0), 0);
        const max = list.length > 0 ? Math.max(...list.map(o => o.total_amount || 0)) : 0;
        setData(list);
        setSummary({
          total,
          avg: list.length > 0 ? total / list.length : 0,
          count: list.length,
          max,
        });
      }
    } catch (err) {
      console.error('Erreur chargement détail stat:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'En attente', variant: 'outline' },
      processing: { label: 'Traitement', variant: 'secondary' },
      confirmed: { label: 'Confirmée', variant: 'secondary' },
      preparing: { label: 'Préparation', variant: 'secondary' },
      ready: { label: 'Prête', variant: 'secondary' },
      in_transit: { label: 'En transit', variant: 'default' },
      delivered: { label: 'Livrée', variant: 'default' },
      completed: { label: 'Terminée', variant: 'default' },
      cancelled: { label: 'Annulée', variant: 'destructive' },
    };
    const info = map[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={info.variant} className="text-[10px]">{info.label}</Badge>;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  const titles: Record<string, { title: string; icon: any; color: string }> = {
    orders: { title: 'Toutes vos commandes', icon: Package, color: 'text-client-primary' },
    active: { title: 'Commandes en cours', icon: TrendingUp, color: 'text-orange-600' },
    favorites: { title: 'Vos favoris', icon: Heart, color: 'text-[#04439e]' },
    spent: { title: 'Détail des dépenses', icon: CreditCard, color: 'text-[#ff4000]' },
  };

  const config = statType ? titles[statType] : null;
  const Icon = config?.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {Icon && <Icon className={`w-5 h-5 ${config?.color}`} />}
            {config?.title}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <ScrollArea className="flex-1 max-h-[60vh]">
            {/* ORDERS - Résumé + liste */}
            {statType === 'orders' && (
              <div className="space-y-4">
                {summary && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="text-center p-2 bg-muted rounded-lg">
                      <p className="text-lg font-bold">{summary.total}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center p-2 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg">
                      <p className="text-lg font-bold text-[#ff4000]">{summary.completed}</p>
                      <p className="text-[10px] text-muted-foreground">{t('clientStatDetailModal.livrees')}</p>
                    </div>
                    <div className="text-center p-2 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                      <p className="text-lg font-bold text-orange-600">{summary.pending}</p>
                      <p className="text-[10px] text-muted-foreground">En cours</p>
                    </div>
                    <div className="text-center p-2 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg">
                      <p className="text-lg font-bold text-[#ff4000]">{summary.cancelled}</p>
                      <p className="text-[10px] text-muted-foreground">{t('clientStatDetailModal.annulees')}</p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {data.length === 0 && <p className="text-center text-muted-foreground py-8">{t('clientStatDetailModal.aucuneCommande')}</p>}
                  {data.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">#{order.order_number || order.id.slice(0, 8)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(order.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{formatPrice(order.total_amount || 0)}</span>
                        {statusBadge(order.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ACTIVE - Liste des commandes en cours */}
            {statType === 'active' && (
              <div className="space-y-2">
                {data.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 mx-auto text-[#ff4000] mb-2" />
                    <p className="text-muted-foreground">{t('clientStatDetailModal.aucuneCommandeEnCours')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('clientStatDetailModal.toutesVosCommandesSontTerminees')}</p>
                  </div>
                )}
                {data.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-orange-50/50 dark:bg-orange-950/10 rounded-lg border border-orange-200/50 dark:border-orange-800/30">
                    <div className="flex items-center gap-3">
                      {order.status === 'shipped' ? (
                        <Truck className="w-5 h-5 text-orange-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-orange-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">#{order.order_number || order.id.slice(0, 8)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(order.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatPrice(order.total_amount || 0)}</p>
                      {statusBadge(order.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* FAVORITES - Liste des favoris avec ajout */}
            {statType === 'favorites' && (
              <div className="space-y-3">
                {/* Liste des favoris existants */}
                {data.length === 0 && !showAddFav && (
                  <div className="text-center py-8">
                    <Heart className="w-12 h-12 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-muted-foreground">{t('clientStatDetailModal.aucunFavori')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('clientStatDetailModal.utilisezLeBoutonCiDessus')}</p>
                  </div>
                )}

                {data.length > 0 && (
                  <p className="text-xs font-medium text-muted-foreground">{data.length} favori{data.length > 1 ? 's' : ''}</p>
                )}

                {data.map((fav: any) => {
                  const isVendor = fav._type === 'vendor';

                  if (isVendor) {
                    return (
                      <div key={fav.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border group hover:border-primary/40 hover:bg-muted/50 transition-all">
                        <button
                          onClick={() => {
                            onClose();
                            navigate(`/shop/${fav.vendor_id}`);
                          }}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          {fav.vendor?.logo_url ? (
                            <img src={fav.vendor.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                              <Store className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium truncate hover:text-primary transition-colors">{fav.vendor?.business_name || 'Boutique'}</p>
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{t('clientStatDetailModal.boutique')}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Ajouté le {formatDate(fav.created_at)}</p>
                          </div>
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={() => removeFromFavorites(fav.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  }

                  const imgUrl = fav.products?.images
                    ? (Array.isArray(fav.products.images) ? fav.products.images[0] : fav.products.images)
                    : null;
                  return (
                    <div key={fav.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border group hover:border-primary/40 hover:bg-muted/50 transition-all">
                      <button
                        onClick={() => {
                          onClose();
                          navigate(`/product/${fav.product_id}`);
                        }}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        {imgUrl ? (
                          <img src={imgUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                            <Heart className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate hover:text-primary transition-colors">{fav.products?.name || 'Produit'}</p>
                          <p className="text-[10px] text-muted-foreground">Ajouté le {formatDate(fav.created_at)}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold">{formatPrice(fav.products?.price || 0)}</p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={() => removeFromFavorites(fav.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* SPENT - Détail des dépenses */}
            {statType === 'spent' && (
              <div className="space-y-4">
                {summary && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-3 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">{t('clientStatDetailModal.totalDepense')}</p>
                      <p className="text-lg font-bold text-[#ff4000]">{formatPrice(summary.total)}</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Panier moyen</p>
                      <p className="text-lg font-bold">{formatPrice(Math.round(summary.avg))}</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">{t('clientStatDetailModal.nbCommandes')}</p>
                      <p className="text-lg font-bold">{summary.count}</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">{t('clientStatDetailModal.plusGrosseCommande')}</p>
                      <p className="text-lg font-bold">{formatPrice(summary.max)}</p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Historique</p>
                  {data.length === 0 && <p className="text-center text-muted-foreground py-4">{t('clientStatDetailModal.aucuneDepense')}</p>}
                  {data.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                      <div>
                        <p className="text-xs font-medium">#{order.order_number || order.id.slice(0, 8)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(order.created_at)}</p>
                      </div>
                      <p className="text-sm font-bold text-[#ff4000]">-{formatPrice(order.total_amount || 0)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
