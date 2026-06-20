/**
 * Liste des produits par catégorie
 */

import { useState, useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ExternalLink, ShoppingCart, Star, Eye, Search, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useDigitalProducts } from '@/hooks/useDigitalProducts';
import { cn } from '@/lib/utils';
import { DigitalProductForm } from './DigitalProductForm';
import { MerchantActivationDialog } from './MerchantActivationDialog';
import { toast } from 'sonner';
import { LocalPrice } from '@/components/ui/LocalPrice';
import QuickFooter from '@/components/QuickFooter';

interface CategoryProductsListProps {
  category: 'dropshipping' | 'voyage' | 'logiciel' | 'formation' | 'livre' | 'custom' | 'ai' | 'physique_affilie';
  title: string;
  description: string;
  gradient: string;
  onBack: () => void;
}

export function CategoryProductsList({
  category,
  title,
  description,
  gradient,
  onBack
}: CategoryProductsListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { products, loading } = useDigitalProducts({ category });
  const [showProductForm, setShowProductForm] = useState(false);
  const [showActivationDialog, setShowActivationDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isMerchant = profile?.role === 'vendeur';

  // Filtrer les produits par recherche
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase().trim();
    return products.filter(product =>
      product.title?.toLowerCase().includes(query) ||
      product.short_description?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const handleAddProduct = () => {
    console.log('[CategoryProductsList] handleAddProduct called', { user: !!user, isMerchant, role: profile?.role });

    if (!user) {
      toast.info(t('categoryProductsList.connexionRequisePourAjouterUn'));
      navigate('/auth', { state: { redirectTo: '/digital-products' } });
      return;
    }

    // Attendre le chargement du profil
    if (!profile) {
      toast.info(t('categoryProductsList.chargementDeVotreProfilEn'));
      return;
    }

    if (!isMerchant) {
      console.log('[CategoryProductsList] User is not merchant, showing activation dialog');
      setShowActivationDialog(true);
      return;
    }

    console.log('[CategoryProductsList] Showing product form');
    setShowProductForm(true);
  };

  const handleActivationSuccess = () => {
    setShowActivationDialog(false);
    setShowProductForm(true);
  };

  const handleProductCreated = () => {
    setShowProductForm(false);
    toast.success(t('categoryProductsList.produitCreeEtPublie'));
  };

  const openExternalSafely = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleProductClick = (product: any) => {
    if (product.product_mode === 'affiliate' && product.affiliate_url) {
      openExternalSafely(product.affiliate_url);
    } else {
      navigate(`/digital-product/${product.id}`);
    }
  };

  // formatPrice conservé pour fallback
  const fc = useFormatCurrency();
  const _formatPriceSimple = (price: number, currency: string = 'GNF') => fc(price, currency);

  if (showProductForm) {
    return (
      <DigitalProductForm
        category={category}
        onBack={() => setShowProductForm(false)}
        onSuccess={handleProductCreated}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-md border-b border-border sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-foreground">{title}</h1>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            {user && (
              <Button
                size="sm"
                onClick={handleAddProduct}
                className={cn('text-white', gradient)}
              >
                <Plus className="w-4 h-4 mr-1" />
                {isMerchant ? 'Ajouter' : 'Vendre'}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Barre de recherche */}
      <section className="px-4 py-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={`Rechercher dans ${title}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-muted/50 border-border"
          />
        </div>
        {searchQuery && (
          <p className="text-xs text-muted-foreground mt-2">
            {filteredProducts.length} résultat{filteredProducts.length !== 1 ? 's' : ''} pour "{searchQuery}"
          </p>
        )}
      </section>

      {/* Products Grid */}
      <section className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className={cn(
              'w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center',
                'text-white/80',
              gradient
            )}>
              <ShoppingCart className="w-8 h-8" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">
              {searchQuery ? `Aucun résultat pour "${searchQuery}"` : `Aucun ${title.toLowerCase()}`}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? 'Essayez avec d\'autres mots-clés'
                : isMerchant
                  ? `Soyez le premier à ajouter dans ${title}!`
                  : `Devenez marchand pour être le premier à vendre!`
              }
            </p>
            {!searchQuery && (
              <Button onClick={handleAddProduct} className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/40">
                <Plus className="w-4 h-4 mr-2" />
                {user
                  ? (isMerchant ? 'Ajouter un produit' : 'Devenir marchand')
                  : 'Se connecter pour vendre'
                }
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-200"
                onClick={() => handleProductClick(product)}
              >
                <div className="relative aspect-square bg-muted">
                  {product.images && product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : product.video_url ? (
                    <video
                      src={product.video_url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <div className={cn(
                      'w-full h-full flex items-center justify-center',
                      'text-white/50',
                      gradient
                    )}>
                      <ShoppingCart className="w-10 h-10" />
                    </div>
                  )}

                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {product.video_url && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-slate-950/75 text-white hover:bg-slate-950/75">
                        <PlayCircle className="w-3 h-3 mr-1" />
                        Vidéo
                      </Badge>
                    )}
                    {product.product_mode === 'affiliate' && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Affilié
                      </Badge>
                    )}
                    {product.is_featured && (
                      <Badge className="text-[10px] px-1.5 py-0.5 bg-[#ff4000]">
                        <Star className="w-3 h-3 mr-1" />
                        Featured
                      </Badge>
                    )}
                  </div>
                </div>

                <CardContent className="p-3">
                  <h3 className="font-medium text-sm text-foreground line-clamp-2 mb-1">
                    {product.title}
                  </h3>

                  {product.short_description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                      {product.short_description}
                    </p>
                  )}

                    <div className="flex items-center justify-between">
                    <LocalPrice
                      amount={product.price}
                      currency={product.currency || 'GNF'}
                      size="sm"
                      className="font-bold text-primary"
                    />
                    {/* Nombre de vues visible uniquement par le vendeur propriétaire */}
                    {isMerchant && user?.id === product.vendor_id && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Eye className="w-3 h-3" />
                        <span className="text-xs">{product.views_count || 0}</span>
                      </div>
                    )}
                  </div>

                    <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-600 transition-colors group-hover:bg-slate-100 group-hover:text-[#04439e]">
                      <span>{t('categoryProductsList.appuyerPourOuvrir')}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Add Product FAB - Intelligent pour tous les utilisateurs */}
      {filteredProducts.length > 0 && (
        <div className="fixed bottom-24 right-4 z-50">
          <Button
            onClick={handleAddProduct}
            className={cn('rounded-full w-14 h-14 shadow-lg text-white', gradient)}
            title={user ? (isMerchant ? 'Ajouter un produit' : 'Devenir marchand pour vendre') : 'Se connecter'}
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <MerchantActivationDialog
        open={showActivationDialog}
        onOpenChange={setShowActivationDialog}
        onSuccess={handleActivationSuccess}
      />

      <QuickFooter />
    </div>
  );
}
