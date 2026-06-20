import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSimilarProducts } from "@/hooks/useProductRecommendations";
import { useTranslation } from "@/hooks/useTranslation";
import TranslatedProductCard from "@/components/marketplace/TranslatedProductCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function SimilarProducts() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: products, isLoading } = useSimilarProducts(id, 30);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold truncate">
          {t('marketplace.similarProducts') || 'Produits similaires'}
        </h1>
        {products && products.length > 0 && (
          <span className="text-sm text-muted-foreground ml-auto">
            {products.length} {t('marketplace.products') || 'produits'}
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
        ) : !products || products.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">{t('marketplace.noSimilarProducts') || 'Aucun produit similaire trouvé'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {products.map((p) => (
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
