import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';

export interface VendorBadges {
  pendingOrders: number;
  unreadExpenseAlerts: number;
  totalProducts: number;
  lowStockProducts: number;
}

export function useVendorBadges() {
  const { vendorId, loading: vendorLoading } = useCurrentVendor();
  const [badges, setBadges] = useState<VendorBadges>({
    pendingOrders: 0,
    unreadExpenseAlerts: 0,
    totalProducts: 0,
    lowStockProducts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (vendorLoading || !vendorId) return;

    const fetchBadges = async () => {
      try {
        // Fetch pending ONLINE orders count only (not POS sales)
        const { count: pendingOrdersCount, error: ordersError } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .eq('status', 'pending')
          .eq('source', 'online');

        if (ordersError) {
          console.error('Error fetching orders:', ordersError);
        }

        // Fetch unread expense alerts count
        const { count: unreadAlertsCount, error: alertsError } = await supabase
          .from('expense_alerts')
          .select('*', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .eq('is_read', false);

        if (alertsError) {
          console.error('Error fetching expense alerts:', alertsError);
        }

        // Fetch products count
        const { count: productsCount, error: productsError } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .eq('is_active', true);

        if (productsError) {
          console.error('Error fetching products:', productsError);
        }

        // Fetch low stock products count
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('inventory')
          .select('id, quantity, minimum_stock, product_id, products!inner(vendor_id)')
          .eq('products.vendor_id', vendorId);

        if (inventoryError) {
          console.error('Error fetching inventory:', inventoryError);
        }

        const lowStockCount = inventoryData?.filter(item =>
          item.quantity <= item.minimum_stock && item.quantity > 0
        ).length || 0;

        setBadges({
          pendingOrders: pendingOrdersCount || 0,
          unreadExpenseAlerts: unreadAlertsCount || 0,
          totalProducts: productsCount || 0,
          lowStockProducts: lowStockCount
        });
      } catch (error) {
        console.error('Error fetching vendor badges:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBadges();

    // Set up realtime subscription for updates
    const channel = supabase
      .channel('vendor-badges-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchBadges()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'expense_alerts' },
        () => fetchBadges()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        () => fetchBadges()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => fetchBadges()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendorId, vendorLoading]);

  return { badges, loading };
}
