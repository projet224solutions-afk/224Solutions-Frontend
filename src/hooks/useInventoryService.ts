import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { useToast } from '@/hooks/use-toast';
import { readSectionCache, writeSectionCache, isBrowserOffline } from '@/lib/offline/sectionCache';

export interface InventoryItem {
  id: string;
  product_id: string;
  quantity: number;
  reserved_quantity: number;
  minimum_stock: number;
  warehouse_id?: string;
  sku?: string;
  barcode?: string;
  cost_price?: number;
  supplier_id?: string;
  reorder_point?: number;
  reorder_quantity?: number;
  lot_number?: string;
  expiry_date?: string;
  warehouse_location?: string;
  location_details?: string;
  notes?: string;
  last_updated: string;
  product?: {
    id: string;
    name: string;
    price: number;
    sku?: string;
  };
  warehouse?: {
    id: string;
    name: string;
  };
  supplier?: {
    id: string;
    name: string;
  };
}

export interface InventoryAlert {
  id: string;
  vendor_id: string;
  product_id: string;
  alert_type: 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'expired' | 'overstocked';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  is_read: boolean;
  is_resolved: boolean;
  resolved_at?: string;
  created_at: string;
  product?: {
    id: string;
    name: string;
    sku?: string;
  };
}

export interface InventoryHistory {
  id: string;
  product_id: string;
  vendor_id: string;
  movement_type: 'sale' | 'purchase' | 'adjustment' | 'return' | 'transfer' | 'loss';
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  order_id?: string;
  warehouse_id?: string;
  notes?: string;
  created_at: string;
  product?: {
    id: string;
    name: string;
    sku?: string;
  };
  warehouse?: {
    id: string;
    name: string;
  };
  order?: {
    id: string;
    order_number: string;
  };
}

export interface InventoryStats {
  total_products: number;
  total_quantity: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_cost: number;
  potential_profit: number;
}

export const useInventoryService = () => {
  const { vendorId, loading: _vendorLoading } = useCurrentVendor();
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [history, setHistory] = useState<InventoryHistory[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Charger les données initiales
  const loadData = useCallback(async () => {
    if (!vendorId) {
      console.log('⚠️ loadData annulé - vendorId:', vendorId);
      return;
    }

    // 📴 Hors ligne : afficher le dernier inventaire connu (cache), sans réseau.
    if (isBrowserOffline()) {
      const cachedInv = readSectionCache('inventory_items', vendorId);
      const cachedAlerts = readSectionCache('inventory_alerts', vendorId);
      const cachedHist = readSectionCache('inventory_history', vendorId);
      if (cachedInv) setInventory(cachedInv);
      if (cachedAlerts) setAlerts(cachedAlerts as any);
      if (cachedHist) setHistory(cachedHist as any);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Chargement inventaire pour vendorId:', vendorId);

      // Charger l'inventaire avec jointure interne pour filtrer par vendor
      const { data: inventoryData, error: invError } = await supabase
        .from('inventory')
        .select(`
          *,
          product:products!inner(id, name, price, sku, vendor_id),
          warehouse:warehouses(id, name),
          supplier:suppliers(id, name)
        `)
        .eq('product.vendor_id', vendorId)
        .order('last_updated', { ascending: false });

      if (invError) {
        console.error('❌ Erreur chargement inventaire:', invError);
        throw invError;
      }

      console.log('📦 Inventaire chargé:', inventoryData?.length, 'items pour vendorId:', vendorId);
      console.log('📦 Détail inventaire:', JSON.stringify(inventoryData, null, 2));

      // Charger les alertes
      const { data: alertsData, error: alertError } = await supabase
        .from('inventory_alerts')
        .select(`
          *,
          product:products(id, name, sku)
        `)
        .eq('vendor_id', vendorId)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false });

      if (alertError) throw alertError;

      // Charger l'historique récent
      const { data: historyData, error: histError } = await supabase
        .from('inventory_history')
        .select(`
          *,
          product:products(id, name, sku),
          warehouse:warehouses(id, name),
          order:orders(id, order_number)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (histError) throw histError;

      // Charger les statistiques
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_inventory_stats', { p_vendor_id: vendorId });

      if (statsError) console.error('Stats error:', statsError);

      setInventory(inventoryData || []);
      setAlerts((alertsData as any) || []);
      setHistory((historyData as any) || []);
      setStats(statsData as any);

      // Persister pour l'affichage hors ligne.
      writeSectionCache('inventory_items', vendorId, inventoryData || []);
      writeSectionCache('inventory_alerts', vendorId, alertsData || []);
      writeSectionCache('inventory_history', vendorId, historyData || []);

    } catch (error: any) {
      // Repli sur le cache en cas d'échec réseau, sinon signaler l'erreur.
      const cachedInv = readSectionCache('inventory_items', vendorId);
      if (cachedInv) {
        setInventory(cachedInv);
        const cachedAlerts = readSectionCache('inventory_alerts', vendorId);
        const cachedHist = readSectionCache('inventory_history', vendorId);
        if (cachedAlerts) setAlerts(cachedAlerts as any);
        if (cachedHist) setHistory(cachedHist as any);
      } else {
        toast({
          title: "Erreur",
          description: `Impossible de charger les données: ${error.message}`,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  }, [vendorId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Synchronisation temps réel
  useEffect(() => {
    if (!vendorId) return;

    console.log('🔄 Configuration synchronisation temps réel pour vendorId:', vendorId);

    // Channel pour l'inventaire - écouter TOUS les événements
    const inventoryChannel = supabase
      .channel(`inventory-changes-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory'
        },
        (payload) => {
          console.log('📦 Changement inventaire détecté:', payload.eventType, payload);
          // Rechargement immédiat
          loadData();
        }
      )
      .subscribe((status) => {
        console.log('📡 Statut channel inventaire:', status);
      });

    // Channel pour les produits (nom/prix/SKU) → refléter instantanément dans l'inventaire
    const productsChannel = supabase
      .channel(`products-changes-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `vendor_id=eq.${vendorId}`
        },
        (payload) => {
          console.log('🧾 Changement produit détecté:', payload.eventType, payload);
          loadData();
        }
      )
      .subscribe((status) => {
        console.log('📡 Statut channel produits:', status);
      });

    // Channel pour les alertes
    const alertsChannel = supabase
      .channel(`alerts-changes-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_alerts',
          filter: `vendor_id=eq.${vendorId}`
        },
        (payload) => {
          console.log('🚨 Alert change:', payload);
          if (payload.eventType === 'INSERT' && payload.new) {
            const newAlert = payload.new as InventoryAlert;
            // Afficher une notification pour les nouvelles alertes
            toast({
              title: newAlert.severity === 'critical' ? '🚨 Alerte critique' : '⚠️ Nouvelle alerte',
              description: newAlert.message,
              variant: newAlert.severity === 'critical' ? 'destructive' : 'default'
            });
          }
          loadData();
        }
      )
      .subscribe();

    // Channel pour l'historique
    const historyChannel = supabase
      .channel(`history-changes-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inventory_history',
          filter: `vendor_id=eq.${vendorId}`
        },
        (payload) => {
          console.log('📝 History change:', payload);
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(inventoryChannel);
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(alertsChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [vendorId, loadData, toast]);

  // Actions
  const updateStock = async (itemId: string, newQuantity: number) => {
    try {
      console.log('📝 Mise à jour stock:', itemId, 'nouvelle quantité:', newQuantity);

      const { error } = await supabase
        .from('inventory')
        .update({
          quantity: newQuantity,
          last_updated: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: "✅ Stock mis à jour",
        description: "La quantité a été mise à jour avec succès."
      });

      await loadData();
    } catch (error: any) {
      console.error('❌ Erreur mise à jour stock:', error);
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const markAlertAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('inventory_alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;
      await loadData();
    } catch (error: any) {
      console.error('Error marking alert as read:', error);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('inventory_alerts')
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: "✅ Alerte résolue",
        description: "L'alerte a été marquée comme résolue."
      });

      await loadData();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const addInventoryItem = async (data: Partial<InventoryItem>) => {
    try {
      const { error } = await supabase
        .from('inventory')
        .insert([data]);

      if (error) throw error;

      toast({
        title: "✅ Article ajouté",
        description: "L'article a été ajouté à l'inventaire."
      });

      await loadData();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return {
    inventory,
    alerts,
    history,
    stats,
    loading,
    vendorId,
    updateStock,
    markAlertAsRead,
    resolveAlert,
    addInventoryItem,
    refresh: loadData
  };
};