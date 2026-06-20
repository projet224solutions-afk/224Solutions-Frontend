import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SalesAnalytics {
  totalOrders: number;
  completedOrders: number;
  totalSales: number;
  avgOrderValue: number;
  conversionRate: string;
  orders: any[];
}

export interface ProductAnalytics {
  totalProducts: number;
  topPerformers: any[];
  lowStock: number;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  activeCustomers: number;
  topSpenders: any[];
  repeatCustomers: number;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  transactionCount: number;
  avgTransaction: number;
  byMethod: any;
  growth: number;
}

type AnalyticsType = 'sales' | 'products' | 'customers' | 'revenue';

/**
 * Hook pour analytics avancés (comme Amazon Seller Central Analytics)
 */
export const useAdvancedAnalytics = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const loadAnalytics = async (
    type: AnalyticsType,
    options?: {
      vendorId?: string;
      startDate?: string;
      endDate?: string;
      granularity?: 'hour' | 'day' | 'week' | 'month';
    }
  ) => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('advanced-analytics', {
        body: {
          type,
          ...options
        }
      });

      if (error) throw error;

      setData(result.data);
      return result.data;
    } catch (error: any) {
      console.error('Error loading analytics:', error);
      toast.error('Erreur lors du chargement des analytics');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getSalesAnalytics = async (vendorId: string, startDate?: string, endDate?: string) => {
    return loadAnalytics('sales', { vendorId, startDate, endDate });
  };

  const getProductAnalytics = async (vendorId: string) => {
    return loadAnalytics('products', { vendorId });
  };

  const getCustomerAnalytics = async () => {
    return loadAnalytics('customers');
  };

  const getRevenueAnalytics = async (startDate?: string, endDate?: string) => {
    return loadAnalytics('revenue', { startDate, endDate });
  };

  return {
    loading,
    data,
    loadAnalytics,
    getSalesAnalytics,
    getProductAnalytics,
    getCustomerAnalytics,
    getRevenueAnalytics
  };
};
