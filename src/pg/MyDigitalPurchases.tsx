/**
 * 📚 MES ACHATS NUMÉRIQUES - Vue unifiée achats + abonnements
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download, Package, ArrowLeft, ShoppingBag,
  Calendar, Loader2, FileText, Clock, CheckCircle,
  AlertTriangle, RefreshCw, Infinity
} from 'lucide-react';
import { LocalPrice } from '@/components/ui/LocalPrice';
import { BottomNavigation } from '@/components/home/BottomNavigation';

interface PurchaseItem {
  id: string;
  product_id: string;
  amount: number;
  created_at: string;
  product_title: string;
  product_image?: string;
  product_currency: string;
  // One-time purchase fields
  download_count?: number;
  max_downloads?: number;
  access_expires_at?: string | null;
  // Subscription fields
  type: 'purchase' | 'subscription';
  billing_cycle?: string;
  status?: string;
  current_period_end?: string;
  auto_renew?: boolean;
  next_billing_date?: string | null;
  subscription_id?: string;
}

export default function MyDigitalPurchases() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (user?.id) loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadAll = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);

      // Load purchases and subscriptions in parallel
      const [purchasesRes, subscriptionsRes] = await Promise.all([
        supabase
          .from('digital_product_purchases')
          .select('*')
          .eq('buyer_id', user.id)
          .eq('payment_status', 'completed')
          .order('created_at', { ascending: false }),
        supabase
          .from('digital_subscriptions')
          .select('*')
          .eq('buyer_id', user.id)
          .order('created_at', { ascending: false })
      ]);

      // Collect all product IDs
      const purchaseProductIds = (purchasesRes.data || []).map(p => p.product_id);
      const subProductIds = (subscriptionsRes.data || []).map(s => s.product_id);
      const allProductIds = [...new Set([...purchaseProductIds, ...subProductIds])];

      // Load product details
      const { data: products } = allProductIds.length > 0
        ? await supabase
            .from('digital_products')
            .select('id, title, images, currency')
            .in('id', allProductIds)
        : { data: [] };

      const productMap = new Map((products || []).map(p => [p.id, p]));

      // Map purchases (exclude those that have active subscriptions)
      const subProductIdSet = new Set(subProductIds);
      const purchaseItems: PurchaseItem[] = (purchasesRes.data || [])
        .filter(p => !subProductIdSet.has(p.product_id)) // avoid duplicates
        .map(p => {
          const prod = productMap.get(p.product_id);
          return {
            id: p.id,
            product_id: p.product_id,
            amount: p.amount,
            created_at: p.created_at,
            product_title: prod?.title || 'Produit inconnu',
            product_image: Array.isArray(prod?.images) ? (prod.images as string[])[0] : undefined,
            product_currency: prod?.currency || 'GNF',
            download_count: p.download_count || 0,
            max_downloads: p.max_downloads,
            access_expires_at: p.access_expires_at,
            type: 'purchase' as const,
          };
        });

      // Map subscriptions
      const subItems: PurchaseItem[] = (subscriptionsRes.data || []).map(s => {
        const prod = productMap.get(s.product_id);
        return {
          id: s.id,
          product_id: s.product_id,
          amount: s.amount_per_period,
          created_at: s.created_at,
          product_title: prod?.title || 'Produit inconnu',
          product_image: Array.isArray(prod?.images) ? (prod.images as string[])[0] : undefined,
          product_currency: s.currency || 'GNF',
          type: 'subscription' as const,
          billing_cycle: s.billing_cycle,
          status: s.status,
          current_period_end: s.current_period_end,
          auto_renew: s.auto_renew,
          next_billing_date: s.next_billing_date,
          subscription_id: s.id,
        };
      });

      // Merge and sort by date
      const merged = [...purchaseItems, ...subItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setItems(merged);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const filteredItems = activeTab === 'all'
    ? items
    : activeTab === 'purchases'
      ? items.filter(i => i.type === 'purchase')
      : items.filter(i => i.type === 'subscription');

  const activeSubscriptions = items.filter(i => i.type === 'subscription' && i.status === 'active').length;
  const totalPurchases = items.filter(i => i.type === 'purchase').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Mes achats numériques</h1>
            <p className="text-xs text-muted-foreground">
              {totalPurchases} achat{totalPurchases > 1 ? 's' : ''} à {activeSubscriptions} abonnement{activeSubscriptions > 1 ? 's' : ''} actif{activeSubscriptions > 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-1 sm:grid-cols-3">
            <TabsTrigger value="all">Tout ({items.length})</TabsTrigger>
            <TabsTrigger value="purchases">Achats ({totalPurchases})</TabsTrigger>
            <TabsTrigger value="subscriptions">Abonnements ({items.filter(i => i.type === 'subscription').length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* List */}
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Aucun achat</h3>
              <p className="text-muted-foreground mb-4">Vous n'avez pas encore acheté de produit numérique.</p>
              <Button onClick={() => navigate('/marketplace')}>
                Découvrir le marketplace
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredItems.map(item => (
              <PurchaseCard
                key={`${item.type}-${item.id}`}
                item={item}
                getDaysRemaining={getDaysRemaining}
                onNavigate={() => navigate(`/digital-purchase/${item.product_id}`)}
                onManageSub={() => navigate('/my-digital-subscriptions')}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}

function PurchaseCard({
  item, getDaysRemaining, onNavigate, onManageSub
}: {
  item: PurchaseItem;
  getDaysRemaining: (d: string) => number;
  onNavigate: () => void;
  onManageSub: () => void;
}) {
  const isSubscription = item.type === 'subscription';
  const isActive = item.status === 'active';
  const daysLeft = item.current_period_end ? getDaysRemaining(item.current_period_end) : 0;
  const totalDays = item.billing_cycle === 'yearly' ? 365 : 30;
  const progressPercent = isSubscription ? Math.min(100, (daysLeft / totalDays) * 100) : 100;

  const cycleLabel: Record<string, string> = { monthly: 'Mensuel', yearly: 'Annuel', lifetime: 'À vie' };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex items-stretch">
          {/* Image */}
          <div className="w-24 shrink-0">
            {item.product_image ? (
              <img
                src={item.product_image}
                alt={item.product_title}
                className="w-full h-full object-cover min-h-[100px]"
              />
            ) : (
              <div className="w-full h-full min-h-[100px] bg-muted flex items-center justify-center">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-3 min-w-0 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm truncate text-foreground">{item.product_title}</h3>
                {isSubscription ? (
                  <Badge
                    variant="outline"
                    className={
                      isActive
                        ? 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20 shrink-0'
                        : item.status === 'cancelled'
                          ? 'bg-muted text-muted-foreground border-border shrink-0'
                          : 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20 shrink-0'
                    }
                  >
                    {isActive ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                    {isActive ? 'Actif' : item.status === 'cancelled' ? 'Annulé' : 'Expiré'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 shrink-0">
                    <Infinity className="w-3 h-3 mr-1" />
                    Permanent
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {new Date(item.created_at).toLocaleDateString('fr-FR')}
                <span className="mx-1">•</span>
                <LocalPrice amount={item.amount} currency={item.product_currency} className="text-xs font-medium" />
                {isSubscription && item.billing_cycle && (
                  <span className="text-muted-foreground">/ {cycleLabel[item.billing_cycle]?.toLowerCase()}</span>
                )}
              </div>
            </div>

            {/* Subscription: Days remaining */}
            {isSubscription && isActive && item.current_period_end && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}
                  </span>
                  <span className="text-muted-foreground">
                    {item.auto_renew ? 'Renouvellement auto' : ''}
                  </span>
                </div>
                <Progress
                  value={progressPercent}
                  className="h-1.5"
                />
              </div>
            )}

            {/* One-time: Download info */}
            {!isSubscription && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Download className="w-3 h-3" />
                {item.download_count || 0} téléchargement{(item.download_count || 0) > 1 ? 's' : ''}
                {item.max_downloads && <span> / {item.max_downloads} max</span>}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-2">
              <Button
                size="sm"
                className="text-xs h-7"
                onClick={(e) => { e.stopPropagation(); onNavigate(); }}
              >
                <Download className="w-3 h-3 mr-1" />
                {isSubscription ? 'Accéder' : 'Télécharger'}
              </Button>
              {isSubscription && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={(e) => { e.stopPropagation(); onManageSub(); }}
                >
                  Gérer
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
