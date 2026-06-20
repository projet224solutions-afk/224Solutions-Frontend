/**
 * Hook de gestion multi-entrepôts et multi-POS
 * 224SOLUTIONS - Système professionnel
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ─── Registre singleton des channels Realtime ────────────────────────────────
// useMultiWarehouse est appelé par plusieurs composants simultanément
// (MultiWarehouseManagement, TransferCreator, TransferReception…).
// Sans ce registre, chaque instance crée son propre supabase.channel() avec le
// même nom → le 2ème .on() arrive sur un channel déjà souscrit → crash Supabase.
// Solution : un seul channel par vendorId, partagé via un Map module-level.
interface ChannelEntry {
  channel: ReturnType<typeof supabase.channel>;
  count: number;
  callbacks: Set<() => void>;
}
const _warehouseChannelRegistry = new Map<string, ChannelEntry>();
const WAREHOUSE_TABLES = [
  'vendor_locations',
  'location_stock',
  'stock_transfers',
  'stock_transfer_items',
  'stock_losses',
] as const;
// ─────────────────────────────────────────────────────────────────────────────
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { toast } from 'sonner';
import {
  buildDestinationSummary,
  computeTotalUnits,
  generateTransferIdempotencyKey,
  normalizeStockUnits,
  validateTransferRequest,
  type TransferDestinationType,
} from '@/lib/inventory/multiWarehouseUtils';

// Types
export interface VendorLocation {
  id: string;
  vendor_id: string;
  name: string;
  code: string | null;
  description: string | null;
  location_type: 'warehouse' | 'pos' | 'shop';
  is_pos_enabled: boolean;
  address: string | null;
  city: string | null;
  country: string;
  coordinates: { lat: number; lng: number } | null;
  manager_name: string | null;
  manager_phone: string | null;
  manager_email: string | null;
  is_active: boolean;
  is_default: boolean;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Computed
  stats?: LocationStats;
}

export interface LocationStock {
  id: string;
  location_id: string;
  product_id: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  minimum_stock: number;
  maximum_stock: number | null;
  reorder_point: number;
  reorder_quantity: number;
  bin_location: string | null;
  lot_number: string | null;
  expiry_date: string | null;
  cost_price: number;
  last_purchase_price: number | null;
  last_stock_update: string;
  last_sale_at: string | null;
  units_per_carton?: number | null;
  quantity_cartons_closed?: number | null;
  quantity_units_loose?: number | null;
  total_units?: number | null;
  stock_role?: 'warehouse' | 'shop';
  linked_shop_product_id?: string | null;
  product?: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    price: number;
    images: string[] | null;
  };
  location?: VendorLocation;
}

export interface StockTransfer {
  id: string;
  vendor_id: string;
  transfer_number: string;
  // Noms de colonnes Supabase (actuels dans la DB d'après types.ts)
  source_location_id: string;
  destination_location_id: string;
  status: 'pending' | 'in_transit' | 'shipped' | 'delivered' | 'completed' | 'partial' | 'cancelled';
  destination_type?: TransferDestinationType;
  destination_client_info?: {
    name?: string;
    phone?: string;
    address?: string;
  } | null;
  destination_shop_id?: string | null;
  approval_status?: 'draft' | 'pending' | 'approved' | 'confirmed' | 'cancelled' | null;
  receipt_url?: string | null;
  idempotency_key?: string | null;
  transfer_mode?: 'units' | 'cartons' | 'mixed' | null;
  created_at: string;
  shipped_at: string | null;
  received_at: string | null;
  notes: string | null;
  shipping_notes: string | null;
  reception_notes: string | null;
  total_items: number | null;
  total_quantity_sent: number | null;
  total_quantity_received: number | null;
  total_quantity_lost: number | null;
  // Relations
  from_location?: VendorLocation;
  to_location?: VendorLocation;
  items?: StockTransferItem[];
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  quantity_sent: number;
  quantity_received: number | null;
  quantity_lost: number | null;
  notes: string | null;
  lot_number: string | null;
  expiry_date: string | null;
  loss_reason: string | null;
  quantity_cartons?: number | null;
  quantity_units?: number | null;
  units_per_carton?: number | null;
  total_units?: number | null;
  shop_product_id?: string | null;
  stock_before_units?: number | null;
  stock_after_units?: number | null;
  product?: {
    id: string;
    name: string;
    sku: string | null;
    images: string[] | null;
  };
}

export interface StockLoss {
  id: string;
  vendor_id: string;
  loss_number: string;
  location_id: string;
  product_id: string;
  loss_type: string;
  quantity: number;
  unit_cost: number | null;
  total_loss_value: number | null;
  reason: string;
  status: string | null;
  loss_date: string | null;
  transfer_id: string | null;
  transfer_item_id: string | null;
  documented_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  location?: VendorLocation;
  product?: {
    id: string;
    name: string;
  };
}

export interface LocationStats {
  location_id: string;
  total_products: number;
  total_quantity: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  pending_transfers_in: number;
  pending_transfers_out: number;
}

export interface ProductStockByLocations {
  product_id: string;
  total_quantity: number;
  total_available: number;
  total_reserved: number;
  locations: {
    location_id: string;
    location_name: string;
    location_type: string;
    is_pos: boolean;
    quantity: number;
    available: number;
    reserved: number;
    minimum: number;
    is_low_stock: boolean;
  }[];
}

export interface CreateLocationInput {
  name: string;
  code?: string;
  description?: string;
  location_type?: 'warehouse' | 'pos';
  is_pos_enabled?: boolean;
  address?: string;
  city?: string;
  country?: string;
  manager_name?: string;
  manager_phone?: string;
  manager_email?: string;
  is_default?: boolean;
}

export interface CreateTransferInput {
  from_location_id: string;
  to_location_id: string;
  items: {
    product_id: string;
    quantity: number;
    unit_cost?: number;
  }[];
  notes?: string;
}

export interface ConfirmReceptionInput {
  transfer_id: string;
  items: {
    product_id: string;
    quantity_received: number;
    notes?: string;
    missing_reason?: 'damaged' | 'lost' | 'stolen' | 'counting_error' | 'other';
  }[];
  notes?: string;
}

export interface WarehouseShopProductMapping {
  id: string;
  vendor_id: string;
  warehouse_product_id: string;
  shop_product_id: string;
  source_location_id?: string | null;
  destination_location_id?: string | null;
  is_active?: boolean | null;
  metadata?: Record<string, any> | null;
  warehouse_product?: {
    id: string;
    name: string;
    sku?: string | null;
  } | null;
  shop_product?: {
    id: string;
    name: string;
    sku?: string | null;
  } | null;
}

export interface AdvancedTransferItemInput {
  product_id: string;
  quantity?: number;
  quantity_cartons?: number;
  quantity_units?: number;
  units_per_carton?: number;
  unit_cost?: number;
  shop_product_id?: string | null;
  notes?: string;
}

export interface AdvancedTransferInput {
  source_location_id: string;
  destination_type: TransferDestinationType;
  destination_location_id?: string | null;
  destination_shop_id?: string | null;
  destination_client_info?: {
    name?: string;
    phone?: string;
    address?: string;
  } | null;
  items: AdvancedTransferItemInput[];
  notes?: string;
  expected_arrival?: string | null;
  idempotency_key?: string;
}

export function useMultiWarehouse() {
  const { vendorId, loading: vendorLoading } = useCurrentVendor();

  const [locations, setLocations] = useState<VendorLocation[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [losses, setLosses] = useState<StockLoss[]>([]);
  const [productMappings, setProductMappings] = useState<WarehouseShopProductMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =============================================
  // FETCH FUNCTIONS
  // =============================================

  const fetchLocations = useCallback(async () => {
    if (!vendorId) return;

    try {
      const { data, error } = await supabase
        .from('vendor_locations')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('is_default', { ascending: false })
        .order('location_type')
        .order('name');

      if (error) throw error;

      // Mapper les données vers le format attendu et récupérer les stats
      const locationsWithStats = await Promise.all(
        (data || []).map(async (loc) => {
          // Obtenir les stats de stock pour ce lieu
          const { data: stockData } = await supabase
            .from('location_stock')
            .select('quantity, minimum_stock, cost_price')
            .eq('location_id', loc.id);

          const stats = {
            location_id: loc.id,
            total_products: stockData?.length || 0,
            total_quantity: stockData?.reduce((sum, s) => sum + (s.quantity || 0), 0) || 0,
            total_value: stockData?.reduce((sum, s) => sum + ((s.quantity || 0) * (s.cost_price || 0)), 0) || 0,
            low_stock_count: stockData?.filter(s => s.quantity > 0 && s.quantity <= s.minimum_stock).length || 0,
            out_of_stock_count: stockData?.filter(s => s.quantity === 0).length || 0,
            pending_transfers_in: 0,
            pending_transfers_out: 0
          };

          return {
            ...loc,
            coordinates: loc.coordinates,
            stats
          };
        })
      );

      setLocations(locationsWithStats);
    } catch (err: any) {
      console.error('Erreur chargement lieux:', err);
      setError(err.message);
    }
  }, [vendorId]);

  const fetchTransfers = useCallback(async (status?: string) => {
    if (!vendorId) return;

    try {
      let query = supabase
        .from('stock_transfers')
        .select(`
          *,
          from_location:vendor_locations!stock_transfers_source_location_id_fkey(id, name, location_type),
          to_location:vendor_locations!stock_transfers_destination_location_id_fkey(id, name, location_type),
          items:stock_transfer_items(
            *,
            product:products(id, name, sku, images)
          )
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      setTransfers(data || []);
    } catch (err: any) {
      console.error('Erreur chargement transferts:', err);
      setError(err.message);
    }
  }, [vendorId]);

  const fetchLosses = useCallback(async () => {
    if (!vendorId) return;

    try {
      const { data, error } = await supabase
        .from('stock_losses')
        .select(`
          *,
          location:vendor_locations(id, name),
          product:products(id, name)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLosses(data || []);
    } catch (err: any) {
      console.error('Erreur chargement pertes:', err);
      setError(err.message);
    }
  }, [vendorId]);

  const fetchProductMappings = useCallback(async () => {
    if (!vendorId) return [];

    try {
      const { data, error } = await supabase
        .from('warehouse_shop_product_links')
        .select(`
          *,
          warehouse_product:products!warehouse_shop_product_links_warehouse_product_id_fkey(id, name, sku),
          shop_product:products!warehouse_shop_product_links_shop_product_id_fkey(id, name, sku)
        `)
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProductMappings(data || []);
      return data || [];
    } catch (err: any) {
      const message = String(err?.message || '');
      if (!message.toLowerCase().includes('warehouse_shop_product_links')) {
        console.warn('Erreur chargement mappings boutique:', err);
      }
      setProductMappings([]);
      return [];
    }
  }, [vendorId]);

  // =============================================
  // LOCATION MANAGEMENT
  // =============================================

  const normalizeLocationInput = (input: Partial<CreateLocationInput>) => ({
    ...input,
    name: input.name?.trim(),
    code: input.code?.trim() || null,
    description: input.description?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    country: input.country?.trim() || 'Guinée',
    manager_name: input.manager_name?.trim() || null,
    manager_phone: input.manager_phone?.trim() || null,
    manager_email: input.manager_email?.trim() || null,
    location_type: input.location_type || 'warehouse',
  });

  const createLocation = async (input: CreateLocationInput): Promise<VendorLocation | null> => {
    if (!vendorId) {
      toast.error('Vendeur non identifié');
      return null;
    }

    try {
      const normalizedInput = normalizeLocationInput(input);

      const { data, error } = await supabase
        .from('vendor_locations')
        .insert({
          vendor_id: vendorId,
          ...normalizedInput,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`${normalizedInput.location_type === 'pos' ? 'Point de vente' : 'Entrepôt'} créé avec succès`);
      await fetchLocations();
      return data;
    } catch (err: any) {
      console.error('Erreur création lieu:', err);
      const isDuplicateCode = err?.code === '23505' || String(err?.message || '').includes('vendor_locations_vendor_id_code_key');
      toast.error(isDuplicateCode ? 'Ce code d’entrepôt existe déjà. Modifiez-le ou laissez ce champ vide.' : (err.message || 'Erreur lors de la création'));
      return null;
    }
  };

  const updateLocation = async (locationId: string, updates: Partial<CreateLocationInput>): Promise<boolean> => {
    try {
      const normalizedUpdates = normalizeLocationInput(updates);

      const { error } = await supabase
        .from('vendor_locations')
        .update(normalizedUpdates)
        .eq('id', locationId);

      if (error) throw error;

      toast.success('Lieu mis à jour');
      await fetchLocations();
      return true;
    } catch (err: any) {
      console.error('Erreur mise à jour lieu:', err);
      toast.error(err.message || 'Erreur lors de la mise à jour');
      return false;
    }
  };

  const togglePOS = async (locationId: string, enable: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('vendor_locations')
        .update({
          is_pos_enabled: enable,
          location_type: enable ? 'pos' : 'warehouse'
        })
        .eq('id', locationId);

      if (error) throw error;

      toast.success(enable ? 'POS activé' : 'POS désactivé');
      await fetchLocations();
      return true;
    } catch (err: any) {
      console.error('Erreur toggle POS:', err);
      toast.error(err.message);
      return false;
    }
  };

  const setDefaultLocation = async (locationId: string): Promise<boolean> => {
    if (!vendorId) return false;

    try {
      // Retirer le défaut de tous les autres
      await supabase
        .from('vendor_locations')
        .update({ is_default: false })
        .eq('vendor_id', vendorId);

      // Mettre ce lieu par défaut
      const { error } = await supabase
        .from('vendor_locations')
        .update({ is_default: true })
        .eq('id', locationId);

      if (error) throw error;

      toast.success('Lieu par défaut mis à jour');
      await fetchLocations();
      return true;
    } catch (err: any) {
      console.error('Erreur mise à jour défaut:', err);
      toast.error(err.message);
      return false;
    }
  };

  const deleteLocation = async (locationId: string): Promise<boolean> => {
    try {
      // Vérifier qu'il n'y a pas de stock
      const { data: stocks } = await supabase
        .from('location_stock')
        .select('id')
        .eq('location_id', locationId)
        .gt('quantity', 0)
        .limit(1);

      if (stocks && stocks.length > 0) {
        toast.error('Impossible de supprimer: ce lieu contient du stock');
        return false;
      }

      const { error } = await supabase
        .from('vendor_locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;

      toast.success('Lieu supprimé');
      await fetchLocations();
      return true;
    } catch (err: any) {
      console.error('Erreur suppression lieu:', err);
      toast.error(err.message);
      return false;
    }
  };

  // =============================================
  // STOCK MANAGEMENT
  // =============================================

  const getLocationStock = async (locationId: string): Promise<LocationStock[]> => {
    try {
      const { data, error } = await supabase
        .from('location_stock')
        .select(`
          *,
          product:products(id, name, sku, barcode, price, images)
        `)
        .eq('location_id', locationId)
        .order('product(name)');

      if (error) throw error;

      return (data || []).map((row: any) => {
        const normalizedUnits = normalizeStockUnits(row);
        return {
          ...row,
          units_per_carton: row.units_per_carton ?? normalizedUnits.unitsPerCarton,
          quantity_cartons_closed: row.quantity_cartons_closed ?? normalizedUnits.qtyCartonsClosed,
          quantity_units_loose: row.quantity_units_loose ?? normalizedUnits.qtyUnitsLoose,
          total_units: row.total_units ?? normalizedUnits.qtyTotalUnits,
          available_quantity: row.available_quantity ?? normalizedUnits.availableUnits,
        };
      });
    } catch (err: any) {
      console.error('Erreur chargement stock:', err);
      return [];
    }
  };

  const getProductStockByLocations = async (productId: string): Promise<ProductStockByLocations | null> => {
    if (!vendorId) return null;

    try {
      // Récupérer les stocks du produit dans tous les lieux du vendeur
      const { data: stockData, error: stockError } = await supabase
        .from('location_stock')
        .select(`
          *,
          location:vendor_locations(id, name, location_type, is_pos_enabled, vendor_id)
        `)
        .eq('product_id', productId);

      if (stockError) throw stockError;

      // Filtrer par vendeur (via les locations)
      const filteredData = (stockData || []).filter(s =>
        s.location?.vendor_id === vendorId
      );

      const result: ProductStockByLocations = {
        product_id: productId,
        total_quantity: filteredData.reduce((sum, s) => sum + (s.quantity || 0), 0),
        total_available: filteredData.reduce((sum, s) => sum + (s.available_quantity || 0), 0),
        total_reserved: filteredData.reduce((sum, s) => sum + (s.reserved_quantity || 0), 0),
        locations: filteredData.map(s => ({
          location_id: s.location_id,
          location_name: s.location?.name || 'Inconnu',
          location_type: s.location?.location_type || 'warehouse',
          is_pos: s.location?.is_pos_enabled || false,
          quantity: s.quantity || 0,
          available: s.available_quantity || 0,
          reserved: s.reserved_quantity || 0,
          minimum: s.minimum_stock || 0,
          is_low_stock: (s.quantity || 0) <= (s.minimum_stock || 0)
        }))
      };

      return result;
    } catch (err: any) {
      console.error('Erreur chargement stock produit:', err);
      return null;
    }
  };

  const getShopProductMappingForItem = useCallback((warehouseProductId: string, destinationLocationId?: string | null) => {
    return productMappings.find((mapping) => {
      if (mapping.warehouse_product_id !== warehouseProductId) return false;
      if (mapping.is_active === false) return false;
      if (!destinationLocationId || !mapping.destination_location_id) return true;
      return mapping.destination_location_id === destinationLocationId;
    }) || null;
  }, [productMappings]);

  const adjustStock = async (
    locationId: string,
    productId: string,
    newQuantity: number,
    reason: string
  ): Promise<boolean> => {
    try {
      // Ajustement ATOMIQUE via RPC (verrou de ligne + historique dans la même
      // transaction + contrôle d'appartenance) → plus de read-then-write/course.
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase.rpc('adjust_location_stock_atomic', {
        p_location_id: locationId,
        p_product_id: productId,
        p_new_quantity: newQuantity,
        p_reason: reason,
        p_user_id: user?.id ?? null,
      });

      if (error) throw error;
      const result = data as { status: 'success' | 'error'; error?: string };
      if (result?.status === 'error') throw new Error(result.error || 'Échec de l\'ajustement');

      toast.success('Stock ajusté');
      return true;
    } catch (err: any) {
      console.error('Erreur ajustement stock:', err);
      toast.error(err.message);
      return false;
    }
  };

  // =============================================
  // TRANSFER MANAGEMENT
  // =============================================

  const createAdvancedTransfer = async (input: AdvancedTransferInput): Promise<StockTransfer | null> => {
    if (!vendorId) {
      toast.error('Vendeur non identifié');
      return null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        toast.error('Utilisateur non authentifié');
        return null;
      }

      const sourceStock = await getLocationStock(input.source_location_id);
      const sourceStockMap = new Map(sourceStock.map((item) => [item.product_id, item]));

      const preparedItems = input.items.map((item) => {
        const stockEntry = sourceStockMap.get(item.product_id);
        const mappedShopProduct = input.destination_type === 'shop'
          ? getShopProductMappingForItem(item.product_id, input.destination_location_id || input.destination_shop_id || null)
          : null;

        const unitsPerCarton = item.units_per_carton || stockEntry?.units_per_carton || 1;
        const quantityCartons = item.quantity_cartons || 0;
        const quantityUnits = item.quantity_units ?? item.quantity ?? 0;
        const quantityTotalUnits = computeTotalUnits({
          unitsPerCarton,
          quantityCartons,
          quantityUnits,
        });

        const validation = validateTransferRequest({
          stock: stockEntry,
          transfer: {
            unitsPerCarton,
            quantityCartons,
            quantityUnits,
          },
          destinationType: input.destination_type,
          shopProductId: item.shop_product_id || mappedShopProduct?.shop_product_id || (input.destination_type === 'shop' ? item.product_id : null),
        });

        if (!validation.valid) {
          throw new Error(validation.error);
        }

        const normalizedStock = normalizeStockUnits(stockEntry);

        return {
          product_id: item.product_id,
          quantity: quantityTotalUnits,
          quantity_cartons: quantityCartons,
          quantity_units: quantityUnits,
          units_per_carton: unitsPerCarton,
          total_units: quantityTotalUnits,
          stock_before_units: normalizedStock.qtyTotalUnits,
          stock_after_units: Math.max(0, normalizedStock.qtyTotalUnits - quantityTotalUnits),
          unit_cost: item.unit_cost || stockEntry?.cost_price || 0,
          shop_product_id: item.shop_product_id || mappedShopProduct?.shop_product_id || (input.destination_type === 'shop' ? item.product_id : null),
          notes: item.notes || null,
        };
      }).filter((item) => item.total_units > 0);

      if (preparedItems.length === 0) {
        toast.error('Ajoutez au moins un produit valide au transfert');
        return null;
      }

      let transferId: string | null = null;

      try {
        const { data, error } = await supabase.rpc('create_advanced_stock_transfer', {
          p_vendor_id: vendorId,
          p_source_location_id: input.source_location_id,
          p_destination_type: input.destination_type,
          p_destination_location_id: input.destination_location_id || input.destination_shop_id || null,
          p_destination_client_info: input.destination_client_info || {},
          p_items: preparedItems,
          p_notes: input.notes || null,
          p_created_by: user.id,
          p_expected_arrival: input.expected_arrival || null,
          p_idempotency_key: input.idempotency_key || generateTransferIdempotencyKey('transfer'),
        });

        if (error) throw error;
        transferId = typeof data === 'string' ? data : data?.transfer_id || data?.id || null;
      } catch (advancedErr: any) {
        const canUseLegacyFallback = input.destination_type === 'warehouse' && Boolean(input.destination_location_id);

        if (!canUseLegacyFallback) {
          throw advancedErr;
        }

        const { data, error } = await supabase.rpc('create_stock_transfer', {
          p_vendor_id: vendorId,
          p_source_location_id: input.source_location_id,
          p_destination_location_id: input.destination_location_id,
          p_items: preparedItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.total_units,
            unit_cost: item.unit_cost,
          })),
          p_notes: input.notes || null,
          p_created_by: user.id,
          p_expected_arrival: input.expected_arrival || null,
        });

        if (error) throw error;
        transferId = typeof data === 'string' ? data : data?.transfer_id || data?.id || null;
      }

      if (!transferId) {
        toast.error('Erreur lors de la création du transfert');
        return null;
      }

      toast.success('Transfert créé avec succès');
      await Promise.all([fetchTransfers(), fetchLosses()]);

      const { data: transfer } = await supabase
        .from('stock_transfers')
        .select(`
          *,
          from_location:vendor_locations!stock_transfers_source_location_id_fkey(id, name, location_type, is_pos_enabled),
          to_location:vendor_locations!stock_transfers_destination_location_id_fkey(id, name, location_type, is_pos_enabled),
          items:stock_transfer_items(
            *,
            product:products(id, name, sku, images)
          )
        `)
        .eq('id', transferId)
        .single();

      return transfer;
    } catch (err: any) {
      console.error('Erreur création transfert avancé:', err);
      toast.error(err.message || 'Erreur lors de la création du transfert');
      return null;
    }
  };

  const createTransfer = async (input: CreateTransferInput): Promise<StockTransfer | null> => {
    return createAdvancedTransfer({
      source_location_id: input.from_location_id,
      destination_type: 'warehouse',
      destination_location_id: input.to_location_id,
      items: input.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
      })),
      notes: input.notes,
    });
  };

  const shipTransfer = async (transferId: string, notes?: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        toast.error('Utilisateur non authentifié');
        return false;
      }

      const { data: transferMeta } = await supabase
        .from('stock_transfers')
        .select('destination_type, transfer_number, receipt_url')
        .eq('id', transferId)
        .single();

      const { error } = await supabase.rpc('ship_transfer', {
        p_transfer_id: transferId,
        p_shipped_by: user.id,
        p_shipping_notes: notes || null
      });

      if (error) throw error;

      if (transferMeta?.destination_type === 'client') {
        await supabase
          .from('stock_transfers')
          .update({
            status: 'completed',
            approval_status: 'confirmed',
            received_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString(),
            receipt_url: transferMeta.receipt_url || `generated://transfer/${transferMeta.transfer_number || transferId}`,
          })
          .eq('id', transferId);

        toast.success('Sortie client confirmée');
      } else {
        toast.success('Transfert expédié - En transit');
      }

      await fetchTransfers();
      return true;
    } catch (err: any) {
      console.error('Erreur expédition transfert:', err);
      toast.error(err.message);
      return false;
    }
  };

  const confirmTransferReception = async (input: ConfirmReceptionInput): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        toast.error('Utilisateur non authentifié');
        return false;
      }

      try {
        const { error } = await supabase.rpc('receive_transfer', {
          p_transfer_id: input.transfer_id,
          p_items_received: input.items,
          p_received_by: user.id,
          p_reception_notes: input.notes || null
        });

        if (error) throw error;
      } catch (receiveErr: any) {
        const { error } = await supabase.rpc('confirm_transfer_reception', {
          p_transfer_id: input.transfer_id,
          p_received_items: input.items,
          p_user_id: user.id,
          p_notes: input.notes || null,
        });

        if (error) throw receiveErr;
      }

      toast.success('Transfert confirmé');
      await Promise.all([fetchTransfers(), fetchLosses()]);
      return true;
    } catch (err: any) {
      console.error('Erreur confirmation transfert:', err);
      toast.error(err.message);
      return false;
    }
  };

  const cancelTransfer = async (transferId: string): Promise<boolean> => {
    try {
      // Vérifier que le transfert n'est pas déjà expédié
      const { data: transfer } = await supabase
        .from('stock_transfers')
        .select('status')
        .eq('id', transferId)
        .single();

      if (transfer?.status !== 'pending') {
        toast.error('Seuls les transferts en attente peuvent être annulés');
        return false;
      }

      const { error } = await supabase
        .from('stock_transfers')
        .update({ status: 'cancelled', approval_status: 'cancelled' })
        .eq('id', transferId);

      if (error) throw error;

      toast.success('Transfert annulé');
      await fetchTransfers();
      return true;
    } catch (err: any) {
      console.error('Erreur annulation transfert:', err);
      toast.error(err.message);
      return false;
    }
  };

  const downloadTransferReceipt = async (transfer: StockTransfer): Promise<boolean> => {
    try {
      if (transfer?.receipt_url && !String(transfer.receipt_url).startsWith('generated://')) {
        window.open(transfer.receipt_url, '_blank', 'noopener,noreferrer');
        return true;
      }

      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      let y = 16;

      const destinationLabel = buildDestinationSummary(
        transfer.destination_type || (transfer.to_location?.is_pos_enabled ? 'shop' : 'warehouse'),
        {
          locationName: transfer.to_location?.name,
          clientName: transfer.destination_client_info?.name,
          clientPhone: transfer.destination_client_info?.phone,
          clientAddress: transfer.destination_client_info?.address,
        },
      );

      doc.setFontSize(16);
      doc.text('REÇU DE TRANSFERT DE STOCK', 14, y);
      y += 10;

      doc.setFontSize(11);
      [
        `Référence: ${transfer.transfer_number}`,
        `Date: ${new Date(transfer.created_at).toLocaleString('fr-FR')}`,
        `Source: ${transfer.from_location?.name || 'Entrepôt source'}`,
        `Destination: ${destinationLabel}`,
        `Type: ${transfer.destination_type || 'warehouse'}`,
        `Statut: ${transfer.status}`,
      ].forEach((line) => {
        doc.text(line, 14, y);
        y += 6;
      });

      y += 2;
      doc.setFontSize(12);
      doc.text('Articles transférés', 14, y);
      y += 8;
      doc.setFontSize(10);

      (transfer.items || []).forEach((item, index) => {
        const line = `${index + 1}. ${item.product?.name || 'Produit'} | Cartons: ${item.quantity_cartons || 0} | Unités: ${item.quantity_units ?? item.quantity_sent ?? 0} | Total: ${item.total_units ?? item.quantity_sent ?? 0}`;
        doc.text(line, 14, y);
        y += 6;
      });

      y += 4;
      if (transfer.notes) {
        doc.text(`Notes: ${transfer.notes}`, 14, y, { maxWidth: 180 });
        y += 10;
      }

      doc.text(`Signature logique: ${transfer.confirmed_by || transfer.created_by || 'Système 224SOLUTIONS'}`, 14, y);
      doc.save(`${transfer.transfer_number || 'transfer'}.pdf`);
      toast.success('Reçu PDF téléchargé');
      return true;
    } catch (err: any) {
      console.error('Erreur génération reçu transfert:', err);
      toast.error('Impossible de générer le reçu PDF');
      return false;
    }
  };

  // =============================================
  // COMPUTED VALUES
  // =============================================

  // Inclut les entrepôts POS-activés : un lieu peut être entrepôt ET point de vente
  const warehouses = locations.filter(l => l.location_type === 'warehouse');
  const posLocations = locations.filter(l => l.is_pos_enabled);
  const activeLocations = locations.filter(l => l.is_active);
  const defaultLocation = locations.find(l => l.is_default);

  const pendingTransfers = transfers.filter(t => t.status === 'pending');
  const inTransitTransfers = transfers.filter(t => t.status === 'in_transit');
  const completedTransfers = transfers.filter(t => t.status === 'completed' || t.status === 'partial');

  const totalLossValue = losses.reduce((sum, l) => sum + (l.total_loss_value || 0), 0);

  // =============================================
  // EFFECTS
  // =============================================

  useEffect(() => {
    if (!vendorLoading && vendorId) {
      setLoading(true);
      Promise.all([
        fetchLocations(),
        fetchTransfers(),
        fetchLosses(),
        fetchProductMappings(),
      ]).finally(() => setLoading(false));
    }
  }, [vendorId, vendorLoading, fetchLocations, fetchTransfers, fetchLosses, fetchProductMappings]);

  // Ref stable : pointe toujours vers les callbacks les plus récents sans
  // que useEffect n'ait besoin de les lister comme dépendances.
  const realtimeRefreshRef = useRef<() => void>(() => {});
  realtimeRefreshRef.current = () => {
    fetchLocations();
    fetchTransfers();
    fetchLosses();
    fetchProductMappings();
  };

  // Callback stable référencé dans le Set partagé du registre singleton.
  // useCallback avec [] garantit que la référence ne change jamais entre renders.
  const myRefreshCallback = useCallback(() => {
    realtimeRefreshRef.current();
  }, []);

  // Registre singleton : un seul channel Supabase par vendorId, partagé entre
  // toutes les instances du hook (MultiWarehouseManagement + TransferCreator +
  // TransferReception). Chaque instance ajoute son callback au Set commun.
  // Le channel n'est détruit que quand le dernier abonné se démonte.
  useEffect(() => {
    if (!vendorId) return;

    const channelName = `multi-warehouse-live-${vendorId}`;
    const existing = _warehouseChannelRegistry.get(channelName);

    if (existing) {
      existing.count++;
      existing.callbacks.add(myRefreshCallback);
    } else {
      const callbacks = new Set<() => void>([myRefreshCallback]);
      const channel = supabase.channel(channelName);
      WAREHOUSE_TABLES.forEach((table) => {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          () => callbacks.forEach((cb) => cb()),
        );
      });
      channel.subscribe();
      _warehouseChannelRegistry.set(channelName, { channel, count: 1, callbacks });
    }

    return () => {
      const entry = _warehouseChannelRegistry.get(channelName);
      if (!entry) return;
      entry.callbacks.delete(myRefreshCallback);
      entry.count--;
      if (entry.count <= 0) {
        supabase.removeChannel(entry.channel);
        _warehouseChannelRegistry.delete(channelName);
      }
    };
  }, [vendorId, myRefreshCallback]);

  return {
    // Data
    locations,
    warehouses,
    posLocations,
    activeLocations,
    defaultLocation,
    transfers,
    productMappings,
    pendingTransfers,
    inTransitTransfers,
    completedTransfers,
    losses,
    totalLossValue,

    // State
    loading,
    error,

    // Location Actions
    createLocation,
    updateLocation,
    deleteLocation,
    togglePOS,
    setDefaultLocation,

    // Stock Actions
    getLocationStock,
    getProductStockByLocations,
    adjustStock,

    // Transfer Actions
    createTransfer,
    createAdvancedTransfer,
    shipTransfer,
    confirmTransferReception,
    cancelTransfer,
    downloadTransferReceipt,
    getShopProductMappingForItem,

    // Refresh
    refresh: () => Promise.all([fetchLocations(), fetchTransfers(), fetchLosses(), fetchProductMappings()]),
    refreshLocations: fetchLocations,
    refreshTransfers: fetchTransfers,
    refreshLosses: fetchLosses,
    refreshProductMappings: fetchProductMappings,
  };
}
