/**
 * HOME PAGE - Ultra Professional Design
 * 224Solutions - Marketplace Landing Page
 * Premium design inspired by Apple, Stripe, Linear
 * OPTIMISÉ pour les performances
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/contexts/CartContext';
import { useUniversalProducts } from '@/hooks/useUniversalProducts';
import { useNearbyServiceStats } from '@/hooks/useNearbyServiceStats';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';

// Premium Home Components
import {
  HomeHeader,
  HomeSearchBar,
  HeroSection,
  BottomNavigation,
  NearbyServicesSection,
  LatestProductsSection,
  NearbyVendorsModal,
  NearbyTaxiModal,
  NearbyDeliveryModal,
  SplineBackground,
} from '@/components/home';
import RecentlyViewedProducts from '@/components/shared/RecentlyViewedProducts';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, getCartCount } = useCart();
  const { t } = useTranslation();

  // Stats des services à proximité (filtrés par distance 20km)
  const { stats: serviceStats, loading: statsLoading } = useNearbyServiceStats();

  const [searchQuery, setSearchQuery] = useState('');
  const [showVendorsModal, setShowVendorsModal] = useState(false);
  const [showTaxiModal, setShowTaxiModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // Universal products hook - memoized options
  const productOptions = useMemo(() => ({
    limit: 4,
    sortBy: 'newest' as const,
    autoLoad: true,
  }), []);

  const { products: universalProducts, loading: productsLoading, refresh: refreshProducts } = useUniversalProducts(productOptions);

  // Search submit: navigate to marketplace with query
  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      navigate(`/marketplace?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }, [searchQuery, navigate]);

  const handleProductClick = useCallback(
    (productId: string) => {
      navigate(`/product/${productId}`);
    },
    [navigate]
  );

  const handleServiceClick = useCallback((serviceId: string) => {
    switch (serviceId) {
      case 'boutiques':
        setShowVendorsModal(true);
        break;
      case 'taxi':
        setShowTaxiModal(true);
        break;
      case 'livraison':
        setShowDeliveryModal(true);
        break;
      case 'restaurants':
        navigate('/services-proximite?type=restaurant');
        break;
      // ✅ Tout autre service → page Proximité (plus de clic ignoré)
      default:
        navigate(`/proximite?service=${serviceId}`);
        break;
    }
  }, [navigate]);

  const handleAddToCart = useCallback(
    (product: any) => {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: typeof product.images === 'string' ? product.images : product.images?.[0],
        vendor_id: product.vendor_id,
        vendor_name: product.vendor_name,
        currency: product.currency || 'GNF',
      });
      toast.success(t('home.addedToCart'));
    },
    [addToCart, t]
  );

  return (
    <div className="min-h-screen bg-background pb-24 relative overflow-hidden">
      {/* 3D Spline Globe Background */}
      <SplineBackground height="100vh" />

      <div className="relative z-10">
        {/* ✅ Le client Supabase gère ses propres erreurs ; aucune variable d'env
            ni configuration n'est exposée dans le DOM en production. */}

        {/* Premium Header - cart works for all users (CartContext uses localStorage) */}
        <HomeHeader
          cartCount={getCartCount()}
        />

        {/* Premium Search Bar - connected to marketplace navigation */}
        <HomeSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={handleSearchSubmit}
          placeholder={t('home.searchPlaceholder')}
          showFilter
          showCamera
          onFilter={() => navigate('/marketplace')}
          onCameraCapture={(file) => {
            navigate('/marketplace/visual-search', { state: { capturedImage: file } });
          }}
        />

        {/* Hero Section - Create Service */}
        <HeroSection />

        {/* Nearby Services */}
        <NearbyServicesSection
          stats={serviceStats}
          onServiceClick={handleServiceClick}
          loading={statsLoading}
        />

        {/* Latest Products */}
        <LatestProductsSection
          products={universalProducts}
          loading={productsLoading}
          onRetry={refreshProducts}
          onProductClick={handleProductClick}
          onAddToCart={handleAddToCart}
        />

        {/* Bottom Navigation */}
        <BottomNavigation />

        {/* Derniers produits visités — toujours en bas */}
        <div className="px-4 pb-6">
          <RecentlyViewedProducts maxItems={6} />
        </div>

        {/* Modals */}
        <NearbyVendorsModal
          open={showVendorsModal}
          onOpenChange={setShowVendorsModal}
        />
        <NearbyTaxiModal
          open={showTaxiModal}
          onOpenChange={setShowTaxiModal}
        />
        <NearbyDeliveryModal
          open={showDeliveryModal}
          onOpenChange={setShowDeliveryModal}
        />
      </div>
    </div>
  );
}
