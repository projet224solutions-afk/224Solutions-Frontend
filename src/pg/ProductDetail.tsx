import { useTranslation } from "@/hooks/useTranslation";
﻿import { useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { ArrowLeft, ShoppingCart, MessageCircle, Star, Shield, Truck, ExternalLink, Play, Pause, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ProductPaymentModal from "@/components/ecommerce/ProductPaymentModal";
import { ShareButton } from "@/components/shared/ShareButton";
import { useAutoCarousel } from "@/hooks/useAutoCarousel";
import { trackProductView } from "@/services/analyticsTrackingService";
import { useBehaviorTracking } from "@/hooks/useBehaviorTracking";
import SEOHead from "@/components/SEOHead";
import { LocalPrice } from "@/components/ui/LocalPrice";
import { getCurrencyForCountry } from "@/data/countryMappings";
import { useVendorCertificationCached } from "@/hooks/useVendorCertificationCache";
import { CertifiedIcon } from "@/components/vendor/CertifiedVendorBadge";
import { addRecentProduct } from "@/lib/recentProductHistory";

// Mini composant pour afficher l'icône certifié à côté du nom vendeur
function VendorCertBadge({ vendorId }: { vendorId: string }) {
  const { t } = useTranslation();
  const { isCertified } = useVendorCertificationCached(vendorId);
  if (!isCertified) return null;
  return <CertifiedIcon status="CERTIFIE" className="w-4 h-4" />;
}

interface Product {
  id: string;
  name: string;
  price: number;
  currency?: string;
  description?: string;
  images?: string[];
  promotional_videos?: string[];
  stock_quantity?: number;
  vendor_id: string;
  barcode?: string;
  sku?: string;
  vendors?: {
    business_name: string;
    id: string;
    user_id: string;
    shop_slug?: string;
    country?: string;
  };
  category_id?: string;
  categories?: {
    name: string;
  };
  rating?: number;
  reviews_count?: number;
  status?: string;
}

export default function ProductDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [pendingAudioActivation, setPendingAudioActivation] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const hasTrackedView = useRef(false);

  // Behavior tracking for AI recommendations
  useBehaviorTracking({ sessionType: 'product_view', productId: id });

  // Mémoriser les vidéos et images pour le carrousel
  const videos = useMemo(() => product?.promotional_videos || [], [product?.promotional_videos]);
  const images = useMemo(() =>
    product?.images && product.images.length > 0
      ? product.images
      : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop'],
    [product?.images]
  );

  // Hook de carrousel automatique
  const {
    currentVideoIndex,
    currentImageIndex,
    isPlayingVideo,
    isAutoPlaying,
    videoRef,
    goToVideo,
    goToImage,
    pauseAutoPlay,
    toggleAutoPlay
  } = useAutoCarousel({
    videos,
    images,
    imageDisplayDuration: 15000,
    enabled: true
  });

  useEffect(() => {
    if (id) {
      loadProduct();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setIsVideoMuted(true);
    setPendingAudioActivation(false);
  }, [id]);

  const ensureAudioPlaybackUnlocked = useCallback(async () => {
    if (typeof window === 'undefined' || !videoRef.current) return;

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    if (!mediaSourceRef.current || !gainNodeRef.current) {
      mediaSourceRef.current = audioContextRef.current.createMediaElementSource(videoRef.current);
      gainNodeRef.current = audioContextRef.current.createGain();
      mediaSourceRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    gainNodeRef.current.gain.value = 1;
  }, [videoRef]);

  const syncVideoAudioState = useCallback(() => {
    if (!videoRef.current) return;

    videoRef.current.muted = isVideoMuted;
    if (!isVideoMuted) {
      videoRef.current.volume = 1;
    }
  }, [isVideoMuted, videoRef]);

  useEffect(() => {
    syncVideoAudioState();
  }, [syncVideoAudioState, isPlayingVideo, currentVideoIndex]);

  useEffect(() => {
    if (!pendingAudioActivation || !videoRef.current) return;

    const videoElement = videoRef.current;
    ensureAudioPlaybackUnlocked()
      .catch(() => {
        // Ignore les erreurs d'unlock et tente quand même la lecture HTML5 standard.
      })
      .finally(() => {
        videoElement.defaultMuted = false;
        videoElement.muted = false;
        videoElement.volume = 1;
        videoElement.play().catch(() => {
          // Certains navigateurs demandent une interaction supplémentaire après le montage.
        }).finally(() => {
          setPendingAudioActivation(false);
        });
      });
  }, [ensureAudioPlaybackUnlocked, pendingAudioActivation, isPlayingVideo, currentVideoIndex, videoRef]);

  const enableVideoAudio = () => {
    setIsVideoMuted(false);
    setPendingAudioActivation(true);
    pauseAutoPlay();

    if (videoRef.current) {
      ensureAudioPlaybackUnlocked()
        .catch(() => {
          // Fallback silencieux si AudioContext n'est pas disponible.
        })
        .finally(() => {
          videoRef.current!.defaultMuted = false;
          videoRef.current!.muted = false;
          videoRef.current!.volume = 1;
          videoRef.current!.play().catch(() => {
            // Certains contextes navigateur peuvent encore demander une interaction utilisateur supplémentaire.
          }).finally(() => {
            setPendingAudioActivation(false);
          });
        });
    }
  };

  const handleVideoSelect = (index: number) => {
    goToVideo(index);
    enableVideoAudio();
  };

  // Tracker la vue du produit une seule fois
  useEffect(() => {
    if (product && product.vendor_id && !hasTrackedView.current) {
      hasTrackedView.current = true;
      trackProductView(product.id, product.vendor_id);
      addRecentProduct(
        {
          id: product.id,
          type: 'physical',
          title: product.name,
          price: product.price,
          currency: product.currency || getCurrencyForCountry(product.vendors?.country || ''),
          imageUrl: product.images?.[0],
          vendorName: product.vendors?.business_name,
          route: `/product/${product.id}`,
        },
        userId
      );
    }
  }, [product, userId]);

  useEffect(() => {
    loadCustomerId();
  }, []);

  const loadCustomerId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);

      // CORRECTION: Charger le customer_id depuis la table customers (UUID), pas user_ids
      console.log('🔍 [ProductDetail] Chargement customer_id pour user:', user.id);
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('✕ [ProductDetail] Erreur chargement customer_id:', error);
        toast.error(t('productDetail.erreurDeChargementDuProfil'));
        return;
      }

      if (data) {
        console.log('✓ [ProductDetail] Customer ID chargé:', data.id);
        setCustomerId(data.id);
      } else {
        console.warn('⚠️ [ProductDetail] Aucun profil customer trouvé pour user:', user.id);
        toast.error(t('productDetail.profilClientManquant'), {
          description: 'Veuillez compléter votre profil client'
        });
      }
    }
  };

  const loadProduct = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          promotional_videos,
          vendors:vendor_id(business_name, id, user_id, shop_slug, country),
          categories:category_id(name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setProduct(data);
    } catch (error) {
      console.error('Erreur chargement produit:', error);
      toast.error(t('productDetail.impossibleDeChargerLeProduit'));
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!product) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t('productDetail.veuillezVousConnecterPourAcheter'));
      navigate('/auth');
      return;
    }

    if (!customerId) {
      toast.error(t('productDetail.erreurDeChargementDuProfil2'));
      return;
    }

    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    toast.success(t('productDetail.commandeEnregistreeAvecSucces'), { duration: 2000 });
    setShowPaymentModal(false);
  };

  const handleContact = async () => {
    const vendorUserId = product?.vendors?.user_id;
    if (!vendorUserId) {
      toast.error(t('productDetail.informationsDuVendeurNonDisponibles'));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t('productDetail.veuillezVousConnecterPourContacter'));
      navigate('/auth');
      return;
    }

    if (user.id === vendorUserId) {
      toast.error(t('productDetail.vousNePouvezPasVous'));
      return;
    }

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: vendorUserId,
          content: `Bonjour, je suis intéressé par votre produit "${product.name}".`,
          type: 'text'
        });

      if (error) throw error;
      toast.success(t('productDetail.messageEnvoyeAuVendeur'));
      navigate(`/messages?recipientId=${vendorUserId}`);
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast.error(t('productDetail.erreurLorsDeLEnvoi'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-bold mb-4">{t('productDetail.produitIntrouvable')}</h2>
          <p className="text-muted-foreground mb-6">{t('productDetail.ceProduitNExistePas')}</p>
          <Button onClick={() => navigate('/marketplace')}>{t('productDetail.retourAuMarketplace')}</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* SEO Meta Tags */}
      <SEOHead
        title={product.name}
        description={product.description || `${product.vendors?.business_name || '224Solutions'}`}
        image={images[0]}
        type="product"
        price={product.price}
      />

      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/marketplace')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">{t('productDetail.detailsDuProduit')}</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Images & Video Carousel */}
          <div className="space-y-4">
            <div className="relative h-[600px] rounded-lg overflow-hidden bg-white flex items-center justify-center p-3 border border-border/20">
              {/* Bouton Play/Pause */}
              <button
                onClick={toggleAutoPlay}
                className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors"
              >
                {isAutoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              {isPlayingVideo && videos.length > 0 ? (
                <>
                  <video
                    ref={videoRef}
                    src={videos[currentVideoIndex]}
                    controls
                    autoPlay
                    muted={isVideoMuted}
                    playsInline
                    onClick={() => {
                      if (isVideoMuted) {
                        enableVideoAudio();
                      }
                    }}
                    onLoadedMetadata={syncVideoAudioState}
                    onVolumeChange={(event) => {
                      setIsVideoMuted(event.currentTarget.muted);
                    }}
                    className="max-w-full max-h-full w-auto h-auto object-contain"
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                  />
                  {isVideoMuted && (
                    <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-start">
                      <Button
                        type="button"
                        size="sm"
                        className="pointer-events-auto gap-2 bg-black/75 text-white hover:bg-black/85"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          enableVideoAudio();
                        }}
                      >
                        <Volume2 className="h-4 w-4" />
                        Activer le son
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <img
                  src={images[currentImageIndex]}
                  alt={product.name}
                  className="max-w-full max-h-full w-auto h-auto object-contain"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                />
              )}

              {/* Indicateur de progression */}
              {!isPlayingVideo && images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-1">
                  {images.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        currentImageIndex === idx ? 'bg-primary' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Thumbnails - Videos + Images */}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {/* Video thumbnails */}
              {videos.map((_, index) => (
                <button
                  key={`video-${index}`}
                  onClick={() => handleVideoSelect(index)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors bg-black flex items-center justify-center ${
                    isPlayingVideo && currentVideoIndex === index ? 'border-primary' : 'border-transparent hover:border-primary/50'
                  }`}
                >
                  <Play className="w-6 h-6 text-white" />
                  <span className="absolute bottom-0.5 left-0.5 text-[8px] text-white bg-black/60 px-1 rounded">
                    {index + 1}
                  </span>
                </button>
              ))}

              {/* Image thumbnails */}
              {images.map((img, idx) => (
                <button
                  key={`img-${idx}`}
                  onClick={() => goToImage(idx)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                    !isPlayingVideo && currentImageIndex === idx ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img loading="lazy" src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-2xl font-bold text-foreground">{product.name}</h2>
                {product.status === 'active' && (
                  <Badge variant="default">Disponible</Badge>
                )}
              </div>

              {product.categories && (
                <Badge variant="secondary" className="mb-2">{product.categories.name}</Badge>
              )}

              {product.rating != null && product.rating > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= (product.rating || 0) ? 'fill-[#ff4000] text-[#ff4000]' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({product.reviews_count || 0} avis)
                  </span>
                </div>
              )}

              {(() => {
                const vendorCountry = (() => {
                  const v = product.vendors;
                  if (Array.isArray(v)) return v[0]?.country;
                  return v?.country;
                })();
                const productCurrency = (vendorCountry ? getCurrencyForCountry(vendorCountry) : null) || product.currency || 'GNF';
                return (
                  <LocalPrice
                    amount={product.price}
                    currency={productCurrency}
                    size="xl"
                    className="text-primary mb-4"
                    showOriginal
                  />
                );
              })()}

              {product.description && (
                <p className="text-muted-foreground leading-relaxed">{product.description}</p>
              )}
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-4">
              <span className="font-medium">{t('productDetail.quantite')}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </Button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={product.stock_quantity ? quantity >= product.stock_quantity : false}
                >
                  +
                </Button>
              </div>
              {product.stock_quantity && userId === product.vendor_id && (
                <span className="text-sm text-muted-foreground">
                  ({product.stock_quantity} en stock)
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={handleBuy} className="flex-1">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Acheter
              </Button>
              <Button onClick={handleContact} variant="outline">
                <MessageCircle className="w-4 h-4" />
              </Button>
              <ShareButton
                title={product.name}
                text={`Découvrez ${product.name} - 224 Solutions`}
                url={`${window.location.origin}/product/${product.id}`}
                resourceType="product"
                resourceId={product.id}
                useShortUrl={true}
                ogType="product"
              />
            </div>

            {/* Vendor */}
            {product.vendors && (
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold mb-2">Vendu par</h3>
                    <Link
                      to={`/boutique/${product.vendors.shop_slug || product.vendors.id}`}
                      className="flex items-center justify-between gap-2 group hover:text-primary transition-colors"
                    >
                      <span className="text-foreground group-hover:text-primary truncate flex items-center gap-1.5">
                        {product.vendors.business_name}
                        <VendorCertBadge vendorId={product.vendor_id} />
                      </span>
                      <ExternalLink className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1">{t('productDetail.cliquezPourVoirLaBoutique')}</p>
                  </div>

                  <ShareButton
                    title={product.vendors.business_name}
                    text={`Découvrez la boutique ${product.vendors.business_name} sur 224 Solutions`}
                    url={`${window.location.origin}/boutique/${product.vendors.shop_slug || product.vendors.id}`}
                    variant="outline"
                    size="icon"
                    resourceType="shop"
                    resourceId={product.vendors.id}
                    useShortUrl={true}
                    ogType="shop"
                  />
                </div>
              </Card>
            )}

            {/* Trust badges */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-accent rounded-lg">
                <Shield className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium text-sm">{t('productDetail.paiementSecurise')}</p>
                  <p className="text-xs text-muted-foreground">{t('productDetail.t100Protege')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-accent rounded-lg">
                <Truck className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium text-sm">{t('productDetail.livraisonRapide')}</p>
                  <p className="text-xs text-muted-foreground">Sous 48h</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de paiement */}
      {product && customerId && userId && (() => {
        const vc = (() => { const v = product.vendors; if (Array.isArray(v)) return v[0]?.country; return v?.country; })();
        const pCur = (vc ? getCurrencyForCountry(vc) : null) || product.currency || 'GNF';
        return (
          <ProductPaymentModal
            open={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            cartItems={[{
              id: product.id,
              name: product.name,
              price: product.price,
              vendorId: product.vendor_id,
              quantity: quantity
            }]}
            totalAmount={product.price * quantity}
            onPaymentSuccess={handlePaymentSuccess}
            userId={userId}
            customerId={customerId}
            currency={pCur}
          />
        );
      })()}
    </div>
  );
}
