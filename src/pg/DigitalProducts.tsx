/**
 * Page Produits Numériques & Marketplace
 * Modules: Voyage, Logiciel, Formation, Livres, Dropshipping, Produit custom
 */

import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Package,
  Plane,
  Monitor,
  GraduationCap,
  BookOpen,
  ArrowLeft,
  Store,
  ShoppingBag,
  Bot,
  Search,
  Eye,
  ExternalLink,
  Star,
  ShoppingCart,
  Box,
  PlayCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import QuickFooter from '@/components/QuickFooter';
import { MerchantActivationDialog } from '@/components/digital-products/MerchantActivationDialog';
import { CategoryProductsList } from '@/components/digital-products/CategoryProductsList';
import { TravelModule } from '@/components/travel/TravelModule';
import { useTranslation } from '@/hooks/useTranslation';
import { useDigitalProducts } from '@/hooks/useDigitalProducts';
import { LocalPrice } from '@/components/ui/LocalPrice';

interface ProductModule {
  id: string;
  icon: React.ReactNode;
  titleKey: string;
  descriptionKey: string;
  gradient: string;
  iconColor: string;
  coverImage: string;
  iconImage: string;
  category: 'dropshipping' | 'voyage' | 'logiciel' | 'formation' | 'livre' | 'custom' | 'ai' | 'physique_affilie';
}

const productModules: ProductModule[] = [
  {
    id: 'dropshipping',
    icon: <Box className="w-7 h-7" />,
    titleKey: 'digital.modules.dropshipping',
    descriptionKey: 'digital.modules.dropshippingDesc',
    gradient: 'bg-[#1f2a44]',
    iconColor: 'text-[#2f4a83]',
    coverImage: 'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1200&q=80',
    iconImage: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=200&q=80',
    category: 'dropshipping'
  },
  {
    id: 'voyage',
    icon: <Plane className="w-7 h-7" />,
    titleKey: 'digital.modules.flight',
    descriptionKey: 'digital.modules.flightDesc',
    gradient: 'bg-[#0d3b8f]',
    iconColor: 'text-[#1f61d5]',
    coverImage: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80',
    iconImage: 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?auto=format&fit=crop&w=200&q=80',
    category: 'voyage'
  },
  {
    id: 'logiciel',
    icon: <Monitor className="w-7 h-7" />,
    titleKey: 'digital.modules.software',
    descriptionKey: 'digital.modules.softwareDesc',
    gradient: 'bg-[#2a2f78]',
    iconColor: 'text-[#4f5bd5]',
    coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    iconImage: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=200&q=80',
    category: 'logiciel'
  },
  {
    id: 'formation',
    icon: <GraduationCap className="w-7 h-7" />,
    titleKey: 'digital.modules.training',
    descriptionKey: 'digital.modules.trainingDesc',
    gradient: 'bg-[#135d3b]',
    iconColor: 'text-[#ff4000]',
    coverImage: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80',
    iconImage: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=200&q=80',
    category: 'formation'
  },
  {
    id: 'livre',
    icon: <BookOpen className="w-7 h-7" />,
    titleKey: 'digital.modules.books',
    descriptionKey: 'digital.modules.booksDesc',
    gradient: 'bg-[#6a4a12]',
    iconColor: 'text-[#ff4000]',
    coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80',
    iconImage: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=200&q=80',
    category: 'livre'
  },
  {
    id: 'ai',
    icon: <Bot className="w-7 h-7" />,
    titleKey: 'digital.modules.ai',
    descriptionKey: 'digital.modules.aiDesc',
    gradient: 'bg-[#3c2b7a]',
    iconColor: 'text-[#04439e]',
    coverImage: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80',
    iconImage: 'https://images.unsplash.com/photo-1655720828018-edd2daec9349?auto=format&fit=crop&w=200&q=80',
    category: 'ai'
  },
  {
    id: 'physique_affilie',
    icon: <ShoppingBag className="w-7 h-7" />,
    titleKey: 'digital.modules.physicalAffiliate',
    descriptionKey: 'digital.modules.physicalAffiliateDesc',
    gradient: 'bg-[#8a2f0a]',
    iconColor: 'text-[#fb923c]',
    coverImage: 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1200&q=80',
    iconImage: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=200&q=80',
    category: 'physique_affilie'
  }
];

export default function DigitalProducts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading } = useAuth();
  const isVendorWorkspace = location.pathname.startsWith('/vendeur-digital');
  const isVendorAddFlow = location.pathname.includes('/add-product');
  const { t } = useTranslation();
  const [showActivationDialog, setShowActivationDialog] = useState(false);
  const [selectedModule, setSelectedModule] = useState<ProductModule | null>(null);
  const [showCategoryProducts, setShowCategoryProducts] = useState(false);
  const [showTravelModule, setShowTravelModule] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { products: allProducts, loading: productsLoading } = useDigitalProducts({ limit: 100 });

  const isMerchant = profile?.role === 'vendeur';

  // Filtrer les produits par recherche
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return allProducts.filter(product =>
      product.title?.toLowerCase().includes(query) ||
      product.short_description?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query)
    );
  }, [allProducts, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  const handleModuleClick = (module: ProductModule) => {
    // Afficher directement les produits de la catégorie
    // Tous les modules fonctionnent de la même manière - les utilisateurs publient leurs liens d'affiliation
    setSelectedModule(module);
    setShowCategoryProducts(true);
  };

  const handleBecomeMerchant = () => {
    // Si pas connecté, rediriger vers auth
    if (!user) {
      toast.info(t('digital.loginRequired'));
      navigate('/auth', { state: { redirectTo: '/digital-products' } });
      return;
    }

    // Si le profil est encore en chargement, attendre
    if (!profile) {
      toast.info(t('digitalProducts.chargementDeVotreProfilEn'));
      return;
    }

    // Si connecté mais pas marchand, afficher dialog d'activation
    if (!isMerchant) {
      setShowActivationDialog(true);
      return;
    }

    // Si déjà marchand, rediriger vers la création de produit
    toast.info(t('digital.alreadyMerchant'));
  };

  const handleActivationSuccess = () => {
    setShowActivationDialog(false);
    if (selectedModule) {
      setShowCategoryProducts(true);
    }
  };

  const handleProductClick = (product: any) => {
    if (product.product_mode === 'affiliate' && product.affiliate_url) {
      window.open(product.affiliate_url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(`/digital-product/${product.id}`);
    }
  };

  const getCategoryGradient = (category: string) => {
    const module = productModules.find(m => m.category === category);
    return module?.gradient || 'bg-[#04439e]';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Affichage du module voyage
  if (showTravelModule) {
    return <TravelModule onBack={() => setShowTravelModule(false)} />;
  }

  // Affichage des produits par catégorie
  if (showCategoryProducts && selectedModule) {
    return (
      <CategoryProductsList
        category={selectedModule.category}
        title={t(selectedModule.titleKey)}
        description={t(selectedModule.descriptionKey)}
        gradient={selectedModule.gradient}
        onBack={() => {
          setShowCategoryProducts(false);
          setSelectedModule(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-md border-b border-border sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(isVendorWorkspace ? '/vendeur-digital/dashboard' : '/')}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-foreground">
                {isVendorWorkspace ? (isVendorAddFlow ? 'Ajouter un produit digital' : 'Modules de vente digitale') : t('digital.title')}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isVendorWorkspace
                  ? (isVendorAddFlow
                    ? 'Choisissez un module puis poursuivez la publication sans quitter votre cockpit vendeur.'
                    : 'Explorez les modules utiles à votre boutique digitale depuis un espace structuré.')
                  : t('digital.subtitle')}
              </p>
            </div>
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(isVendorWorkspace ? '/vendeur-digital/products' : '/marketplace?type=digital')}
                className="shrink-0"
              >
                <Store className="w-4 h-4 mr-1.5" />
                {isVendorWorkspace ? 'Mon catalogue' : t('nav.marketplace')}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Barre de recherche */}
      <section className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={isVendorWorkspace ? 'Rechercher un module ou un produit à ajouter...' : 'Rechercher un produit numérique...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-muted/50 border-border"
          />
        </div>
        {isSearching && (
          <p className="text-xs text-muted-foreground mt-2">
            {filteredProducts.length} résultat{filteredProducts.length !== 1 ? 's' : ''} pour "{searchQuery}"
          </p>
        )}
      </section>

      {/* Résultats de recherche */}
      {isSearching ? (
        <section className="px-4 py-4">
          {productsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-muted">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Aucun résultat pour "{searchQuery}"
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Essayez avec d'autres mots-clés
              </p>
              <Button variant="outline" onClick={() => setSearchQuery('')}>
                Effacer la recherche
              </Button>
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
                        getCategoryGradient(product.category)
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
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Eye className="w-3 h-3" />
                        <span className="text-xs">{product.views_count || 0}</span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-600 transition-colors group-hover:bg-slate-100 group-hover:text-[#04439e]">
                      <span>{t('digitalProducts.appuyerPourOuvrir')}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Status Banner */}
          {!isVendorWorkspace && user && !isMerchant && (
            <div className="mx-4 mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-4 shadow-sm">
              <div className="flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <Store className="mt-0.5 w-4 h-4 text-[#04439e] shrink-0" />
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold text-[#0b1b33]">{t('digital.wantToSell')}</p>
                    <p className="text-[#5673a7] leading-5">{t('digital.activateMerchant')}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleBecomeMerchant}
                  className="h-9 w-full min-[560px]:w-auto text-xs bg-[#04439e] text-white hover:bg-[#05378a]"
                >
                  {t('digital.becomeMerchant')}
                </Button>
              </div>
            </div>
          )}

          {!isVendorWorkspace && user && isMerchant && (
            <div className="mx-4 mt-4 rounded-xl px-3 py-3 sm:px-4 bg-[#04439e] text-white text-center min-[560px]:text-left text-xs sm:text-sm shadow-sm">
              <span className="flex items-center justify-center min-[560px]:justify-start gap-2 font-bold leading-tight">
                <Store className="w-4 h-4 shrink-0" />
                {t('digital.merchantActive')}
              </span>
            </div>
          )}

          {/* Hero Section */}
          <section className="px-4 pt-5 pb-2">
            <div className="rounded-2xl bg-[#04439e] px-5 py-5 sm:px-7 sm:py-6">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 mb-3">
                <Package className="w-3.5 h-3.5 text-white" />
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-white/90">
                  {isVendorAddFlow ? 'Création produit' : isVendorWorkspace ? 'Outils vendeur' : t('digital.marketplaceDigital')}
                </span>
              </div>
              <h2 className="text-lg font-bold leading-snug text-white sm:text-2xl max-w-lg">
                {isVendorAddFlow
                  ? 'Choisissez le module de votre prochain produit digital.'
                  : isVendorWorkspace
                    ? 'Développez votre catalogue depuis un espace vendeur cohérent.'
                    : t('digital.discover')}
              </h2>
              <p className="mt-2 max-w-xl text-[13px] leading-5 text-white/70 sm:text-sm">
                {isVendorWorkspace
                  ? (isVendorAddFlow
                    ? 'Sélectionnez le bon module pour publier votre offre.'
                    : 'Modules utiles à votre croissance et distribution digitale.')
                  : (
                    <>
                      {t('digital.discoverDesc')}
                      {!isMerchant && ` ${t('digital.becomeSellerPrompt')}`}
                    </>
                  )}
              </p>
            </div>
          </section>

          {/* Modules Grid */}
          <section className="px-4 pb-6">
            <div className="mb-4 text-center">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">{t('digitalProducts.modulesDeVente')}</h3>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500">{t('digitalProducts.explorezNosModulesDeVente')}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {productModules.map((module) => (
                <Card
                  key={module.id}
                  className="group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
                  onClick={() => handleModuleClick(module)}
                >
                  <CardContent className="p-0">
                    <div className="relative h-28 sm:h-32 w-full overflow-hidden">
                      <img
                        src={module.coverImage}
                        alt={t(module.titleKey)}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/40" />
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                        <div className="h-10 w-10 sm:h-11 sm:w-11 overflow-hidden rounded-xl shadow-lg ring-2 ring-white">
                          <img
                            src={module.iconImage}
                            alt={t(module.titleKey)}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-3 sm:px-4 sm:py-3.5 text-center">
                      <h3 className="text-sm sm:text-[15px] font-semibold text-slate-900 leading-tight">
                        {t(module.titleKey)}
                      </h3>
                      <p className="mt-1 text-xs sm:text-[13px] leading-relaxed text-slate-500 line-clamp-2">
                        {t(module.descriptionKey)}
                      </p>
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-[#04439e]">
                        Ouvrir le module →
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Dialog d'activation marchand */}
      <MerchantActivationDialog
        open={showActivationDialog}
        onOpenChange={setShowActivationDialog}
        onSuccess={handleActivationSuccess}
      />

      {!isVendorWorkspace && <QuickFooter />}
    </div>
  );
}
