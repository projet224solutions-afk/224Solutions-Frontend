/**
 * ⭐ AVIS DE LA BOUTIQUE - 224SOLUTIONS
 * Fenêtre "Avis" de la boutique, en 2 onglets bien SÉPARÉS :
 *   • Avis boutique  → vendor_ratings (avis sur le vendeur)
 *   • Avis produits  → product_reviews (avis sur les produits), groupés par produit
 * Chaque avis : photo de profil + nom + drapeau du pays + commentaire,
 * et la réponse du vendeur juste sous CE commentaire (par avis).
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, User, Store, Package } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CountryFlag } from '@/components/CountryFlag';
import { useTranslation } from '@/hooks/useTranslation';

interface ShopReview {
  id: string;
  rating: number;
  title?: string | null;
  content: string | null;
  created_at: string;
  verified_purchase?: boolean | null;
  vendor_response: string | null;
  vendor_response_at: string | null;
  product_name?: string | null;
  author_name?: string | null;
  author_country?: string | null;
  author_avatar?: string | null;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn('w-3.5 h-3.5', s <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function ReviewCard({ r }: { r: ShopReview }) {
  const { t } = useTranslation();
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Auteur : photo + nom + drapeau */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-9 w-9">
              {r.author_avatar && <AvatarImage src={r.author_avatar} alt={r.author_name || t('shopReviews.client')} />}
              <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate flex items-center gap-1.5">
                <CountryFlag country={r.author_country} size={14} />
                {r.author_name || t('shopReviews.client')}
              </p>
              <Stars rating={r.rating} />
            </div>
          </div>
          {r.verified_purchase && (
            <Badge variant="secondary" className="text-[10px] shrink-0">{t('shopReviews.verifiedPurchase')}</Badge>
          )}
        </div>

        {r.title && <p className="font-medium text-sm mb-1">{r.title}</p>}

        {/* Échange façon messagerie */}
        <div className="space-y-2 mt-1">
          {/* Message du client (bulle gauche) */}
          {r.content && (
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-muted rounded-2xl rounded-tl-sm px-3 py-2">
                <p className="text-sm whitespace-pre-wrap">{r.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1 text-right">
                  {format(new Date(r.created_at), 'dd MMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>
          )}

          {/* Réponse du vendeur (bulle droite, style réponse) */}
          {r.vendor_response && (
            <div className="flex justify-end">
              <div className="max-w-[85%] bg-primary/10 rounded-2xl rounded-tr-sm px-3 py-2 border border-primary/20">
                <p className="text-[10px] font-semibold text-primary mb-0.5 flex items-center gap-1">
                  <Store className="w-3 h-3" /> {t('shopReviews.vendorResponse')}
                </p>
                <p className="text-sm whitespace-pre-wrap">{r.vendor_response}</p>
                {r.vendor_response_at && (
                  <p className="text-[10px] text-muted-foreground mt-1 text-right">
                    {format(new Date(r.vendor_response_at), 'dd MMM yyyy', { locale: fr })}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function avg(list: ShopReview[]): number {
  return list.length > 0 ? list.reduce((s, r) => s + (r.rating || 0), 0) / list.length : 0;
}

export default function ShopReviewsSection({ vendorId }: { vendorId: string }) {
  const { t } = useTranslation();
  const [shopReviews, setShopReviews] = useState<ShopReview[]>([]);
  const [productReviews, setProductReviews] = useState<ShopReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vendorId) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [shopRes, prodRes] = await Promise.all([
          supabase.rpc('get_shop_reviews', { p_vendor_id: vendorId }),
          supabase.rpc('get_shop_product_reviews', { p_vendor_id: vendorId }),
        ]);
        if (active) {
          setShopReviews((shopRes.data || []) as unknown as ShopReview[]);
          setProductReviews((prodRes.data || []) as unknown as ShopReview[]);
        }
      } catch (e) {
        console.warn('[ShopReviews] chargement échoué:', e);
        if (active) { setShopReviews([]); setProductReviews([]); }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [vendorId]);

  // Regrouper les avis produits par produit
  const grouped: Record<string, ShopReview[]> = {};
  for (const r of productReviews) {
    const key = r.product_name || t('shopReviews.productFallback');
    (grouped[key] = grouped[key] || []).push(r);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-9 bg-muted rounded animate-pulse" />
        <div className="h-24 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="shop" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="shop" className="gap-1.5">
          <Store className="w-4 h-4" />
          {t('shopReviews.tabShop')} ({shopReviews.length})
        </TabsTrigger>
        <TabsTrigger value="products" className="gap-1.5">
          <Package className="w-4 h-4" />
          {t('shopReviews.tabProducts')} ({productReviews.length})
        </TabsTrigger>
      </TabsList>

      {/* Onglet AVIS BOUTIQUE */}
      <TabsContent value="shop" className="mt-3 space-y-3">
        {shopReviews.length > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="font-semibold">{avg(shopReviews).toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">· {shopReviews.length} {t('shopReviews.reviewsOnShop')}</span>
          </div>
        )}
        {shopReviews.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t('shopReviews.noShopReviews')}
          </CardContent></Card>
        ) : (
          shopReviews.map((r) => <ReviewCard key={r.id} r={r} />)
        )}
      </TabsContent>

      {/* Onglet AVIS PRODUITS (groupés par produit) */}
      <TabsContent value="products" className="mt-3 space-y-4">
        {productReviews.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            {t('shopReviews.noProductReviews')}
          </CardContent></Card>
        ) : (
          Object.entries(grouped).map(([productName, list]) => (
            <div key={productName} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Package className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold text-sm truncate">{productName}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  ⭐ {avg(list).toFixed(1)} ({list.length})
                </span>
              </div>
              {list.map((r) => <ReviewCard key={r.id} r={r} />)}
            </div>
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}
