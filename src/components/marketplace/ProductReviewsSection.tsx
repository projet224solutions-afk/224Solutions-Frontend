/**
 * Section d'affichage des avis clients sur un produit spécifique
 * Récupère les avis depuis vendor_ratings (avis vendeur liés aux commandes)
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Star, User, Calendar, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';

interface Review {
  id: string;
  rating: number;
  title: string;
  content: string;
  created_at: string;
  customer_name: string;
  verified_purchase: boolean;
}

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  distribution: { [key: number]: number };
}

interface ProductReviewsSectionProps {
  productId: string;
  productName?: string;
}

export default function ProductReviewsSection({ productId, productName }: ProductReviewsSectionProps) {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>({
    averageRating: 0,
    totalReviews: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productId) {
      loadReviews();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const loadReviews = async () => {
    try {
      setLoading(true);

      // Récupérer les avis depuis product_reviews pour ce produit spécifique
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('product_reviews')
        .select(`
          id,
          rating,
          title,
          content,
          created_at,
          user_id,
          verified_purchase
        `)
        .eq('product_id', productId)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (reviewsError) throw reviewsError;

      if (!reviewsData || reviewsData.length === 0) {
        setReviews([]);
        setStats({
          averageRating: 0,
          totalReviews: 0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        });
        setLoading(false);
        return;
      }

      // Récupérer les profils des clients
      const userIds = [...new Set(reviewsData.map(r => r.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name')
        .in('id', userIds);

      const profilesMap = new Map(
        (profilesData || []).map(p => [
          p.id,
          p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Client'
        ])
      );

      const reviewsList: Review[] = reviewsData.map(review => ({
        id: review.id,
        rating: review.rating,
        title: review.title || '',
        content: review.content || '',
        created_at: review.created_at,
        customer_name: profilesMap.get(review.user_id) || 'Client',
        verified_purchase: review.verified_purchase || false
      }));

      setReviews(reviewsList);

      // Calculer les statistiques
      const total = reviewsList.length;
      const sum = reviewsList.reduce((acc, r) => acc + r.rating, 0);
      const avg = total > 0 ? sum / total : 0;

      const dist: { [key: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      reviewsList.forEach(r => {
        if (r.rating >= 1 && r.rating <= 5) {
          dist[r.rating]++;
        }
      });

      setStats({
        averageRating: avg,
        totalReviews: total,
        distribution: dist
      });
    } catch (error) {
      console.error('Error loading product reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, size: 'sm' | 'lg' = 'sm') => {
    const sizeClass = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating
                ? 'fill-[#ff4000] text-[#ff4000]'
                : 'text-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground">{t('productReviewsSection.chargementDesAvis')}</p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="py-6 text-center">
        <Star className="w-12 h-12 mx-auto text-muted-foreground mb-2 opacity-50" />
        <p className="text-muted-foreground">{t('productReviewsSection.aucunAvisPourCeProduit')}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Soyez le premier à donner votre avis sur ce produit
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec statistiques */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Avis clients {productName ? `sur ${productName}` : ''}
        </h3>

        <div className="flex items-start gap-6 mb-6">
          {/* Note moyenne */}
          <div className="text-center">
            <div className="text-4xl font-bold mb-1">
              {stats.averageRating.toFixed(1)}
            </div>
            {renderStars(Math.round(stats.averageRating), 'lg')}
            <p className="text-sm text-muted-foreground mt-1">
              {stats.totalReviews} avis
            </p>
          </div>

          {/* Distribution */}
          <div className="flex-1 space-y-2">
            {[5, 4, 3, 2, 1].map((stars) => (
              <div key={stars} className="flex items-center gap-2">
                <span className="text-sm w-8">{stars} ★</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#ff4000]"
                    style={{
                      width: stats.totalReviews > 0
                        ? `${(stats.distribution[stars] / stats.totalReviews) * 100}%`
                        : '0%'
                    }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-8">
                  {stats.distribution[stars]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      {/* Liste des avis */}
      <div className="space-y-4">
        <h4 className="font-medium">Tous les avis ({reviews.length})</h4>

        {reviews.map((review) => (
          <Card key={review.id} className="border-border/50">
            <CardContent className="p-4">
              {/* En-tête de l'avis */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {review.customer_name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {new Date(review.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                      {review.verified_purchase && (
                        <Badge variant="secondary" className="text-xs bg-orange-100 text-[#ff4000] dark:bg-[#ff4000] dark:text-orange-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Achat vérifié
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {renderStars(review.rating)}
              </div>

              {/* Titre de l'avis */}
              {review.title && (
                <h5 className="font-medium text-sm mb-2">{review.title}</h5>
              )}

              {/* Commentaire du client */}
              {review.content && (
                <p className="text-sm text-foreground">{review.content}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
