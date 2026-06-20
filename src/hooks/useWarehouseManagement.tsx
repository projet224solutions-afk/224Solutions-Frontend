import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';

export interface Warehouse {
  id: string;
  vendor_id: string;
  name: string;
  address?: string | null;
  country?: string | null;
  city?: string | null;
  manager_name?: string | null;
  manager_phone?: string | null;
  manager_email?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  is_active?: boolean;
  created_at: string;
}

export interface WarehouseStock {
  id: string;
  warehouse_id: string;
  product_id: string;
  quantity: number;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  from_warehouse_id?: string | null;
  to_warehouse_id?: string | null;
  quantity: number;
  movement_type: 'in' | 'out' | 'transfer';
  created_at: string;
  notes?: string | null;
}

export const useWarehouseManagement = () => {
  const { vendorId, loading: vendorLoading } = useCurrentVendor();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStock[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWarehouses = async () => {
    if (!vendorId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWarehouses((data as unknown[])?.map((warehouse: unknown) => ({
        id: warehouse.id,
        vendor_id: warehouse.vendor_id,
        name: warehouse.name,
        address: warehouse.address,
        country: warehouse.country,
        city: warehouse.city,
        manager_name: warehouse.manager_name,
        manager_phone: warehouse.manager_phone,
        manager_email: warehouse.manager_email,
        contact_person: warehouse.contact_person,
        contact_phone: warehouse.contact_phone,
        is_active: warehouse.is_active,
        created_at: warehouse.created_at
      })) || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStocks = async (warehouseId?: string) => {
    if (!vendorId) return;

    try {
      let query = supabase
        .from('warehouse_stocks')
        .select('*');

      if (warehouseId) {
        query = query.eq('warehouse_id', warehouseId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setWarehouseStocks((data as unknown[])?.map(stock => ({
        id: stock.id,
        warehouse_id: stock.warehouse_id,
        product_id: stock.product_id,
        quantity: stock.quantity,
        updated_at: stock.updated_at
      })) || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchMovements = async () => {
    if (!vendorId) return;

    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setStockMovements((data as unknown[])?.map(movement => ({
        id: movement.id,
        product_id: movement.product_id,
        from_warehouse_id: movement.from_warehouse_id,
        to_warehouse_id: movement.to_warehouse_id,
        quantity: movement.quantity,
        movement_type: movement.movement_type as 'in' | 'out' | 'transfer',
        created_at: movement.created_at,
        notes: movement.notes
      })) || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createWarehouse = async (warehouseData: {
    name: string;
    address?: string;
    contact_person?: string;
    contact_phone?: string;
  }) => {
    if (!vendorId) throw new Error('Vendor ID not found');

    try {
      const { data, error } = await supabase
        .from('warehouses')
        .insert([{
          vendor_id: vendorId,
          ...warehouseData
        }])
        .select()
        .single();

      if (error) throw error;
      await fetchWarehouses(); // Refresh the list
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const updateWarehouse = async (warehouseId: string, updates: Partial<Warehouse>) => {
    try {
      const { error } = await supabase
        .from('warehouses')
        .update(updates)
        .eq('id', warehouseId);

      if (error) throw error;
      await fetchWarehouses(); // Refresh the list
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteWarehouse = async (warehouseId: string) => {
    try {
      const { error } = await supabase
        .from('warehouses')
        .delete()
        .eq('id', warehouseId);

      if (error) throw error;
      await fetchWarehouses(); // Refresh the list
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateStock = async (warehouseId: string, productId: string, quantity: number) => {
    try {
      const { error } = await supabase
        .from('warehouse_stocks')
        .upsert({
          warehouse_id: warehouseId,
          product_id: productId,
          quantity
        });

      if (error) throw error;
      await fetchStocks(); // Refresh the stocks
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const createStockMovement = async (movementData: {
    product_id: string;
    from_warehouse_id?: string;
    to_warehouse_id?: string;
    quantity: number;
    movement_type: 'in' | 'out' | 'transfer';
    notes?: string;
  }) => {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .insert([movementData])
        .select()
        .single();

      if (error) throw error;

      // Update stock quantities based on movement
      if (movementData.from_warehouse_id) {
        const { data: currentStock } = await supabase
          .from('warehouse_stocks')
          .select('quantity')
          .eq('warehouse_id', movementData.from_warehouse_id)
          .eq('product_id', movementData.product_id)
          .single();

        if (currentStock) {
          await supabase
            .from('warehouse_stocks')
            .update({
              quantity: Math.max(0, (currentStock as unknown).quantity - movementData.quantity)
            })
            .eq('warehouse_id', movementData.from_warehouse_id)
            .eq('product_id', movementData.product_id);
        }
      }

      if (movementData.to_warehouse_id) {
        await supabase
          .from('warehouse_stocks')
          .upsert({
            warehouse_id: movementData.to_warehouse_id,
            product_id: movementData.product_id,
            quantity: movementData.quantity
          }, {
            onConflict: 'warehouse_id,product_id',
            ignoreDuplicates: false
          });
      }

      await fetchStocks();
      await fetchMovements();
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const transferStock = async (
    productId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number,
    notes?: string
  ) => {
    try {
      // Record the movement
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: productId,
          from_warehouse_id: fromWarehouseId,
          to_warehouse_id: toWarehouseId,
          quantity,
          movement_type: 'transfer',
          notes
        });

      if (movementError) throw movementError;

      // Update stocks in both warehouses
      const { data: fromStock } = await supabase
        .from('warehouse_stocks')
        .select('quantity')
        .eq('warehouse_id', fromWarehouseId)
        .eq('product_id', productId)
        .single();

      const { data: toStock } = await supabase
        .from('warehouse_stocks')
        .select('quantity')
        .eq('warehouse_id', toWarehouseId)
        .eq('product_id', productId)
        .single();

      if (fromStock) {
        await supabase
          .from('warehouse_stocks')
          .update({ quantity: (fromStock as unknown).quantity - quantity })
          .eq('warehouse_id', fromWarehouseId)
          .eq('product_id', productId);
      }

      if (toStock) {
        await supabase
          .from('warehouse_stocks')
          .update({ quantity: (toStock as unknown).quantity + quantity })
          .eq('warehouse_id', toWarehouseId)
          .eq('product_id', productId);
      } else {
        await supabase
          .from('warehouse_stocks')
          .insert({
            warehouse_id: toWarehouseId,
            product_id: productId,
            quantity
          });
      }

      await Promise.all([fetchStocks(), fetchMovements()]);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    if (!vendorLoading && vendorId) {
      fetchWarehouses();
      fetchStocks();
      fetchMovements();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, vendorLoading]);

  return {
    warehouses,
    warehouseStocks,
    stockMovements,
    loading,
    error,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    updateStock,
    createStockMovement,
    transferStock,
    refetch: fetchWarehouses
  };
};