import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, MessageCircle, Star, Truck, Shield, X, Plus, ExternalLink, Play, Pause, Layers, Package, Volume2 } from "lucide-react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrencyForCountry } from "@/data/countryMappings";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import ProductReviewsSection from "./ProductReviewsSection";
import { ShareButton } from "@/components/shared/ShareButton";
import { useAutoCarousel } from "@/hooks/useAutoCarousel";
import { trackProductView } from "@/services/analyticsTrackingService";
import { useTrackProductView } from "@/hooks/useProductRecommendations";
import { LocalPrice } from "@/components/ui/LocalPrice";
import { useTranslation } from "@/hooks/useTranslation";
interface Product {
  id: string;
  name: string;
  price: number;
  currency?: string; // Devise du produit
  product_type?: string;
  description?: string;
  images?: string[];
  promotional_videos?: string[];
  vendor_id: string;
  category_id?: string;
  is_active: boolean;
  vendors?: {
    business_name: string;
    user_id: string;
    shop_slug?: string;
    country?: string;
  };
  // ✅ Champs pour les produits d'affiliation
  is_affiliate?: boolean;
  affiliate_url?: string;
  product_mode?: string;
}

interface ProductDetailModalProps {
  productId: string | null;
  open: boolean;
  onClose: () => void;
}

export default function ProductDetailModal({ productId, open, onClose }: ProductDetailModalProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [pendingAudioActivation, setPendingAudioActivation] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { t } = useTranslation();
  const hasTrackedView = useRef(false);
  const lastTrackedProductId = useRef<string | null>(null);
  const isAffiliateProduct = product?.is_affiliate === true;
  const isAffiliateFlightTicket =
    isAffiliateProduct &&
    (product.product_type || '').trim().toLowerCase() === 'billet_avion';

  // 🧠 Track pour recommandations intelligentes
  useTrackProductView(open && productId ? productId : null);



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
    imageDisplayDuration: 3000,
    enabled: open
  });

  useEffect(() => {
    if (productId && open) {
      loadProduct();
    }
    // Reset tracking when modal closes or product changes
    if (!open) {
      hasTrackedView.current = false;
      setIsVideoMuted(true);
      setPendingAudioActivation(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, open]);

  useEffect(() => {
    setIsVideoMuted(true);
    setPendingAudioActivation(false);
  }, [productId]);

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
          // Le navigateur peut bloquer la lecture sonore si la vidéo vient juste d'être montée.
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
            // Le navigateur peut encore imposer une interaction supplémentaire selon le contexte.
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

  // Tracker la vue du produit une seule fois par produit
  useEffect(() => {
    if (product && product.vendor_id && open && lastTrackedProductId.current !== product.id) {
      lastTrackedProductId.current = product.id;
      trackProductView(product.id, product.vendor_id);
    }
  }, [product, open]);

  const loadProduct = async () => {
    if (!productId) return;

    setLoading(true);
    try {
      // 1) Produits physiques (products)
      const { data: physicalProduct, error: physicalError } = await supabase
        .from("products")
        .select(
          `
          id,
          name,
          price,
          currency,
          original_price_currency,
          seller_currency,
          description,
          images,
          promotional_videos,
          vendor_id,
          category_id,
          is_active,
          vendors (
            business_name,
            user_id,
            shop_slug,
            shop_currency,
            country,
            average_delivery_days
          )
        `
        )
        .eq("id", productId)
        .maybeSingle();

      if (physicalError) throw physicalError;
      if (physicalProduct) {
        const vendor = Array.isArray((physicalProduct as any).vendors)
          ? (physicalProduct as any).vendors?.[0]
          : (physicalProduct as any).vendors;

        // PRIX EN DEVISE DU VENDEUR : un vendeur en CFA/EUR price ses produits dans SA devise.
        // Devise du prix = original_price_currency / seller_currency (produit), sinon shop_currency
        // (vendeur), sinon devise du produit, sinon déduite du pays, sinon GNF. C'est la MÊME source
        // que le paiement (getSellerCurrency). <Money>/LocalPrice convertit ensuite vers la devise
        // d'affichage de l'acheteur (ex. 50 000 CFA → 74,76 € pour un acheteur EUR).
        // DEVISE = PAYS DU VENDEUR (source fiable) : Guinée→GNF, Sénégal→XOF. PAS shop_currency
        // (parfois faux, ex. Fusion=EUR) NI le champ produit (toujours GNF). <Money> convertit
        // ensuite vers la devise de l'acheteur au taux EXACT BCRG.
        const derivedCurrency = getCurrencyForCountry(vendor?.country || '');
        setProduct({ ...physicalProduct, vendors: vendor, currency: derivedCurrency });
        return;
      }

      // 2) Ancien flux "service_products" (legacy)
      const { data: serviceProduct, error: serviceError } = await supabase
        .from("service_products")
        .select(
          `
          id,
          name,
          price,
          description,
          images,
          professional_service_id,
          professional_services (
            business_name,
            user_id,
            status
          )
        `
        )
        .eq("id", productId)
        .maybeSingle();

      if (serviceError) throw serviceError;

      if (serviceProduct) {
        const proService = serviceProduct.professional_services as any;

        // Ne pas afficher si le service n'est plus actif
        if (!proService || proService.status !== "active") {
          throw new Error("Produit introuvable");
        }

        setProduct({
          id: serviceProduct.id,
          name: serviceProduct.name,
          price: serviceProduct.price,
          description: serviceProduct.description,
          images: Array.isArray(serviceProduct.images) ? (serviceProduct.images as string[]) : [],
          promotional_videos: [],
          vendor_id: serviceProduct.professional_service_id,
          category_id: undefined,
          is_active: true,
          vendors: {
            business_name: proService.business_name || "Vendeur",
            user_id: proService.user_id,
            shop_slug: undefined,
          },
        });
        return;
      }

      // 3) Produits numériques (digital_products) ✅
      const { data: digitalProduct, error: digitalError } = await supabase
        .from("digital_products")
        .select(
          `
          id,
          title,
          price,
          currency,
          product_type,
          description,
          images,
          video_url,
          status,
          vendor_id,
          merchant_id,
          product_mode,
          affiliate_url,
          vendors:vendors!digital_products_vendor_id_fkey (
            business_name,
            user_id,
            shop_slug,
            country
          )
        `
        )
        .eq("id", productId)
        .maybeSingle();

      if (digitalError) throw digitalError;

      if (digitalProduct) {
        if (digitalProduct.status !== "published") {
          throw new Error("Produit introuvable");
        }

        const vRaw = (digitalProduct.vendors as any) || null;
        const v = Array.isArray(vRaw) ? vRaw?.[0] : vRaw;

        // Digital : devise explicite du produit, sinon devise déduite du pays du vendeur, sinon GNF.
        const vendorCountry = v?.country || '';
        const derivedCurrency = digitalProduct.currency || (vendorCountry ? getCurrencyForCountry(vendorCountry) : 'GNF');

        setProduct({
          id: digitalProduct.id,
          name: digitalProduct.title,
          price: digitalProduct.price || 0,
          currency: derivedCurrency, // Devise du produit
          product_type: digitalProduct.product_type || undefined,
          description: digitalProduct.description || undefined,
          images: Array.isArray(digitalProduct.images) ? (digitalProduct.images as string[]) : [],
          promotional_videos: digitalProduct.video_url ? [digitalProduct.video_url] : [],
          vendor_id: digitalProduct.vendor_id || digitalProduct.merchant_id,
          category_id: undefined,
          is_active: true,
          vendors: {
            business_name: v?.business_name || "Vendeur",
            user_id: v?.user_id || digitalProduct.merchant_id,
            shop_slug: v?.shop_slug || undefined,
            country: v?.country || undefined,
          },
          // ✅ Champs affiliation
          is_affiliate: digitalProduct.product_mode === "affiliate",
          affiliate_url: digitalProduct.affiliate_url || undefined,
          product_mode: digitalProduct.product_mode || undefined,
        });
        return;
      }

      throw new Error("Produit introuvable");
    } catch (error) {
      console.error("Erreur chargement produit:", error);
      toast.error(t('marketplace.cannotLoadProduct'));
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!product) return;

    // ✅ Si c'est un produit d'affiliation, rediriger vers le fournisseur
    if (product.is_affiliate && product.affiliate_url) {
      toast.success(t('marketplace.redirectingToSupplier'), {
        description: t('marketplace.redirectingToSupplierDesc'),
        duration: 2000,
      });

      // Ouvrir dans un nouvel onglet après un court délai
      setTimeout(() => {
        window.open(product.affiliate_url, "_blank", "noopener,noreferrer");
      }, 500);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error(t('marketplace.loginToBuy'));
        navigate('/auth');
        return;
      }

      const totalAmount = product.price * quantity;

      // Déterminer si c'est un produit numérique (product_mode existe = digital_products)
      const isDigital = !!product.product_mode;

      toast.success(t('marketplace.redirectingToPayment'));
      navigate(`/payment`, {
        state: {
          productId: product.id,
          productName: product.name,
          amount: totalAmount,
          currency: (product as any).currency || 'GNF',
          quantity,
          vendorId: product.vendor_id,
          productType: isDigital ? 'digital' : 'physical'
        }
      });
    } catch (error) {
      console.error('Erreur lors de l\'achat:', error);
      toast.error(t('marketplace.paymentCreationError'));
    }
  };

  const handleAddToCart = () => {
    if (!product) return;

    if (product.product_mode) {
      toast.info(t('marketplace.digitalBuyDirectly'));
      return;
    }

    // Pour les produits affiliés, ne pas ajouter au panier mais informer l'utilisateur
    if (product.is_affiliate && product.affiliate_url) {
      toast.info(t('marketplace.partnerProductInfo'));
      return;
    }

    for (let i = 0; i < quantity; i++) {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.images?.[0],
        vendor_id: product.vendor_id,
        vendor_name: product.vendors?.business_name,
        currency: product.currency || 'GNF',
        // Inclure les infos d'affiliation pour la gestion dans le panier
        item_type: product.product_mode === 'affiliate' ? 'digital_product' : undefined,
        product_mode: product.product_mode as 'direct' | 'affiliate' | undefined,
        affiliate_url: product.affiliate_url
      });
    }

    toast.success(`${quantity} produit(s) ajouté(s) au panier`);
    onClose();
  };

  const handleContact = async () => {
    if (!product?.vendors?.user_id) {
      toast.error(t('marketplace.vendorInfoUnavailable'));
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error(t('marketplace.loginToContactSeller'));
        navigate('/auth');
        return;
      }

      // Vérifier que l'utilisateur a un profil, sinon le créer
      const { data: senderProfile, error: _profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!senderProfile) {
        // Créer le profil automatiquement
        const { error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilisateur'
          });

        if (createError) {
          console.error('Erreur création profil:', createError);
          toast.error(t('marketplace.profileConfigError'));
          return;
        }
      }

      // Vérifier que le vendeur a un profil, sinon le créer automatiquement
      // eslint-disable-next-line prefer-const
      let { data: recipientProfile, error: _recipientError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', product.vendors.user_id)
        .maybeSingle();

      if (!recipientProfile) {
        console.log('Profil vendeur non trouvé, création automatique pour:', product.vendors.user_id);

        // ✅ Utiliser les infos du vendeur disponibles (pas besoin d'appel admin)
        const vendorName = product.vendors.business_name || 'Vendeur';
        // Générer un email placeholder basé sur l'ID vendeur (sera mis à jour plus tard)
        const vendorEmail = `vendeur_${product.vendors.user_id.slice(0, 8)}@224solution.net`;

        const { data: createdProfile, error: createVendorError } = await supabase
          .from('profiles')
          .insert({
            id: product.vendors.user_id,
            email: vendorEmail,
            full_name: vendorName
          })
          .select('id, full_name')
          .single();

        if (createVendorError) {
          console.error('Erreur création profil vendeur:', createVendorError);
          // Si erreur de conflit (profil existe déjà), réessayer de récupérer
          if (createVendorError.code === '23505') {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('id, full_name')
              .eq('id', product.vendors.user_id)
              .maybeSingle();
            recipientProfile = existingProfile;
          } else {
            // ✅ Continuer quand même - le message peut fonctionner sans profil vendeur complet
            console.warn('Profil vendeur non créé, mais on continue avec le message');
          }
        } else {
          recipientProfile = createdProfile;
        }
      }

      // Créer un message initial
      const initialMessage = `Bonjour, je suis intéressé par votre produit "${product.name}". Pouvez-vous me donner plus d'informations ?`;

      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: product.vendors.user_id,
          content: initialMessage,
          type: 'text'
        });

      if (messageError) {
        console.error('Erreur création message:', messageError);
        throw messageError;
      }

      toast.success(t('marketplace.messageSentToSeller'));

      // Rediriger vers la page de messagerie
      setTimeout(() => {
        onClose();
        navigate(`/messages?recipientId=${product.vendors.user_id}`);
      }, 1000);

    } catch (error) {
      console.error('Erreur lors du contact:', error);
      toast.error(t('marketplace.cannotContactSeller'));
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">{t('marketplace.loadingProduct')}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
        <ScrollArea className="h-[85vh] px-4 md:px-6">
        <DialogHeader>
          <DialogTitle className="text-xl md:text-2xl font-bold break-words pr-6">{product.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="details">{t('marketplace.productDetails')}</TabsTrigger>
            <TabsTrigger value="reviews">Avis clients</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid md:grid-cols-2 gap-6">
          {/* Images & Video Carousel */}
          <div className="space-y-4">
            <div className="relative h-[600px] rounded-lg overflow-hidden bg-white flex items-center justify-center p-3 border border-border/20">

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
                    <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-end">
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
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              {/* Video thumbnails */}
              {videos.map((_, index) => (
                <button
                  key={`video-${index}`}
                  onClick={() => handleVideoSelect(index)}
                  className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all bg-black flex items-center justify-center ${
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
              {images.map((img, index) => (
                <button
                  key={`img-${index}`}
                  onClick={() => goToImage(index)}
                  className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${
                    !isPlayingVideo && currentImageIndex === index ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img loading="lazy" src={img} alt={`${product.name} ${index + 1}`} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>

            {/* Boutons Produits similaires / Autres produits */}
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => {
                  onClose();
                  navigate(`/marketplace/similar/${productId}`);
                }}
              >
                <Layers className="w-4 h-4" />
                {t('marketplace.similarProducts') || 'Produits similaires'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => {
                  onClose();
                  navigate(`/marketplace/others/${productId}`);
                }}
              >
                <Package className="w-4 h-4" />
                {t('marketplace.otherProducts') || 'Autres produits'}
              </Button>
            </div>
          </div>

          {/* Détails */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <LocalPrice
                  amount={product.price}
                  currency={product.currency || 'GNF'}
                  size="xl"
                  showOriginal={true}
                  className="text-primary"
                />
                {isAffiliateProduct ? (
                  <Badge className={isAffiliateFlightTicket ? 'bg-orange-500 hover:bg-orange-600 text-white border-0' : 'bg-[#ff4000] text-white border-0'}>
                    <ExternalLink className="w-3 h-3 mr-1" />
                    {isAffiliateFlightTicket ? 'Partenaire' : 'Affiliation'}
                  </Badge>
                ) : (
                  <Badge variant="secondary">En stock</Badge>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground min-w-0">
                  Vendu par{" "}
                  {product.vendors?.business_name ? (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onClose();
                        navigate(`/boutique/${product.vendors?.shop_slug || product.vendor_id}`);
                      }}
                      className="font-medium text-foreground hover:text-primary inline-flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                    >
                      <span className="truncate">{product.vendors.business_name}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  ) : (
                    <span className="font-medium text-foreground">{t('marketplace.seller')}</span>
                  )}
                </p>

                <ShareButton
                  title={product.vendors?.business_name || "Boutique"}
                  text={`Découvrez la boutique ${product.vendors?.business_name || ""} sur 224 Solutions`}
                  url={`${window.location.origin}/boutique/${product.vendors?.shop_slug || product.vendor_id}`}
                  variant="outline"
                  size="icon"
                  useShortUrl={true}
                  resourceType="shop"
                  resourceId={product.vendor_id}
                  ogType="shop"
                />
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words overflow-hidden">
                {product.description || 'Aucune description disponible'}
              </p>
            </div>

            <Separator />

            {/* Quantité - masquer pour les affiliations */}
            {!isAffiliateProduct && (
              <div>
                <label className="text-sm font-medium mb-2 block">{t('marketplace.quantity')}</label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    -
                  </Button>
                  <span className="text-lg font-semibold w-12 text-center">{quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
            )}

            {!isAffiliateProduct && <Separator />}

            {/* Total - masquer pour les affiliations */}
            {!isAffiliateProduct && (
              <div className="bg-accent p-4 rounded-lg">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span className="text-accent-foreground">Total</span>
                  <LocalPrice
                    amount={product.price * quantity}
                    currency={product.currency || 'GNF'}
                    size="lg"
                    className="text-accent-foreground"
                  />
                </div>
              </div>
            )}

            {/* Notice affiliation */}
            {isAffiliateProduct && (
              <div
                className={isAffiliateFlightTicket
                  ? 'bg-[#ff4000]/5 p-4 rounded-lg border border-orange-200 dark:border-orange-800'
                  : 'bg-blue-50 p-4 rounded-lg border border-blue-200 dark:border-[#04439e]'
                }
              >
                <div className="flex items-start gap-3">
                  <div className={isAffiliateFlightTicket ? 'p-2 bg-orange-100 dark:bg-orange-900 rounded-full' : 'p-2 bg-blue-100 dark:bg-[#04439e] rounded-full'}>
                    <ExternalLink className={isAffiliateFlightTicket ? 'w-5 h-5 text-orange-600 dark:text-orange-400' : 'w-5 h-5 text-[#04439e] dark:text-[#04439e]'} />
                  </div>
                  <div>
                    <h4 className={isAffiliateFlightTicket ? 'font-semibold text-orange-900 dark:text-orange-100' : 'font-semibold text-[#04439e] dark:text-blue-100'}>
                      {isAffiliateFlightTicket ? 'Réservation partenaire' : 'Produit partenaire'}
                    </h4>
                    <p className={isAffiliateFlightTicket ? 'text-sm text-orange-700 dark:text-orange-300 mt-1' : 'text-sm text-[#04439e] dark:text-blue-300 mt-1'}>
                      {isAffiliateFlightTicket
                        ? 'Réservez votre vol en toute sécurité via notre partenaire. En cliquant sur "Réserver votre vol", vous serez redirigé vers sa plateforme pour consulter les disponibilités et finaliser votre réservation.'
                        : 'En cliquant sur "Acheter", vous serez redirigé vers le site du fournisseur pour finaliser votre achat en toute sécurité.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <Button
                className={`w-full ${isAffiliateProduct ? (isAffiliateFlightTicket ? '!bg-orange-500 hover:!bg-orange-600 !text-white !shadow-lg !shadow-orange-500/30 hover:!shadow-orange-500/40' : 'bg-[#ff4000] hover:bg-[#ce3d11]') : ''}`}
                onClick={handleBuy}
              >
                {isAffiliateProduct ? (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {isAffiliateFlightTicket ? 'Réserver votre vol' : 'Acheter chez le partenaire'}
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Acheter maintenant
                  </>
                )}
              </Button>
              {!isAffiliateProduct && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleAddToCart}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter au panier ({quantity})
                </Button>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleContact}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Contacter
                </Button>
                  <ShareButton
                    title={product.name}
                    text={`${t('marketplace.discover') || 'Découvrez'} ${product.name} - 224 Solutions`}
                    url={`${window.location.origin}/product/${product.id}`}
                    variant="outline"
                    size="icon"
                    resourceType="product"
                    resourceId={product.id}
                    useShortUrl={true}
                    ogType="product"
                    imageUrl={product.images?.[0]}
                    description={product.description}
                    price={product.price}
                    currency={product.currency || 'GNF'}
                  />
              </div>
            </div>


            {/* Garanties */}
            <div className="space-y-2 pt-4 pb-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>{isAffiliateProduct ? 'Achat sécurisé chez le partenaire' : 'Paiement sécurisé'}</span>
              </div>
              {!isAffiliateProduct && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Truck className="w-4 h-4" />
                  <span>
                    {(product?.vendors as any)?.average_delivery_days
                      ? `Livraison estimée : ${(product.vendors as any).average_delivery_days} jour${(product.vendors as any).average_delivery_days > 1 ? 's' : ''} ouvrable${(product.vendors as any).average_delivery_days > 1 ? 's' : ''}`
                      : 'Livraison disponible'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="reviews">
        <ProductReviewsSection
          productId={product.id}
          productName={product.name}
        />
      </TabsContent>
        </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
