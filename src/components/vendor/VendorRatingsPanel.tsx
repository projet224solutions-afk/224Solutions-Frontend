/**
 * Panneau d'affichage des notes et avis reçus par le vendeur
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, MessageSquare, User, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import VendorResponseToReview from './VendorResponseToReview';
import AIReviewResponseCard from './AIReviewResponseCard';

interface VendorRating {
  id: string;
  rating: number;
  comment: string | null;
  vendor_response: string | null;
  vendor_response_at: string | null;
  created_at: string;
  order_id: string;
  ai_suggested_response: string | null;
  ai_response_status: string | null;
  ai_sentiment: string | null;
  ai_analyzed_at: string | null;
  orders?: {
    order_number: string;
  };
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

interface RatingStats {
  averageRating: number;
  totalRatings: number;
  distribution: { [key: number]: number };
}

export default function VendorRatingsPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [ratings, setRatings] = useState<VendorRating[]>([]);
  const [stats, setStats] = useState<RatingStats>({
    averageRating: 0,
    totalRatings: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadRatings();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadRatings = async () => {
    if (!user?.id) return;

    try {
      // Récupérer le vendor_id
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!vendorData) return;

      // Récupérer toutes les notes avec les infos du client
      const { data, error } = await supabase
        .from('vendor_ratings')
        .select(`
          *,
          orders(order_number)
        `)
        .eq('vendor_id', vendorData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // ✅ Anti N+1 : 1 SEULE requête batch pour tous les profils clients (au lieu
      // d'une requête par avis). Pas de JOIN PostgREST ici : il n'existe aucune FK
      // vendor_ratings.customer_id → profiles, donc l'embed échouerait.
      const customerIds = Array.from(
        new Set((data || []).map((r: any) => r.customer_id).filter(Boolean))
      );
      let profilesById: Record<string, { first_name: string; last_name: string }> = {};
      if (customerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', customerIds);
        profilesById = Object.fromEntries(
          (profilesData || []).map((p: any) => [
            p.id, { first_name: p.first_name || '', last_name: p.last_name || '' },
          ])
        );
      }

      const ratingsWithProfiles = (data || []).map((rating: any) => ({
        ...rating,
        vendor_response: rating.vendor_response || null,
        vendor_response_at: rating.vendor_response_at || null,
        ai_suggested_response: rating.ai_suggested_response || null,
        ai_response_status: rating.ai_response_status || 'none',
        ai_sentiment: rating.ai_sentiment || null,
        ai_analyzed_at: rating.ai_analyzed_at || null,
        profiles: profilesById[rating.customer_id] || { first_name: '', last_name: '' },
      }));

      setRatings(ratingsWithProfiles);

      // Calculer les statistiques
      if (ratingsWithProfiles && ratingsWithProfiles.length > 0) {
        const total = ratingsWithProfiles.length;
        const sum = ratingsWithProfiles.reduce((acc, r) => acc + r.rating, 0);
        const avg = sum / total;

        const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        ratingsWithProfiles.forEach(r => {
          dist[r.rating as keyof typeof dist]++;
        });

        setStats({
          averageRating: avg,
          totalRatings: total,
          distribution: dist
        });
      }
    } catch (error) {
      console.error('Error loading ratings:', error);
      toast.error(t('vendorRatingsPanel.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, size: 'sm' | 'lg' = 'sm') => {
    const sizeClass = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating
                ? 'fill-[#ff4000] text-[#ff4000]'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">{t('vendorRatingsPanel.chargementDesNotes')}</p>
        </CardContent>
      </Card>
    );
  }

  if (ratings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Notes et Avis
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Star className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('vendorRatingsPanel.aucuneNoteRecuePourLe')}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Les notes apparaîtront ici lorsque vos clients vous évalueront
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistiques globales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Notes et Avis ({stats.totalRatings})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Note moyenne */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-4xl font-bold">
                  {stats.averageRating.toFixed(1)}
                </div>
                {renderStars(Math.round(stats.averageRating), 'lg')}
                <p className="text-sm text-muted-foreground mt-1">
                  {stats.totalRatings} avis
                </p>
              </div>
            </div>

            {/* Distribution */}
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => (
                <div key={stars} className="flex items-center gap-2">
                  <span className="text-sm w-8">{stars} ★</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#ff4000]"
                      style={{
                        width: `${(stats.distribution[stars] / stats.totalRatings) * 100}%`
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
        </CardContent>
      </Card>

      {/* Liste des avis */}
      <div className="space-y-3">
        {ratings.map((rating) => (
          <Card key={rating.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {rating.profiles?.first_name || 'Client'}{' '}
                      {rating.profiles?.last_name || ''}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {new Date(rating.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
                {renderStars(rating.rating)}
              </div>

              {rating.comment && (
                <div className="flex gap-2 p-3 bg-muted/50 rounded-lg mb-3">
                  <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{rating.comment}</p>
                </div>
              )}

              {/* Réponse IA proposée (si disponible et en attente de validation) */}
              {rating.ai_suggested_response && rating.ai_response_status === 'pending' && !rating.vendor_response && (
                <AIReviewResponseCard
                  ratingId={rating.id}
                  aiSuggestedResponse={rating.ai_suggested_response}
                  aiResponseStatus={rating.ai_response_status}
                  aiSentiment={rating.ai_sentiment || undefined}
                  aiAnalyzedAt={rating.ai_analyzed_at || undefined}
                  onStatusChange={loadRatings}
                />
              )}

              {/* Composant de réponse manuelle du vendeur (si pas de réponse IA en attente) */}
              {(!rating.ai_suggested_response || rating.ai_response_status !== 'pending') && (
                <VendorResponseToReview
                  ratingId={rating.id}
                  existingResponse={rating.vendor_response || undefined}
                  onResponseSubmitted={loadRatings}
                />
              )}

              {rating.orders && (
                <div className="mt-3 pt-3 border-t">
                  <Badge variant="outline" className="text-xs">
                    Commande #{rating.orders.order_number}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
