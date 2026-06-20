/**
 * Page de détail d'un produit numérique
 */

import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, ExternalLink, Eye, MessageCircle, PlayCircle, RefreshCw, Shield, ShoppingCart, Star, Store, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShareButton } from "@/components/shared/ShareButton";
import { LocalPrice } from "@/components/ui/LocalPrice";
import ProductAffiliateBox from "@/components/marketplace/ProductAffiliateBox";
import { useAuth } from "@/hooks/useAuth";
import { addRecentProduct } from "@/lib/recentProductHistory";

interface DigitalProductWithVendor {
  id: string;
  merchant_id: string;
  vendor_id: string | null;
  title: string;
  description: string | null;
  short_description: string | null;
  images: string[];
  video_url?: string | null;
  category: string;
  product_mode: string;
  price: number;
  original_price: number | null;
  commission_rate: number;
  currency: string;
  affiliate_url: string | null;
  affiliate_platform: string | null;
  file_urls: string[];
  file_type: string | null;
  tags: string[];
  status: string;
  views_count: number;
  sales_count: number;
  rating: number;
  reviews_count: number;
  created_at: string;
  metadata?: {
    training?: {
      instructorName?: string;
      level?: string;
      estimatedHours?: number | null;
      targetAudience?: string;
      learningGoals?: string[];
      lessons?: Array<{ order?: number; title?: string; durationMinutes?: number }>;
      videoMaxMinutes?: number;
    };
  } | null;
  pricing_type?: string | null;
  subscription_interval?: string | null;
  access_duration?: string | null;
  vendors?: {
    id: string;
    user_id?: string;
    business_name: string;
    shop_slug?: string;
    logo_url?: string;
  };
}

export default function DigitalProductDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<DigitalProductWithVendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { user } = useAuth();

  // Utiliser l'ID depuis les params ou depuis le query string
  const productId = id || searchParams.get('id');

  // Vérifier si l'utilisateur actuel est le vendeur du produit
  const isVendorOwner = user?.id && product?.merchant_id === user.id;

  useEffect(() => {
    if (productId) {
      loadProduct();
      incrementViews();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    if (!product) return;
    addRecentProduct(
      {
        id: product.id,
        type: 'digital',
        title: product.title,
        price: product.price,
        currency: product.currency || 'GNF',
        imageUrl: product.images?.[0],
        vendorName: product.vendors?.business_name,
        route: `/digital-product/${product.id}`,
      },
      user?.id || null
    );
  }, [product, user?.id]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('digital_products')
        .select(`
          *,
          vendors:vendor_id(id, user_id, business_name, shop_slug, logo_url)
        `)
        .eq('id', productId)
        .maybeSingle();

      if (error) throw error;
      setProduct(data as DigitalProductWithVendor);
    } catch (error) {
      console.error('Erreur chargement produit:', error);
      toast.error(t('digitalProductDetail.impossibleDeChargerLeProduit'));
    } finally {
      setLoading(false);
    }
  };

  const incrementViews = async () => {
    if (!productId) return;

    const viewKey = `digital_product_view_${productId}`;
    const hasViewed = sessionStorage.getItem(viewKey);

    if (hasViewed) return;

    try {
      // Use RPC function to bypass RLS
      const { error } = await supabase.rpc('increment_digital_product_views', {
        p_product_id: productId
      });

      if (!error) {
        sessionStorage.setItem(viewKey, 'true');
      }
    } catch (error) {
      console.error('Erreur incrémentation vues:', error);
    }
  };

  // formatPrice conservé pour les cas simples sans conversion
  const _formatPriceSimple = (price: number, currency: string = 'GNF') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0
    }).format(price);
  };

  const handleBuy = async () => {
    if (!product) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t('digitalProductDetail.veuillezVousConnecterPourAcheter'));
      navigate('/auth');
      return;
    }

    // Pour les produits affiliés, rediriger vers le lien
    if (product.product_mode === 'affiliate' && product.affiliate_url) {
      window.open(product.affiliate_url, '_blank');
      return;
    }

    if (product.price <= 0) {
      const { error: purchaseError } = await supabase
        .from('digital_product_purchases')
        .insert({
          product_id: product.id,
          buyer_id: user.id,
          merchant_id: product.merchant_id,
          amount: 0,
          payment_status: 'completed',
          access_granted: true,
          download_count: 0,
          max_downloads: 10,
          access_expires_at: null,
        });

      if (purchaseError && !purchaseError.message?.toLowerCase().includes('duplicate')) {
        console.error('Erreur attribution acces gratuit:', purchaseError);
        toast.error(t('digitalProductDetail.impossibleDAccorderLAcces'));
        return;
      }

      toast.success('Acces gratuit active');
      navigate(`/digital-purchase/${product.id}`);
      return;
    }

    // Naviguer vers la page de paiement avec les infos du produit digital
    toast.success(t('digitalProductDetail.redirectionVersLePaiement'));
    navigate('/payment', {
      state: {
        productId: product.id,
        productName: product.title,
        amount: product.price,
        quantity: 1,
        vendorId: product.vendor_id || product.merchant_id,
        productType: 'digital'
      }
    });
  };

  const handleContact = async () => {
    const recipientUserId = product?.vendors?.user_id || product?.merchant_id;

    if (!recipientUserId) {
      toast.error(t('digitalProductDetail.informationsDuVendeurNonDisponibles'));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t('digitalProductDetail.veuillezVousConnecterPourContacter'));
      navigate('/auth');
      return;
    }

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: recipientUserId,
          content: `Bonjour, je suis intéressé par votre produit numérique "${product.title}".`,
          type: 'text'
        });

      if (error) throw error;
      toast.success(t('digitalProductDetail.messageEnvoyeAuVendeur'));
      navigate(`/messages?recipientId=${recipientUserId}`);
    } catch (error) {
      console.error('Erreur envoi message:', error);
      toast.error(t('digitalProductDetail.erreurLorsDeLEnvoi'));
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
          <h2 className="text-xl font-bold mb-4">{t('digitalProductDetail.produitIntrouvable')}</h2>
          <p className="text-muted-foreground mb-6">{t('digitalProductDetail.ceProduitNumeriqueNExiste')}</p>
          <Button onClick={() => navigate('/digital-products')}>{t('digitalProductDetail.retourAuxProduitsNumeriques')}</Button>
        </Card>
      </div>
    );
  }

  const images = product.images && product.images.length > 0
    ? product.images
    : [];
  const mediaItems: Array<{ type: 'video' | 'image'; src: string }> = [
    ...(product.video_url ? [{ type: 'video' as const, src: product.video_url }] : []),
    ...(images.length > 0 ? images.map((src) => ({ type: 'image' as const, src })) : [{ type: 'image' as const, src: '/placeholder.svg' }]),
  ];
  const currentMedia = mediaItems[currentImageIndex] || mediaItems[0];

  const vendor = product.vendors;
  const training = product.metadata?.training;
  const learningGoals = Array.isArray(training?.learningGoals) ? training.learningGoals.filter(Boolean) : [];
  const curriculum = Array.isArray(training?.lessons) ? training.lessons.filter((lesson) => lesson?.title) : [];
  const trainingTotalMinutes = curriculum.reduce((sum, lesson) => sum + (lesson.durationMinutes || 0), 0);
  const intervalLabel = product.subscription_interval === 'yearly'
    ? 'par an'
    : product.subscription_interval === 'lifetime'
      ? 'a vie'
      : 'par mois';
  const subscriptionLabel = product.subscription_interval === 'yearly'
    ? 'annuel'
    : product.subscription_interval === 'lifetime'
      ? 'a vie'
      : 'mensuel';
  const accessLabelMap: Record<string, string> = {
    lifetime: 'Accès à vie',
    '1_year': 'Accès 1 an',
    '6_months': 'Accès 6 mois',
    '3_months': 'Accès 3 mois',
    '1_month': 'Accès 1 mois',
  };
  const accessLabel = product.pricing_type === 'subscription'
    ? `Facturation ${intervalLabel}`
    : accessLabelMap[product.access_duration || 'lifetime'] || 'Accès immédiat';
  const ctaLabel = product.product_mode === 'affiliate'
    ? "Voir l'offre"
    : product.price > 0
      ? product.pricing_type === 'subscription'
        ? `S'abonner (${subscriptionLabel})`
        : 'Acheter maintenant'
      : 'Accéder gratuitement';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(4,67,158,0.08),transparent_32%),linear-gradient(180deg,#f7fbff_0%,#eef4ff_42%,#f9fbff_100%)] pb-32 md:pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1">{t('digitalProductDetail.produitNumerique')}</h1>
          <ShareButton
            title={product.title}
            text={`Découvrez ${product.title} sur 224 Solutions`}
            url={`${window.location.origin}/digital-product/${product.id}`}
            resourceType="digital_product"
            resourceId={product.id}
            useShortUrl={true}
            ogType="digital_product"
          />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_420px] lg:items-start">
          {/* Images */}
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              {currentMedia?.type === 'video' ? (
                <video
                  src={currentMedia.src}
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                  preload="metadata"
                  poster={images[0] || '/placeholder.svg'}
                />
              ) : (
                <img
                  src={currentMedia?.src || '/placeholder.svg'}
                  alt={product.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
              )}

              {/* Badges */}
              <div className="absolute left-3 top-3 flex max-w-[85%] flex-wrap gap-2">
                <Badge className="border-0 bg-slate-950/85 text-white backdrop-blur">
                  {product.category}
                </Badge>
                {training?.level && (
                  <Badge variant="secondary" className="bg-white/90 text-slate-800">
                    Niveau {training.level}
                  </Badge>
                )}
                {product.product_mode === 'affiliate' && (
                  <Badge variant="secondary" className="bg-white/90 text-slate-800">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Affiliation
                  </Badge>
                )}
              </div>

              {curriculum.length > 0 && (
                <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/50 bg-slate-950/70 p-4 text-white backdrop-blur">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-semibold">Programme structure</p>
                      <p className="text-white/75">
                        {curriculum.length} module{curriculum.length > 1 ? 's' : ''}
                        {trainingTotalMinutes > 0 ? ` à ${Math.ceil(trainingTotalMinutes / 60)}h de contenu` : ''}
                      </p>
                    </div>
                    <PlayCircle className="h-10 w-10 text-white/90" />
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {mediaItems.length > 1 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {mediaItems.map((media, idx) => (
                  <button
                    key={`${media.type}-${idx}`}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`aspect-square overflow-hidden rounded-2xl border-2 transition-colors ${
                      currentImageIndex === idx ? 'border-primary' : 'border-transparent hover:border-primary/50'
                    }`}
                  >
                    {media.type === 'video' ? (
                      <div className="relative h-full w-full bg-slate-950">
                        <video
                          src={media.src}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                          poster={images[0] || '/placeholder.svg'}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/25">
                          <PlayCircle className="h-8 w-8 text-white drop-shadow" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={media.src}
                        alt={`${product.title} ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-5">
            <Card className="overflow-hidden border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="space-y-5 p-5 sm:p-7">
                <div className="flex flex-wrap items-center gap-2">
                  {product.product_mode !== 'affiliate' && product.pricing_type && (
                    product.pricing_type === 'subscription' ? (
                      <Badge className="border-primary/20 bg-primary/10 text-primary">
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Abonnement {subscriptionLabel}
                      </Badge>
                    ) : product.pricing_type === 'pay_what_you_want' ? (
                      <Badge variant="secondary">Prix libre</Badge>
                    ) : (
                      <Badge variant="outline" className="border-[#ff4000]/20 bg-[#ff4000]/10 text-[#ff4000]">
                        Achat unique
                      </Badge>
                    )
                  )}
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                    {accessLabel}
                  </Badge>
                  {product.product_mode === 'affiliate' && product.commission_rate > 0 && (
                    <Badge variant="outline">Commission {product.commission_rate}%</Badge>
                  )}
                </div>

                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{product.title}</h2>

                  {product.short_description && (
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{product.short_description}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Acces</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{accessLabel}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Format</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{product.category}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Programme</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {curriculum.length > 0 ? `${curriculum.length} cours` : 'Acces immediat'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Auteur</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">{training?.instructorName || vendor?.business_name || 'Equipe'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  {product.price > 0 ? (
                    <>
                      <LocalPrice
                        amount={product.price}
                        currency={product.currency || 'GNF'}
                        size="xl"
                        showOriginal={true}
                        className="text-primary"
                      />
                      {product.original_price && product.original_price > product.price && (
                        <LocalPrice
                          amount={product.original_price}
                          currency={product.currency || 'GNF'}
                          size="md"
                          className="text-muted-foreground line-through"
                        />
                      )}
                      {product.pricing_type === 'subscription' && (
                        <span className="pb-1 text-sm text-muted-foreground">{intervalLabel}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-3xl font-bold text-[#ff4000]">Gratuit</span>
                  )}
                </div>

                <div className="grid gap-3 rounded-3xl border border-slate-100 bg-slate-50/80 p-4 sm:grid-cols-3">
                  <div className="flex items-center gap-3">
                    <Shield className="h-9 w-9 rounded-2xl bg-white p-2 text-primary shadow-sm" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{t('digitalProductDetail.paiementSecurise')}</p>
                      <p className="text-xs text-slate-500">{t('digitalProductDetail.transactionEtAccesProteges')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Download className="h-9 w-9 rounded-2xl bg-white p-2 text-primary shadow-sm" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Activation rapide</p>
                      <p className="text-xs text-slate-500">{t('digitalProductDetail.debloqueJusteApresPaiement')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock3 className="h-9 w-9 rounded-2xl bg-white p-2 text-primary shadow-sm" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Videos longues</p>
                      <p className="text-xs text-slate-500">{t('digitalProductDetail.jusquA1hParVideo')}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleBuy} className="h-12 flex-1 rounded-2xl text-base" size="lg">
                    {product.product_mode === 'affiliate' ? (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {ctaLabel}
                      </>
                    ) : product.price > 0 ? (
                      <>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {ctaLabel}
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        {ctaLabel}
                      </>
                    )}
                  </Button>
                  <Button onClick={handleContact} variant="outline" size="lg" className="h-12 rounded-2xl px-4">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>

                {product.product_mode !== 'affiliate' && product.id && (
                  <div className="mt-4">
                    <ProductAffiliateBox productId={product.id} />
                  </div>
                )}
              </div>
            </Card>

            {/* Description */}
            {product.description && (
              <Card className="rounded-[28px] border-white/70 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.06)] sm:p-6">
                <h3 className="mb-3 text-lg font-semibold">Description</h3>
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground sm:text-base">{product.description}</p>
              </Card>
            )}

            {(training || curriculum.length > 0) && (
              <Card className="rounded-[28px] border-white/70 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.06)] sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{t('digitalProductDetail.experienceDeFormation')}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Concue pour vendre comme un programme premium avec transformation claire, acces mobile et progression guidee.
                    </p>
                  </div>
                  {training?.estimatedHours ? (
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                      {training.estimatedHours}h estimees
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Formateur</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{training?.instructorName || vendor?.business_name || 'Equipe formation'}</p>
                    {training?.targetAudience && (
                      <p className="mt-3 text-sm leading-6 text-slate-600">Pour {training.targetAudience}</p>
                    )}
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ce que l'acheteur obtient</p>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />
                        Acces mobile et ordinateur
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />
                        Contenu long format jusqu'a 60 min par video
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />
                        Parcours concu pour la conversion et la retention
                      </div>
                    </div>
                  </div>
                </div>

                {learningGoals.length > 0 && (
                  <div className="mt-5">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Objectifs d'apprentissage</h4>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {learningGoals.map((goal, index) => (
                        <div key={`${goal}-${index}`} className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-4">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <p className="text-sm leading-6 text-slate-700">{goal}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {curriculum.length > 0 && (
                  <div className="mt-5">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Programme</h4>
                    <div className="mt-3 space-y-3">
                      {curriculum.map((lesson, index) => (
                        <div key={`${lesson.title}-${index}`} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">
                              {(lesson.order || index + 1).toString().padStart(2, '0')} à {lesson.title}
                            </p>
                          </div>
                          {lesson.durationMinutes ? (
                            <Badge variant="secondary" className="shrink-0 bg-slate-100 text-slate-700">
                              {lesson.durationMinutes} min
                            </Badge>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <Card className="rounded-[28px] border-white/70 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.06)] sm:p-6">
                <h3 className="mb-3 font-semibold">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </Card>
            )}

            {/* Vendor */}
            {vendor && (
              <Card className="rounded-[28px] border-white/70 bg-white/90 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.06)] sm:p-5">
                <h3 className="font-semibold mb-3">Vendu par</h3>
                <div className="flex items-center justify-between gap-3">
                  <Link
                    to={`/boutique/${vendor.shop_slug || vendor.id}`}
                    className="flex items-center gap-3 group hover:text-primary transition-colors flex-1"
                  >
                    {vendor.logo_url ? (
                      <img
                        src={vendor.logo_url}
                        alt={vendor.business_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Store className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <span className="font-medium group-hover:text-primary">
                        {vendor.business_name}
                      </span>
                      <p className="text-xs text-muted-foreground">{t('digitalProductDetail.cliquezPourVoirLaBoutique')}</p>
                    </div>
                  </Link>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </div>
              </Card>
            )}

            {isVendorOwner && (
              <Card className="rounded-[28px] border-white/70 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
                <h3 className="font-semibold text-foreground">Performance</h3>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span>{product.views_count || 0} vues</span>
                  </div>
                  {product.rating > 0 && (
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 fill-[#ff4000] text-[#ff4000]" />
                      <span>{product.rating.toFixed(1)} / 5</span>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/70 bg-white/95 px-4 py-3 shadow-[0_-20px_40px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{product.title}</p>
            <p className="text-xs text-slate-500">{product.price > 0 ? accessLabel : 'Acces gratuit immediat'}</p>
          </div>
          <Button onClick={handleBuy} className="rounded-2xl px-5">
            {ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
