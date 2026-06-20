/**
 * USE CHINA REPORTS HOOK
 *
 * Hook pour générer et consulter les rapports spécifiques
 * aux opérations de dropshipping Chine.
 *
 * @module useChinaReports
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  ChinaDropshipReport,
  ChinaSupplierExtension,
  ChinaSupplierOrder,
  ChinaPlatformType
} from '@/types/china-dropshipping';

// ============================================================================
// TYPES
// ============================================================================

interface ReportPeriod {
  type: 'daily' | 'weekly' | 'monthly';
  start: Date;
  end: Date;
}

interface ReportFilters {
  vendorId?: string;
  supplierId?: string;
  platform?: string;
}

interface OrderMetrics {
  total: number;
  completed: number;
  cancelled: number;
  disputed: number;
  avgDeliveryDays: number;
  onTimeRate: number;
}

interface FinancialMetrics {
  totalRevenue: number;
  totalCost: number;
  profit: number;
  marginPercent: number;
  currency: string;
}

interface SupplierRanking {
  supplierId: string;
  supplierName: string;
  platform: string;
  totalOrders: number;
  successRate: number;
  avgDeliveryDays: number;
  score: number;
}

interface ProductRanking {
  productId: string;
  productName: string;
  totalSold: number;
  revenue: number;
  profit: number;
  marginPercent: number;
}

interface CustomsMetrics {
  totalInspected: number;
  blocked: number;
  released: number;
  avgClearanceDays: number;
  blockedRate: number;
}

interface UseChinaReportsReturn {
  // State
  loading: boolean;
  currentReport: ChinaDropshipReport | null;
  reports: ChinaDropshipReport[];

  // Generation
  generateDailyReport: (date?: Date, filters?: ReportFilters) => Promise<ChinaDropshipReport | null>;
  generateWeeklyReport: (weekStart?: Date, filters?: ReportFilters) => Promise<ChinaDropshipReport | null>;
  generateMonthlyReport: (month: Date, filters?: ReportFilters) => Promise<ChinaDropshipReport | null>;

  // Queries
  loadReports: (vendorId: string, limit?: number) => Promise<void>;
  getReportById: (reportId: string) => Promise<ChinaDropshipReport | null>;

  // Analytics
  getOrderMetrics: (period: ReportPeriod, filters?: ReportFilters) => Promise<OrderMetrics>;
  getFinancialMetrics: (period: ReportPeriod, filters?: ReportFilters) => Promise<FinancialMetrics>;
  getTopSuppliers: (period: ReportPeriod, limit?: number) => Promise<SupplierRanking[]>;
  getTopProducts: (period: ReportPeriod, limit?: number) => Promise<ProductRanking[]>;
  getCustomsMetrics: (period: ReportPeriod) => Promise<CustomsMetrics>;

  // Export
  exportReportCsv: (report: ChinaDropshipReport) => void;
  exportReportPdf: (report: ChinaDropshipReport) => Promise<void>;

  // Comparisons
  comparePerformance: (period1: ReportPeriod, period2: ReportPeriod) => Promise<{
    orders: { current: number; previous: number; change: number };
    revenue: { current: number; previous: number; change: number };
    margin: { current: number; previous: number; change: number };
    deliveryDays: { current: number; previous: number; change: number };
  }>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export const useChinaReports = (): UseChinaReportsReturn => {
  const [loading, setLoading] = useState(false);
  const [currentReport, setCurrentReport] = useState<ChinaDropshipReport | null>(null);
  const [reports, setReports] = useState<ChinaDropshipReport[]>([]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getStartOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getEndOfDay = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const getStartOfWeek = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getEndOfWeek = (date: Date): Date => {
    const start = getStartOfWeek(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  };

  const getStartOfMonth = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  };

  const getEndOfMonth = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  };

  // ============================================================================
  // QUERY HELPERS
  // ============================================================================

  const fetchOrders = async (
    startDate: Date,
    endDate: Date,
    filters?: ReportFilters
  ): Promise<ChinaSupplierOrder[]> => {
    let query = supabase
      .from('china_supplier_orders')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (filters?.vendorId) {
      query = query.eq('vendor_id', filters.vendorId);
    }
    if (filters?.supplierId) {
      query = query.eq('supplier_id', filters.supplierId);
    }

    const { data, error } = await query;
    if (error) throw error;
    // Transform Json fields to proper types
    return ((data || []) as any[]).map(order => ({
      ...order,
      status_history: Array.isArray(order.status_history)
        ? order.status_history
        : (order.status_history ? [order.status_history] : []),
      items: Array.isArray(order.items) ? order.items : []
    })) as ChinaSupplierOrder[];
  };

  const fetchLogistics = async (orderIds: string[]) => {
    if (orderIds.length === 0) return [];

    const { data, error } = await supabase
      .from('china_logistics')
      .select('*')
      .in('order_id', orderIds);

    if (error) throw error;
    return data || [];
  };

  // ============================================================================
  // METRICS CALCULATION
  // ============================================================================

  const getOrderMetrics = useCallback(async (
    period: ReportPeriod,
    filters?: ReportFilters
  ): Promise<OrderMetrics> => {
    try {
      const orders = await fetchOrders(period.start, period.end, filters);
      const logistics = await fetchLogistics(orders.map(o => o.id));

      const total = orders.length;
      const completed = orders.filter(o => o.status === 'delivered').length;
      const cancelled = orders.filter(o => o.status === 'cancelled').length;
      const disputed = orders.filter(o => o.status === 'disputed').length;

      // Calculate average delivery days
      const deliveredOrders = logistics.filter(l => l.actual_delivery_date);
      const deliveryDays = deliveredOrders.map(l => {
        const start = new Date(l.created_at);
        const end = new Date(l.actual_delivery_date);
        return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      });
      const avgDeliveryDays = deliveryDays.length > 0
        ? deliveryDays.reduce((a, b) => a + b, 0) / deliveryDays.length
        : 0;

      // On-time rate (within estimated)
      const onTimeCount = deliveredOrders.filter(l => {
        if (!l.actual_delivery_date || !l.estimated_total_days) return false;
        const actualDays = Math.floor(
          (new Date(l.actual_delivery_date).getTime() - new Date(l.created_at).getTime())
          / (1000 * 60 * 60 * 24)
        );
        return actualDays <= l.estimated_total_days;
      }).length;
      const onTimeRate = deliveredOrders.length > 0
        ? (onTimeCount / deliveredOrders.length) * 100
        : 0;

      return {
        total,
        completed,
        cancelled,
        disputed,
        avgDeliveryDays: Math.round(avgDeliveryDays * 10) / 10,
        onTimeRate: Math.round(onTimeRate * 10) / 10,
      };
    } catch (error) {
      console.error('Error calculating order metrics:', error);
      return {
        total: 0,
        completed: 0,
        cancelled: 0,
        disputed: 0,
        avgDeliveryDays: 0,
        onTimeRate: 0,
      };
    }
  }, []);

  const getFinancialMetrics = useCallback(async (
    period: ReportPeriod,
    filters?: ReportFilters
  ): Promise<FinancialMetrics> => {
    try {
      const orders = await fetchOrders(period.start, period.end, filters);

      const totalCost = orders.reduce((sum, o) => sum + (o.supplier_total_usd || 0), 0);

      // Estimate revenue with average markup (this would normally come from sales data)
      const avgMarkup = 1.35; // 35% average margin
      const totalRevenue = totalCost * avgMarkup;
      const profit = totalRevenue - totalCost;
      const marginPercent = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      return {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        marginPercent: Math.round(marginPercent * 10) / 10,
        currency: 'USD',
      };
    } catch (error) {
      console.error('Error calculating financial metrics:', error);
      return {
        totalRevenue: 0,
        totalCost: 0,
        profit: 0,
        marginPercent: 0,
        currency: 'USD',
      };
    }
  }, []);

  const getTopSuppliers = useCallback(async (
    period: ReportPeriod,
    limit: number = 10
  ): Promise<SupplierRanking[]> => {
    try {
      const orders = await fetchOrders(period.start, period.end);

      // Group by supplier
      const supplierMap = new Map<string, {
        orders: ChinaSupplierOrder[];
        delivered: number;
        totalDays: number;
      }>();

      for (const order of orders) {
        if (!order.supplier_id) continue;

        const existing = supplierMap.get(order.supplier_id) || {
          orders: [],
          delivered: 0,
          totalDays: 0,
        };
        existing.orders.push(order);
        if (order.status === 'delivered') {
          existing.delivered++;
        }
        supplierMap.set(order.supplier_id, existing);
      }

      // Fetch supplier details
      const supplierIds = Array.from(supplierMap.keys());
      const { data: suppliers } = await supabase
        .from('china_suppliers')
        .select('id, platform_type, platform_shop_id, internal_score')
        .in('id', supplierIds);

      const supplierDetails = new Map(suppliers?.map(s => [s.id, s]) || []);

      // Calculate rankings
      const rankings: SupplierRanking[] = [];

      for (const [supplierId, data] of supplierMap.entries()) {
        const details = supplierDetails.get(supplierId);
        const totalOrders = data.orders.length;
        const successRate = totalOrders > 0 ? (data.delivered / totalOrders) * 100 : 0;

        rankings.push({
          supplierId,
          supplierName: details?.platform_shop_id || supplierId.slice(0, 8),
          platform: details?.platform_type || 'UNKNOWN',
          totalOrders,
          successRate: Math.round(successRate * 10) / 10,
          avgDeliveryDays: 18, // Would calculate from logistics
          score: details?.internal_score || 50,
        });
      }

      return rankings
        .sort((a, b) => b.totalOrders - a.totalOrders)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting top suppliers:', error);
      return [];
    }
  }, []);

  const getTopProducts = useCallback(async (
    period: ReportPeriod,
    _limit: number = 10
  ): Promise<ProductRanking[]> => {
    try {
      // This would require joining with product data
      // Returning mock structure for now
      return [];
    } catch (error) {
      console.error('Error getting top products:', error);
      return [];
    }
  }, []);

  const getCustomsMetrics = useCallback(async (
    period: ReportPeriod
  ): Promise<CustomsMetrics> => {
    try {
      const orders = await fetchOrders(period.start, period.end);
      const orderIds = orders.map(o => o.id);

      const { data: logistics } = await supabase
        .from('china_logistics')
        .select('*')
        .in('order_id', orderIds);

      if (!logistics || logistics.length === 0) {
        return {
          totalInspected: 0,
          blocked: 0,
          released: 0,
          avgClearanceDays: 0,
          blockedRate: 0,
        };
      }

      const customsData = logistics.filter(l => l.customs_status);
      const blocked = customsData.filter(l => l.customs_status === 'held').length;
      const released = customsData.filter(l => l.customs_status === 'cleared' || l.customs_status === 'released').length;
      const blockedRate = customsData.length > 0 ? (blocked / customsData.length) * 100 : 0;

      return {
        totalInspected: customsData.length,
        blocked,
        released,
        avgClearanceDays: 3, // Would calculate from actual dates
        blockedRate: Math.round(blockedRate * 10) / 10,
      };
    } catch (error) {
      console.error('Error getting customs metrics:', error);
      return {
        totalInspected: 0,
        blocked: 0,
        released: 0,
        avgClearanceDays: 0,
        blockedRate: 0,
      };
    }
  }, []);

  // ============================================================================
  // REPORT GENERATION
  // ============================================================================

  const generateReport = async (
    period: ReportPeriod,
    filters?: ReportFilters
  ): Promise<ChinaDropshipReport | null> => {
    setLoading(true);
    try {
      const [orderMetrics, financialMetrics, topSuppliers, customsMetrics] = await Promise.all([
        getOrderMetrics(period, filters),
        getFinancialMetrics(period, filters),
        getTopSuppliers(period, 5),
        getCustomsMetrics(period),
      ]);

      const report: ChinaDropshipReport = {
        id: crypto.randomUUID(),
        vendor_id: filters?.vendorId || '',
        report_period: period.type,
        period_start: period.start.toISOString().split('T')[0],
        period_end: period.end.toISOString().split('T')[0],

        // Order stats
        total_china_orders: orderMetrics.total,
        completed_orders: orderMetrics.completed,
        cancelled_orders: orderMetrics.cancelled,
        disputed_orders: orderMetrics.disputed,

        // Financial
        total_revenue_local: financialMetrics.totalRevenue,
        total_cost_usd: financialMetrics.totalCost,
        total_profit_local: financialMetrics.profit,
        net_margin_percent: financialMetrics.marginPercent,

        // Delivery
        avg_actual_delivery_days: orderMetrics.avgDeliveryDays,
        avg_estimated_delivery_days: 18,
        delivery_variance_days: orderMetrics.avgDeliveryDays - 18,
        on_time_rate: orderMetrics.onTimeRate,

        // Customs
        customs_blocked_orders: customsMetrics.blocked,
        customs_blocked_rate: customsMetrics.blockedRate,
        avg_customs_delay_days: customsMetrics.avgClearanceDays,

        // Rankings - Transform SupplierRanking to TopSupplierStat
        top_suppliers: topSuppliers.map(s => ({
          supplier_id: s.supplierId,
          supplier_name: s.supplierName,
          platform: s.platform as ChinaPlatformType,
          orders_count: s.totalOrders,
          revenue: 0, // Not tracked in SupplierRanking
          profit: 0,  // Not tracked in SupplierRanking
          on_time_rate: s.successRate,
          score: s.score
        })),
        top_products: [],

        // Alerts
        price_increase_alerts: 0,
        stock_out_alerts: 0,
        quality_issues: 0,

        generated_at: new Date().toISOString(),
      };

      // Save to database if vendor specified
      if (filters?.vendorId) {
        const { error } = await supabase
          .from('china_dropship_reports')
          .insert({
            ...report,
            top_suppliers: JSON.stringify(topSuppliers),
            top_products: JSON.stringify([]),
          });

        if (error) {
          console.error('Error saving report:', error);
        }
      }

      setCurrentReport(report);
      return report;
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Erreur génération rapport');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const generateDailyReport = useCallback(async (
    date: Date = new Date(),
    filters?: ReportFilters
  ): Promise<ChinaDropshipReport | null> => {
    return generateReport({
      type: 'daily',
      start: getStartOfDay(date),
      end: getEndOfDay(date),
    }, filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateWeeklyReport = useCallback(async (
    weekStart: Date = new Date(),
    filters?: ReportFilters
  ): Promise<ChinaDropshipReport | null> => {
    return generateReport({
      type: 'weekly',
      start: getStartOfWeek(weekStart),
      end: getEndOfWeek(weekStart),
    }, filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateMonthlyReport = useCallback(async (
    month: Date,
    filters?: ReportFilters
  ): Promise<ChinaDropshipReport | null> => {
    return generateReport({
      type: 'monthly',
      start: getStartOfMonth(month),
      end: getEndOfMonth(month),
    }, filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // QUERIES
  // ============================================================================

  const loadReports = useCallback(async (vendorId: string, limit: number = 20) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('china_dropship_reports')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('generated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      // Transform Json fields to proper types
      setReports(((data || []) as any[]).map(report => ({
        ...report,
        top_suppliers: Array.isArray(report.top_suppliers)
          ? report.top_suppliers
          : (typeof report.top_suppliers === 'string' ? JSON.parse(report.top_suppliers) : []),
        top_products: Array.isArray(report.top_products)
          ? report.top_products
          : (typeof report.top_products === 'string' ? JSON.parse(report.top_products) : [])
      })) as ChinaDropshipReport[]);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Erreur chargement rapports');
    } finally {
      setLoading(false);
    }
  }, []);

  const getReportById = useCallback(async (reportId: string): Promise<ChinaDropshipReport | null> => {
    try {
      const { data, error } = await supabase
        .from('china_dropship_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) throw error;
      // Transform Json fields to proper types
      const report = data as any;
      return {
        ...report,
        top_suppliers: Array.isArray(report.top_suppliers)
          ? report.top_suppliers
          : (typeof report.top_suppliers === 'string' ? JSON.parse(report.top_suppliers) : []),
        top_products: Array.isArray(report.top_products)
          ? report.top_products
          : (typeof report.top_products === 'string' ? JSON.parse(report.top_products) : [])
      } as ChinaDropshipReport;
    } catch (error) {
      console.error('Error getting report:', error);
      return null;
    }
  }, []);

  // ============================================================================
  // EXPORT
  // ============================================================================

  const exportReportCsv = useCallback((report: ChinaDropshipReport) => {
    const headers = [
      'Période',
      'Début',
      'Fin',
      'Commandes totales',
      'Complétées',
      'Annulées',
      'Litiges',
      'Revenu',
      'Coût',
      'Profit',
      'Marge %',
      'Délai moyen',
      'Taux à temps',
    ];

    const values = [
      report.report_period,
      report.period_start,
      report.period_end,
      report.total_china_orders,
      report.completed_orders,
      report.cancelled_orders,
      report.disputed_orders,
      report.total_revenue_local,
      report.total_cost_usd,
      report.total_profit_local,
      report.net_margin_percent,
      report.avg_actual_delivery_days,
      report.on_time_rate,
    ];

    const csv = [headers.join(','), values.join(',')].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `china_report_${report.period_start}_${report.period_end}.csv`;
    link.click();

    toast.success('Rapport CSV téléchargé');
  }, []);

  const exportReportPdf = useCallback(async (_report: ChinaDropshipReport) => {
    // Would integrate with PDF generation library
    toast.info('Export PDF en développement');
  }, []);

  // ============================================================================
  // COMPARISONS
  // ============================================================================

  const comparePerformance = useCallback(async (
    period1: ReportPeriod,
    period2: ReportPeriod
  ) => {
    const [metrics1, metrics2, financial1, financial2] = await Promise.all([
      getOrderMetrics(period1),
      getOrderMetrics(period2),
      getFinancialMetrics(period1),
      getFinancialMetrics(period2),
    ]);

    const calcChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 1000) / 10;
    };

    return {
      orders: {
        current: metrics1.total,
        previous: metrics2.total,
        change: calcChange(metrics1.total, metrics2.total),
      },
      revenue: {
        current: financial1.totalRevenue,
        previous: financial2.totalRevenue,
        change: calcChange(financial1.totalRevenue, financial2.totalRevenue),
      },
      margin: {
        current: financial1.marginPercent,
        previous: financial2.marginPercent,
        change: calcChange(financial1.marginPercent, financial2.marginPercent),
      },
      deliveryDays: {
        current: metrics1.avgDeliveryDays,
        previous: metrics2.avgDeliveryDays,
        change: calcChange(metrics1.avgDeliveryDays, metrics2.avgDeliveryDays),
      },
    };
  }, [getOrderMetrics, getFinancialMetrics]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    loading,
    currentReport,
    reports,
    generateDailyReport,
    generateWeeklyReport,
    generateMonthlyReport,
    loadReports,
    getReportById,
    getOrderMetrics,
    getFinancialMetrics,
    getTopSuppliers,
    getTopProducts,
    getCustomsMetrics,
    exportReportCsv,
    exportReportPdf,
    comparePerformance,
  };
};

export default useChinaReports;
