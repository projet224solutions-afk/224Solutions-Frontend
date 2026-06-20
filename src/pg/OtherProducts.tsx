import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAlsoBoughtProducts, usePersonalizedRecommendations } from "@/hooks/useProductRecommendations";
import { useTranslation } from "@/hooks/useTranslation";
import TranslatedProductCard from "@/components/marketplace/TranslatedProductCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function OtherProducts() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: alsoBought, isLoading: loadingAlso } = useAlsoBoughtProducts(id, 20);
  const { data: personalized, isLoading: loadingPersonalized } = usePersonalizedRecommendations(20);

  const isLoading = loadingAlso || loadingPersonalized;

  // Merge and deduplicate
  const allProducts = (() => {
    const seen = new Set<string>();
    const result: Array<{ product_id: string; name: string; price: number; images: string[]; rating: number | null }> = [];
    for (const p of [...(alsoBought || []), ...(personalized || [])]) {
      if (!seen.has(p.product_id) && p.product_id !== id) {
        seen.add(p.product_id);
        result.push(p);
      }
    }
    return result;
  })();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold truncate">
          {t('marketplace.otherProducts') || 'Autres produits'}
        </h1>
        {allProducts.length > 0 && (
          <span className="text-sm text-muted-foreground ml-auto">
            {allProducts.length} {t('marketplace.products') || 'produits'}
          </span>
        )}
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : allProducts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">{t('marketplace.noProducts') || 'Aucun produit trouvé'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {allProducts.map((p) => (
              <TranslatedProductCard
                key={p.product_id}
                id={p.product_id}
                title={p.name}
                price={p.price}
                image={p.images || []}
                rating={p.rating || 0}
                reviewCount={0}
                vendor=""
                onBuy={() => navigate(`/product/${p.product_id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
