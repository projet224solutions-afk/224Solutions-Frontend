/**
 * Module d'Affiliation Compagnies Aériennes
 * Interface similaire à CategoryProductsList pour les produits digitaux
 * L'utilisateur peut créer ses propres affiliations aériennes avec nom, images, lien
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plane, Plus, ExternalLink,
  Eye, Star, ShoppingCart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MerchantActivationDialog } from '@/components/digital-products/MerchantActivationDialog';
import { AirlineAffiliateForm } from './AirlineAffiliateForm';
import { LocalPrice } from '@/components/ui/LocalPrice';

interface AirlineAffiliateModuleProps {
  onBack: () => void;
}

export function AirlineAffiliateModule({ onBack }: AirlineAffiliateModuleProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showActivationDialog, setShowActivationDialog] = useState(false);

  const isMerchant = profile?.role === 'vendeur';
  const gradient = '';

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('digital_products')
        .select('*')
        .eq('category', 'voyage')
        .eq('product_mode', 'affiliate')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = () => {
    if (!user) {
      toast.info(t('airlineAffiliateModule.connexionRequisePourAjouterUn'));
      navigate('/auth', { state: { redirectTo: '/digital-products' } });
      return;
    }

    // Attendre le chargement du profil
    if (!profile) {
      toast.info(t('airlineAffiliateModule.chargementDeVotreProfilEn'));
      return;
    }

    if (!isMerchant) {
      setShowActivationDialog(true);
      return;
    }

    setShowProductForm(true);
  };

  const handleActivationSuccess = () => {
    setShowActivationDialog(false);
    setShowProductForm(true);
  };

  const handleProductCreated = () => {
    setShowProductForm(false);
    loadProducts();
    toast.success(t('airlineAffiliateModule.affiliationAerienneCreeeAvecSucces'));
  };

  const handleProductClick = (product: any) => {
    if (product.affiliate_url) {
      window.open(product.affiliate_url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(`/digital-product/${product.id}`);
    }
  };

  if (showProductForm) {
    return (
      <AirlineAffiliateForm
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
              <h1 className="text-lg font-bold text-foreground">{t('airlineAffiliateModule.affiliationAerienne')}</h1>
              <p className="text-xs text-muted-foreground">{t('airlineAffiliateModule.compagniesAeriennesEtVols')}</p>
            </div>
            {user && (
              <Button
                size="sm"
                onClick={handleAddProduct}
                className={cn('bg-gradient-to-r text-white', gradient)}
              >
                <Plus className="w-4 h-4 mr-1" />
                {isMerchant ? 'Ajouter' : 'Vendre'}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Products Grid */}
      <section className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <div className={cn(
              'w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center',
              'bg-gradient-to-br text-white/80',
              gradient
            )}>
              <Plane className="w-8 h-8" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">{t('airlineAffiliateModule.aucuneAffiliationAerienne')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isMerchant
                ? 'Soyez le premier à ajouter une affiliation compagnie aérienne!'
                : 'Devenez marchand pour promouvoir des compagnies aériennes!'
              }
            </p>
            <Button onClick={handleAddProduct} className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/40">
              <Plus className="w-4 h-4 mr-2" />
              {user
                ? (isMerchant ? 'Ajouter une affiliation' : 'Devenir marchand')
                : 'Se connecter pour vendre'
              }
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-200"
                onClick={() => handleProductClick(product)}
              >
                <div className="relative aspect-square bg-muted">
                  {product.images && product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className={cn(
                      'w-full h-full flex items-center justify-center',
                      'bg-gradient-to-br text-white/50',
                      gradient
                    )}>
                      <Plane className="w-10 h-10" />
                    </div>
                  )}

                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Affilié
                    </Badge>
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
                    {product.price > 0 ? (
                      <LocalPrice
                        amount={product.price}
                        currency={product.currency || 'USD'}
                        size="sm"
                        className="font-bold text-primary"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('airlineAffiliateModule.voirLePrix')}</span>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Eye className="w-3 h-3" />
                      <span className="text-xs">{product.views_count || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Add Product FAB */}
      {products.length > 0 && (
        <div className="fixed bottom-24 right-4 z-50">
          <Button
            onClick={handleAddProduct}
            className={cn('rounded-full w-14 h-14 shadow-lg bg-gradient-to-r text-white', gradient)}
            title={user ? (isMerchant ? 'Ajouter une affiliation' : 'Devenir marchand') : 'Se connecter'}
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
    </div>
  );
}
