/**
 * Hook pour gérer les actions CRUD sur les produits
 * Extraction de la logique métier de ProductManagement
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePublicId } from '@/hooks/usePublicId';
import { backendFetch } from '@/services/backendApi';
import { SubscriptionService } from '@/services/subscriptionService';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { generateEAN13Barcode } from '@/lib/barcodeGenerator';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import {
  canCreateProductWithLimit,
  canDuplicateProductWithLimit,
  canReactivateProductWithLimit,
} from '@/lib/subscriptions/productQuotaRules';

interface ProductFormData {
  name: string;
  description?: string;
  price: string;
  compare_price?: string;
  cost_price?: string;
  sku?: string;
  barcode?: string;
  stock_quantity: string;
  low_stock_threshold: string;
  category_id?: string;
  category_name?: string;
  section?: string; // Section personnalisée du vendeur
  weight?: string;
  tags?: string;
  is_active: boolean;
  // Champs carton
  sell_by_carton?: boolean;
  units_per_carton?: string;
  price_carton?: string;
  carton_sku?: string;
}

interface UseProductActionsProps {
  vendorId: string | null;
  onProductCreated?: () => void;
  onProductUpdated?: () => void;
  onProductDeleted?: () => void;
}

export function useProductActions({
  vendorId,
  onProductCreated,
  onProductUpdated,
  onProductDeleted,
}: UseProductActionsProps) {
  const { generatePublicId } = usePublicId();
  const { user } = useAuth();
  const { userId: vendorAuthUserId } = useCurrentVendor();
  // Pour la vérification de limites, utiliser le user_id du vendeur (pas de l'agent)
  const limitCheckUserId = vendorAuthUserId || user?.id;
  const { uploadFile: gcsUploadFile, uploadMultipleFiles } = useStorageUpload();

  /**
   * Upload des images vers Google Cloud Storage
   */
  const uploadImages = useCallback(async (files: File[]): Promise<string[]> => {
    if (!vendorId || files.length === 0) return [];

    toast.info(`Upload de ${files.length} image(s)...`);

    const results = await uploadMultipleFiles(files, {
      folder: 'products',
      subfolder: vendorId,
    });

    const imageUrls = results
      .filter(r => r.success && r.publicUrl)
      .map(r => r.publicUrl!);

    if (imageUrls.length > 0) {
      toast.success(`${imageUrls.length} image(s) uploadée(s)`);
    }

    return imageUrls;
  }, [vendorId, uploadMultipleFiles]);

  /**
   * Supprimer une vidéo du storage
   */
  const deleteVideoFromStorage = useCallback(async (videoUrl: string): Promise<boolean> => {
    if (!videoUrl || !videoUrl.includes('/product-videos/')) return false;

    try {
      // Extraire le chemin depuis l'URL
      // Format: https://{project}.supabase.co/storage/v1/object/public/product-videos/{path}
      const match = videoUrl.match(/\/product-videos\/(.+)$/);
      if (!match || !match[1]) return false;

      const filePath = match[1];

      const { error } = await supabase.storage
        .from('product-videos')
        .remove([filePath]);

      if (error) {
        console.error('[VideoDelete] Error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[VideoDelete] Exception:', error);
      return false;
    }
  }, []);

  /**
   * Upload vidéo publicitaire vers Google Cloud Storage (Premium uniquement)
   */
  const uploadPromotionalVideo = useCallback(async (file: File): Promise<string | null> => {
    if (!vendorId || !file) return null;

    try {
      toast.info('Upload vidéo publicitaire...');

      const result = await gcsUploadFile(file, {
        folder: 'videos',
        subfolder: vendorId,
      });

      if (!result.success || !result.publicUrl) {
        toast.error(`Échec upload vidéo: ${result.error}`);
        return null;
      }

      toast.success('Vidéo publicitaire uploadée');
      return result.publicUrl;
    } catch (error) {
      console.error('[VideoUpload] Exception:', error);
      return null;
    }
  }, [vendorId, gcsUploadFile]);

  /**
   * Synchroniser le stock dans la table inventory (stock réel utilisé en POS)
   */
  const syncInventoryQuantity = useCallback(async (productId: string, quantity: number) => {
    const { error } = await supabase
      .from('inventory')
      .upsert(
        [{
          product_id: productId,
          quantity,
          last_updated: new Date().toISOString(),
        }],
        { onConflict: 'product_id' }
      );

    if (error) {
      console.error('[InventorySync] Error:', error);
      throw error;
    }
  }, []);

  /**
   * Gérer la catégorie (créer si n'existe pas)
   */
  const handleCategory = useCallback(async (categoryName?: string, categoryId?: string): Promise<string | null> => {
    console.log('[Category] handleCategory called:', { categoryName, categoryId });

    // Si un ID de catégorie est fourni, l'utiliser directement
    if (categoryId && categoryId.trim() !== '') {
      console.log('[Category] Using existing category_id:', categoryId);
      return categoryId;
    }

    // Si pas de nom de catégorie, retourner null
    if (!categoryName || categoryName.trim() === '') {
      console.log('[Category] No category name provided');
      return null;
    }

    try {
      // Chercher catégorie existante par nom
      const { data: existingCategory, error: searchError } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', categoryName.trim())
        .maybeSingle();

      if (searchError) {
        console.error('[Category] Search error:', searchError);
      }

      if (existingCategory) {
        console.log('[Category] Found existing category:', existingCategory.id);
        return existingCategory.id;
      }

      // Créer nouvelle catégorie
      console.log('[Category] Creating new category:', categoryName.trim());
      const { data: newCategory, error: categoryError } = await supabase
        .from('categories')
        .insert([
          {
            name: categoryName.trim(),
            is_active: true,
          },
        ])
        .select('id')
        .single();

      if (categoryError) {
        console.error('[Category] Creation error:', categoryError);
        return null;
      }

      console.log('[Category] Created new category:', newCategory?.id);
      return newCategory?.id || null;
    } catch (error) {
      console.error('[Category] Exception:', error);
      return null;
    }
  }, []);

  /**
   * Générer un SKU unique automatiquement
   */
  const generateUniqueSKU = useCallback(async (): Promise<string> => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SKU-${timestamp}-${random}`;
  }, []);

  /**
   * Créer un nouveau produit
   */
  const createProduct = useCallback(async (
    formData: ProductFormData,
    images: File[],
    promotionalVideos: File[] = []
  ): Promise<{ success: boolean; product?: any }> => {
    if (!vendorId) {
      toast.error('Vendeur introuvable');
      return { success: false };
    }

    if (!user?.id) {
      toast.error('Utilisateur non connecté');
      return { success: false };
    }

    try {
      // ✅ VÉRIFICATION CRITIQUE: Vérifier la limite de produits AVANT de créer
      console.log('🔍 [ProductCreate] Vérification limite de produits...');
      const limitCheck = await SubscriptionService.checkProductLimit(limitCheckUserId!);

      if (!limitCheck) {
        toast.error('Impossible de vérifier les limites d\'abonnement');
        return { success: false };
      }

      console.log('📊 [ProductCreate] Limite:', {
        current: limitCheck.current_count,
        max: limitCheck.max_products,
        canAdd: limitCheck.can_add,
        isUnlimited: limitCheck.is_unlimited
      });

      // ❌ BLOQUER si limite atteinte
      if (!canCreateProductWithLimit(limitCheck, formData.is_active !== false)) {
        const message = limitCheck.is_unlimited
          ? 'Erreur de vérification de limite'
          : `🚫 Limite atteinte : ${limitCheck.current_count}/${limitCheck.max_products} produits. Mettez à jour votre abonnement pour ajouter plus de produits.`;

        toast.error(message, {
          duration: 5000,
          action: {
            label: 'Voir abonnements',
            onClick: () => window.location.href = '/subscriptions'
          }
        });

        return { success: false };
      }

      // ✅ Limite OK - Continuer la création
      console.log('✅ [ProductCreate] Limite OK, création du produit...');

      // Upload images
      const imageUrls = await uploadImages(images);

      // Upload vidéos publicitaires si fournies (max 2)
      const videoUrls: string[] = [];
      for (const video of promotionalVideos.slice(0, 2)) {
        const url = await uploadPromotionalVideo(video);
        if (url) videoUrls.push(url);
      }

      // Gérer catégorie - log pour debug
      console.log('[ProductCreate] Category data received:', {
        category_id: formData.category_id,
        category_name: formData.category_name,
      });
      const categoryId = await handleCategory(formData.category_name, formData.category_id);
      console.log('[ProductCreate] Category ID resolved:', categoryId);

      // Générer public_id
      const public_id = await generatePublicId('products', false);
      if (!public_id) {
        toast.error("Impossible de générer l'ID du produit");
        return { success: false };
      }

      // Générer SKU unique si non fourni
      const sku = formData.sku?.trim() || (await generateUniqueSKU());

      // ✅ Générer automatiquement un code-barres EAN-13 unique pour le POS
      const barcodeValue = generateEAN13Barcode();
      console.log('[ProductCreate] Generated barcode:', barcodeValue);

      // Préparer données produit
      const productData = {
        public_id,
        name: formData.name,
        description: formData.description || null,
        price: parseFloat(formData.price),
        compare_price: formData.compare_price ? parseFloat(formData.compare_price) : null,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        sku,
        barcode: formData.barcode || null,
        barcode_value: barcodeValue, // Code-barres POS auto-généré
        barcode_format: 'EAN13', // Format EAN-13 standard
        stock_quantity: parseInt(formData.stock_quantity),
        low_stock_threshold: parseInt(formData.low_stock_threshold),
        category_id: categoryId,
        section: formData.section?.trim() || null, // Section personnalisée
        weight: formData.weight ? parseFloat(formData.weight) : null,
        tags: formData.tags ? formData.tags.split(',').map((tag) => tag.trim()) : null,
        is_active: formData.is_active,
        vendor_id: vendorId,
        images: imageUrls.length > 0 ? imageUrls : null,
        promotional_videos: videoUrls.length > 0 ? videoUrls : null,
        // Champs carton
        sell_by_carton: formData.sell_by_carton || false,
        units_per_carton: formData.units_per_carton ? parseInt(formData.units_per_carton) : 1,
        price_carton: formData.price_carton ? parseFloat(formData.price_carton) : 0,
        carton_sku: formData.carton_sku || null,
      };

      console.log('[ProductCreate] Data:', productData);

      // Créer le produit via le BACKEND (limites de plan + troncature images + cohérence)
      // vendor_id est résolu côté serveur depuis le JWT.
      const { vendor_id: _omitVendorId, ...productPayload } = productData as any;
      const resp = await backendFetch<any>('/api/products', {
        method: 'POST',
        body: { ...productPayload, images: imageUrls, promotional_videos: videoUrls },
      });

      if (!resp.success || !resp.data) {
        throw new Error(resp.error || (resp as any).message || 'Erreur lors de la création du produit');
      }
      const data = resp.data;

      // Inventaire synchronisé côté backend (atomique avec la création)
      const warnings = (resp as any).warnings;
      if (Array.isArray(warnings) && warnings.length > 0) {
        toast.warning(warnings[0]);
      }
      toast.success('✅ Produit créé avec succès');
      onProductCreated?.();

      return { success: true, product: data };
    } catch (error: any) {
      console.error('[ProductCreate] Error:', error);

      // Message d'erreur personnalisé selon le type
      let errorMessage = 'Erreur lors de la création du produit';

      if (error.message?.includes('limit') || error.message?.includes('maximum')) {
        errorMessage = '🚫 Limite de produits atteinte. Mettez à jour votre abonnement.';
      } else if (error.code === '23505') {
        errorMessage = 'Un produit avec ce SKU existe déjà';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      return { success: false };
    }
  }, [vendorId, user, uploadImages, handleCategory, generatePublicId, onProductCreated, generateUniqueSKU, syncInventoryQuantity]);

  /**
   * Mettre à jour un produit
   */
  const updateProduct = useCallback(async (
    productId: string,
    formData: ProductFormData,
    newImages: File[],
    existingImages: string[] = [],
    newVideos: File[] = [],
    existingVideoUrls: string[] = []
  ): Promise<{ success: boolean; product?: any }> => {
    if (!vendorId) {
      toast.error('Vendeur introuvable');
      return { success: false };
    }

    try {
      const { data: existingProduct, error: existingError } = await supabase
        .from('products')
        .select('id, is_active')
        .eq('id', productId)
        .eq('vendor_id', vendorId)
        .single();

      if (existingError || !existingProduct) {
        toast.error('Produit introuvable');
        return { success: false };
      }

      if (!existingProduct.is_active && formData.is_active && user?.id) {
        const limitCheck = await SubscriptionService.checkProductLimit(user.id);

        if (!limitCheck) {
          toast.error('Impossible de vérifier les limites d\'abonnement');
          return { success: false };
        }

        if (!canReactivateProductWithLimit(limitCheck, existingProduct.is_active, formData.is_active)) {
          toast.error(`🚫 Limite atteinte : ${limitCheck.current_count}/${limitCheck.max_products} produits actifs.`);
          return { success: false };
        }
      }

      // Upload nouvelles images
      const newImageUrls = await uploadImages(newImages);

      // Combiner anciennes et nouvelles images
      const allImages = newImageUrls.length > 0 ? [...existingImages, ...newImageUrls] : existingImages;

      // Upload nouvelles vidéos et combiner avec les existantes
      let allVideoUrls: string[] = [...existingVideoUrls];

      for (const videoFile of newVideos) {
        const uploadedUrl = await uploadPromotionalVideo(videoFile);
        if (uploadedUrl) {
          allVideoUrls.push(uploadedUrl);
        }
      }

      // Limiter à 2 vidéos maximum
      allVideoUrls = allVideoUrls.slice(0, 2);

      // Gérer catégorie
      const categoryId = await handleCategory(formData.category_name, formData.category_id);

      // Préparer données mise à jour
      const updateData = {
        name: formData.name,
        description: formData.description || null,
        price: parseFloat(formData.price),
        compare_price: formData.compare_price ? parseFloat(formData.compare_price) : null,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        sku: formData.sku || null,
        barcode: formData.barcode || null,
        stock_quantity: parseInt(formData.stock_quantity),
        low_stock_threshold: parseInt(formData.low_stock_threshold),
        category_id: categoryId,
        section: formData.section?.trim() || null, // Section personnalisée
        weight: formData.weight ? parseFloat(formData.weight) : null,
        tags: formData.tags ? formData.tags.split(',').map((tag) => tag.trim()) : null,
        is_active: formData.is_active,
        images: allImages.length > 0 ? allImages : null,
        promotional_videos: allVideoUrls.length > 0 ? allVideoUrls : null,
        // Champs carton
        sell_by_carton: formData.sell_by_carton || false,
        units_per_carton: formData.units_per_carton ? parseInt(formData.units_per_carton) : 1,
        price_carton: formData.price_carton ? parseFloat(formData.price_carton) : 0,
        carton_sku: formData.carton_sku || null,
      };

      console.log('[ProductUpdate] Data:', updateData);

      // Mettre à jour via le BACKEND (ownership + limites + troncature images server-side)
      const resp = await backendFetch<any>(`/api/products/${productId}`, {
        method: 'PATCH',
        body: updateData,
      });

      if (!resp.success || !resp.data) {
        throw new Error(resp.error || (resp as any).message || 'Erreur lors de la mise à jour');
      }
      const data = resp.data;

      // Inventaire synchronisé côté backend (dans la même requête de mise à jour)
      const warnings = (resp as any).warnings;
      if (Array.isArray(warnings) && warnings.length > 0) toast.warning(warnings[0]);
      toast.success('✅ Produit mis à jour');
      onProductUpdated?.();

      return { success: true, product: data };
    } catch (error: any) {
      console.error('[ProductUpdate] Error:', error);
      toast.error(`Erreur mise à jour: ${error.message}`);
      return { success: false };
    }
  }, [vendorId, uploadImages, handleCategory, onProductUpdated, syncInventoryQuantity, user?.id]);

  /**
   * Supprimer un produit
   */
  const deleteProduct = useCallback(async (productId: string): Promise<boolean> => {
    if (!vendorId) {
      toast.error('Vendeur introuvable');
      return false;
    }

    try {
      // Suppression via le BACKEND (soft-delete sûr + ownership server-side ;
      // préserve l'historique des commandes/analytics).
      const resp = await backendFetch(`/api/products/${productId}`, { method: 'DELETE' });

      if (!resp.success) {
        throw new Error(resp.error || 'Erreur lors de la suppression');
      }

      toast.success('🗑️ Produit supprimé');
      onProductDeleted?.();

      return true;
    } catch (error: any) {
      console.error('[ProductDelete] Error:', error);
      toast.error(`Erreur suppression: ${error.message}`);
      return false;
    }
  }, [vendorId, onProductDeleted]);

  /**
   * Dupliquer un produit
   */
  const duplicateProduct = useCallback(async (productId: string): Promise<{ success: boolean; product?: any }> => {
    if (!vendorId) {
      toast.error('Vendeur introuvable');
      return { success: false };
    }

    try {
      // Récupérer produit original
      const { data: original, error: fetchError } = await supabase.from('products').select('*').eq('id', productId).single();

      if (fetchError) throw fetchError;

      if (original?.is_active && user?.id) {
        const limitCheck = await SubscriptionService.checkProductLimit(user.id);

        if (!limitCheck) {
          toast.error('Impossible de vérifier les limites d\'abonnement');
          return { success: false };
        }

        if (!canDuplicateProductWithLimit(limitCheck, original.is_active)) {
          toast.error(`🚫 Limite atteinte : ${limitCheck.current_count}/${limitCheck.max_products} produits actifs.`);
          return { success: false };
        }
      }

      // Générer nouveau public_id
      const public_id = await generatePublicId('products', false);
      if (!public_id) {
        toast.error("Impossible de générer l'ID du produit");
        return { success: false };
      }

      // Générer un nouveau SKU unique pour la copie
      const newSKU = await generateUniqueSKU();

      // Créer copie — nouveau code-barres POS unique (ne pas recopier celui de l'original)
      const duplicateData = {
        ...original,
        id: undefined, // Laisser DB générer nouvel ID
        public_id,
        name: `${original.name} (Copie)`,
        sku: newSKU,
        barcode: null, // Ne pas dupliquer barcode
        barcode_value: generateEAN13Barcode(), // Nouveau code-barres EAN-13 unique
        barcode_format: 'EAN13',
        created_at: undefined,
        updated_at: undefined,
      };

      const { data, error } = await supabase.from('products').insert([duplicateData]).select().single();

      if (error) throw error;

      toast.success('✅ Produit dupliqué');
      onProductCreated?.();

      return { success: true, product: data };
    } catch (error: any) {
      console.error('[ProductDuplicate] Error:', error);
      toast.error(`Erreur duplication: ${error.message}`);
      return { success: false };
    }
  }, [vendorId, generatePublicId, onProductCreated, generateUniqueSKU, user?.id]);

  /**
   * Mise à jour en masse du stock
   */
  const bulkUpdateStock = useCallback(async (updates: { productId: string; quantity: number }[]): Promise<boolean> => {
    if (!vendorId) {
      toast.error('Vendeur introuvable');
      return false;
    }

    try {
      for (const update of updates) {
        const { error } = await supabase
          .from('products')
          .update({ stock_quantity: update.quantity })
          .eq('id', update.productId)
          .eq('vendor_id', vendorId);

        if (error) throw error;
      }

      toast.success(`✅ Stock mis à jour pour ${updates.length} produit(s)`);
      onProductUpdated?.();

      return true;
    } catch (error: any) {
      console.error('[BulkUpdateStock] Error:', error);
      toast.error(`Erreur mise à jour stock: ${error.message}`);
      return false;
    }
  }, [vendorId, onProductUpdated]);

  return {
    createProduct,
    updateProduct,
    deleteProduct,
    duplicateProduct,
    bulkUpdateStock,
    uploadImages,
    uploadPromotionalVideo,
    deleteVideoFromStorage,
  };
}
