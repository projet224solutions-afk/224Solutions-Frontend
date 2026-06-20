/**
 * DROPSHIP ORDER HANDLER SERVICE
 * Gère le flux des commandes contenant des produits dropshipping
 *
 * Workflow:
 * 1. Client passe commande normalement (ne sait pas que c'est dropship)
 * 2. Système détecte les items dropship
 * 3. Crée automatiquement les commandes fournisseurs
 * 4. Notifie le vendeur des actions requises
 * 5. Suivi tracking multi-segment
 *
 * @module DropshipOrderHandler
 * @version 1.0.0
 * @author 224Solutions
 */

import { supabase } from '@/integrations/supabase/client';
import { dropshippingConnectorService } from '@/services/connectors/DropshippingConnectorService';

// ==================== TYPES ====================

export interface OrderItem {
  productId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantId?: string;
  variantTitle?: string;
}

export interface CustomerOrder {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vendorId: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  status: string;
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    postalCode?: string;
  };
  paymentMethod: string;
  paymentStatus: string;
  notes?: string;
  createdAt: string;
}

export interface DropshipOrderItem {
  orderId: string;
  orderItemId: string;
  productId: string;
  sourceConnector: string;
  sourceProductId: string;
  quantity: number;
  supplierCost: number;
  supplierCurrency: string;
  supplierOrderId?: string;
  supplierOrderStatus: 'pending' | 'ordered' | 'shipped' | 'delivered' | 'cancelled' | 'error';
  trackingNumber?: string;
  trackingCarrier?: string;
  trackingUrl?: string;
  createdAt: string;
  orderedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
}

export interface ProcessOrderResult {
  success: boolean;
  orderId: string;
  hasDropshipItems: boolean;
  dropshipItemsCount: number;
  regularItemsCount: number;
  supplierOrdersCreated: number;
  errors: string[];
}

// ==================== SERVICE CLASS ====================

export class DropshipOrderHandler {
  private static instance: DropshipOrderHandler;
  private connectorService: typeof dropshippingConnectorService;

  private constructor() {
    this.connectorService = dropshippingConnectorService;
  }

  static getInstance(): DropshipOrderHandler {
    if (!DropshipOrderHandler.instance) {
      DropshipOrderHandler.instance = new DropshipOrderHandler();
    }
    return DropshipOrderHandler.instance;
  }

  /**
   * Traite une nouvelle commande et identifie les items dropship
   */
  async processNewOrder(order: CustomerOrder): Promise<ProcessOrderResult> {
    console.log(`[DropshipOrderHandler] Processing order ${order.id}`);

    const result: ProcessOrderResult = {
      success: false,
      orderId: order.id,
      hasDropshipItems: false,
      dropshipItemsCount: 0,
      regularItemsCount: 0,
      supplierOrdersCreated: 0,
      errors: []
    };

    try {
      // 1. Identifier les items dropship
      const dropshipItems: Array<OrderItem & { dropshipInfo: any }> = [];
      const regularItems: OrderItem[] = [];

      for (const item of order.items) {
        const dropshipInfo = await this.getDropshipProductInfo(item.productId);

        if (dropshipInfo) {
          dropshipItems.push({ ...item, dropshipInfo });
          result.dropshipItemsCount++;
        } else {
          regularItems.push(item);
          result.regularItemsCount++;
        }
      }

      result.hasDropshipItems = dropshipItems.length > 0;

      if (!result.hasDropshipItems) {
        console.log(`[DropshipOrderHandler] Order ${order.id} has no dropship items`);
        result.success = true;
        return result;
      }

      console.log(`[DropshipOrderHandler] Found ${dropshipItems.length} dropship items`);

      // 2. Créer les entrées de commande fournisseur pour chaque item dropship
      for (const item of dropshipItems) {
        try {
          await this.createSupplierOrderEntry(order, item);
          result.supplierOrdersCreated++;
        } catch (error: any) {
          result.errors.push(`Failed to create supplier order for ${item.title}: ${error.message}`);
        }
      }

      // 3. Notifier le vendeur
      await this.notifyVendorOfDropshipOrder(order, dropshipItems);

      // 4. Logger l'activité
      await this.logOrderActivity(order.id, 'dropship_detected', {
        dropshipItemsCount: result.dropshipItemsCount,
        regularItemsCount: result.regularItemsCount
      });

      result.success = result.errors.length === 0;

    } catch (error: any) {
      console.error(`[DropshipOrderHandler] Error processing order ${order.id}:`, error);
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Vérifie si un produit est un dropship et récupère ses infos
   */
  private async getDropshipProductInfo(productId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('dropship_products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Crée une entrée de commande fournisseur
   */
  private async createSupplierOrderEntry(
    order: CustomerOrder,
    item: OrderItem & { dropshipInfo: any }
  ): Promise<void> {
    const { error } = await (supabase as any)
      .from('china_supplier_orders')
      .insert({
        customer_order_id: order.id,
        vendor_id: order.vendorId,
        supplier_id: item.dropshipInfo.china_supplier_id || null,
        status: 'pending_supplier_confirm',
        items: [{
          product_id: item.productId,
          title: item.title,
          quantity: item.quantity,
          unit_cost: item.dropshipInfo.cost_price,
          total_cost: item.dropshipInfo.cost_price * item.quantity
        }],
        shipping_address: order.shippingAddress,
        supplier_total_usd: item.dropshipInfo.cost_price * item.quantity,
        supplier_total_cny: (item.dropshipInfo.cost_price * item.quantity) * 7.2,
        notes_internal: `Source: ${item.dropshipInfo.source_connector} | Product: ${item.dropshipInfo.source_product_id}`
      });

    if (error) {
      console.error('[DropshipOrderHandler] Error creating supplier order:', error);
      throw error;
    }
  }

  /**
   * Notifie le vendeur d'une commande dropship
   */
  private async notifyVendorOfDropshipOrder(
    order: CustomerOrder,
    dropshipItems: Array<OrderItem & { dropshipInfo: any }>
  ): Promise<void> {
    // Créer une notification
    await supabase
      .from('notifications')
      .insert({
        user_id: order.vendorId,
        type: 'dropship_order',
        title: 'Nouvelle commande dropshipping',
        message: `Commande #${order.id.slice(-8)} contient ${dropshipItems.length} produit(s) dropship à commander`,
        data: {
          orderId: order.id,
          customerName: order.customerName,
          dropshipItemsCount: dropshipItems.length,
          totalSupplierCost: dropshipItems.reduce((sum, item) =>
            sum + (item.dropshipInfo.cost_price * item.quantity), 0
          )
        },
        read: false,
        created_at: new Date().toISOString()
      });
  }

  /**
   * Log une activité liée à la commande
   */
  private async logOrderActivity(
    orderId: string,
    action: string,
    details: Record<string, any>
  ): Promise<void> {
    await supabase
      .from('dropship_activity_logs')
      .insert({
        entity_type: 'order',
        entity_id: orderId,
        action,
        details,
        created_at: new Date().toISOString()
      });
  }

  /**
   * Récupère les commandes fournisseur en attente pour un vendeur
   */
  async getPendingSupplierOrders(vendorId: string): Promise<DropshipOrderItem[]> {
    const { data, error } = await supabase
      .from('china_supplier_orders')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DropshipOrderHandler] Error fetching pending orders:', error);
      return [];
    }

    return (data || []).map(this.mapSupplierOrder);
  }

  /**
   * Récupère toutes les commandes fournisseur pour un vendeur
   */
  async getSupplierOrders(
    vendorId: string,
    status?: string
  ): Promise<DropshipOrderItem[]> {
    let query = supabase
      .from('china_supplier_orders')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[DropshipOrderHandler] Error fetching supplier orders:', error);
      return [];
    }

    return (data || []).map(this.mapSupplierOrder);
  }

  /**
   * Marque une commande fournisseur comme passée
   */
  async markAsOrdered(
    supplierOrderId: string,
    externalOrderId: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('china_supplier_orders')
      .update({
        status: 'ordered',
        supplier_order_id: externalOrderId,
        ordered_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', supplierOrderId);

    if (error) {
      console.error('[DropshipOrderHandler] Error marking order as ordered:', error);
      return false;
    }

    // Mettre à jour le statut de la commande client
    await this.updateCustomerOrderStatus(supplierOrderId, 'processing');

    return true;
  }

  /**
   * Met à jour le tracking d'une commande fournisseur
   */
  async updateTracking(
    supplierOrderId: string,
    trackingNumber: string,
    carrier: string,
    trackingUrl?: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('china_supplier_orders')
      .update({
        status: 'shipped',
        tracking_number: trackingNumber,
        tracking_carrier: carrier,
        tracking_url: trackingUrl,
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', supplierOrderId);

    if (error) {
      console.error('[DropshipOrderHandler] Error updating tracking:', error);
      return false;
    }

    // Mettre à jour le statut de la commande client
    await this.updateCustomerOrderStatus(supplierOrderId, 'shipped');

    return true;
  }

  /**
   * Marque une commande comme livrée
   */
  async markAsDelivered(supplierOrderId: string): Promise<boolean> {
    const { error } = await supabase
      .from('china_supplier_orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', supplierOrderId);

    if (error) {
      console.error('[DropshipOrderHandler] Error marking as delivered:', error);
      return false;
    }

    // Mettre à jour le statut de la commande client
    await this.updateCustomerOrderStatus(supplierOrderId, 'delivered');

    return true;
  }

  /**
   * Met à jour le statut de la commande client principale
   */
  private async updateCustomerOrderStatus(
    supplierOrderId: string,
    status: string
  ): Promise<void> {
    // Récupérer l'ID de la commande client
    const { data: supplierOrder } = await supabase
      .from('china_supplier_orders')
      .select('customer_order_id')
      .eq('id', supplierOrderId)
      .single();

    if (!supplierOrder) return;

    // Vérifier si tous les items dropship de la commande ont le même statut
    const { data: allItems } = await supabase
      .from('china_supplier_orders')
      .select('status')
      .eq('customer_order_id', supplierOrder.customer_order_id);

    if (!allItems) return;

    // Si tous les items ont le statut ou supérieur, mettre à jour la commande
    const allSameOrHigher = allItems.every(item =>
      this.getStatusLevel(item.status) >= this.getStatusLevel(status)
    );

    if (allSameOrHigher) {
      // Map status to valid order status
      const orderStatus = this.mapToOrderStatus(status);
      await supabase
        .from('orders')
        .update({
          status: orderStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', supplierOrder.customer_order_id);
    }
  }

  /**
   * Map supplier status to order status
   */
  private mapToOrderStatus(status: string): 'pending' | 'confirmed' | 'processing' | 'preparing' | 'ready' | 'in_transit' | 'delivered' | 'completed' | 'cancelled' {
    const mapping: Record<string, 'pending' | 'confirmed' | 'processing' | 'preparing' | 'ready' | 'in_transit' | 'delivered' | 'completed' | 'cancelled'> = {
      'pending': 'pending',
      'pending_supplier_confirm': 'processing',
      'ordered': 'processing',
      'processing': 'processing',
      'shipped': 'in_transit',
      'shipped_international': 'in_transit',
      'customs_clearance': 'in_transit',
      'last_mile_delivery': 'in_transit',
      'delivered': 'delivered',
      'completed': 'completed',
      'cancelled': 'cancelled',
      'error': 'cancelled'
    };
    return mapping[status] || 'pending';
  }

  /**
   * Obtient le niveau numérique d'un statut pour comparaison
   */
  private getStatusLevel(status: string): number {
    const levels: Record<string, number> = {
      'pending': 0,
      'ordered': 1,
      'processing': 2,
      'shipped': 3,
      'delivered': 4,
      'cancelled': -1,
      'error': -1
    };
    return levels[status] ?? 0;
  }

  /**
   * Map les données DB vers le type DropshipOrderItem
   */
  private mapSupplierOrder(data: any): DropshipOrderItem {
    return {
      orderId: data.customer_order_id,
      orderItemId: data.id,
      productId: data.items?.[0]?.product_id || '',
      sourceConnector: data.notes_internal?.split('Source: ')[1]?.split(' |')[0] || 'UNKNOWN',
      sourceProductId: data.items?.[0]?.product_id || '',
      quantity: data.items?.[0]?.quantity || 0,
      supplierCost: data.supplier_total_usd || 0,
      supplierCurrency: 'USD',
      supplierOrderId: data.id,
      supplierOrderStatus: data.status as any,
      trackingNumber: undefined,
      trackingCarrier: undefined,
      trackingUrl: undefined,
      createdAt: data.created_at,
      orderedAt: data.supplier_payment_date,
      shippedAt: data.expected_ship_date,
      deliveredAt: data.expected_delivery_date
    };
  }

  /**
   * Calcule le profit réel d'une commande dropship
   */
  async calculateOrderProfit(orderId: string): Promise<{
    revenue: number;
    supplierCost: number;
    profit: number;
    marginPercent: number;
  }> {
    // Récupérer la commande client
    const { data: order } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('id', orderId)
      .single();

    // Récupérer les coûts fournisseur
    const { data: supplierOrders } = await supabase
      .from('china_supplier_orders')
      .select('supplier_total_usd')
      .eq('customer_order_id', orderId);

    const revenue = order?.total_amount || 0;
    const supplierCost = (supplierOrders || []).reduce((sum, o) => sum + (o.supplier_total_usd || 0), 0);
    const profit = revenue - supplierCost;
    const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      revenue,
      supplierCost,
      profit,
      marginPercent
    };
  }
}

// ==================== SINGLETON EXPORT ====================

export const dropshipOrderHandler = DropshipOrderHandler.getInstance();

export default dropshipOrderHandler;
