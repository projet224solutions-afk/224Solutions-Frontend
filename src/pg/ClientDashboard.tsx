import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShoppingBag, Heart, Package, Search, CreditCard,
  LogOut, Home, ShoppingCart, TrendingUp, Bot, User, Settings, Trash2, History, HandCoins, Headphones, Loader2
} from 'lucide-react';
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useClientData } from "@/hooks/useClientData";
import { useUniversalProducts } from "@/hooks/useUniversalProducts";
import { supabase } from "@/lib/supabaseClient";
import { useResponsive } from "@/hooks/useResponsive";
import { useCart } from "@/contexts/CartContext";
import { useClientStats } from "@/hooks/useClientStats";
import { useAffiliateModule } from "@/hooks/useAffiliateModule";

// Lazy loading des composants lourds
const ProductCard = lazy(() => import("@/components/ProductCard"));
const UserProfileCard = lazy(() => import("@/components/UserProfileCard"));
// Copilot 224 unifié (mode intégré plein écran) — remplace l'ancien CopiloteChat.
const Copilot224 = lazy(() => import("@/components/service-common/Copilot224"));
const UniversalWalletTransactions = lazy(() => import("@/components/wallet/UniversalWalletTransactions"));
const _WalletBalanceWidget = lazy(() => import("@/components/wallet/WalletBalanceWidget").then(m => ({ default: m.WalletBalanceWidget })));
const UserIdDisplay = lazy(() => import("@/components/UserIdDisplay").then(m => ({ default: m.UserIdDisplay })));
const IdSystemIndicator = lazy(() => import("@/components/IdSystemIndicator").then(m => ({ default: m.IdSystemIndicator })));
const ProductPaymentModal = lazy(() => import("@/components/ecommerce/ProductPaymentModal"));
const ClientStatDetailModal = lazy(() => import("@/components/client/ClientStatDetailModal").then(m => ({ default: m.ClientStatDetailModal })));
const ClientOrdersList = lazy(() => import("@/components/client/ClientOrdersList"));
const ResponsiveGrid = lazy(() => import("@/components/responsive/ResponsiveContainer").then(m => ({ default: m.ResponsiveGrid })));
const ProductDetailModal = lazy(() => import("@/components/marketplace/ProductDetailModal"));
const ClientSettings = lazy(() => import("@/components/client/ClientSettings"));
const NotificationBellButton = lazy(() => import("@/components/shared/NotificationBellButton").then(m => ({ default: m.NotificationBellButton })));
const RecentlyViewedProducts = lazy(() => import("@/components/shared/RecentlyViewedProducts"));
const SupportTicketsUniversal = lazy(() => import("@/components/shared/SupportTicketsUniversal").then(m => ({ default: m.SupportTicketsUniversal })));

export default function ClientDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const responsive = useResponsive();
  const { t } = useTranslation();
  const { isAffiliateEnabled } = useAffiliateModule();
  const { wallet } = useWallet();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Stats optimisées avec SQL
  const { stats: clientStats, loading: statsLoading, refresh: refreshStats } = useClientStats();

  // Produits via hook universel
  const { products: universalProducts, loading: _productsLoading } = useUniversalProducts({
    limit: 50,
    sortBy: 'newest',
    autoLoad: true,
    searchQuery
  });

  // Données client: commandes, favoris, contact vendeur
  const {
    orders,
    favorites,
    toggleFavorite,
    contactVendor,
    loadAllData
  } = useClientData();

  // Panier unifié via CartContext (seule source de vérité)
  const { cartItems, addToCart: addToCartContext, removeFromCart, clearCart, getCartTotal, getCartCount } = useCart();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [statDetailType, setStatDetailType] = useState<'orders' | 'active' | 'favorites' | 'spent' | null>(null);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success(t('common.signOutSuccess'));
      navigate('/');
    } catch {
      toast.error(t('common.error'));
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' ' + (wallet?.currency || 'GNF');
  };

  // Charger le customer_id + données client
  useEffect(() => {
    if (!user?.id) return;

    const loadCustomerId = async () => {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setCustomerId(data.id);
      } else {
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert({ user_id: user.id })
          .select('id')
          .single();

        if (newCustomer) {
          setCustomerId(newCustomer.id);
        } else {
          console.error('✕ Échec création customer:', createError);
        }
      }
    };

    loadCustomerId();
    loadAllData(user.id);
  }, [user?.id, loadAllData]);

  const handleCheckout = () => {
    if (!user?.id) {
      toast.error(t('client.connectionRequired'));
      return;
    }
    if (getCartCount() === 0) {
      toast.error(t('client.emptyCart'));
      return;
    }
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    clearCart();
    loadAllData(user?.id);
    refreshStats();
    setShowPaymentModal(false);
    toast.success(t('clientDashboard.commandeEnregistreeAvecSucces'), { duration: 2000 });
  };

  const handleProductClick = (productId: string) => {
    setSelectedProductId(productId);
    setShowProductModal(true);
  };

  // Contact vendeur unifié via edge function
  const handleContactVendor = async (product: any) => {
    const vendorUserId = product.vendor_user_id;
    if (!vendorUserId) {
      toast.error(t('clientDashboard.informationsDuVendeurNonDisponibles'));
      return;
    }
    if (!user) {
      toast.error(t('clientDashboard.veuillezVousConnecter'));
      return;
    }

    const conversationId = await contactVendor(vendorUserId, product.vendor_name || product.name);
    if (conversationId) {
      navigate('/messages');
    }
  };

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">{t('clientDashboard.chargementDuDashboard')}</p>
        </div>
      </div>
    }>
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className={`container flex ${responsive.isMobile ? 'h-14' : 'h-16'} items-center justify-between ${responsive.isMobile ? 'px-3' : 'px-4'}`}>
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className={`${responsive.isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg bg-client-gradient flex items-center justify-center shadow-elegant`}>
                <ShoppingBag className={`${responsive.isMobile ? 'w-4 h-4' : 'w-6 h-6'} text-white`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 md:gap-2">
                  <h1 className={`${responsive.isMobile ? 'text-sm' : 'text-lg'} font-bold text-foreground truncate`}>
                    {responsive.isMobile ? '224SOL' : '224SOLUTIONS'}
                  </h1>
                  {!responsive.isMobile && (
                    <UserIdDisplay layout="horizontal" showBadge={true} className="text-xs" />
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">Marketplace</p>
                  {isAffiliateEnabled && (
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                      {t('client.affiliateActiveBadge')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Barre de recherche desktop */}
          {!responsive.isMobile && (
            <div className="flex-1 max-w-md mx-4 lg:mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('clientDashboard.rechercher')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 border-border focus-visible:ring-client-primary"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <Suspense fallback={null}>
              <NotificationBellButton className={responsive.isMobile ? 'h-8 w-8' : 'h-9 w-9'} iconSize={responsive.isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
            </Suspense>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setActiveTab('cart')}
            >
              <ShoppingCart className={responsive.isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
              {getCartCount() > 0 && (
                <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-client-primary text-xs">
                  {getCartCount()}
                </Badge>
              )}
            </Button>

            {!responsive.isMobile && (
              <>
                <Button variant="ghost" size="icon" onClick={() => setActiveTab('settings')}>
                  <User className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleSignOut}>
                  <LogOut className="w-5 h-5" />
                </Button>
              </>
            )}

            {responsive.isMobile && (
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Barre de recherche mobile */}
        {responsive.isMobile && (
          <div className="px-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('clientDashboard.rechercherDesProduits')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className={`container ${responsive.isMobile ? 'px-3 py-4' : 'px-4 py-6'}`}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
          <div className="overflow-x-auto scrollbar-hide -mx-3 px-3 md:mx-0 md:px-0">
            <TabsList className={`${responsive.isMobile ? 'inline-flex w-max' : `grid w-full ${isAffiliateEnabled ? 'grid-cols-8' : 'grid-cols-7'} lg:w-auto lg:inline-grid`} bg-muted/50 min-w-full md:min-w-0`}>
              <TabsTrigger value="overview" className={`data-[state=active]:bg-client-primary data-[state=active]:text-white ${responsive.isMobile ? 'text-xs px-3' : ''}`}>
                <Home className={`${responsive.isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1 md:mr-2`} />
                {responsive.isMobile ? 'Vue' : "Vue d'ensemble"}
              </TabsTrigger>
              <TabsTrigger value="cart" className={`data-[state=active]:bg-client-primary data-[state=active]:text-white ${responsive.isMobile ? 'text-xs px-3' : ''}`}>
                <ShoppingCart className={`${responsive.isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1 md:mr-2`} />
                Panier
              </TabsTrigger>
              <TabsTrigger value="orders" className={`data-[state=active]:bg-client-primary data-[state=active]:text-white ${responsive.isMobile ? 'text-xs px-3' : ''}`}>
                <Package className={`${responsive.isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1 md:mr-2`} />
                {responsive.isMobile ? 'Cmd' : 'Commandes'}
              </TabsTrigger>
              <TabsTrigger value="recent" className={`data-[state=active]:bg-client-primary data-[state=active]:text-white ${responsive.isMobile ? 'text-xs px-3' : ''}`}>
                <History className={`${responsive.isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1 md:mr-2`} />
                {responsive.isMobile ? 'Vus' : 'Derniers visites'}
              </TabsTrigger>
              <TabsTrigger value="copilot" className={`data-[state=active]:bg-client-primary data-[state=active]:text-white ${responsive.isMobile ? 'text-xs px-3' : ''}`}>
                <Bot className={`${responsive.isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1 md:mr-2`} />
                {responsive.isMobile ? 'IA' : 'Assistant IA'}
              </TabsTrigger>
              {isAffiliateEnabled && (
                <TabsTrigger value="affiliate" className={`data-[state=active]:bg-client-primary data-[state=active]:text-white ${responsive.isMobile ? 'text-xs px-3' : ''}`}>
                  <HandCoins className={`${responsive.isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1 md:mr-2`} />
                  {responsive.isMobile ? t('client.tabAffiliateShort') : t('client.tabAffiliate')}
                </TabsTrigger>
              )}
              <TabsTrigger value="support" className={`data-[state=active]:bg-client-primary data-[state=active]:text-white ${responsive.isMobile ? 'text-xs px-3' : ''}`}>
                <Headphones className={`${responsive.isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1 md:mr-2`} />
                {responsive.isMobile ? 'Support' : 'Support'}
              </TabsTrigger>
              <TabsTrigger value="settings" className={`data-[state=active]:bg-client-primary data-[state=active]:text-white ${responsive.isMobile ? 'text-xs px-3' : ''}`}>
                <Settings className={`${responsive.isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-1 md:mr-2`} />
                {responsive.isMobile ? 'Réglages' : 'Paramètres'}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Vue d'ensemble */}
          <TabsContent value="overview" className="space-y-4 md:space-y-6 animate-fade-in">
            <ResponsiveGrid mobileCols={1} tabletCols={2} desktopCols={3} gap="md">
              <div className="lg:col-span-2">
                <UserProfileCard showWalletDetails={false} />
              </div>
              <div>
                <IdSystemIndicator />
              </div>
            </ResponsiveGrid>

            <ResponsiveGrid mobileCols={1} tabletCols={2} desktopCols={3} gap="md">
              <div className="lg:col-span-2">
                <UniversalWalletTransactions />
              </div>
              {/* Statistiques */}
              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className={responsive.isMobile ? 'text-base' : 'text-lg'}>Statistiques</CardTitle>
                  <CardDescription className="text-xs md:text-sm">{t('clientDashboard.votreActivite')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="text-center py-4 text-muted-foreground">Chargement...</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <button onClick={() => setStatDetailType('orders')} className="flex flex-col items-center justify-center p-2 sm:p-3 bg-client-accent rounded-lg text-center cursor-pointer hover:ring-2 hover:ring-client-primary/40 transition-all active:scale-95">
                        <div className={`${responsive.isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-client-primary/10 flex items-center justify-center mb-1`}>
                          <Package className={`${responsive.isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-client-primary`} />
                        </div>
                        <p className={`${responsive.isMobile ? 'text-lg' : 'text-xl'} font-bold text-foreground`}>{clientStats?.total_orders || 0}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{t('clientDashboard.commandes')}</p>
                      </button>

                      <button onClick={() => setStatDetailType('active')} className="flex flex-col items-center justify-center p-2 sm:p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg text-center cursor-pointer hover:ring-2 hover:ring-orange-400/40 transition-all active:scale-95">
                        <div className={`${responsive.isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-1`}>
                          <TrendingUp className={`${responsive.isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-orange-600`} />
                        </div>
                        <p className={`${responsive.isMobile ? 'text-lg' : 'text-xl'} font-bold text-foreground`}>{clientStats?.active_orders || 0}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">En cours</p>
                      </button>

                      <button onClick={() => setStatDetailType('favorites')} className="flex flex-col items-center justify-center p-2 sm:p-3 bg-blue-50 dark:bg-[#04439e]/20 rounded-lg text-center cursor-pointer hover:ring-2 hover:ring-[#04439e]/40 transition-all active:scale-95">
                        <div className={`${responsive.isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-blue-100 dark:bg-[#04439e]/30 flex items-center justify-center mb-1`}>
                          <Heart className={`${responsive.isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-[#04439e]`} />
                        </div>
                        <p className={`${responsive.isMobile ? 'text-lg' : 'text-xl'} font-bold text-foreground`}>{clientStats?.favorites_count || 0}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Favoris</p>
                      </button>

                      <button onClick={() => setStatDetailType('spent')} className="flex flex-col items-center justify-center p-2 sm:p-3 bg-orange-50 dark:bg-[#ff4000]/20 rounded-lg text-center cursor-pointer hover:ring-2 hover:ring-[#ff4000]/40 transition-all active:scale-95">
                        <div className={`${responsive.isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-orange-100 dark:bg-[#ff4000]/30 flex items-center justify-center mb-1`}>
                          <CreditCard className={`${responsive.isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-[#ff4000]`} />
                        </div>
                        <p className={`${responsive.isMobile ? 'text-sm' : 'text-base'} font-bold text-foreground truncate max-w-full`}>{formatPrice(clientStats?.total_spent || 0)}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{t('clientDashboard.totalDepense')}</p>
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </ResponsiveGrid>

            <Card className="shadow-elegant border-client-primary/20 bg-gradient-to-br from-client-primary/10 to-background">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HandCoins className="w-5 h-5 text-client-primary" />
                  {t('client.affiliateEarnTitle')}
                </CardTitle>
                <CardDescription>
                  {t('client.affiliateEarnDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => navigate(isAffiliateEnabled ? '/affiliate/dashboard' : '/affiliate/activation')}
                  className="bg-client-primary hover:bg-client-primary/90"
                >
                  {isAffiliateEnabled ? t('client.affiliateOpenSpace') : t('client.affiliateActivate')}
                </Button>
              </CardContent>
            </Card>

            {/* Produits populaires */}
            <Card className="shadow-elegant">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('clientDashboard.produitsPopulaires')}</CardTitle>
                    <CardDescription>{t('clientDashboard.decouvrezNosMeilleuresVentes')}</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/marketplace')}>
                    Voir tout
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {universalProducts.slice(0, 6).map((product) => (
                    <ProductCard
                      key={product.id}
                      id={product.id}
                      image={product.images?.[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop'}
                      title={product.name}
                      price={product.price}
                      currency={product.currency || 'GNF'}
                      vendor={product.vendor_name}
                      rating={product.rating}
                      reviewCount={product.reviews_count}
                      onBuy={() => handleProductClick(product.id)}
                      onAddToCart={() => {
                        addToCartContext({
                          id: product.id,
                          name: product.name,
                          price: product.price,
                          image: product.images?.[0],
                          vendor_id: product.vendor_id,
                          vendor_name: product.vendor_name,
                          currency: product.currency || 'GNF',
                        });
                      }}
                      onContact={() => handleContactVendor(product)}
                      isPremium={product.is_hot}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          {/* Panier - utilise CartContext comme seule source */}
          <TabsContent value="cart" className="space-y-6 animate-fade-in">
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle>Mon panier</CardTitle>
                <CardDescription>
                  {getCartCount()} article{getCartCount() > 1 ? 's' : ''} dans votre panier
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cartItems.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">{t('clientDashboard.votrePanierEstVide')}</h3>
                    <p className="text-muted-foreground mb-6">{t('clientDashboard.ajoutezDesProduitsPourCommencer')}</p>
                    <Button onClick={() => navigate('/marketplace')} className="bg-client-primary hover:bg-client-primary/90">
                      Parcourir les produits
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cartItems.map((item) => (
                      <Card key={item.id}>
                        <CardContent className="p-4 flex items-center gap-4">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-20 h-20 rounded-lg object-cover" />
                          ) : (
                            <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                              <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate">{item.name}</h4>
                            <p className="text-sm text-muted-foreground">Qté: {item.quantity}</p>
                            {item.vendor_name && (
                              <p className="text-xs text-muted-foreground">{item.vendor_name}</p>
                            )}
                            <p className="text-lg font-bold text-client-primary mt-1">
                              {new Intl.NumberFormat('fr-FR').format(item.price * item.quantity) + ' ' + (item.currency || wallet?.currency || 'GNF')}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                    <Card className="bg-client-accent">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-lg font-semibold">Total</span>
                          <span className="text-2xl font-bold text-client-primary">
                            {(() => {
                              const primaryCurrency = cartItems.find(i => i.currency && i.currency !== 'GNF')?.currency || cartItems[0]?.currency || wallet?.currency || 'GNF';
                              return new Intl.NumberFormat('fr-FR').format(getCartTotal()) + ' ' + primaryCurrency;
                            })()}
                          </span>
                        </div>
                        <Button
                          className="w-full bg-client-primary hover:bg-client-primary/90"
                          size="lg"
                          onClick={handleCheckout}
                        >
                          <CreditCard className="w-5 h-5 mr-2" />
                          Procéder au paiement
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commandes */}
          <TabsContent value="orders" className="space-y-6 animate-fade-in">
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle>{t('clientDashboard.mesCommandes')}</CardTitle>
                <CardDescription>{t('clientDashboard.suivezLEtatDeVos')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ClientOrdersList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recent" className="space-y-6 animate-fade-in">
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle>{t('clientDashboard.derniersProduitsVisites')}</CardTitle>
                <CardDescription>{t('clientDashboard.retrouvezRapidementLesProduitsQue')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<div className="text-sm text-muted-foreground">{t('clientDashboard.chargementDeLHistorique')}</div>}>
                  <RecentlyViewedProducts maxItems={12} />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Copilote */}
          <TabsContent value="copilot" className="animate-fade-in">
            <Copilot224 variant="embedded" service="" title="Copilot 224" height="calc(100vh - 160px)" />
          </TabsContent>

          {isAffiliateEnabled && (
            <TabsContent value="affiliate" className="animate-fade-in">
              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HandCoins className="w-5 h-5 text-client-primary" />
                    {t('client.affiliateSpaceTitle')}
                  </CardTitle>
                  <CardDescription>{t('client.affiliateSpaceDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    ✓ Module affilié actif — accédez à votre espace pour gérer vos liens et suivre vos gains.
                  </p>
                  <Button onClick={() => navigate('/affiliate/dashboard')} className="bg-client-primary hover:bg-client-primary/90">
                    {t('client.affiliateOpenSpace')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Support technique */}
          <TabsContent value="support" className="animate-fade-in">
            <Suspense fallback={<div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
              <SupportTicketsUniversal />
            </Suspense>
          </TabsContent>

          {/* Paramètres */}
          <TabsContent value="settings" className="animate-fade-in">
            <ClientSettings />
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal de paiement */}
      {user?.id && (
        <ProductPaymentModal
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          cartItems={cartItems.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image || '',
            vendorId: item.vendor_id,
            vendor_id: item.vendor_id,
            currency: item.currency || 'GNF',
          }))}
          totalAmount={getCartTotal()}
          currency={cartItems.find(i => i.currency && i.currency !== 'GNF')?.currency || cartItems[0]?.currency || 'GNF'}
          onPaymentSuccess={handlePaymentSuccess}
          userId={user.id}
          customerId={customerId}
        />
      )}

      {/* Modal de détails du produit */}
      <ProductDetailModal
        productId={selectedProductId}
        open={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setSelectedProductId(null);
        }}
      />

      {/* Modal détail statistiques */}
      <ClientStatDetailModal
        open={!!statDetailType}
        onClose={() => setStatDetailType(null)}
        statType={statDetailType}
      />
    </div>
    </Suspense>
  );
}
