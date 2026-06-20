/**
 * ServiceReviews — Gestion des avis clients d'un service professionnel
 * Source : service_reviews JOIN profiles
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, MessageSquare, Loader2, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface ServiceReviewsProps {
  serviceId: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  is_verified: boolean;
  created_at: string;
  client: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn(sz, i <= value ? 'fill-[#ff4000] text-[#ff4000]' : 'text-muted-foreground/30')}
        />
      ))}
    </div>
  );
}

function RatingBar({ count, total, label }: { count: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-4 text-right text-muted-foreground">{label}</span>
      <Star className="w-3 h-3 fill-[#ff4000] text-[#ff4000] flex-shrink-0" />
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-[#ff4000] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-muted-foreground">{count}</span>
    </div>
  );
}

export function ServiceReviews({ serviceId }: ServiceReviewsProps) {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_reviews')
        .select(`
          id, rating, comment, is_verified, created_at,
          client:client_id ( full_name, avatar_url )
        `)
        .eq('professional_service_id', serviceId)
        .order('created_at', { ascending: false });

      if (!error) {
        setReviews((data || []) as Review[]);
      }
    } catch (err) {
      console.error('[ServiceReviews]', err);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const total = reviews.length;
  const avg = total > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / total
    : 0;

  const byStars = [5, 4, 3, 2, 1].map(n => ({
    star: n,
    count: reviews.filter(r => r.rating === n).length,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t('serviceReviews.title')}</h2>

      {total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">{t('serviceReviews.noReviews')}</p>
            <p className="text-sm mt-1">{t('serviceReviews.noReviewsDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Résumé des notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6 flex flex-col items-center justify-center gap-2">
                <div className="text-5xl font-black">{avg.toFixed(1)}</div>
                <Stars value={Math.round(avg)} size="lg" />
                <p className="text-sm text-muted-foreground">{total} {t('serviceReviews.reviewWord')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex flex-col justify-center gap-2">
                {byStars.map(({ star, count }) => (
                  <RatingBar key={star} count={count} total={total} label={String(star)} />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Liste des avis */}
          <div className="space-y-3">
            {reviews.map(review => {
              const name = review.client?.full_name || t('serviceReviews.anonymousClient');
              const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
              const date = new Date(review.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric'
              });

              return (
                <Card key={review.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarImage src={review.client?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{name}</span>
                            {review.is_verified && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                                <ThumbsUp className="w-2.5 h-2.5" />
                                {t('serviceReviews.verified')}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{date}</span>
                        </div>

                        <div className="mt-1 mb-2">
                          <Stars value={review.rating} />
                        </div>

                        {review.comment && (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {review.comment}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
