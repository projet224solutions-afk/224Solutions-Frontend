/**
 * Composant de gestion du menu restaurant
 * Catégories et plats avec CRUD complet + multi-images + vidéo Premium
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, Edit2, Trash2, UtensilsCrossed, Tag,
  Clock, Star, Eye, EyeOff,
  Search, Upload, X, Loader2, Image as ImageIcon, Video, Lock
} from 'lucide-react';
import { useRestaurantMenu, MenuCategory, MenuItem } from '@/hooks/useRestaurantMenu';
import { useServiceSubscription } from '@/hooks/useServiceSubscription';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { cn } from '@/lib/utils';

interface RestaurantMenuManagerProps {
  serviceId: string;
}

const DIETARY_TAGS = [
  { value: 'vegetarien', label: 'Végétarien', icon: '🥬' },
  { value: 'vegan', label: 'Végan', icon: '🌱' },
  { value: 'halal', label: 'Halal', icon: '🕌' },
  { value: 'casher', label: 'Casher', icon: '✡️' },
  { value: 'sans_gluten', label: 'Sans gluten', icon: '🌾' },
  { value: 'bio', label: 'Bio', icon: '🌿' },
];

const MAX_IMAGES = 5;
const MAX_VIDEO_SIZE_MB = 50;
const MAX_VIDEO_DURATION_S = 45;

// Icônes proposées pour les catégories du menu (le restaurateur en choisit une distincte par catégorie).
const CATEGORY_ICONS = [
  '🍽️', '🥗', '🍔', '🍕', '🍗', '🍟', '🌮', '🥙', '🧆', '🍲', '🍛', '🍜', '🍝', '🍣', '🍤',
  '🥩', '🐟', '🍚', '🥘', '🫓', '🥖', '🧀', '🥚', '🍳', '🥞', '🍰', '🍩', '🍦', '🍫', '🍪',
  '☕', '🍵', '🥤', '🧃', '🥛', '🍹', '🍺', '🍷', '🧊', '🍉',
];

// Options / suppléments payants d'un plat (ex. « Taille », « Suppléments »).
interface OptionGroup {
  id: string;
  name: string;
  min: number;   // sélections minimales (0 = facultatif)
  max: number;   // sélections maximales (1 = choix unique)
  options: { id: string; name: string; price: number }[];
}

const uid = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

// Nettoie les variants avant sauvegarde : retire les groupes/options vides, borne les nombres.
function sanitizeVariants(v: { groups: OptionGroup[] }): { groups: OptionGroup[] } | null {
  const groups = (v?.groups || [])
    .map((g) => ({
      id: g.id || uid(),
      name: (g.name || '').trim(),
      min: Math.max(0, Number(g.min) || 0),
      max: Math.max(1, Number(g.max) || 1),
      options: (g.options || [])
        .filter((o) => (o.name || '').trim())
        .map((o) => ({ id: o.id || uid(), name: o.name.trim(), price: Math.max(0, Number(o.price) || 0) })),
    }))
    .filter((g) => g.name && g.options.length > 0);
  return groups.length ? { groups } : null;
}

export function RestaurantMenuManager({ serviceId }: RestaurantMenuManagerProps) {
  const { t } = useTranslation();
  const formatCurrency = useFormatCurrency();
  const { subscription } = useServiceSubscription({ serviceId });
  const { uploadFile } = useStorageUpload();
  const canUploadVideo = subscription?.can_upload_video ?? false;

  const {
    categories,
    menuItems,
    loading,
    createCategory,
    updateCategory,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleItemAvailability,
  } = useRestaurantMenu(serviceId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // États du formulaire plat
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    preparation_time: '15',
    spicy_level: '0',
    is_featured: false,
    dietary_tags: [] as string[],
    image_url: '',
    images: [] as string[],
    video_url: '',
    stock_quantity: '',   // '' = illimité ; nombre = portions disponibles
    section: '',          // regroupement libre (ex. « Midi », « Bar »)
    variants: { groups: [] as OptionGroup[] },
  });

  // États du formulaire catégorie
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    icon: '🍽️',
  });

  const resetItemForm = () => {
    setItemForm({
      name: '',
      description: '',
      price: '',
      category_id: '',
      preparation_time: '15',
      spicy_level: '0',
      is_featured: false,
      dietary_tags: [],
      image_url: '',
      images: [],
      video_url: '',
      stock_quantity: '',
      section: '',
      variants: { groups: [] },
    });
    setEditingItem(null);
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', description: '', icon: '🍽️' });
    setEditingCategory(null);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name || !itemForm.price) {
      toast.error(t('restaurantMenuManager.nomEtPrixRequis'));
      return;
    }

    const allImages = itemForm.images.length > 0
      ? itemForm.images
      : itemForm.image_url
        ? [itemForm.image_url]
        : [];

    // STOCK ↔ DISPONIBILITÉ : null = illimité ; sinon le nombre pilote is_available.
    //  - stock > 0  → disponible (réapprovisionner réactive un plat épuisé)
    //  - stock = 0  → indisponible (retiré du menu en ligne automatiquement)
    //  - illimité   → on NE force PAS (on garde l'état du bouton Disponible/Indisponible)
    const stockVal = itemForm.stock_quantity.trim() === '' ? null : Math.max(0, parseInt(itemForm.stock_quantity) || 0);

    try {
      if (editingItem) {
        await updateMenuItem(editingItem.id, {
          name: itemForm.name,
          description: itemForm.description || null,
          price: parseFloat(itemForm.price),
          category_id: itemForm.category_id || null,
          preparation_time: parseInt(itemForm.preparation_time),
          spicy_level: parseInt(itemForm.spicy_level),
          is_featured: itemForm.is_featured,
          dietary_tags: itemForm.dietary_tags,
          image_url: allImages[0] || null,
          images: allImages,
          video_url: itemForm.video_url || null,
          stock_quantity: stockVal,
          is_available: stockVal === null ? editingItem.is_available : stockVal > 0,
          section: itemForm.section.trim() || null,
          variants: sanitizeVariants(itemForm.variants),
        });
        toast.success(t('restaurantMenuManager.platMisAJour'));
      } else {
        await createMenuItem({
          name: itemForm.name,
          description: itemForm.description || undefined,
          price: parseFloat(itemForm.price),
          category_id: itemForm.category_id || undefined,
          preparation_time: parseInt(itemForm.preparation_time),
          spicy_level: parseInt(itemForm.spicy_level),
          is_featured: itemForm.is_featured,
          dietary_tags: itemForm.dietary_tags,
          image_url: allImages[0] || undefined,
          images: allImages,
          video_url: itemForm.video_url || undefined,
          stock_quantity: stockVal,
          is_available: stockVal === null ? true : stockVal > 0,
          section: itemForm.section.trim() || null,
          variants: sanitizeVariants(itemForm.variants),
        });
        toast.success(t('restaurantMenuManager.platAjoute'));
      }
      setShowItemDialog(false);
      resetItemForm();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name) { toast.error('Nom requis'); return; }
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryForm);
        toast.success(t('restaurantMenuManager.categorieMiseAJour'));
      } else {
        await createCategory(categoryForm);
        toast.success(t('restaurantMenuManager.categorieAjoutee'));
      }
      setShowCategoryDialog(false);
      resetCategoryForm();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category_id: item.category_id || '',
      preparation_time: item.preparation_time.toString(),
      spicy_level: item.spicy_level.toString(),
      is_featured: item.is_featured,
      dietary_tags: item.dietary_tags || [],
      image_url: item.image_url || '',
      images: item.images || (item.image_url ? [item.image_url] : []),
      video_url: item.video_url || '',
      stock_quantity: item.stock_quantity != null ? String(item.stock_quantity) : '',
      section: (item as any).section || '',
      variants: { groups: Array.isArray((item as any).variants?.groups) ? (item as any).variants.groups : [] },
    });
    setShowItemDialog(true);
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    if (itemForm.images.length >= MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images par plat`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('restaurantMenuManager.lImageNeDoitPas'));
      return;
    }
    try {
      setUploadingImage(true);
      const result = await uploadFile(file, { folder: 'restaurant', subfolder: `dishes/${serviceId}` });
      if (!result.success || !result.publicUrl) throw new Error(result.error);
      setItemForm(prev => ({
        ...prev,
        images: [...prev.images, result.publicUrl!],
        image_url: prev.images.length === 0 ? result.publicUrl! : prev.image_url,
      }));
      toast.success(t('restaurantMenuManager.imageAjoutee'));
    } catch (err: any) {
      toast.error("Erreur upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setItemForm(prev => {
      const newImages = prev.images.filter((_, i) => i !== index);
      return { ...prev, images: newImages, image_url: newImages[0] || '' };
    });
  };

  const handleVideoUpload = async (file: File) => {
    if (!file) return;
    if (!canUploadVideo) {
      toast.error(t('restaurantMenuManager.uploadVideoReserveAuPlan'));
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      toast.error(`La vidéo ne doit pas dépasser ${MAX_VIDEO_SIZE_MB} MB`);
      return;
    }

    // Vérification durée via élément video HTML
    const duration = await getVideoDuration(file);
    if (duration > MAX_VIDEO_DURATION_S) {
      toast.error(`La vidéo ne doit pas dépasser ${MAX_VIDEO_DURATION_S} secondes (durée : ${Math.round(duration)}s)`);
      return;
    }

    try {
      setUploadingVideo(true);
      const result = await uploadFile(file, { folder: 'videos', subfolder: `restaurant-dishes/${serviceId}` });
      if (!result.success || !result.publicUrl) throw new Error(result.error);
      setItemForm(prev => ({ ...prev, video_url: result.publicUrl! }));
      toast.success(t('restaurantMenuManager.videoUploadee'));
    } catch (err: any) {
      toast.error(t('restaurantMenuManager.erreurUploadVideo'));
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleEditCategory = (cat: MenuCategory) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, description: cat.description || '', icon: cat.icon || '🍽️' });
    setShowCategoryDialog(true);
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm(t('restaurantMenuManager.supprimerCePlat'))) return;
    try {
      await deleteMenuItem(id);
      toast.success(t('restaurantMenuManager.platSupprime'));
    } catch (err: any) {
      toast.error(err.message);
    }
  };


  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || item.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('restaurantMenuManager.rechercherUnPlat')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={resetCategoryForm}>
                <Tag className="w-4 h-4 mr-2" />
                Catégorie
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('restaurantMenuManager.exEntreesPlatsPrincipaux')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('restaurantMenuManager.iconeDeLaCategorie')}</Label>
                  <div className="flex flex-wrap gap-1.5 rounded-lg border p-2 max-h-32 overflow-y-auto">
                    {CATEGORY_ICONS.map((emo) => (
                      <button
                        key={emo}
                        type="button"
                        onClick={() => setCategoryForm(prev => ({ ...prev, icon: emo }))}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-md text-lg transition-colors',
                          categoryForm.icon === emo ? 'bg-[#ff4000] ring-2 ring-[#ff4000]' : 'bg-muted hover:bg-muted-foreground/20',
                        )}
                        aria-label={`Icône ${emo}`}
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('restaurantMenuManager.choisissezUneIconeDistinctePar')}</p>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>{t('restaurantMenuManager.annuler')}</Button>
                <Button onClick={handleSaveCategory}>{editingCategory ? 'Mettre à jour' : 'Créer'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
            <DialogTrigger asChild>
              <Button onClick={resetItemForm}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un plat
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
              <DialogHeader className="pb-1">
                <DialogTitle>{editingItem ? 'Modifier le plat' : 'Nouveau plat'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label>{t('restaurantMenuManager.nomDuPlat')}</Label>
                    <Input
                      value={itemForm.name}
                      onChange={(e) => setItemForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Poulet yassa"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prix (FG) *</Label>
                    <Input
                      type="number"
                      value={itemForm.price}
                      onChange={(e) => setItemForm(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="50000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('restaurantMenuManager.categorie')}</Label>
                    <Select
                      value={itemForm.category_id}
                      onValueChange={(v) => setItemForm(prev => ({ ...prev, category_id: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* 📦 STOCK — compact. Vide = illimité ; à 0 le plat passe indisponible. */}
                  <div className="flex items-center gap-2 rounded-lg border-2 border-[#ff4000]/30 bg-[#ff4000]/5 px-3 py-2">
                    <Label className="whitespace-nowrap text-sm font-bold text-[#ff4000]">📦 Stock</Label>
                    <Input
                      type="number"
                      min={0}
                      value={itemForm.stock_quantity}
                      onChange={(e) => setItemForm(prev => ({ ...prev, stock_quantity: e.target.value }))}
                      placeholder="vide=illimité"
                      className="h-9 font-semibold"
                    />
                  </div>
                  {/* SECTION — regroupement libre (comme le POS vendeur), en plus de la catégorie. */}
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <Label className="whitespace-nowrap text-sm font-medium">Section</Label>
                    <Input
                      value={itemForm.section}
                      onChange={(e) => setItemForm(prev => ({ ...prev, section: e.target.value }))}
                      placeholder="ex : Midi, Bar"
                      className="h-9"
                      list="resto-sections"
                    />
                    <datalist id="resto-sections">
                      {[...new Set(menuItems.map(i => (i as any).section).filter(Boolean))].map(s => <option key={s as string} value={s as string} />)}
                    </datalist>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={itemForm.description}
                    onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('restaurantMenuManager.decrivezLePlat')}
                    rows={2}
                  />
                </div>

                {/* Médias repliables (photos + vidéo) — raccourcit le formulaire */}
                <details className="rounded-lg border">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
                    📷 Photos & vidéo du plat (optionnel){itemForm.images.length > 0 ? ` · ${itemForm.images.length} photo${itemForm.images.length > 1 ? 's' : ''}` : ''}
                  </summary>
                  <div className="space-y-3 border-t p-3">
                {/* Multi-images du plat */}
                <div className="space-y-2">
                  <Label>
                    Photos du plat
                    <span className="text-xs text-muted-foreground ml-2">
                      ({itemForm.images.length}/{MAX_IMAGES})
                    </span>
                  </Label>
                  <div className="border-2 border-dashed rounded-lg p-3 space-y-3">
                    {/* Grille d'images */}
                    {itemForm.images.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {itemForm.images.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <img
                              src={url}
                              alt={`Photo ${idx + 1}`}
                              className="w-full h-20 object-cover rounded-md"
                            />
                            {idx === 0 && (
                              <span className="absolute top-1 left-1 text-[10px] bg-primary text-primary-foreground px-1 rounded">
                                Principale
                              </span>
                            )}
                            <button
                              onClick={() => handleRemoveImage(idx)}
                              className="absolute -top-1.5 -right-1.5 p-0.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {itemForm.images.length === 0 && (
                      <div className="text-center py-2">
                        <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">{t('restaurantMenuManager.aucunePhoto')}</p>
                      </div>
                    )}
                    {itemForm.images.length < MAX_IMAGES && (
                      <label className="block text-center">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                          disabled={uploadingImage}
                        />
                        <Button variant="outline" size="sm" asChild disabled={uploadingImage}>
                          <span className="cursor-pointer">
                            {uploadingImage
                              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              : <Upload className="w-4 h-4 mr-2" />
                            }
                            {uploadingImage ? 'Upload...' : 'Ajouter une photo'}
                          </span>
                        </Button>
                      </label>
                    )}
                  </div>
                </div>

                {/* Vidéo du plat — Premium/Pro uniquement */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Vidéo du plat (max 45 s)
                    {!canUploadVideo && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Lock className="w-3 h-3" /> Premium
                      </Badge>
                    )}
                  </Label>
                  <div className={`border-2 border-dashed rounded-lg p-3 ${!canUploadVideo ? 'opacity-60' : ''}`}>
                    {itemForm.video_url ? (
                      <div className="space-y-2">
                        <video
                          src={itemForm.video_url}
                          controls
                          className="w-full rounded-md max-h-32 object-contain bg-black"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setItemForm(prev => ({ ...prev, video_url: '' }))}
                          className="w-full"
                        >
                          <X className="w-4 h-4 mr-2" /> Supprimer la vidéo
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <Video className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground mb-2">
                          {canUploadVideo ? 'MP4 / MOV · max 45 s · max 50 MB' : 'Disponible avec le plan Premium'}
                        </p>
                        {canUploadVideo && (
                          <label className="block">
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
                              disabled={uploadingVideo}
                            />
                            <Button variant="outline" size="sm" asChild disabled={uploadingVideo}>
                              <span className="cursor-pointer">
                                {uploadingVideo
                                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  : <Upload className="w-4 h-4 mr-2" />
                                }
                                {uploadingVideo ? 'Upload...' : 'Ajouter une vidéo'}
                              </span>
                            </Button>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                  </div>
                </details>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t('restaurantMenuManager.tempsDePreparationMin')}</Label>
                    <Input
                      type="number"
                      value={itemForm.preparation_time}
                      onChange={(e) => setItemForm(prev => ({ ...prev, preparation_time: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('restaurantMenuManager.niveauEpice03')}</Label>
                    <Select
                      value={itemForm.spicy_level}
                      onValueChange={(v) => setItemForm(prev => ({ ...prev, spicy_level: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">{t('restaurantMenuManager.nonEpice')}</SelectItem>
                        <SelectItem value="1">{t('restaurantMenuManager.leger')}</SelectItem>
                        <SelectItem value="2">🌶️🌶️ Moyen</SelectItem>
                        <SelectItem value="3">🌶️🌶️🌶️ Fort</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tags alimentaires</Label>
                  <div className="flex flex-wrap gap-2">
                    {DIETARY_TAGS.map(tag => (
                      <Badge
                        key={tag.value}
                        variant={itemForm.dietary_tags.includes(tag.value) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          setItemForm(prev => ({
                            ...prev,
                            dietary_tags: prev.dietary_tags.includes(tag.value)
                              ? prev.dietary_tags.filter(t => t !== tag.value)
                              : [...prev.dietary_tags, tag.value]
                          }));
                        }}
                      >
                        {tag.icon} {tag.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-[#ff4000]" />
                    <span className="text-sm font-medium">Plat signature</span>
                  </div>
                  <Switch
                    checked={itemForm.is_featured}
                    onCheckedChange={(v) => setItemForm(prev => ({ ...prev, is_featured: v }))}
                  />
                </div>

                {/* OPTIONS / SUPPLÉMENTS PAYANTS (repliable) — groupes (ex. « Taille », « Suppléments ») */}
                <details className="rounded-lg border" open={itemForm.variants.groups.length > 0}>
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
                    ⚙️ Options / suppléments (optionnel){itemForm.variants.groups.length > 0 ? ` · ${itemForm.variants.groups.length} groupe${itemForm.variants.groups.length > 1 ? 's' : ''}` : ''}
                  </summary>
                  <div className="space-y-3 border-t p-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Groupes d'options</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => setItemForm(prev => ({ ...prev, variants: { groups: [...prev.variants.groups, { id: uid(), name: '', min: 0, max: 1, options: [] }] } }))}>
                      <Plus className="w-4 h-4 mr-1" /> Groupe
                    </Button>
                  </div>
                  {itemForm.variants.groups.length === 0 && (
                    <p className="text-xs text-muted-foreground">{t('restaurantMenuManager.aucuneOptionExTailleUnique')}</p>
                  )}
                  {itemForm.variants.groups.map((g, gi) => (
                    <div key={g.id} className="space-y-2 rounded-md bg-muted/40 p-2">
                      <div className="flex items-center gap-2">
                        <Input placeholder={t('restaurantMenuManager.nomDuGroupeExTaille')} value={g.name}
                          onChange={(e) => setItemForm(prev => { const groups = [...prev.variants.groups]; groups[gi] = { ...g, name: e.target.value }; return { ...prev, variants: { groups } }; })} />
                        <Input type="number" min={1} className="w-16" title="Choix max" value={g.max}
                          onChange={(e) => setItemForm(prev => { const groups = [...prev.variants.groups]; groups[gi] = { ...g, max: Math.max(1, +e.target.value || 1) }; return { ...prev, variants: { groups } }; })} />
                        <label className="flex items-center gap-1 text-xs whitespace-nowrap"><input type="checkbox" checked={g.min > 0} onChange={(e) => setItemForm(prev => { const groups = [...prev.variants.groups]; groups[gi] = { ...g, min: e.target.checked ? 1 : 0 }; return { ...prev, variants: { groups } }; })} />Oblig.</label>
                        <Button type="button" size="icon" variant="ghost" onClick={() => setItemForm(prev => ({ ...prev, variants: { groups: prev.variants.groups.filter((_, i) => i !== gi) } }))}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                      {g.options.map((o, oi) => (
                        <div key={o.id} className="flex items-center gap-2 pl-2">
                          <Input placeholder="Option (ex. Grande)" value={o.name}
                            onChange={(e) => setItemForm(prev => { const groups = [...prev.variants.groups]; const options = [...g.options]; options[oi] = { ...o, name: e.target.value }; groups[gi] = { ...g, options }; return { ...prev, variants: { groups } }; })} />
                          <Input type="number" min={0} className="w-24" placeholder="+ GNF" value={o.price}
                            onChange={(e) => setItemForm(prev => { const groups = [...prev.variants.groups]; const options = [...g.options]; options[oi] = { ...o, price: Math.max(0, +e.target.value || 0) }; groups[gi] = { ...g, options }; return { ...prev, variants: { groups } }; })} />
                          <Button type="button" size="icon" variant="ghost" onClick={() => setItemForm(prev => { const groups = [...prev.variants.groups]; groups[gi] = { ...g, options: g.options.filter((_, i) => i !== oi) }; return { ...prev, variants: { groups } }; })}><X className="w-4 h-4" /></Button>
                        </div>
                      ))}
                      <Button type="button" size="sm" variant="ghost" className="ml-2" onClick={() => setItemForm(prev => { const groups = [...prev.variants.groups]; groups[gi] = { ...g, options: [...g.options, { id: uid(), name: '', price: 0 }] }; return { ...prev, variants: { groups } }; })}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Option
                      </Button>
                    </div>
                  ))}
                  </div>
                </details>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowItemDialog(false)}>{t('restaurantMenuManager.annuler')}</Button>
                <Button onClick={handleSaveItem}>{editingItem ? 'Mettre à jour' : 'Créer'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtres par catégorie */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={!selectedCategory ? 'filter-active' : 'filter'}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(null)}
          >
            Tous ({menuItems.length})
          </Badge>
          {categories.map(cat => {
            const count = menuItems.filter(i => i.category_id === cat.id).length;
            return (
              <Badge
                key={cat.id}
                variant={selectedCategory === cat.id ? 'filter-active' : 'filter'}
                className="cursor-pointer group"
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.icon} {cat.name} ({count})
                <button
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); handleEditCategory(cat); }}
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Liste des plats */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || selectedCategory
                ? 'Aucun plat trouvé avec ces filtres'
                : 'Ajoutez votre premier plat au menu'}
            </p>
            {!searchQuery && !selectedCategory && (
              <Button className="mt-4" onClick={() => setShowItemDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un plat
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => {
            const category = categories.find(c => c.id === item.category_id);
            const displayImages = item.images && item.images.length > 0
              ? item.images
              : item.image_url
                ? [item.image_url]
                : [];
            return (
              <Card key={item.id} className={`relative ${!item.is_available ? 'opacity-60' : ''}`}>
                {item.is_featured && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge className="bg-[#ff4000]">
                      <Star className="w-3 h-3 mr-1" />
                      Signature
                    </Badge>
                  </div>
                )}
                {item.is_new && (
                  <div className="absolute top-2 left-2 z-10">
                    <Badge variant="secondary">{t('restaurantMenuManager.nouveau')}</Badge>
                  </div>
                )}

                {/* Aperçu image principale */}
                {displayImages.length > 0 && (
                  <div className="relative h-32 overflow-hidden rounded-t-lg">
                    <img
                      src={displayImages[0]}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    {displayImages.length > 1 && (
                      <span className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 rounded">
                        +{displayImages.length - 1}
                      </span>
                    )}
                    {item.video_url && (
                      <span className="absolute bottom-1 left-1 bg-black/60 text-white rounded p-0.5">
                        <Video className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                )}

                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{item.name}</h3>
                      {category && (
                        <span className="text-xs text-muted-foreground">
                          {category.icon} {category.name}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-primary">{formatCurrency(item.price)}</span>
                  </div>

                  {item.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
                  )}

                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.spicy_level > 0 && (
                      <Badge variant="outline" className="text-xs">{'🌶️'.repeat(item.spicy_level)}</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      <Clock className="w-3 h-3 mr-1" />{item.preparation_time} min
                    </Badge>
                    {/* STOCK : nombre disponible (suivi) ou « illimité ». */}
                    {item.stock_quantity == null ? (
                      <Badge variant="outline" className="text-xs text-muted-foreground">{t('restaurantMenuManager.stockIllimite')}</Badge>
                    ) : item.stock_quantity <= 0 ? (
                      <Badge variant="outline" className="text-xs border-red-300 text-red-600">{t('restaurantMenuManager.epuise')}</Badge>
                    ) : (
                      <Badge variant="outline" className={`text-xs ${item.stock_quantity <= 5 ? 'border-orange-300 text-orange-600' : 'border-emerald-300 text-emerald-700'}`}>
                        {item.stock_quantity} en stock
                      </Badge>
                    )}
                    {item.dietary_tags?.map(tag => {
                      const tagInfo = DIETARY_TAGS.find(t => t.value === tag);
                      return tagInfo ? (
                        <Badge key={tag} variant="outline" className="text-xs">{tagInfo.icon}</Badge>
                      ) : null;
                    })}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // On ne peut pas remettre « Disponible » un plat à stock 0 : il faut réapprovisionner.
                        if (!item.is_available && item.stock_quantity === 0) {
                          toast.error(t('restaurantMenuManager.stockA0ReapprovisionnezLe'));
                          return;
                        }
                        toggleItemAvailability(item.id);
                      }}
                    >
                      {item.is_available ? (
                        <><Eye className="w-4 h-4 mr-1 text-[#ff4000]" /><span className="text-[#ff4000]">Disponible</span></>
                      ) : (
                        <><EyeOff className="w-4 h-4 mr-1" />Indisponible</>
                      )}
                    </Button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditItem(item)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RestaurantMenuManager;

/** Lit la durée d'un fichier vidéo via l'API HTML5 */
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration); };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Impossible de lire la vidéo')); };
    video.src = url;
  });
}
