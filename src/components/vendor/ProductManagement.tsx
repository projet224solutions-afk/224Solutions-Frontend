/**
 * PRODUCT MANAGEMENT - VERSION REFACTORISÉE & OPTIMISÉE
 * Interface professionnelle avec gestion IA améliorée
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { formatCurrency } from '@/lib/formatters';
import { readSectionCache, writeSectionCache, isBrowserOffline } from '@/lib/offline/sectionCache';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useProductActions } from "@/hooks/useProductActions";
import { useVendorErrorBoundary } from "@/hooks/useVendorErrorBoundary";
import { SubscriptionService } from "@/services/subscriptionService";
import { ProductLimitService, ProductLimitStatus } from "@/services/productLimitService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PublicIdBadge } from "@/components/PublicIdBadge";
import {
  Package, Plus, Search, Filter, Edit, Trash2,
  ShoppingCart, TrendingUp, Camera, Save, X, Copy,
  Sparkles, Loader2, ImagePlus, Tags, FolderOpen, AlertCircle, Video
} from "lucide-react";
import { ProductBarcodeDisplay } from "./ProductBarcodeDisplay";
import { BarcodeLabelsA4Generator } from "./BarcodeLabelsA4Generator";

interface Product {
  id: string;
  public_id?: string;
  name: string;
  description?: string;
  price: number;
  compare_price?: number;
  cost_price?: number;
  sku?: string;
  barcode?: string;
  // Stock affiché côté produit (peut être synchronisé depuis inventory)
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  category_id?: string;
  category?: { id: string; name: string } | null;
  section?: string; // Section personnalisée du vendeur
  images?: string[];
  promotional_videos?: string[]; // URLs des vidéos publicitaires (max 2)
  tags?: string[];
  weight?: number;
  created_at?: string;
  // Jointure inventory pour valeur/stock exacts
  inventory?: { quantity: number | null } | Array<{ quantity: number | null }> | null;
  // Champs carton
  sell_by_carton?: boolean;
  units_per_carton?: number;
  price_carton?: number;
  carton_sku?: string;
}

interface Category {
  id: string;
  name: string;
  is_active: boolean;
}

export default function ProductManagement() {
  const { t } = useTranslation();
  // fc CONVERTIT le montant (stocké en GNF) vers la devise du vendeur au taux BCRG,
  // contrairement à formatCurrency() qui ne fait que formater sans convertir.
  const fc = useFormatCurrency();
  const { vendorId, user, loading: vendorLoading } = useCurrentVendor();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { captureError } = useVendorErrorBoundary();

  // ------------------------------
  // Persistence UI (anti-fermeture sur refresh mobile)
  // ------------------------------
  const PRODUCT_DRAFT_VERSION = 1;
  const PRODUCT_DRAFT_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2h
  const productDraftKey = useMemo(
    () => (vendorId ? `vendor_product_draft_v${PRODUCT_DRAFT_VERSION}:${vendorId}` : null),
    [vendorId]
  );
  const draftRestoredRef = useRef(false);
  const draftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Product actions hook
  const {
    createProduct,
    updateProduct,
    deleteProduct,
    duplicateProduct,
  } = useProductActions({
    vendorId,
    onProductCreated: () => {
      fetchProducts();
      if (productDraftKey) localStorage.removeItem(productDraftKey);
      setShowDialog(false);
      resetForm();
    },
    onProductUpdated: () => {
      fetchProducts();
      if (productDraftKey) localStorage.removeItem(productDraftKey);
      setShowDialog(false);
      resetForm();
    },
    onProductDeleted: () => {
      fetchProducts();
    }
  });

  // State management
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [categoryMode, setCategoryMode] = useState<'existing' | 'new'>('existing');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [productLimit, setProductLimit] = useState<{
    current_count: number;
    max_products: number | null;
    can_add: boolean;
    is_unlimited: boolean;
  } | null>(null);
  const [productLimitStatus, setProductLimitStatus] = useState<ProductLimitStatus | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    compare_price: '',
    cost_price: '',
    sku: '',
    barcode: '',
    stock_quantity: '',
    low_stock_threshold: '10',
    category_id: '',
    category_name: '',
    section: '', // Section personnalisée du vendeur
    weight: '',
    tags: '',
    is_active: true,
    // Champs carton
    sell_by_carton: false,
    units_per_carton: '',
    price_carton: '',
    carton_sku: '',
    cartons_in_stock: ''
  });

  const saveDraftNow = useCallback(() => {
    if (!productDraftKey) return;
    // On ne persiste que le mode création (pas l'édition) pour éviter les incohérences.
    if (!showDialog || !!editingProduct) return;
    if (saving) return;

    try {
      const payload = {
        ts: Date.now(),
        mode: 'create' as const,
        formData,
      };
      localStorage.setItem(productDraftKey, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [productDraftKey, showDialog, editingProduct, saving, formData]);

  const clearDraft = useCallback(() => {
    if (!productDraftKey) return;
    try {
      localStorage.removeItem(productDraftKey);
    } catch {
      // ignore
    }
  }, [productDraftKey]);

  // Si le dialog est fermé (ou si on passe en mode édition), on nettoie le draft
  useEffect(() => {
    if (!productDraftKey) return;
    if (!showDialog || !!editingProduct) {
      clearDraft();
    }
  }, [productDraftKey, showDialog, editingProduct, clearDraft]);

  // Restaurer le draft si la page se "refresh" quand l'utilisateur sort/revient
  useEffect(() => {
    if (!productDraftKey || !vendorId || vendorLoading) return;
    if (draftRestoredRef.current) return;
    draftRestoredRef.current = true;

    try {
      const raw = localStorage.getItem(productDraftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { ts?: number; mode?: string; formData?: any };
      const ts = typeof parsed?.ts === 'number' ? parsed.ts : 0;
      if (!ts || Date.now() - ts > PRODUCT_DRAFT_MAX_AGE_MS) {
        localStorage.removeItem(productDraftKey);
        return;
      }
      if (parsed?.mode !== 'create' || !parsed?.formData) return;

      // Réouvrir le formulaire et restaurer les champs
      setEditingProduct(null);
      setFormData((prev) => ({ ...prev, ...parsed.formData }));
      setShowDialog(true);
    } catch {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productDraftKey, vendorId, vendorLoading]);

  // Sauvegarde automatique (debounced) + sauvegarde immédiate sur sortie d'onglet/app
  useEffect(() => {
    if (!productDraftKey) return;
    if (!showDialog || !!editingProduct) return;

    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    draftSaveTimeoutRef.current = setTimeout(() => {
      saveDraftNow();
    }, 250);

    return () => {
      if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    };
  }, [productDraftKey, showDialog, editingProduct, formData, saveDraftNow]);

  useEffect(() => {
    if (!productDraftKey) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveDraftNow();
    };
    const handlePageHide = () => saveDraftNow();
    const handleBlur = () => saveDraftNow();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('blur', handleBlur);
    };
  }, [productDraftKey, saveDraftNow]);

  // Load initial data
  useEffect(() => {
    if (!vendorId || vendorLoading) return;
    fetchData();
    loadProductLimit();
    loadPremiumStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, vendorLoading]);

  // Check if we should open the dialog from URL params (action=new)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new' && !vendorLoading && vendorId) {
      setShowDialog(true);
      setEditingProduct(null);
      resetForm();
      // Remove the param from URL to avoid reopening on refresh
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, vendorLoading, vendorId]);

  const loadProductLimit = async () => {
    if (!user?.id) return;
    const limit = await SubscriptionService.checkProductLimit(user.id);
    setProductLimit(limit);
  };

  // Check and cache premium status
  const loadPremiumStatus = async () => {
    if (!user?.id) {
      setIsPremium(false);
      return;
    }
    try {
      // Get ALL active subscriptions (user might have multiple)
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('plan_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (subError || !subData || subData.length === 0) {
        setIsPremium(false);
        return;
      }

      // Check if ANY subscription is premium/pro/business/enterprise
      const planIds = subData.map(s => s.plan_id);
      const { data: planData } = await supabase
        .from('plans')
        .select('name')
        .in('id', planIds);

      const hasPremium = (planData || []).some(p => {
        const name = (p.name as string || '').toLowerCase();
        return name.includes('premium') || name.includes('enterprise') || name.includes('pro') || name.includes('business');
      });

      console.log('[Premium Check] Has premium:', hasPremium, planData);
      setIsPremium(hasPremium);
    } catch (e) {
      console.error('[Premium Check] Error:', e);
      setIsPremium(false);
    }
  };

  // Check if user has premium subscription (for immediate validation)
  const checkPremiumStatus = async (): Promise<boolean> => {
    if (isPremium) return true;
    // Refresh and return
    await loadPremiumStatus();
    return isPremium;
  };

  // Handle video upload with 10 second validation
  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if user has premium subscription
    const isPremium = await checkPremiumStatus();
    if (!isPremium) {
      toast.error(t('productManagement.fonctionnalitePremiumUniquement'), {
        description: t('productManagement.passezAUnAbonnementPremium'),
        action: {
          label: t('productManagement.voirLesOffres'),
          onClick: () => navigate('/vendeur/subscription')
        }
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast.error(t('productManagement.formatInvalideVeuillezSelectionnerUne'));
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast.error(t('productManagement.videoTropVolumineuseTailleMaximale'));
      return;
    }

    // Check max 2 videos (including existing ones)
    const totalVideos = selectedVideos.length + (editingProduct?.promotional_videos?.length || 0);
    if (totalVideos >= 2) {
      toast.error(t('productManagement.maximum2VideosParProduit'));
      return;
    }

    // Validate video duration (max 45 seconds)
    try {
      setUploadingVideo(true);
      const video = document.createElement('video');
      video.preload = 'metadata';

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          if (video.duration > 45) {
            reject(new Error('Durée maximale dépassée'));
          } else {
            resolve();
          }
        };
        video.onerror = () => reject(new Error('Erreur de lecture'));
        video.src = URL.createObjectURL(file);
      });

      setSelectedVideos(prev => [...prev, file]);
      toast.success(`✅ Vidéo ${selectedVideos.length + 1}/2 ajoutée`);
    } catch (error: any) {
      if (error.message === 'Durée maximale dépassée') {
        toast.error(t('productManagement.videoTropLongueDureeMaximale'));
      } else {
        toast.error(t('productManagement.erreurLorsDeLaValidation'));
      }
    } finally {
      setUploadingVideo(false);
    }
  };

  const fetchData = async () => {
    if (!vendorId) return;
    try {
      setLoading(true);
      await Promise.all([fetchProducts(), fetchCategories()]);
    } catch (error: any) {
      captureError('product', 'Failed to fetch products', error);
      toast.error(t('productManagement.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    if (!vendorId) return;

    // 📴 Hors ligne : afficher le dernier catalogue connu (cache), sans réseau.
    if (isBrowserOffline()) {
      const cached = readSectionCache<Product>('products', vendorId);
      if (cached) setProducts(cached);
      return;
    }

    try {
      // 1. Appliquer les limites d'abonnement et désactiver les produits en excès
      const limitStatus = await ProductLimitService.enforceProductLimit(vendorId, user?.id);
      setProductLimitStatus(limitStatus);

      // 2. Notifier le vendeur si des produits ont été désactivés
      if (limitStatus.excess_products > 0) {
        ProductLimitService.notifyProductDeactivation(limitStatus);
      }

      // 3. Charger les produits mis à jour
      const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(id, name), inventory:inventory(quantity)')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        captureError('product', 'Failed to fetch products', error);
        // Échec réseau silencieux → repli sur le cache.
        const cached = readSectionCache<Product>('products', vendorId);
        if (cached) setProducts(cached);
        return;
      }

      setProducts((data || []) as Product[]);
      writeSectionCache('products', vendorId, (data || []) as Product[]);
    } catch (error: any) {
      captureError('product', 'Failed to enforce product limits', error);
      console.error('[ProductLimit] Error:', error);

      // Charger quand même les produits même en cas d'erreur
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*, category:categories(id, name), inventory:inventory(quantity)')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (!fetchError) {
        setProducts((data || []) as Product[]);
        writeSectionCache('products', vendorId, (data || []) as Product[]);
      } else {
        const cached = readSectionCache<Product>('products', vendorId);
        if (cached) setProducts(cached);
      }
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      captureError('product', 'Failed to fetch categories', error);
      console.error('[Categories] Fetch error:', error);
      return;
    }

    console.log('[Categories] Loaded:', data?.length, 'categories', data);
    setCategories(data || []);
  };

  // Handlers
  const handleSave = async () => {
    const payload: typeof formData = { ...formData };

    if (payload.sell_by_carton) {
      const unitsPerCarton = parseInt(payload.units_per_carton || '', 10);
      if (!unitsPerCarton || Number.isNaN(unitsPerCarton) || unitsPerCarton < 1) {
        toast.error(t('productManagement.veuillezRenseignerUnitesParCarton'));
        return;
      }

      if (payload.cartons_in_stock && payload.cartons_in_stock.trim() !== '') {
        const cartons = parseInt(payload.cartons_in_stock, 10);
        if (Number.isNaN(cartons) || cartons < 0) {
          toast.error(t('productManagement.nombreDeCartonsInvalide'));
          return;
        }
        payload.stock_quantity = String(cartons * unitsPerCarton);
      }
    }

    if (!payload.name || !payload.price || !payload.stock_quantity) {
      toast.error(t('productManagement.veuillezRemplirTousLesChamps'));
      return;
    }

    // Prix barré : doit être strictement supérieur au prix de vente
    if (payload.compare_price && payload.compare_price.trim() !== '') {
      const comparePrice = parseFloat(payload.compare_price);
      const sellPrice = parseFloat(payload.price);
      if (!Number.isNaN(comparePrice) && comparePrice > 0 && comparePrice <= sellPrice) {
        toast.error(t('productManagement.lePrixBarreDoitEtre'));
        return;
      }
    }

    // Validation obligatoire de l'image
    const hasExistingImages = editingProduct?.images && editingProduct.images.length > 0;
    const hasNewImages = selectedImages.length > 0;
    if (!hasExistingImages && !hasNewImages) {
      toast.error(t('productManagement.veuillezAjouterAuMoinsUne'));
      return;
    }

    if (saving) return;
    setSaving(true);

    try {
      console.log('[ProductSave] Starting save...', {
        isEditing: !!editingProduct,
        formData: payload,
        categoryMode,
        categoriesLoaded: categories.length,
      });

      if (editingProduct) {
        const result = await updateProduct(
          editingProduct.id,
          payload,
          selectedImages,
          editingProduct.images || [],
          selectedVideos,
          editingProduct.promotional_videos || []
        );
        console.log('[ProductSave] Update result:', result);
      } else {
        const result = await createProduct(payload, selectedImages, selectedVideos);
        console.log('[ProductSave] Create result:', result);
        if (!result.success) {
          console.error('[ProductSave] Creation failed');
        }
      }
    } catch (error: any) {
      console.error('[ProductSave] Exception:', error);
      captureError('product', 'Failed to save product', error);
      toast.error(`Erreur: ${error.message || 'Échec de la sauvegarde'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product: Product) => {
    // Stock exact basé sur inventory si disponible
    const inv = product.inventory as any;
    const invQty = Array.isArray(inv) ? inv?.[0]?.quantity : inv?.quantity;
    const effectiveStock = (typeof invQty === 'number' ? invQty : product.stock_quantity) || 0;

    const unitsPerCarton = Number(product.units_per_carton || 0);
    const cartonsInStock =
      product.sell_by_carton && unitsPerCarton > 1
        ? String(Math.floor(effectiveStock / unitsPerCarton))
        : '';

    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      compare_price: product.compare_price?.toString() || '',
      cost_price: product.cost_price?.toString() || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      stock_quantity: String(effectiveStock),
      low_stock_threshold: product.low_stock_threshold.toString(),
      category_id: product.category_id || '',
      category_name: '',
      section: product.section || '', // Section personnalisée
      weight: product.weight?.toString() || '',
      tags: product.tags?.join(', ') || '',
      is_active: product.is_active,
      // Champs carton
      sell_by_carton: product.sell_by_carton || false,
      units_per_carton: product.units_per_carton?.toString() || '',
      price_carton: product.price_carton?.toString() || '',
      carton_sku: product.carton_sku || '',
      cartons_in_stock: cartonsInStock,
    });
    setCategoryMode(product.category_id ? 'existing' : 'new');
    setShowDialog(true);
  };

  const handleDelete = async (productId: string) => {
    if (!confirm(t('productManagement.etesVousSurDeVouloir'))) return;

    try {
      const success = await deleteProduct(productId);
      if (success) {
        // Recharger les produits et réappliquer les limites
        await fetchProducts();
        await loadProductLimit();
      }
    } catch (error: any) {
      captureError('product', 'Failed to delete product', error);
      toast.error(t('productManagement.erreurLorsDeLaSuppression'));
    }
  };

  const handleDuplicate = async (productId: string) => {
    if (!confirm(t('productManagement.voulezVousCreerUneCopie'))) return;

    try {
      await duplicateProduct(productId);
      toast.success(t('productManagement.produitDupliqueAvecSucces'));
      fetchProducts();
    } catch (error: any) {
      captureError('product', 'Failed to duplicate product', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      compare_price: '',
      cost_price: '',
      sku: '',
      barcode: '',
      stock_quantity: '',
      low_stock_threshold: '10',
      category_id: '',
      category_name: '',
      section: '', // Section personnalisée
      weight: '',
      tags: '',
      is_active: true,
      // Champs carton
      sell_by_carton: false,
      units_per_carton: '',
      price_carton: '',
      carton_sku: '',
      cartons_in_stock: '',
    });
    setEditingProduct(null);
    setSelectedImages([]);
    setSelectedVideos([]);
    setCategoryMode('existing');
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const imageFiles = Array.from(files).filter(file =>
      file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024
    );

    if (imageFiles.length !== files.length) {
      toast.error('Certains fichiers ont été ignorés (format invalide ou taille > 10MB)');
    }

    setSelectedImages(prev => [...prev, ...imageFiles]);
    toast.success(`${imageFiles.length} image(s) sélectionnée(s)`);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Retirer une image EXISTANTE (édition) — propagée à updateProduct via editingProduct.images
  const removeExistingImage = (index: number) => {
    setEditingProduct(prev => prev
      ? { ...prev, images: (prev.images || []).filter((_, i) => i !== index) }
      : prev);
  };

  // AI Generation Functions
  const handleGenerateDescription = async () => {
    if (!formData.name) {
      toast.error(t('productManagement.veuillezEntrerLeNomDu'));
      return;
    }

    try {
      setGeneratingDescription(true);
      toast.info(t('productManagement.generationIaEnCours'));

      const categoryName = categoryMode === 'existing' && formData.category_id
        ? categories.find(c => c.id === formData.category_id)?.name
        : formData.category_name || undefined;

      const { data, error } = await supabase.functions.invoke('generate-product-description', {
        body: {
          productName: formData.name,
          category: categoryName,
          price: formData.price ? parseInt(formData.price) : undefined
        }
      });

      if (error) throw error;

      if (data?.description) {
        setFormData(prev => ({ ...prev, description: data.description }));
        toast.success(t('productManagement.descriptionGenereeParIa'));
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Erreur génération description:', error);
      toast.error(error.message || 'Erreur lors de la génération');
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!formData.name) {
      toast.error(t('productManagement.veuillezEntrerLeNomDu'));
      return;
    }

    try {
      setGeneratingImage(true);

      const categoryName = categoryMode === 'existing' && formData.category_id
        ? categories.find(c => c.id === formData.category_id)?.name
        : formData.category_name || undefined;

      // Image de référence : image existante du produit, sinon 1ère image sélectionnée
      // ⚠️ Ne JAMAIS envoyer une image en base64 (data:) à l'edge function :
      // payload énorme → "Failed to send a request", et l'IA ne sait pas fetch une URL data:.
      // generate-similar-image n'est utilisé QUE si on a une vraie URL http(s) (produit existant).
      const referenceUrl: string | null = editingProduct?.images?.[0] || null;
      const hasHttpRef = !!referenceUrl && /^https?:\/\//i.test(referenceUrl);

      let generatedUrl: string | undefined;

      // 1) Image "similaire" (URL réelle uniquement) — avec repli si échec
      if (hasHttpRef) {
        try {
          toast.info(t('productManagement.generationDUneImageSimilaire'));
          const { data, error } = await supabase.functions.invoke('generate-similar-image', {
            body: { imageUrl: referenceUrl, productName: formData.name, description: formData.description }
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          generatedUrl = data?.similarImageUrl;
        } catch (simErr) {
          console.warn('[AI image] generate-similar-image échoué → repli generate-product-image', simErr);
          generatedUrl = undefined; // repli ci-dessous
        }
      }

      // 2) Repli (ou nouveau produit) : génération fraîche depuis le titre + description
      if (!generatedUrl) {
        toast.info(t('productManagement.generationImageIaEnCours'));
        const { data, error } = await supabase.functions.invoke('generate-product-image', {
          body: { productName: formData.name, category: categoryName, description: formData.description }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        generatedUrl = data?.imageUrl;
      }

      if (!generatedUrl) throw new Error('Aucune image générée');

      // Convertir (base64 ou URL) en fichier
      const response = await fetch(generatedUrl);
      const blob = await response.blob();
      const file = new File([blob], `ai-generated-${Date.now()}.png`, { type: 'image/png' });
      setSelectedImages(prev => [...prev, file]);
      toast.success(t('productManagement.imageGenereeParIa'));
    } catch (error: any) {
      console.error('Erreur génération image:', error);
      toast.error(error.message || 'Erreur lors de la génération');
    } finally {
      setGeneratingImage(false);
    }
  };

  // Generate SKU
  const handleGenerateSKU = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const sku = `SKU-${timestamp}-${random}`;
    setFormData(prev => ({ ...prev, sku }));
    toast.success(t('productManagement.skuGenere'));
  };

  // Generate Barcode (EAN-13 format)
  const handleGenerateBarcode = () => {
    // Generate a valid EAN-13 barcode
    const prefix = '224'; // Guinea country code
    const randomDigits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
    const baseCode = prefix + randomDigits;

    // Calculate check digit for EAN-13
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(baseCode[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;

    const barcode = baseCode + checkDigit;
    setFormData(prev => ({ ...prev, barcode }));
    toast.success(t('productManagement.codeBarresEan13Genere'));
  };

  // Helpers (stock exact basé sur inventory si disponible)
  const getEffectiveStock = (product: Product) => {
    const inv = product.inventory as any;
    const invQty = Array.isArray(inv) ? inv?.[0]?.quantity : inv?.quantity;
    return (typeof invQty === 'number' ? invQty : product.stock_quantity) || 0;
  };

  // Filtering
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.sku?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' ||
                           (statusFilter === 'active' && product.is_active) ||
                           (statusFilter === 'inactive' && !product.is_active);

      const effectiveStock = getEffectiveStock(product);
      const matchesLowStock = !lowStockFilter ||
                             effectiveStock <= product.low_stock_threshold;

      const matchesCategory = categoryFilter === 'all' ||
                             product.category_id === categoryFilter;

      return matchesSearch && matchesStatus && matchesLowStock && matchesCategory;
    });
  }, [products, searchTerm, statusFilter, lowStockFilter, categoryFilter]);

  // Stats
  const stats = useMemo(() => {
    const totalValue = products.reduce((sum, p) => sum + (p.price * getEffectiveStock(p)), 0);
    const lowStock = products.filter(p => getEffectiveStock(p) <= p.low_stock_threshold).length;

    return {
      total: products.length,
      active: products.filter(p => p.is_active).length,
      lowStock,
      totalValue,
    };
  }, [products]);

  // Get unique categories used in products
  const usedCategories = useMemo(() => {
    const categoryIds = new Set(products.map(p => p.category_id).filter(Boolean));
    return categories.filter(c => categoryIds.has(c.id));
  }, [products, categories]);

  if (vendorLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Product Limit Exceeded Banner - Produits désactivés */}
      {productLimitStatus && productLimitStatus.excess_products > 0 && (
        <Card className="border-[#ff4000] bg-orange-50 dark:bg-[#ff4000]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-[#ff4000] dark:text-[#ff4000] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-[#ff4000] dark:text-orange-100">
                  ⚠️ Produits automatiquement désactivés
                </h3>
                <p className="text-sm text-[#ff4000] dark:text-orange-200 mt-1">
                  Vous avez {productLimitStatus.active_products} produits actifs mais votre abonnement ne permet que {productLimitStatus.max_allowed} produits actifs.
                  <br />
                  <strong>{productLimitStatus.excess_products} produit(s)</strong> ont été automatiquement désactivés et ne sont pas visibles sur le marketplace.
                  <br />
                  Les produits actifs les plus récents restent actifs, les plus anciens parmi les actifs sont désactivés.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={() => navigate('/vendeur/subscription')}
                    size="sm"
                    variant="default"
                  >
                    Mettre à niveau pour réactiver tous mes produits
                  </Button>
                  <Button
                    onClick={fetchProducts}
                    size="sm"
                    variant="outline"
                  >
                    Actualiser
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Limit Banner */}
      {productLimit && !productLimit.can_add && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                  🚫 Limite de produits atteinte
                </h3>
                <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                  Vous avez atteint la limite de {productLimit.max_products} produits pour votre plan actuel ({productLimit.current_count}/{productLimit.max_products}).
                </p>
                <Button
                  onClick={() => navigate('/vendeur/subscription')}
                  size="sm"
                  className="mt-3"
                  variant="default"
                >
                  Mettre à niveau mon abonnement
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Limit Info (when can add) */}
      {productLimit && productLimit.can_add && !productLimit.is_unlimited && (
        <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Produits: {productLimit.current_count}/{productLimit.max_products}
                </span>
              </div>
              <Button
                onClick={() => navigate('/vendeur/subscription')}
                size="sm"
                variant="ghost"
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Voir plans
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 md:h-8 md:w-8 text-primary flex-shrink-0" />
          <div>
            <h1 className="text-lg md:text-3xl font-bold">
              Gestion des produits
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Gérez votre catalogue de produits
            </p>
          </div>
        </div>
        {/* Boutons en grille sur mobile */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <BarcodeLabelsA4Generator vendorId={vendorId || ''} />
          <Button
            onClick={() => { resetForm(); setShowDialog(true); }}
            className="w-full sm:w-auto text-sm"
            disabled={productLimit && !productLimit.can_add}
          >
            <Plus className="h-4 w-4 mr-1 shrink-0" />
            <span className="truncate">{t('productManagement.nouveau')}</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card className="p-2 md:p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 md:p-6 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">{t('productManagement.totalProduits')}</CardTitle>
            <Package className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-2 md:p-6 pt-0">
            <div className="text-lg md:text-2xl font-bold">{stats.total}</div>
            <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground">
              <span className="text-[#ff4000]">✓ {stats.active} actifs</span>
              {stats.total - stats.active > 0 && (
                <span className="text-[#ff4000]">● {stats.total - stats.active} désactivés</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="p-2 md:p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 md:p-6 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Stock Bas</CardTitle>
            <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-orange-500" />
          </CardHeader>
          <CardContent className="p-2 md:p-6 pt-0">
            <div className="text-lg md:text-2xl font-bold text-orange-500">{stats.lowStock}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-1">
              Réappro. requis
            </p>
          </CardContent>
        </Card>

        <Card className="p-2 md:p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 md:p-6 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Valeur Stock</CardTitle>
            <ShoppingCart className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-2 md:p-6 pt-0">
            <div className="text-sm md:text-2xl font-bold truncate">
              {fc(stats.totalValue)}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-1">
              Valeur inventaire
            </p>
          </CardContent>
        </Card>

        <Card className="p-2 md:p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 md:p-6 pb-1 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">{t('productManagement.categories')}</CardTitle>
            <FolderOpen className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-2 md:p-6 pt-0">
            <div className="text-lg md:text-2xl font-bold">{usedCategories.length}</div>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              Catégories utilisées
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 md:pt-6 md:p-6">
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('productManagement.rechercherUnProduit')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9 md:h-10 text-sm"
              />
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap gap-2">
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-[130px] h-9 text-xs md:text-sm">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('productManagement.tous')}</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="inactive">Inactifs</SelectItem>
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs md:text-sm">
                  <FolderOpen className="h-3 w-3 mr-1" />
                  <SelectValue placeholder={t('productManagement.categorie')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('productManagement.toutesCategories')}</SelectItem>
                  {usedCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Low Stock Filter */}
              <Button
                variant={lowStockFilter ? "default" : "outline"}
                onClick={() => setLowStockFilter(!lowStockFilter)}
                className="h-9 text-xs md:text-sm px-3"
                size="sm"
              >
                <Filter className="h-3 w-3 mr-1" />
                Stock bas
                {stats.lowStock > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {stats.lowStock}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-4">
        {filteredProducts.map((product) => (
          <Card
            key={product.id}
            className={`overflow-hidden group hover:shadow-md transition-all ${
              !product.is_active ? 'opacity-60 blur-[1px] hover:blur-[0.5px]' : ''
            }`}
          >
            {/* Product Image */}
            <div className={`aspect-square bg-muted relative ${!product.is_active ? 'grayscale' : ''}`}>
              {product.images && product.images[0] ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Package className="h-8 w-8 md:h-12 md:w-12 text-muted-foreground" />
                </div>
              )}
              {product.public_id && (
                <div className="absolute top-1 left-1 md:top-2 md:left-2">
                  <PublicIdBadge publicId={product.public_id} variant="default" className="text-[8px] md:text-xs px-1 md:px-2" />
                </div>
              )}
              {!product.is_active && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                  <Badge className="text-xs md:text-sm px-3 py-1.5" variant="destructive">
                    ❌ Produit désactivé
                  </Badge>
                </div>
              )}
              {getEffectiveStock(product) <= product.low_stock_threshold && product.is_active && (
                <Badge className="absolute bottom-1 right-1 md:bottom-2 md:right-2 bg-orange-500 text-white text-[10px] md:text-xs px-1 md:px-2" variant="outline">
                  Stock bas
                </Badge>
              )}
            </div>

            {/* Product Info */}
            <CardHeader className="p-2 md:p-4 pb-1 md:pb-2">
              <CardTitle className="text-xs md:text-base line-clamp-2 leading-tight">{product.name}</CardTitle>
              {/* Category Badge */}
              {product.category?.name && (
                <Badge variant="secondary" className="mt-1 text-[10px] md:text-xs w-fit">
                  <FolderOpen className="h-2.5 w-2.5 md:h-3 md:w-3 mr-1" />
                  {product.category.name}
                </Badge>
              )}
            </CardHeader>

            <CardContent className="p-2 md:p-4 pt-0 space-y-1.5 md:space-y-3">
              {/* Price */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <span className="text-sm md:text-xl font-bold text-primary truncate">
                  {fc(product.price)}
                </span>
                {product.compare_price && product.compare_price > product.price && (
                  <span className="text-[10px] md:text-sm line-through text-muted-foreground">
                    {fc(product.compare_price)}
                  </span>
                )}
              </div>

              {/* Barcode - Clickable visual barcode */}
              {product.barcode && (
                <ProductBarcodeDisplay
                  barcode={product.barcode}
                  productName={product.name}
                  sku={product.sku}
                  price={product.price}
                  size="small"
                />
              )}

              {/* Stock */}
              <div className="flex items-center justify-between text-[10px] md:text-sm">
                <span className="text-muted-foreground">Stock:</span>
                <span className={`font-medium ${getEffectiveStock(product) <= product.low_stock_threshold ? 'text-orange-500' : ''}`}>
                  {getEffectiveStock(product)} unités
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-1 md:gap-2 pt-1 md:pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(product)}
                  className="flex-1 h-7 md:h-9 text-[10px] md:text-sm px-1 md:px-3"
                >
                  <Edit className="h-3 w-3 md:mr-1" />
                  <span className="hidden md:inline">{t('productManagement.editer')}</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDuplicate(product.id)}
                  className="h-7 md:h-9 px-1.5 md:px-3"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(product.id)}
                  className="h-7 md:h-9 px-1.5 md:px-3"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('productManagement.aucunProduitTrouve')}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => { resetForm(); setShowDialog(true); }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer votre premier produit
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Product Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Informations</TabsTrigger>
              <TabsTrigger value="pricing">Prix & Stock</TabsTrigger>
              <TabsTrigger value="media">Images</TabsTrigger>
            </TabsList>

            {/* Tab 1: Basic Info */}
            <TabsContent value="info" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('productManagement.nomDuProduit')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: T-shirt en coton premium"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">Description</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateDescription}
                    disabled={generatingDescription || !formData.name}
                  >
                    {generatingDescription ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Générer avec IA
                  </Button>
                </div>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('productManagement.descriptionDetailleeDuProduit')}
                  rows={4}
                />
              </div>

              {/* Category Selection - Unified */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Catégorie
                </Label>

                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    variant={categoryMode === 'existing' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setCategoryMode('existing');
                      setFormData(prev => ({ ...prev, category_name: '' }));
                    }}
                  >
                    Existante
                  </Button>
                </div>

                {categoryMode === 'existing' ? (
                  <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={categoryOpen}
                        className="w-full justify-between font-normal"
                      >
                        {formData.category_id
                          ? categories.find((cat) => cat.id === formData.category_id)?.name
                          : "Rechercher une catégorie..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder={t('productManagement.rechercherCategorie')} />
                        <CommandList>
                          <CommandEmpty>{t('productManagement.aucuneCategorieTrouvee')}</CommandEmpty>
                          <CommandGroup>
                            {categories.map((cat) => (
                              <CommandItem
                                key={cat.id}
                                value={cat.name}
                                onSelect={() => {
                                  setFormData({ ...formData, category_id: cat.id });
                                  setCategoryOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.category_id === cat.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {cat.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="space-y-1">
                    <Input
                      autoFocus
                      value={formData.category_name}
                      onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                      placeholder={t('productManagement.tapezLeNomDeLa')}
                      className="border-primary/50 focus:border-primary"
                    />
                    <p className="text-xs text-muted-foreground">
                      Une nouvelle catégorie sera créée avec ce nom lors de l'enregistrement du produit.
                    </p>
                  </div>
                )}
              </div>

              {/* Section - Affiché uniquement si une catégorie est sélectionnée */}
              {(formData.category_id || formData.category_name) && (
                <div className="space-y-2">
                  <Label htmlFor="section" className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Section (optionnel)
                  </Label>
                  <Input
                    id="section"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    placeholder="Ex: Moteurs, Accessoires, Carrosserie..."
                    className="border-muted focus:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    Organisez vos produits par section dans votre POS pour les retrouver plus facilement.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="tags" className="flex items-center gap-2">
                  <Tags className="h-4 w-4" />
                  Tags (séparés par virgules)
                </Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder={t('productManagement.etePromoNouveaute')}
                />
              </div>
            </TabsContent>

            {/* Tab 2: Pricing & Stock */}
            <TabsContent value="pricing" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">{t('productManagement.prixDeVenteGnf')}</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="50000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compare_price">{t('productManagement.prixBarreGnf')}</Label>
                  <Input
                    id="compare_price"
                    type="number"
                    value={formData.compare_price}
                    onChange={(e) => setFormData({ ...formData, compare_price: e.target.value })}
                    placeholder="70000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost_price">{t('productManagement.prixDeRevientGnf')}</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    placeholder="30000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock">{t('productManagement.quantiteEnStockUnites')}</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    placeholder="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="threshold">Seuil stock bas</Label>
                  <Input
                    id="threshold"
                    type="number"
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                    placeholder="10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sku">Code SKU</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateSKU}
                      className="h-6 px-2 text-xs"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Générer
                    </Button>
                  </div>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="SKU-001"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="barcode">Code-barres</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateBarcode}
                      className="h-6 px-2 text-xs"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Générer
                    </Button>
                  </div>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="123456789"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  Produit actif et visible
                </Label>
              </div>

              {/* Section Vente par Carton */}
              <div className="border border-border/50 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="sell_by_carton" className="text-base font-semibold cursor-pointer">
                      📦 Vente par carton
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Permet de vendre ce produit en gros par carton
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="sell_by_carton"
                    checked={formData.sell_by_carton}
                    onChange={(e) => setFormData({ ...formData, sell_by_carton: e.target.checked })}
                    className="h-5 w-5"
                  />
                </div>

                {formData.sell_by_carton && (
                  <div className="space-y-4 pt-3 border-t border-border/30">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="units_per_carton">{t('productManagement.unitesParCarton')}</Label>
                        <Input
                          id="units_per_carton"
                          type="number"
                          min="1"
                          value={formData.units_per_carton}
                          onChange={(e) =>
                            setFormData((prev) => {
                              const unitsStr = e.target.value;
                              const unitsPerCarton = parseInt(unitsStr || '0', 10);
                              const cartons = parseInt(prev.cartons_in_stock || '0', 10);

                              const canCompute =
                                !!prev.cartons_in_stock &&
                                !Number.isNaN(cartons) &&
                                cartons >= 0 &&
                                !Number.isNaN(unitsPerCarton) &&
                                unitsPerCarton > 0;

                              return {
                                ...prev,
                                units_per_carton: unitsStr,
                                stock_quantity: canCompute ? String(cartons * unitsPerCarton) : prev.stock_quantity,
                              };
                            })
                          }
                          placeholder="Ex: 12, 24, 50"
                        />
                        <p className="text-xs text-muted-foreground">
                          Nombre d'unités dans un carton
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price_carton">{t('productManagement.prixDuCartonGnf')}</Label>
                        <Input
                          id="price_carton"
                          type="number"
                          value={formData.price_carton}
                          onChange={(e) => setFormData({ ...formData, price_carton: e.target.value })}
                          placeholder="Ex: 230000"
                        />
                        {formData.units_per_carton && formData.price && (
                          <p className="text-xs text-[#ff4000]">
                            Économie: {formatCurrency(
                              (parseFloat(formData.price) * parseInt(formData.units_per_carton || '1')) -
                              parseFloat(formData.price_carton || '0')
                            , 'GNF')} vs unités
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cartons_in_stock">{t('productManagement.nombreDeCartonsEnStock')}</Label>
                        <Input
                          id="cartons_in_stock"
                          type="number"
                          min="0"
                          value={formData.cartons_in_stock}
                          onChange={(e) =>
                            setFormData((prev) => {
                              const cartonsStr = e.target.value;
                              const cartons = parseInt(cartonsStr || '0', 10);
                              const unitsPerCarton = parseInt(prev.units_per_carton || '0', 10);

                              const canCompute =
                                !Number.isNaN(cartons) &&
                                cartons >= 0 &&
                                !Number.isNaN(unitsPerCarton) &&
                                unitsPerCarton > 0;

                              return {
                                ...prev,
                                cartons_in_stock: cartonsStr,
                                stock_quantity: canCompute ? String(cartons * unitsPerCarton) : prev.stock_quantity,
                              };
                            })
                          }
                          placeholder="Ex: 15"
                        />
                        <p className="text-xs text-muted-foreground">
                          Remplit automatiquement la quantité en stock (unités)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>{t('productManagement.stockCalculeUnites')}</Label>
                        <Input
                          value={(() => {
                            const cartons = parseInt(formData.cartons_in_stock || '0', 10);
                            const unitsPerCarton = parseInt(formData.units_per_carton || '0', 10);
                            if (Number.isNaN(cartons) || Number.isNaN(unitsPerCarton) || cartons < 0 || unitsPerCarton <= 0) return '';
                            return String(cartons * unitsPerCarton);
                          })()}
                          readOnly
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="carton_sku">Code SKU Carton (optionnel)</Label>
                      <Input
                        id="carton_sku"
                        value={formData.carton_sku}
                        onChange={(e) => setFormData({ ...formData, carton_sku: e.target.value })}
                        placeholder="Ex: CART-001"
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab 3: Media */}
            <TabsContent value="media" className="space-y-4 mt-4">
              <div className="space-y-3">
                <Label>{t('productManagement.imagesDuProduit')}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-20 flex-col gap-2"
                  >
                    <Camera className="h-6 w-6" />
                    <span className="text-xs">Importer images</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateImage}
                    disabled={generatingImage || !formData.name}
                    className="h-20 flex-col gap-2"
                  >
                    {generatingImage ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <ImagePlus className="h-6 w-6" />
                    )}
                    <span className="text-xs">
                      {generatingImage ? 'Génération...' : 'Générer avec IA'}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!isPremium) {
                        toast.error(t('productManagement.fonctionnalitePremiumUniquement'), {
                          description: 'Passez à un abonnement Premium/Pro/Business pour ajouter des vidéos',
                          action: {
                            label: t('productManagement.voirLesOffres'),
                            onClick: () => navigate('/vendeur/subscription')
                          }
                        });
                        return;
                      }
                      videoInputRef.current?.click();
                    }}
                    disabled={uploadingVideo || selectedVideos.length >= 2}
                    className={`h-20 flex-col gap-2 relative ${!isPremium ? 'opacity-60' : ''}`}
                  >
                    {uploadingVideo ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        <Video className="h-6 w-6" />
                        <Badge
                          variant={isPremium ? "default" : "secondary"}
                          className={`absolute top-1 right-1 text-[10px] px-1 ${isPremium ? 'bg-[#ff4000]' : ''}`}
                        >
                          {isPremium ? '✓ Premium' : '🔒 Premium'}
                        </Badge>
                      </>
                    )}
                    <span className="text-xs">
                      {uploadingVideo ? 'Validation...' : `Vidéos (${selectedVideos.length}/2)`}
                    </span>
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
              </div>

              {/* Video Preview */}
              {(selectedVideos.length > 0 || (editingProduct?.promotional_videos?.length || 0) > 0) && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Vidéos publicitaires Premium ({(editingProduct?.promotional_videos?.length || 0) + selectedVideos.length}/2)
                    <Badge variant="secondary" className="text-[10px]">Max 45s</Badge>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Existing Videos */}
                    {editingProduct?.promotional_videos?.map((videoUrl, index) => (
                      <div key={`existing-video-${index}`} className="relative aspect-video rounded-lg overflow-hidden border-2 border-primary/20 bg-black">
                        <video
                          src={videoUrl}
                          controls
                          className="w-full h-full"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2 h-6 w-6 p-0"
                          onClick={() => {
                            if (editingProduct) {
                              const updatedVideos = editingProduct.promotional_videos?.filter((_, i) => i !== index) || [];
                              setEditingProduct({ ...editingProduct, promotional_videos: updatedVideos.length > 0 ? updatedVideos : undefined });
                            }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <Badge className="absolute bottom-2 left-2 text-xs" variant="secondary">
                          Vidéo {index + 1}
                        </Badge>
                      </div>
                    ))}
                    {/* New Videos */}
                    {selectedVideos.map((video, index) => (
                      <div key={`new-video-${index}`} className="relative aspect-video rounded-lg overflow-hidden border-2 border-[#ff4000]/50 bg-black">
                        <video
                          src={URL.createObjectURL(video)}
                          controls
                          className="w-full h-full"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2 h-6 w-6 p-0"
                          onClick={() => {
                            setSelectedVideos(prev => prev.filter((_, i) => i !== index));
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <Badge className="absolute bottom-2 left-2 text-xs" variant="default">
                          Nouvelle • {(video.size / (1024 * 1024)).toFixed(1)} MB
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Image Previews */}
              {(selectedImages.length > 0 || (editingProduct?.images?.length || 0) > 0) && (
                <div className="space-y-2">
                  <Label>Aperçu ({selectedImages.length} nouvelle(s))</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Existing Images */}
                    {editingProduct?.images?.map((url, index) => (
                      <div key={`existing-${index}`} className="relative aspect-square rounded-lg overflow-hidden border">
                        <img
                          src={url}
                          alt={`Existing ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-1 right-1 h-5 w-5 p-0"
                          onClick={() => removeExistingImage(index)}
                          title="Retirer cette image"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <Badge className="absolute top-1 left-1 text-[8px]" variant="secondary">
                          Existante
                        </Badge>
                      </div>
                    ))}
                    {/* New Images */}
                    {selectedImages.map((file, index) => (
                      <div key={`new-${index}`} className="relative aspect-square rounded-lg overflow-hidden border">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-1 right-1 h-5 w-5 p-0"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <Badge className="absolute bottom-1 left-1 text-[8px]" variant="default">
                          Nouvelle
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Footer Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                  clearDraft();
                setShowDialog(false);
                resetForm();
              }}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button onClick={handleSave} className="flex-1" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingProduct ? 'Mise à jour...' : 'Création...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {editingProduct ? 'Mettre à jour' : 'Créer le produit'}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
