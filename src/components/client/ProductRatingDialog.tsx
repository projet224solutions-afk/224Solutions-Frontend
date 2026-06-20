import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Loader2, Package, ChevronRight, Check, Store } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OrderProduct {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  rated: boolean;
}

type Step = 'products' | 'vendor' | 'done';

interface ProductRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  vendorId: string;
  vendorName: string;
  onRatingSubmitted?: () => void;
}

export default function ProductRatingDialog({
  open,
  onOpenChange,
  orderId,
  vendorId,
  vendorName,
  onRatingSubmitted
}: ProductRatingDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Produits
  const [products, setProducts] = useState<OrderProduct[]>([]);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Navigation entre étapes
  const [step, setStep] = useState<Step>('products');

  // Boutique
  const [vendorRating, setVendorRating] = useState(0);
  const [hoveredVendorRating, setHoveredVendorRating] = useState(0);
  const [vendorComment, setVendorComment] = useState('');
  const [submittingVendor, setSubmittingVendor] = useState(false);
  const [vendorAlreadyRated, setVendorAlreadyRated] = useState(false);

  useEffect(() => {
    if (open && orderId) {
      setStep('products');
      setVendorRating(0);
      setVendorComment('');
      loadOrderProducts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  const loadOrderProducts = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: orderItems, error: itemsError }, { data: existingReviews }, { data: existingVendorRating }] =
        await Promise.all([
          supabase
            .from('order_items')
            .select('id, product_id, quantity, products:product_id(name, images)')
            .eq('order_id', orderId),
          supabase
            .from('product_reviews')
            .select('product_id')
            .eq('order_id', orderId)
            .eq('user_id', user.id),
          supabase
            .from('vendor_ratings')
            .select('id')
            .eq('order_id', orderId)
            .eq('customer_id', user.id)
            .maybeSingle(),
        ]);

      if (itemsError) throw itemsError;

      setVendorAlreadyRated(!!existingVendorRating);

      const ratedProductIds = new Set((existingReviews || []).map(r => r.product_id));

      // Dédupliquer par product_id
      const seenProductIds = new Set<string>();
      const productsList: OrderProduct[] = (orderItems || [])
        .filter(item => {
          if (seenProductIds.has(item.product_id)) return false;
          seenProductIds.add(item.product_id);
          return true;
        })
        .map(item => {
          const product = item.products as any;
          const images = product?.images;
          const firstImage = Array.isArray(images) && images.length > 0 ? images[0] : null;
          return {
            id: item.id,
            product_id: item.product_id,
            product_name: product?.name || 'Produit',
            product_image: firstImage,
            quantity: item.quantity,
            rated: ratedProductIds.has(item.product_id),
          };
        });

      setProducts(productsList);

      if (productsList.length === 0) {
        // Pas de produits — aller directement à la notation boutique si pas encore notée
        if (existingVendorRating) {
          setStep('done');
        } else {
          setStep('vendor');
        }
        return;
      }

      const firstUnrated = productsList.findIndex(p => !p.rated);
      if (firstUnrated >= 0) {
        setCurrentProductIndex(firstUnrated);
      } else {
        // Tous déjà notés — aller à la boutique
        if (existingVendorRating) {
          setStep('done');
        } else {
          setStep('vendor');
        }
      }
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      toast.error(t('productRatingDialog.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      toast.error(t('productRatingDialog.veuillezSelectionnerUneNote'));
      return;
    }

    const currentProduct = products[currentProductIndex];
    if (!currentProduct) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // upsert : contrainte UNIQUE (user_id, product_id) → si déjà noté, on met à jour l'avis
      // au lieu d'échouer en duplicate key.
      const { error } = await supabase
        .from('product_reviews')
        .upsert({
          product_id: currentProduct.product_id,
          order_id: orderId,
          user_id: user.id,
          rating,
          title: `Avis sur ${currentProduct.product_name}`.substring(0, 100),
          content: comment.trim() || 'Aucun commentaire',
          verified_purchase: true,
          is_approved: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,product_id' });

      if (error) throw error;

      // Mettre à jour la note moyenne du produit
      const { data: productReviewStats } = await supabase
        .from('product_reviews')
        .select('rating')
        .eq('product_id', currentProduct.product_id)
        .eq('is_approved', true);

      const reviewCount = productReviewStats?.length || 0;
      const averageRating = reviewCount > 0
        ? productReviewStats!.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviewCount
        : rating;

      await supabase
        .from('products')
        .update({
          rating: Math.round(averageRating * 10) / 10,
          reviews_count: reviewCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentProduct.product_id);

      toast.success(`Avis soumis pour ${currentProduct.product_name}`, { description: `${rating}/5 étoiles` });

      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] });

      const updatedProducts = [...products];
      updatedProducts[currentProductIndex].rated = true;
      setProducts(updatedProducts);
      setRating(0);
      setComment('');

      // Produit suivant non noté
      const nextUnrated = updatedProducts.findIndex((p, i) => !p.rated && i > currentProductIndex);
      if (nextUnrated >= 0) {
        setCurrentProductIndex(nextUnrated);
      } else {
        const prevUnrated = updatedProducts.findIndex(p => !p.rated);
        if (prevUnrated >= 0) {
          setCurrentProductIndex(prevUnrated);
        } else {
          // Tous notés → étape boutique
          if (vendorAlreadyRated) {
            setStep('done');
            onRatingSubmitted?.();
          } else {
            setStep('vendor');
          }
        }
      }
    } catch (error) {
      console.error('Erreur soumission avis:', error);
      toast.error(t('productRatingDialog.erreurLorsDeLEnvoi'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitVendorRating = async () => {
    if (vendorRating === 0) {
      toast.error(t('productRatingDialog.veuillezSelectionnerUneNotePour'));
      return;
    }

    setSubmittingVendor(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { error } = await supabase
        .from('vendor_ratings')
        .insert({
          vendor_id: vendorId,
          customer_id: user.id,
          order_id: orderId,
          rating: vendorRating,
          comment: vendorComment.trim() || null,
        });

      if (error) throw error;

      toast.success(`Merci pour votre avis sur ${vendorName} !`, { description: `${vendorRating}/5 étoiles` });
      setStep('done');
      onRatingSubmitted?.();
    } catch (error: any) {
      if (error?.code === '23505') {
        // Doublon — déjà noté
        setStep('done');
        onRatingSubmitted?.();
      } else {
        console.error('Erreur notation boutique:', error);
        toast.error(t('productRatingDialog.erreurLorsDeLaNotation'));
      }
    } finally {
      setSubmittingVendor(false);
    }
  };

  const handleSkipVendorRating = () => {
    setStep('done');
    onRatingSubmitted?.();
  };

  const handleClose = () => {
    onOpenChange(false);
    setRating(0);
    setComment('');
    setCurrentProductIndex(0);
    setVendorRating(0);
    setVendorComment('');
    if (products.some(p => p.rated) || step === 'done') {
      onRatingSubmitted?.();
    }
  };

  const currentProduct = products[currentProductIndex];
  const ratedCount = products.filter(p => p.rated).length;
  const totalCount = products.length;

  // ─── Chargement ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Étape finale : Merci ───────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[#ff4000]" />
              Merci pour vos avis !
            </DialogTitle>
            <DialogDescription>
              Vos avis aident les autres clients à faire leurs choix.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleClose}>{t('productRatingDialog.fermer')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Étape : Notation boutique ──────────────────────────────────────────────
  if (step === 'vendor') {
    const vendorLabels = ['', 'Très insatisfait', 'Insatisfait', 'Correct', 'Satisfait', 'Excellent !'];
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              Notez la boutique
            </DialogTitle>
            <DialogDescription>
              Comment s'est passée votre expérience chez <strong>{vendorName}</strong> ?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-5">
            {/* Étoiles */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setVendorRating(star)}
                    onMouseEnter={() => setHoveredVendorRating(star)}
                    onMouseLeave={() => setHoveredVendorRating(0)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={`w-10 h-10 ${
                        star <= (hoveredVendorRating || vendorRating)
                          ? 'fill-[#ff4000] text-[#ff4000]'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {(hoveredVendorRating || vendorRating) > 0 && (
                <p className="text-sm font-medium text-muted-foreground">
                  {vendorLabels[hoveredVendorRating || vendorRating]}
                </p>
              )}
            </div>

            {/* Commentaire */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Votre avis sur la boutique (optionnel)
              </label>
              <Textarea
                placeholder={t('productRatingDialog.delaiDeLivraisonQualiteDu')}
                value={vendorComment}
                onChange={(e) => setVendorComment(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {vendorComment.length}/500
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={handleSkipVendorRating} disabled={submittingVendor}>
              Passer
            </Button>
            <Button
              onClick={handleSubmitVendorRating}
              disabled={submittingVendor || vendorRating === 0}
              className="gap-2"
            >
              {submittingVendor ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Envoi...
                </>
              ) : (
                'Soumettre'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Étape : Notation produits ──────────────────────────────────────────────
  if (products.length === 0) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('productRatingDialog.aucunProduitANoter')}</DialogTitle>
            <DialogDescription>
              Impossible de charger les produits de cette commande.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleClose}>{t('productRatingDialog.fermer')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{t('productRatingDialog.notezVosProduits')}</DialogTitle>
          <DialogDescription>
            Commande chez <strong>{vendorName}</strong> • {ratedCount}/{totalCount} produit(s) noté(s)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Miniatures produits */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {products.map((product, index) => (
              <button
                key={product.id}
                onClick={() => !product.rated && setCurrentProductIndex(index)}
                disabled={product.rated}
                className={`flex-shrink-0 p-2 rounded-lg border transition-all ${
                  index === currentProductIndex
                    ? 'border-primary bg-primary/5'
                    : product.rated
                    ? 'border-[#ff4000] bg-orange-50 dark:bg-[#ff4000] opacity-60'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="relative w-12 h-12">
                  {product.product_image ? (
                    <img
                      src={product.product_image}
                      alt={product.product_name}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted rounded flex items-center justify-center">
                      <Package className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  {product.rated && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#ff4000] rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Produit actuel */}
          {currentProduct && (
            <Card className="border-primary/20">
              <CardContent className="p-3">
                <div className="flex gap-3">
                  <div className="w-14 h-14 flex-shrink-0">
                    {currentProduct.product_image ? (
                      <img
                        src={currentProduct.product_image}
                        alt={currentProduct.product_name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm line-clamp-2">{currentProduct.product_name}</h4>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      Qté: {currentProduct.quantity}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Étoiles */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">{t('productRatingDialog.commentEvaluezVousCeProduit')}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= (hoveredRating || rating)
                        ? 'fill-[#ff4000] text-[#ff4000]'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-muted-foreground">
                {rating === 1 && 'Très insatisfait'}
                {rating === 2 && 'Insatisfait'}
                {rating === 3 && 'Correct'}
                {rating === 4 && 'Satisfait'}
                {rating === 5 && 'Excellent !'}
              </p>
            )}
          </div>

          {/* Commentaire */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('productRatingDialog.votreAvisOptionnel')}</label>
            <Textarea
              placeholder={t('productRatingDialog.partagezVotreExperience')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{comment.length}/500</p>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0 pt-4 border-t">
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            {ratedCount > 0 ? 'Terminer' : 'Plus tard'}
          </Button>
          <Button
            onClick={handleSubmitRating}
            disabled={submitting || rating === 0}
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                Soumettre
                {ratedCount < totalCount - 1 && <ChevronRight className="w-4 h-4" />}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
