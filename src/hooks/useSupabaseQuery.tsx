import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PostgrestError } from '@supabase/supabase-js';

interface UseSupabaseQueryOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

export const useSupabaseQuery = <T,>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  dependencies: unknown[] = [],
  options: UseSupabaseQueryOptions = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PostgrestError | null>(null);

  const { enabled = true, refetchInterval } = options;

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    const executeQuery = async () => {
      try {
        setLoading(true);
        const result = await queryFn();

        if (!isMounted) return;

        if (result.error) {
          setError(result.error);
          setData(null);
        } else {
          setData(result.data);
          setError(null);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err as PostgrestError);
        setData(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    executeQuery();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...dependencies]);

  // Set up refetch interval if specified
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(async () => {
      try {
        setLoading(true);
        const result = await queryFn();

        if (result.error) {
          setError(result.error);
          setData(null);
        } else {
          setData(result.data);
          setError(null);
        }
      } catch (err) {
        setError(err as PostgrestError);
        setData(null);
      } finally {
        setLoading(false);
      }
    }, refetchInterval);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchInterval, enabled]);

  const refetch = async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      const result = await queryFn();

      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      setError(err as PostgrestError);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch };
};

// Specialized hooks for common queries
export const useProducts = (vendorId?: string) => {
  return useSupabaseQuery(
    async () => {
      // Joindre inventory (quantity) pour refléter la décrémentation côté backend
      // Fallback: products.stock_quantity
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          stock_quantity,
          barcode,
          ean,
          sku,
          images,
          category:categories(name),
          vendor:vendors(business_name),
          inventory:inventory(quantity)
        `)
        .eq('is_active', true);

      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      }

      const result = await query;
      if (result?.data && Array.isArray(result.data)) {
        // Normaliser le stock pour la consommation UI
        result.data = result.data.map((p: any) => ({
          ...p,
          stock_quantity: (p?.inventory?.quantity ?? p?.stock_quantity ?? 0)
        }));
      }
      return result;
    },
    [vendorId]
  );
};

export const useOrders = (userId?: string, role?: string) => {
  return useSupabaseQuery(
    async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          customer:customers(id, user_id, profiles:profiles(first_name, last_name)),
          vendor:vendors(business_name),
          order_items(
            *,
            product:products(name, images)
          )
        `);

      if (role === 'vendeur' && userId) {
        query = query.eq('vendor.user_id', userId);
      } else if (role === 'client' && userId) {
        query = query.eq('customer.user_id', userId);
      }

      return await query.order('created_at', { ascending: false });
    },
    [userId, role]
  );
};

export const useDeliveries = (driverId?: string) => {
  return useSupabaseQuery(
    async () => {
      let query = supabase
        .from('deliveries')
        .select(`
          *,
          order:orders(
            order_number,
            total_amount,
            customer:customers(profiles:profiles(first_name, last_name))
          )
        `);

      if (driverId) {
        query = query.eq('driver_id', driverId);
      }

      return await query.order('created_at', { ascending: false });
    },
    [driverId]
  );
};

export const useRides = (customerId?: string, driverId?: string) => {
  return useSupabaseQuery(
    async () => {
      let query = supabase
        .from('rides')
        .select(`
          *,
          customer:customers(profiles:profiles(first_name, last_name)),
          driver:drivers(profiles:profiles(first_name, last_name), vehicle_info)
        `);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      } else if (driverId) {
        query = query.eq('driver_id', driverId);
      }

      return await query.order('created_at', { ascending: false });
    },
    [customerId, driverId]
  );
};

// useVendorStats removed - use useVendorStats from @/hooks/useVendorData instead