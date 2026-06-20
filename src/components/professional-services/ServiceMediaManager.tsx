import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/lib/supabaseClient';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  ImagePlus, Play, Trash2, Star, Upload, X,
  Camera, Video, ChevronLeft, ChevronRight, Loader2, GripVertical, Lock,
} from 'lucide-react';

interface MediaItem {
  id: string;
  media_type: 'image' | 'video';
  image_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  display_order: number;
  is_cover: boolean;
}

interface ServiceMediaManagerProps {
  serviceId: string;
  readonly?: boolean;
  isPremium?: boolean;
}

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;   // 8 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_ITEMS = 20;

export function ServiceMediaManager({ serviceId, readonly = false, isPremium: isPremiumProp }: ServiceMediaManagerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { uploadFile } = useStorageUpload();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [isPremiumInternal, setIsPremiumInternal] = useState(false);
  const [premiumPrice, setPremiumPrice] = useState<number | null>(null);

  // Si le parent fournit isPremium (depuis useServiceSubscription), on l'utilise directement.
  // Sinon, on le détermine nous-mêmes via le RPC (comportement standalone).
  const isPremium = isPremiumProp !== undefined ? isPremiumProp : isPremiumInternal;

  // Libellé de prix : on affiche le VRAI prix du plan Premium du type de service (40 000 / 50 000 /
  // 150 000 GNF selon le métier) au lieu d'un montant codé en dur. Repli neutre si indisponible.
  const premiumLabel = premiumPrice != null
    ? `Premium à ${premiumPrice.toLocaleString('fr-FR')} GNF/mois`
    : 'un abonnement Premium';

  const loadSubscription = useCallback(async () => {
    // Skip si le parent gère l'état ou si readonly
    if (readonly || isPremiumProp !== undefined) return;
    try {
      // RPC SECURITY DEFINER — contourne RLS, accessible même en anonyme
      const { data, error } = await supabase
        .rpc('get_service_subscription', { p_service_id: serviceId });

      if (error) {
        console.warn('get_service_subscription error:', error.message);
        setIsPremiumInternal(false);
        return;
      }

      const row = (data as any[])?.[0];
      // Source de vérité UNIQUE = le flag can_upload_video du plan (défini par le PDG, aligné sur
      // l'enforcement DB du trigger). On NE se rabat PLUS sur le nom du plan (incohérent : certains
      // 'pro' ont can_upload_video=false).
      setIsPremiumInternal(row?.can_upload_video === true);
    } catch (err) {
      console.warn('loadSubscription exception:', err);
      setIsPremiumInternal(false);
    }
  }, [serviceId, readonly, isPremiumProp]);

  // Prix réel du plan Premium pour ce type de service (pour l'invite d'upgrade).
  const loadPremiumPrice = useCallback(async () => {
    if (readonly) return;
    try {
      const { data: svc } = await supabase
        .from('professional_services').select('service_type_id').eq('id', serviceId).single();
      if (!svc?.service_type_id) return;
      const { data: plan } = await supabase
        .from('service_plans')
        .select('monthly_price_gnf')
        .eq('service_type_id', svc.service_type_id).eq('name', 'premium').eq('is_active', true)
        .maybeSingle();
      if (plan?.monthly_price_gnf != null) setPremiumPrice(Number(plan.monthly_price_gnf));
    } catch { /* prix optionnel : repli sur le libellé neutre */ }
  }, [serviceId, readonly]);

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_gallery_images')
        .select('id, media_type, image_url, video_url, thumbnail_url, caption, display_order, is_cover')
        .eq('professional_service_id', serviceId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setItems((data || []) as MediaItem[]);
    } catch (err) {
      console.error('Erreur chargement médias:', err);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => { loadMedia(); loadSubscription(); loadPremiumPrice(); }, [loadMedia, loadSubscription, loadPremiumPrice]);

  // ─── Sync cover_image_url dans professional_services ─────────────
  const syncCoverToService = async (imageUrl: string) => {
    await supabase
      .from('professional_services')
      .update({ cover_image_url: imageUrl })
      .eq('id', serviceId);
  };

  // ─── Upload image ──────────────────────────────────────────────
  const uploadImage = async (file: File) => {
    if (file.size > MAX_IMAGE_SIZE) {
      toast({ title: 'Image trop volumineuse', description: 'Maximum 8 MB par image', variant: 'destructive' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Format invalide', description: 'Seules les images sont acceptées ici', variant: 'destructive' });
      return;
    }

    setUploading(true);
    setUploadProgress('Upload de l\'image...');
    try {
      const result = await uploadFile(file, { folder: 'products', subfolder: `service-gallery/${serviceId}` });
      if (!result.success || !result.publicUrl) throw new Error(result.error);
      const publicUrl = result.publicUrl;

      // Première image de la galerie → couverture automatique
      const isFirstImage = items.filter(i => i.media_type === 'image').length === 0;

      const { error: dbErr } = await supabase.from('service_gallery_images').insert({
        professional_service_id: serviceId,
        media_type: 'image',
        image_url: publicUrl,
        display_order: items.length,
        is_cover: isFirstImage,
      });
      if (dbErr) throw dbErr;

      // Synchroniser cover_image_url dans professional_services
      // pour que l'image apparaisse immédiatement sur le marketplace
      if (isFirstImage) {
        await syncCoverToService(publicUrl);
      }

      toast({ title: '✅ Image ajoutée', description: 'Votre photo est maintenant visible sur le marketplace' });
      loadMedia();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erreur upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  // ─── Upload vidéo ──────────────────────────────────────────────
  const uploadVideo = async (file: File) => {
    // Garde de droit AVANT tout upload (évite d'uploader un fichier qui serait ensuite rejeté
    // par le trigger DB = fuite de stockage). Le paywall reste verrouillé en base de toute façon.
    if (!isPremium) {
      toast({ title: 'Abonnement Premium requis', description: `Passez à ${premiumLabel} pour ajouter des vidéos.`, variant: 'destructive' });
      return;
    }
    if (file.size > MAX_VIDEO_SIZE) {
      toast({ title: 'Vidéo trop volumineuse', description: 'Maximum 100 MB par vidéo', variant: 'destructive' });
      return;
    }
    if (!file.type.startsWith('video/')) {
      toast({ title: 'Format invalide', description: 'Seules les vidéos sont acceptées ici', variant: 'destructive' });
      return;
    }

    setUploading(true);
    setUploadProgress('Upload de la vidéo (peut prendre quelques secondes)...');
    try {
      const result = await uploadFile(file, { folder: 'videos', subfolder: `service-gallery/${serviceId}` });
      if (!result.success || !result.publicUrl) throw new Error(result.error);
      const publicUrl = result.publicUrl;

      // image_url laissé null pour les vidéos (colonne nullable depuis migration 20260518010000)
      const { error: dbErr } = await supabase.from('service_gallery_images').insert({
        professional_service_id: serviceId,
        media_type: 'video',
        image_url: null,
        video_url: publicUrl,
        display_order: items.length,
        is_cover: false,
      });
      if (dbErr) throw dbErr;

      toast({ title: '✅ Vidéo ajoutée', description: 'Votre vidéo est maintenant visible' });
      loadMedia();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erreur upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  // ─── Drag & drop ──────────────────────────────────────────────
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (readonly || uploading || items.length >= MAX_ITEMS) return;
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type.startsWith('image/')) await uploadImage(file);
    else if (file.type.startsWith('video/')) {
      if (!isPremium) {
        toast({
          title: 'Abonnement Premium requis',
          description: `Passez à ${premiumLabel} pour ajouter des vidéos.`,
          variant: 'destructive',
        });
        return;
      }
      await uploadVideo(file);
    }
  };

  // ─── Supprimer ────────────────────────────────────────────────
  const handleDelete = async (item: MediaItem) => {
    try {
      // Supprimer du storage Supabase : on extrait le bucket ET le chemin EXACTS depuis l'URL
      // publique (.../storage/v1/object/public/{bucket}/{chemin}). L'ancien code ciblait un
      // bucket/chemin erronés (service-gallery + slice(-2)) → le fichier n'était JAMAIS supprimé
      // (fuite de stockage). Les vrais buckets sont product-images (images) / communication-files (vidéos).
      const url = item.media_type === 'video' ? item.video_url : item.image_url;
      const marker = '/storage/v1/object/public/';
      if (url && url.includes(marker)) {
        const after = url.split('?')[0].split(marker)[1] || '';
        const slash = after.indexOf('/');
        if (slash > 0) {
          const bucket = after.slice(0, slash);
          const storagePath = decodeURIComponent(after.slice(slash + 1));
          await supabase.storage.from(bucket).remove([storagePath]);
        }
      }
      // Pour les URLs GCS, pas de suppression côté storage (géré côté admin GCS)
      // Supprimer de la DB
      const { error } = await supabase.from('service_gallery_images').delete().eq('id', item.id);
      if (error) throw error;

      // Si c'était la couverture, définir la prochaine image comme couverture
      if (item.is_cover) {
        const nextImage = items.find(i => i.id !== item.id && i.media_type === 'image');
        if (nextImage) {
          await supabase.from('service_gallery_images').update({ is_cover: true }).eq('id', nextImage.id);
        }
      }

      toast({ title: 'Média supprimé' });
      loadMedia();
    } catch (err: any) {
      toast({ title: 'Erreur suppression', description: err.message, variant: 'destructive' });
    }
  };

  // ─── Définir comme couverture ─────────────────────────────────
  const handleSetCover = async (item: MediaItem) => {
    if (item.media_type !== 'image') return;
    try {
      await supabase.from('service_gallery_images').update({ is_cover: false }).eq('professional_service_id', serviceId);
      await supabase.from('service_gallery_images').update({ is_cover: true }).eq('id', item.id);
      // Mettre à jour aussi cover_image_url du service
      await supabase.from('professional_services').update({ cover_image_url: item.image_url }).eq('id', serviceId);
      toast({ title: '⭐ Image de couverture définie', description: 'Cette image sera affichée sur le marketplace' });
      loadMedia();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  // ─── Mise à jour légende ──────────────────────────────────────
  // ─── Lightbox navigation ──────────────────────────────────────
  const openLightbox = (index: number) => setLightbox({ open: true, index });
  const closeLightbox = () => setLightbox({ open: false, index: 0 });
  const prevLightbox = () => setLightbox(l => ({ ...l, index: Math.max(0, l.index - 1) }));
  const nextLightbox = () => setLightbox(l => ({ ...l, index: Math.min(items.length - 1, l.index + 1) }));

  const images = items.filter(i => i.media_type === 'image');
  const videos = items.filter(i => i.media_type === 'video');
  const canAdd = !readonly && items.length < MAX_ITEMS && !uploading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── En-tête ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Galerie Médias
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {items.length} média{items.length !== 1 ? 's' : ''} —{' '}
            {images.length} photo{images.length !== 1 ? 's' : ''},{' '}
            {videos.length} vidéo{videos.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!readonly && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => imageInputRef.current?.click()}
              disabled={!canAdd}
            >
              <ImagePlus className="w-4 h-4" />
              Photo
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={`gap-1.5 ${isPremium
                ? 'border-blue-300 text-[#04439e] hover:bg-blue-50 dark:border-[#04439e] dark:text-[#04439e] dark:hover:bg-[#04439e]/30'
                : 'border-muted-foreground/30 text-muted-foreground/60'
              }`}
              onClick={() => {
                if (!isPremium) {
                  toast({
                    title: 'Abonnement Premium requis',
                    description: `Passez à ${premiumLabel} pour débloquer les vidéos.`,
                    variant: 'destructive',
                  });
                  return;
                }
                videoInputRef.current?.click();
              }}
              disabled={!canAdd || uploading}
              title={!isPremium ? `Disponible avec ${premiumLabel}` : undefined}
            >
              {isPremium ? <Video className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              Vidéo
              {!isPremium && <span className="text-[9px] font-bold ml-0.5 uppercase tracking-wide text-[#ff4000]">Premium</span>}
            </Button>
            <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={async e => {
                const files = Array.from(e.target.files || []);
                for (const f of files) await uploadImage(f);
                e.target.value = '';
              }}
            />
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) await uploadVideo(file);
                e.target.value = '';
              }}
            />
          </div>
        )}
      </div>

      {/* ─── Bandeau Premium vidéo ──────────────────────────── */}
      {!readonly && !isPremium && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-50 dark:bg-[#ff4000]/20 border border-orange-200 dark:border-[#ff4000]">
          <Lock className="w-4 h-4 shrink-0 mt-0.5 text-[#ff4000] dark:text-[#ff4000]" />
          <div className="text-sm">
            <span className="font-semibold text-[#ff4000] dark:text-[#ff4000]">{t('serviceMediaManager.videosVerrouillees')}</span>
            <span className="text-[#ff4000] dark:text-[#ff4000]"> {t('serviceMediaManager.lAjoutDeVideosEst')} </span>
            <span className="font-bold text-[#ff4000] dark:text-[#ff4000]">{premiumLabel}</span>
            <span className="text-[#ff4000] dark:text-[#ff4000]">{t('serviceMediaManager.lesPhotosSontDisponiblesGratuitement')}</span>
          </div>
        </div>
      )}

      {/* ─── Upload en cours ─────────────────────────────────── */}
      {uploading && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
            <p className="text-sm text-primary font-medium">{uploadProgress}</p>
          </CardContent>
        </Card>
      )}

      {/* ─── Zone drag & drop ────────────────────────────────── */}
      {!readonly && items.length === 0 && (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`
            border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200
            ${dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50'}
          `}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{t('serviceMediaManager.glissezVosPhotosEtVideos')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('serviceMediaManager.ouUtilisezLesBoutonsCi')}</p>
              <p className="text-xs text-muted-foreground/70 mt-2">Photos : max 8 MB · Vidéos : max 100 MB · {MAX_ITEMS} médias max</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Section Photos ───────────────────────────────────── */}
      {images.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Camera className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Photos ({images.length})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((item, idx) => (
              <div
                key={item.id}
                className="relative group rounded-2xl overflow-hidden aspect-square bg-muted shadow-sm cursor-pointer"
                onClick={() => openLightbox(items.indexOf(item))}
              >
                <img
                  src={item.image_url!}
                  alt={item.caption || `Photo ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Badge couverture */}
                {item.is_cover && (
                  <div className="absolute top-2 left-2 z-10">
                    <Badge className="bg-[#ff4000] text-white text-[10px] gap-1 shadow-lg">
                      <Star className="w-2.5 h-2.5 fill-white" />
                      Couverture
                    </Badge>
                  </div>
                )}

                {/* Actions propriétaire */}
                {!readonly && (
                  <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(item); }}
                      className="w-8 h-8 rounded-full bg-destructive/90 text-white flex items-center justify-center shadow-lg hover:bg-destructive transition-colors"
                      title={t('serviceMediaManager.supprimer')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {!item.is_cover && (
                      <button
                        onClick={e => { e.stopPropagation(); handleSetCover(item); }}
                        className="w-8 h-8 rounded-full bg-[#ff4000]/90 text-white flex items-center justify-center shadow-lg hover:bg-[#ff4000] transition-colors"
                        title={t('serviceMediaManager.definirCommeCouverture')}
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Légende au bas */}
                {item.caption && (
                  <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-medium line-clamp-1">{item.caption}</p>
                  </div>
                )}
              </div>
            ))}

            {/* Bouton ajout rapide */}
            {canAdd && images.length > 0 && (
              <button
                onClick={() => imageInputRef.current?.click()}
                className="rounded-2xl aspect-square border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all duration-200 hover:bg-primary/5"
              >
                <ImagePlus className="w-6 h-6" />
                <span className="text-xs font-medium">{t('serviceMediaManager.ajouter')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Section Vidéos ───────────────────────────────────── */}
      {videos.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Video className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Vidéos ({videos.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {videos.map((item, idx) => (
              <div key={item.id} className="relative group rounded-2xl overflow-hidden bg-black shadow-md">
                <video
                  src={item.video_url!}
                  controls
                  preload="metadata"
                  className="w-full max-h-56 object-contain"
                  poster={item.thumbnail_url || undefined}
                />
                {/* Actions propriétaire */}
                {!readonly && (
                  <button
                    onClick={() => handleDelete(item)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive/90 text-white flex items-center justify-center shadow-lg hover:bg-destructive transition-colors opacity-0 group-hover:opacity-100 z-10"
                    title={t('serviceMediaManager.supprimer')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {item.caption && (
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-white text-xs font-medium">{item.caption}</p>
                  </div>
                )}
                {/* Badge vidéo */}
                <div className="absolute top-2 left-2">
                  <Badge className="bg-[#04439e] text-white text-[10px] gap-1">
                    <Play className="w-2.5 h-2.5 fill-white" />
                    Vidéo {idx + 1}
                  </Badge>
                </div>
              </div>
            ))}

            {/* Ajout vidéo rapide */}
            {canAdd && isPremium && videos.length > 0 && (
              <button
                onClick={() => videoInputRef.current?.click()}
                className="rounded-2xl border-2 border-dashed border-blue-200 dark:border-[#04439e] hover:border-[#04439e] h-40 flex flex-col items-center justify-center gap-2 text-[#04439e] hover:text-[#04439e] transition-all duration-200 hover:bg-blue-50 dark:hover:bg-[#04439e]/20"
              >
                <Video className="w-6 h-6" />
                <span className="text-xs font-medium">{t('serviceMediaManager.ajouterUneVideo')}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── État vide (propriétaire avec items = 0) ─────────── */}
      {!readonly && items.length > 0 && (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`
            border border-dashed rounded-xl p-4 text-center text-xs text-muted-foreground transition-all
            ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}
          `}
        >
          <GripVertical className="w-4 h-4 mx-auto mb-1 opacity-40" />
          Glissez d'autres fichiers ici • {MAX_ITEMS - items.length} emplacement{MAX_ITEMS - items.length > 1 ? 's' : ''} restant{MAX_ITEMS - items.length > 1 ? 's' : ''}
        </div>
      )}

      {/* ─── État vide (lecture seule) ────────────────────────── */}
      {readonly && items.length === 0 && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Camera className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">{t('serviceMediaManager.aucunMediaPourLeMoment')}</p>
          </CardContent>
        </Card>
      )}

      {/* ─── Lightbox ────────────────────────────────────────── */}
      <Dialog open={lightbox.open} onOpenChange={open => !open && closeLightbox()}>
        <DialogContent className="max-w-4xl w-full p-2 bg-black/95 border-0 max-h-[90vh] overflow-y-auto">
          <div className="relative">
            {/* Fermer */}
            <button
              onClick={closeLightbox}
              className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Compteur */}
            <div className="absolute top-3 left-3 z-20">
              <Badge className="bg-black/60 text-white border-0 text-xs">
                {lightbox.index + 1} / {items.length}
              </Badge>
            </div>

            {/* Média actif */}
            {items[lightbox.index] && (
              <div className="flex items-center justify-center min-h-[50vh] max-h-[80vh]">
                {items[lightbox.index].media_type === 'video' ? (
                  <video
                    src={items[lightbox.index].video_url!}
                    controls
                    autoPlay
                    className="max-w-full max-h-[80vh] rounded-xl"
                  />
                ) : (
                  <img
                    src={items[lightbox.index].image_url!}
                    alt={items[lightbox.index].caption || ''}
                    className="max-w-full max-h-[80vh] object-contain rounded-xl"
                  />
                )}
              </div>
            )}

            {/* Navigation */}
            {items.length > 1 && (
              <>
                <button
                  onClick={prevLightbox}
                  disabled={lightbox.index === 0}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors disabled:opacity-30"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={nextLightbox}
                  disabled={lightbox.index === items.length - 1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Légende */}
            {items[lightbox.index]?.caption && (
              <div className="mt-3 text-center">
                <p className="text-white/80 text-sm">{items[lightbox.index].caption}</p>
              </div>
            )}

            {/* Thumbnails */}
            {items.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1 justify-center">
                {items.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => setLightbox(l => ({ ...l, index: idx }))}
                    className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${idx === lightbox.index ? 'border-primary scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    {item.media_type === 'video' ? (
                      <div className="w-full h-full bg-[#04439e] flex items-center justify-center">
                        <Play className="w-4 h-4 text-blue-300 fill-blue-300" />
                      </div>
                    ) : (
                      <img src={item.image_url!} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
