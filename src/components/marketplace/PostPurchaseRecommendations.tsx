/**
 * 🎁 RECOMMANDATIONS POST-ACHAT - 224SOLUTIONS
 * Affiche des suggestions après un achat ou ajout au panier
 */

import { useNavigate } from "react-router-dom";
import { Gift, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAIPostPurchase } from "@/hooks/useAIRecommendations";
import TranslatedProductCard from "./TranslatedProductCard";
import { useTranslation } from "@/hooks/useTranslation";

interface PostPurchaseRecommendationsProps {
  productId: string;
  isOpen: boolean;
  onClose: () => void;
  trigger: 'purchase' | 'cart';
}

export function PostPurchaseRecommendations({ productId, isOpen, onClose, trigger }: PostPurchaseRecommendationsProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: products, isLoading } = useAIPostPurchase(isOpen ? productId : undefined, 8);

  const title = trigger === 'purchase'
    ? (t('marketplace.afterPurchase') || 'Complétez votre achat')
    : (t('marketplace.youMightAlsoLike') || 'Vous aimerez aussi');

  const subtitle = trigger === 'purchase'
    ? (t('marketplace.afterPurchaseSubtitle') || 'Les clients qui ont acheté cet article ont aussi aimé')
    : (t('marketplace.cartSuggestions') || 'Ajoutez ces articles à votre panier');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 bg-muted/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 p-2">
            {products.map((p) => (
              <div key={p.product_id} className="relative">
                <TranslatedProductCard
                  id={p.product_id}
                  title={p.name}
                  price={p.price}
                  image={p.images || []}
                  rating={p.rating || 0}
                  reviewCount={0}
                  vendor=""
                  onBuy={() => {
                    onClose();
                    navigate(`/product/${p.product_id}`);
                  }}
                />
                {p.reason && (
                  <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/90 text-primary-foreground font-medium">
                    {p.reason}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            {t('marketplace.noSuggestions') || 'Aucune suggestion pour le moment'}
          </p>
        )}

        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.continue') || 'Continuer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
