import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Clock,
  Star,
  Mail,
  Share2,
  Heart,
  MessageSquare,
  Calendar,
  Navigation,
  UtensilsCrossed,
  Flame,
  Settings,
  Camera,
  ImagePlus,
  Trash2,
  LocateFixed,
  PhoneCall,
  Images,
} from "lucide-react";
import { ServiceMediaManager } from "@/components/professional-services/ServiceMediaManager";
import { useStorageUpload } from "@/hooks/useStorageUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useGeoDistance, formatDistance } from "@/hooks/useGeoDistance";
import { ReservationModal } from "@/components/restaurant/ReservationModal";
import { tryNativeShare } from "@/utils/nativeShare";

interface ServiceDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  service_type_code?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  rating: number;
  reviews_count: number;
  is_open: boolean | null; // null = unknown
  image_url?: string;
  opening_hours?: OpeningHours;
  latitude?: number | null;
  longitude?: number | null;
  has_real_coordinates: boolean; // true if coordinates are from DB, not fallback
  features?: string[];
  vendor_user_id?: string;
}

interface OpeningHours {
  monday?: string | { open?: string; close?: string; closed?: boolean };
  tuesday?: string | { open?: string; close?: string; closed?: boolean };
  wednesday?: string | { open?: string; close?: string; closed?: boolean };
  thursday?: string | { open?: string; close?: string; closed?: boolean };
  friday?: string | { open?: string; close?: string; closed?: boolean };
  saturday?: string | { open?: string; close?: string; closed?: boolean };
  sunday?: string | { open?: string; close?: string; closed?: boolean };
}

interface Review {
  id: string;
  user_name: string;
  user_avatar?: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  image_url?: string;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category_id?: string;
  is_available: boolean;
  is_featured: boolean;
  spicy_level?: number;
  dietary_tags?: string[];
  preparation_time?: number;
}

/**
 * Compute open/closed based on opening_hours and current time.
 * Returns null if we can't determine (no hours data).
 */
function computeIsOpen(hours: OpeningHours | undefined): boolean | null {
  if (!hours) return null;

  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayKey = dayNames[now.getDay()];
  const todayHours = (hours as any)[todayKey];

  if (!todayHours) return null;

  if (typeof todayHours === 'string') {
    const lower = todayHours.toLowerCase().trim();
    if (lower === 'fermé' || lower === 'closed') return false;
    // Try to parse "HH:MM - HH:MM"
    const match = lower.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (match) {
      const openMinutes = parseInt(match[1]) * 60 + parseInt(match[2]);
      const closeMinutes = parseInt(match[3]) * 60 + parseInt(match[4]);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    }
    return null; // Can't determine
  }

  if (typeof todayHours === 'object' && todayHours !== null) {
    if (todayHours.closed) return false;
    if (todayHours.open && todayHours.close) {
      const [oh, om] = todayHours.open.split(':').map(Number);
      const [ch, cm] = todayHours.close.split(':').map(Number);
      const openMinutes = oh * 60 + (om || 0);
      const closeMinutes = ch * 60 + (cm || 0);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    }
  }

  return null;
}

export default function ServiceDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { uploadAndPersist } = useStorageUpload();
  const { getDistanceTo, usingRealLocation, positionReady } = useGeoDistance();
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [galleryImages, setGalleryImages] = useState<{ id: string; image_url: string; caption?: string }[]>([]);
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
  const [promoVideoUrl, setPromoVideoUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  // Review form
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Charger le détail dès que l'id est disponible — pas besoin d'attendre le GPS
  useEffect(() => {
    if (!id) return;
    loadServiceDetails();
    loadReviews();
    loadRestaurantMenu();
    loadGalleryImages();
    loadFavoriteStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Recalculer la distance quand le GPS réel arrive (sans recharger toutes les données)
  useEffect(() => {
    if (!positionReady || !service?.latitude || !service?.longitude) return;
    const dist = getDistanceTo(service.latitude, service.longitude);
    setDistance(dist);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionReady, service?.latitude, service?.longitude]);

  // Check ownership
  useEffect(() => {
    if (service?.vendor_user_id && user?.id) {
      setIsOwner(service.vendor_user_id === user.id);
    } else {
      setIsOwner(false);
    }
  }, [service?.vendor_user_id, user?.id]);

  const loadFavoriteStatus = async () => {
    // Favorites stored in localStorage for now (no user_favorites table)
    if (!id) return;
    try {
      const favs = JSON.parse(localStorage.getItem('service_favorites') || '[]');
      setIsFavorite(favs.includes(id));
    } catch {
      // Silently ignore
    }
  };

  const loadServiceDetails = async () => {
    try {
      setLoading(true);

      const { data: proService, error: proError } = await supabase
        .from('professional_services')
        .select(`
          id,
          user_id,
          business_name,
          description,
          logo_url,
          cover_image_url,
          address,
          phone,
          email,
          website,
          opening_hours,
          rating,
          total_reviews,
          latitude,
          longitude,
          service_types (
            name,
            category,
            code
          )
        `)
        .eq('id', id)
        .single();

      if (!proError && proService) {
        const openingHours = proService.opening_hours as OpeningHours | undefined;

        // Only use real coordinates from the DB
        const hasRealCoords = proService.latitude != null && proService.longitude != null &&
          Number.isFinite(Number(proService.latitude)) && Number.isFinite(Number(proService.longitude)) &&
          !(Number(proService.latitude) === 0 && Number(proService.longitude) === 0);

        const serviceData: ServiceDetail = {
          id: proService.id,
          name: proService.business_name,
          description: proService.description || 'Aucune description disponible',
          category: proService.service_types?.category || proService.service_types?.name || 'service',
          service_type_code: proService.service_types?.code,
          address: proService.address,
          phone: proService.phone,
          email: proService.email,
          website: proService.website,
          rating: Number(proService.rating) || 0,
          reviews_count: proService.total_reviews || 0,
          is_open: computeIsOpen(openingHours),
          image_url: proService.cover_image_url || proService.logo_url,
          features: [],
          latitude: hasRealCoords ? Number(proService.latitude) : null,
          longitude: hasRealCoords ? Number(proService.longitude) : null,
          has_real_coordinates: hasRealCoords,
          opening_hours: openingHours || undefined,
          vendor_user_id: proService.user_id
        };

        setService(serviceData);
        setPortfolioImages([]);
        setPromoVideoUrl(null);

        // Calculer la distance si les coordonnées sont disponibles
        if (hasRealCoords) {
          const dist = getDistanceTo(serviceData.latitude!, serviceData.longitude!);
          setDistance(dist);
        } else {
          setDistance(null);
        }
        return;
      }

      // Fallback: service_types (generic)
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const serviceData: ServiceDetail = {
        id: data.id,
        name: data.name,
        description: data.description || 'Aucune description disponible',
        category: data.category || 'service',
        rating: 0,
        reviews_count: 0,
        is_open: null,
        image_url: data.icon,
        features: (Array.isArray(data.features) ? data.features : []) as string[],
        latitude: null,
        longitude: null,
        has_real_coordinates: false,
        opening_hours: undefined
      };

      setService(serviceData);
      setDistance(null);

    } catch (error) {
      console.error('Erreur chargement service:', error);
      toast.error(t('serviceDetail.erreurLorsDuChargementDu'));
      navigate('/services-proximite');
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('service_reviews')
        .select(`id, rating, comment, created_at, client_id, is_verified`)
        .eq('professional_service_id', id)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Erreur chargement avis:', error);
        setReviews([]);
        return;
      }

      if (!data || data.length === 0) {
        setReviews([]);
        return;
      }

      const clientIds = data.map(r => r.client_id).filter(Boolean);
      let clientsMap: Record<string, any> = {};

      if (clientIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', clientIds);

        if (profiles) {
          clientsMap = profiles.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
        }
      }

      const formattedReviews = data.map((review: any) => {
        const client = clientsMap[review.client_id];
        return {
          id: review.id,
          user_name: client?.full_name || 'Client vérifié',
          user_avatar: client?.avatar_url,
          rating: review.rating,
          comment: review.comment,
          created_at: review.created_at,
        };
      });

      setReviews(formattedReviews);
    } catch (error) {
      console.error('Erreur chargement avis:', error);
    }
  };

  const loadRestaurantMenu = async () => {
    try {
      const { data: categories } = await supabase
        .from('restaurant_menu_categories')
        .select('*')
        .eq('professional_service_id', id)
        .eq('is_active', true)
        .order('display_order');

      if (categories) setMenuCategories(categories);

      const { data: items } = await supabase
        .from('restaurant_menu_items')
        .select('*')
        .eq('professional_service_id', id)
        .eq('is_available', true)
        .order('display_order');

      if (items) setMenuItems(items);
    } catch (error) {
      console.error('Erreur chargement menu:', error);
    }
  };

  const loadGalleryImages = async () => {
    try {
      const { data, error } = await supabase
        .from('service_gallery_images')
        .select('id, image_url, caption')
        .eq('professional_service_id', id)
        .eq('media_type', 'image')
        .not('image_url', 'is', null)
        .order('display_order');
      if (!error && data) setGalleryImages(data as { id: string; image_url: string; caption?: string }[]);
    } catch (e) {
      console.warn('Erreur chargement galerie:', e);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('serviceDetail.seulesLesImagesSontAutorisees'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop volumineuse (max 5 MB)');
      return;
    }

    setUploadingImage(true);
    try {
      // ✅ ATOMIQUE : fichier + ligne service_gallery_images tout-ou-rien (rollback
      // du fichier si l'écriture DB échoue). GCS en prod, Supabase sinon ; validation
      // MIME + magic bytes + retry inclus.
      const atomic = await uploadAndPersist(
        file,
        { folder: 'service-gallery', subfolder: id },
        async (up) => {
          const { error: dbError } = await supabase
            .from('service_gallery_images')
            .insert({
              professional_service_id: id,
              image_url: up.publicUrl!,
              display_order: galleryImages.length,
            });
          if (dbError) throw dbError;
          return up.publicUrl!;
        },
      );

      if (!atomic.success) {
        throw new Error(atomic.error || 'Upload échoué');
      }

      toast.success(t('serviceDetail.imageAjouteeALaGalerie'));
      loadGalleryImages();
    } catch (err: any) {
      console.error('Erreur upload galerie:', err);
      toast.error(t('serviceDetail.erreurLorsDeLUpload'));
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleDeleteGalleryImage = async (imageId: string) => {
    try {
      const { error } = await supabase
        .from('service_gallery_images')
        .delete()
        .eq('id', imageId);
      if (error) throw error;
      toast.success(t('serviceDetail.imageSupprimee'));
      setGalleryImages(prev => prev.filter(img => img.id !== imageId));
    } catch {
      toast.error(t('serviceDetail.erreurLorsDeLaSuppression'));
    }
  };

  const handleContact = () => {
    if (service?.phone) {
      window.open(`tel:${service.phone}`, '_self');
    } else if (service?.vendor_user_id) {
      if (!user) {
        toast.error(t('serviceDetail.veuillezVousConnecterPourContacter'));
        navigate('/auth');
        return;
      }
      if (service.vendor_user_id === user.id) {
        toast.error(t('serviceDetail.vousNePouvezPasVous'));
        return;
      }
      navigate(`/communication/direct/${service.vendor_user_id}`);
    } else {
      toast.error(t('serviceDetail.aucunMoyenDeContactDisponible'));
    }
  };

  const handleMessage = () => {
    if (!user) {
      toast.error(t('serviceDetail.veuillezVousConnecterPourEnvoyer'));
      navigate('/auth');
      return;
    }
    if (!service?.vendor_user_id) {
      toast.error(t('serviceDetail.informationsDuPrestataireNonDisponibles'));
      return;
    }
    if (service.vendor_user_id === user.id) {
      toast.error(t('serviceDetail.vousNePouvezPasVous'));
      return;
    }
    navigate(`/communication/direct/${service.vendor_user_id}`);
  };

  const handleLocateRestaurant = () => {
    if (service?.has_real_coordinates && service.latitude && service.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${service.latitude},${service.longitude}&travelmode=driving`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (service?.address) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(service.address)}&travelmode=driving`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      toast.error(t('serviceDetail.positionDuServiceNonDisponible'));
    }
  };

  const handleReservation = () => {
    if (!user) {
      toast.error(t('serviceDetail.veuillezVousConnecterPourReserver'));
      navigate('/auth');
      return;
    }
    if (isRestaurant) {
      setIsReservationModalOpen(true);
    } else {
      toast.info(t('serviceDetail.contactezLePrestatairePourReserver'));
    }
  };

  const handleOrderFromRestaurant = () => {
    navigate(`/restaurant/${id}/menu`);
  };

  const isRestaurant = service?.service_type_code === 'restaurant';

  const handleShare = async () => {
    try {
      const result = await tryNativeShare({
          title: service?.name,
          text: service?.description,
          url: window.location.href
      });

      if (result === 'fallback') {
        await navigator.clipboard.writeText(window.location.href);
        toast.success(t('serviceDetail.lienCopieDansLePresse'));
      }
    } catch (error) {
      console.error('Erreur partage:', error);
    }
  };

  const toggleFavorite = () => {
    if (!id) return;
    try {
      const favs: string[] = JSON.parse(localStorage.getItem('service_favorites') || '[]');
      let newFavs: string[];
      if (isFavorite) {
        newFavs = favs.filter(f => f !== id);
        setIsFavorite(false);
        toast.success(t('serviceDetail.retireDesFavoris'));
      } else {
        newFavs = [...favs, id];
        setIsFavorite(true);
        toast.success(t('serviceDetail.ajouteAuxFavoris'));
      }
      localStorage.setItem('service_favorites', JSON.stringify(newFavs));
    } catch {
      setIsFavorite(!isFavorite);
    }
  };

  const openInMaps = () => {
    if (service?.has_real_coordinates && service.latitude && service.longitude) {
      const url = `https://www.google.com/maps/place/${service.latitude},${service.longitude}/@${service.latitude},${service.longitude},17z`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (service?.address) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(service.address)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      toast.error(t('serviceDetail.coordonneesNonDisponibles'));
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error(t('serviceDetail.veuillezVousConnecterPourLaisser'));
      navigate('/auth');
      return;
    }
    if (!reviewComment.trim()) {
      toast.error(t('serviceDetail.veuillezEcrireUnCommentaire'));
      return;
    }
    setSubmittingReview(true);
    try {
      const { error } = await supabase.from('service_reviews').insert({
        professional_service_id: id,
        client_id: user.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      if (error) throw error;
      toast.success(t('serviceDetail.merciPourVotreAvis'));
      setShowReviewForm(false);
      setReviewComment("");
      setReviewRating(5);
      loadReviews();
    } catch (err: any) {
      console.error('Erreur soumission avis:', err);
      toast.error(t('serviceDetail.erreurLorsDeLEnvoi'));
    } finally {
      setSubmittingReview(false);
    }
  };

  // Render open/closed status
  const renderStatusBadge = () => {
    if (service?.is_open === true) {
      return (
        <Badge className="text-sm px-4 py-2 font-semibold shadow-lg backdrop-blur-sm border-0 bg-primary text-primary-foreground">
          ✓ Ouvert
        </Badge>
      );
    }
    if (service?.is_open === false) {
      return (
        <Badge className="text-sm px-4 py-2 font-semibold shadow-lg backdrop-blur-sm border-0 bg-destructive text-destructive-foreground">
          🔴 Fermé
        </Badge>
      );
    }
    // null = unknown, don't show misleading status
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('serviceDetail.chargementDuService')}</p>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{t('serviceDetail.serviceNonTrouve')}</p>
          <Button onClick={() => navigate('/services-proximite')}>
            Retour aux services
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* === Hero Image === */}
      <div className="relative h-72 md:h-[420px] bg-muted overflow-hidden">
        {service.image_url ? (
          <img src={service.image_url} alt={service.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
            <span className="text-7xl opacity-60">
              {service.category === 'restaurant' ? '🍽️' :
               service.category === 'sante' ? '🏥' :
               service.category === 'education' ? '📚' :
               service.category === 'beaute' ? '💇' :
               service.category === 'commerce' ? '🛍️' : '🔧'}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />

        {/* Top navigation */}
        <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between z-10">
          <Button
            variant="ghost" size="icon"
            className="text-white bg-black/30 backdrop-blur-sm hover:bg-black/50 rounded-full w-10 h-10"
            onClick={() => navigate('/services-proximite')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex gap-2">
            {isOwner && (
              <Button variant="ghost" size="icon"
                className="text-white bg-black/30 backdrop-blur-sm hover:bg-black/50 rounded-full w-10 h-10"
                onClick={() => navigate(`/dashboard/service/${id}`)}
              >
                <Settings className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon"
              className="text-white bg-black/30 backdrop-blur-sm hover:bg-black/50 rounded-full w-10 h-10"
              onClick={handleShare}
            >
              <Share2 className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon"
              className="text-white bg-black/30 backdrop-blur-sm hover:bg-black/50 rounded-full w-10 h-10"
              onClick={toggleFavorite}
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-[#ff4000] text-[#ff4000]' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Status badge on image - only if determinable */}
        <div className="absolute bottom-4 right-4 z-10">
          {renderStatusBadge()}
        </div>
      </div>

      {/* === Main Content === */}
      <div className="max-w-3xl mx-auto px-4 relative">
        <Card className="relative -mt-16 z-20 border-0 shadow-xl rounded-2xl overflow-hidden">
          <CardContent className="p-5 md:p-8">
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight mb-3">
              {service.name}
            </h1>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Rating - only show if real */}
              {service.rating > 0 && (
                <div className="flex items-center gap-1.5">
                  <Star className="w-5 h-5 fill-[#ff4000] text-[#ff4000]" />
                  <span className="font-bold text-lg">{service.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground text-sm">
                    ({service.reviews_count} avis)
                  </span>
                </div>
              )}

              {/* Distance - only show if real coordinates exist */}
              {distance !== null && service.has_real_coordinates && (
                <Badge variant="outline" className="flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full border-primary/30">
                  <Navigation className="w-3.5 h-3.5 text-primary" />
                  {formatDistance(distance)}
                  {usingRealLocation && <span className="text-[#ff4000] text-xs">●</span>}
                </Badge>
              )}

              {/* No coordinates message */}
              {!service.has_real_coordinates && (
                <Badge variant="secondary" className="text-xs">
                  📍 Position non renseignée
                </Badge>
              )}
            </div>

            <Badge className="bg-primary/10 text-primary border-0 font-semibold mb-4">
              {service.category}
            </Badge>

            <p className="text-muted-foreground leading-relaxed mb-6">
              {service.description}
            </p>

            {/* === Action Buttons === */}
            <div className="flex flex-wrap gap-3">
              {service.phone && (
                <Button onClick={handleContact} className="flex-1 min-w-[100px] h-12 rounded-xl font-semibold text-sm bg-primary hover:bg-primary/90">
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Appeler
                </Button>
              )}
              <Button onClick={handleMessage} variant="outline" className="flex-1 min-w-[100px] h-12 rounded-xl font-semibold text-sm border-primary/30 text-primary hover:bg-primary/5">
                <MessageSquare className="w-4 h-4 mr-2" />
                Message
              </Button>
              <Button onClick={handleReservation} variant="outline" className="flex-1 min-w-[100px] h-12 rounded-xl font-semibold text-sm border-primary/30 text-primary hover:bg-primary/5">
                <Calendar className="w-4 h-4 mr-2" />
                Réserver
              </Button>
              {isRestaurant && (
                <Button onClick={handleOrderFromRestaurant} className="flex-1 min-w-[100px] h-12 rounded-xl font-semibold text-sm bg-accent text-accent-foreground hover:bg-accent/90">
                  <UtensilsCrossed className="w-4 h-4 mr-2" />
                  Commander
                </Button>
              )}
            </div>

            {/* Location Button - only if locatable */}
            {(service.has_real_coordinates || service.address) && (
              <div className="mt-4">
                <Button onClick={handleLocateRestaurant} variant="outline" className="w-full h-11 rounded-xl font-semibold text-sm border-primary/30 text-primary hover:bg-primary/5 gap-2">
                  <LocateFixed className="w-4 h-4" />
                  📍 Localiser sur la carte
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* === Tabs Section === */}
        <Tabs defaultValue="info" className="mt-6 mb-6">
          <TabsList className="w-full rounded-xl h-12 bg-muted/60 p-1 gap-0.5">
            <TabsTrigger value="info" className="flex-1 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md font-semibold text-xs sm:text-sm">
              Informations
            </TabsTrigger>
            {/* Galerie Médias = outil de GESTION (upload + upsell vidéo Premium) → propriétaire UNIQUEMENT. */}
            {isOwner && (
            <TabsTrigger value="media" className="flex-1 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md font-semibold text-xs sm:text-sm gap-1">
              <Images className="w-3.5 h-3.5 hidden sm:block" />
              Médias
              {galleryImages.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold data-[state=active]:bg-white/20 data-[state=active]:text-white">
                  {galleryImages.length}
                </span>
              )}
            </TabsTrigger>
            )}
            <TabsTrigger value="hours" className="flex-1 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md font-semibold text-xs sm:text-sm">
              Horaires
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md font-semibold text-xs sm:text-sm">
              Avis ({reviews.length})
            </TabsTrigger>
          </TabsList>

          {/* --- Informations --- */}
          <TabsContent value="info">
            <Card className="rounded-2xl border-0 shadow-md">
              <CardContent className="p-5 md:p-6 space-y-5">
                {service.address && (
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">Adresse</p>
                      <p className="text-muted-foreground text-sm mt-0.5">{service.address}</p>
                      <Button variant="link" className="px-0 h-auto mt-1 text-primary font-medium text-sm" onClick={openInMaps}>
                        Voir sur la carte
                      </Button>
                    </div>
                  </div>
                )}

                {service.phone && (
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{t('serviceDetail.telephone')}</p>
                      <a href={`tel:${service.phone}`} className="text-primary hover:underline text-sm mt-0.5 inline-block">
                        {service.phone}
                      </a>
                    </div>
                  </div>
                )}

                {service.email && (
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">Email</p>
                      <a href={`mailto:${service.email}`} className="text-primary hover:underline text-sm mt-0.5 inline-block">
                        {service.email}
                      </a>
                    </div>
                  </div>
                )}

                {service.features && service.features.length > 0 && (
                  <div>
                    <p className="font-semibold text-foreground mb-2">{t('serviceDetail.caracteristiques')}</p>
                    <div className="flex flex-wrap gap-2">
                      {service.features.map((feature, index) => (
                        <Badge key={index} variant="outline" className="rounded-full">{feature}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Médias (galerie images + vidéos) — GESTION réservée au propriétaire --- */}
          {isOwner && (
          <TabsContent value="media">
            <Card className="rounded-2xl border-0 shadow-md">
              <CardContent className="p-5 md:p-6">
                <ServiceMediaManager serviceId={id!} readonly={false} />
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* --- Horaires --- */}
          <TabsContent value="hours">
            <Card className="rounded-2xl border-0 shadow-md">
              <CardContent className="p-5 md:p-6">
                {service.opening_hours ? (
                  <div className="space-y-1">
                    {Object.entries(service.opening_hours).map(([day, hours]) => {
                      const dayName = day === 'monday' ? 'Lundi' :
                        day === 'tuesday' ? 'Mardi' :
                        day === 'wednesday' ? 'Mercredi' :
                        day === 'thursday' ? 'Jeudi' :
                        day === 'friday' ? 'Vendredi' :
                        day === 'saturday' ? 'Samedi' : 'Dimanche';

                      let hoursDisplay: string;
                      if (typeof hours === 'string') {
                        hoursDisplay = hours;
                      } else if (typeof hours === 'object' && hours !== null) {
                        const hoursObj = hours as { open?: string; close?: string; closed?: boolean };
                        if (hoursObj.closed) {
                          hoursDisplay = 'Fermé';
                        } else {
                          hoursDisplay = `${hoursObj.open || '08:00'} - ${hoursObj.close || '18:00'}`;
                        }
                      } else {
                        hoursDisplay = 'Non défini';
                      }

                      const isClosed = hoursDisplay.toLowerCase() === 'fermé';

                      return (
                        <div key={day} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                          <span className="font-medium text-foreground">{dayName}</span>
                          <span className={`text-sm font-medium ${isClosed ? 'text-[#ff4000]' : 'text-muted-foreground'}`}>
                            {hoursDisplay}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">{t('serviceDetail.horairesNonRenseignes')}</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">{t('serviceDetail.contactezLePrestatairePourConnaetre')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Avis --- */}
          <TabsContent value="reviews">
            <Card className="rounded-2xl border-0 shadow-md">
              <CardContent className="p-5 md:p-6">
                {reviews.length === 0 && !showReviewForm ? (
                  <div className="text-center py-10">
                    <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground mb-4">{t('serviceDetail.aucunAvisPourLeMoment')}</p>
                    <Button variant="outline" className="rounded-xl" onClick={() => {
                      if (!user) {
                        toast.error(t('serviceDetail.veuillezVousConnecter'));
                        navigate('/auth');
                        return;
                      }
                      setShowReviewForm(true);
                    }}>
                      Soyez le premier à donner votre avis
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Review form */}
                    {!showReviewForm && user && !isOwner && (
                      <div className="mb-4">
                        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowReviewForm(true)}>
                          Laisser un avis
                        </Button>
                      </div>
                    )}

                    {showReviewForm && (
                      <div className="mb-6 p-4 rounded-xl bg-muted/50 space-y-3">
                        <p className="font-semibold text-sm">{t('serviceDetail.votreAvis')}</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button key={star} onClick={() => setReviewRating(star)}>
                              <Star className={`w-6 h-6 ${star <= reviewRating ? 'fill-[#ff4000] text-[#ff4000]' : 'text-muted-foreground/30'}`} />
                            </button>
                          ))}
                        </div>
                        <Textarea
                          placeholder={t('serviceDetail.decrivezVotreExperience')}
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSubmitReview} disabled={submittingReview} className="rounded-xl">
                            {submittingReview ? 'Envoi...' : 'Envoyer'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setShowReviewForm(false)} className="rounded-xl">
                            Annuler
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Existing reviews */}
                    <div className="space-y-5">
                      {reviews.map((review) => (
                        <div key={review.id} className="border-b border-border/50 pb-5 last:border-0 last:pb-0">
                          <div className="flex items-start gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={review.user_avatar} />
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {review.user_name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-foreground text-sm">{review.user_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(review.created_at).toLocaleDateString('fr-FR')}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5 mb-2">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-[#ff4000] text-[#ff4000]' : 'text-muted-foreground/30'}`} />
                                ))}
                              </div>
                              <p className="text-muted-foreground text-sm leading-relaxed">{review.comment}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* === Aperçu galerie (preview compact hors onglets) === */}
        {galleryImages.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Galerie</h2>
                <Badge variant="secondary" className="rounded-full">{galleryImages.length}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {galleryImages.slice(0, 7).map((img, idx) => (
                <div
                  key={img.id}
                  className="relative rounded-xl overflow-hidden aspect-square bg-muted shadow-sm cursor-pointer group"
                  onClick={() => {/* handled in onglet Médias */}}
                >
                  <img
                    src={img.image_url}
                    alt={img.caption || `Photo ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* Dernier item : overlay "Voir tout" */}
                  {idx === 6 && galleryImages.length > 7 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">+{galleryImages.length - 7}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === Portfolio legacy + Vidéo de présentation === */}
        {(portfolioImages.length > 0 || promoVideoUrl) && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <ImagePlus className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Portfolio</h2>
              {portfolioImages.length > 0 && (
                <Badge variant="secondary" className="rounded-full">{portfolioImages.length}</Badge>
              )}
            </div>
            {portfolioImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {portfolioImages.map((url, idx) => (
                  <div key={idx} className="rounded-2xl overflow-hidden aspect-square bg-muted shadow-sm">
                    <img src={url} alt={`Portfolio ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            )}
            {promoVideoUrl && (
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-2">{t('serviceDetail.videoDePresentation')}</p>
                <video
                  src={promoVideoUrl}
                  controls
                  className="w-full rounded-2xl max-h-64 bg-black object-contain shadow-md"
                  preload="metadata"
                />
              </div>
            )}
          </div>
        )}

        {/* === Restaurant Menu Section === */}
        {isRestaurant && menuItems.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <UtensilsCrossed className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">{t('serviceDetail.notreMenu')}</h2>
            </div>

            {menuCategories.length > 0 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                {menuCategories.map((category) => (
                  <Badge key={category.id} variant="secondary" className="whitespace-nowrap px-4 py-1.5 rounded-full font-medium">
                    {category.icon && <span className="mr-1">{category.icon}</span>}
                    {category.name}
                  </Badge>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {menuItems.map((item) => (
                <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow rounded-2xl border-0 shadow-sm">
                  <div className="flex">
                    <div className="w-28 h-28 flex-shrink-0 bg-muted">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl bg-primary/5">🍽️</div>
                      )}
                    </div>
                    <CardContent className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-foreground line-clamp-1 text-sm">{item.name}</h3>
                          {item.is_featured && (
                            <Badge className="bg-accent text-accent-foreground text-[10px] px-1.5">⭐</Badge>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{item.description}</p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.spicy_level && item.spicy_level > 0 && (
                            <div className="flex items-center text-accent">
                              {[...Array(item.spicy_level)].map((_, i) => (
                                <Flame key={i} className="w-3 h-3" />
                              ))}
                            </div>
                          )}
                          {item.dietary_tags?.map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] rounded-full px-1.5">{tag}</Badge>
                          ))}
                          {item.preparation_time && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />{item.preparation_time}min
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-base font-bold text-primary">{item.price.toLocaleString()} FG</span>
                        <Button size="sm" onClick={handleOrderFromRestaurant} className="h-8 rounded-lg text-xs bg-accent hover:bg-accent/90 text-accent-foreground">
                          Commander
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>

            <div className="text-center mt-5">
              <Button variant="outline" onClick={handleOrderFromRestaurant} className="w-full md:w-auto rounded-xl h-12 font-semibold">
                <UtensilsCrossed className="w-4 h-4 mr-2" />
                Voir le menu complet et commander
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de réservation restaurant */}
      {isRestaurant && service && (
        <ReservationModal
          isOpen={isReservationModalOpen}
          onClose={() => setIsReservationModalOpen(false)}
          serviceId={service.id}
          restaurantName={service.name}
          restaurantPhone={service.phone}
        />
      )}
    </div>
  );
}
