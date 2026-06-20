/**
 * 🔍 HOOK: SUIVI COMPLET DES ACTIVITÉS UTILISATEUR
 * Utilise une Edge Function pour bypasser les RLS et récupérer toutes les données
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types pour les différentes activités
export interface UserFullProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
  public_id?: string;
  role?: string;
  address?: string;
  city?: string;
  country?: string;
  created_at?: string;
  updated_at?: string;
  last_sign_in_at?: string;
}

export interface WalletInfo {
  id: string;
  balance: number;
  currency: string;
  status: string;
  created_at: string;
  full_data?: any;
}

export interface TransactionActivity {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  sender_user_id?: string;
  receiver_user_id?: string;
  direction?: 'sent' | 'received';
  created_at: string;
  metadata?: any;
}

export interface FinancialTransaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  created_at: string;
}

export interface OrderActivity {
  id: string;
  order_number?: string;
  status: string;
  payment_status?: string;
  payment_method?: string;
  total_amount: number;
  subtotal?: number;
  source?: string;
  role?: 'customer' | 'vendor';
  created_at: string;
  updated_at?: string;
  shipping_address?: any;
  notes?: string;
}

export interface LoginActivity {
  id: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  attempted_at: string;
  role?: string;
}

export interface AuditActivity {
  id: string;
  action: string;
  target_type?: string;
  target_id?: string;
  ip_address?: string;
  user_agent?: string;
  data_json?: any;
  created_at: string;
}

export interface MessageActivity {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string; // CONTENU COMPLET
  content_preview: string;
  type: string;
  status: string;
  direction: 'sent' | 'received';
  file_url?: string;
  file_name?: string;
  file_size?: number;
  read_at?: string;
  created_at: string;
  metadata?: any;
}

export interface DeliveryActivity {
  id: string;
  status: string;
  pickup_address?: any;
  delivery_address?: any;
  price?: number;
  role?: 'client' | 'driver';
  created_at: string;
  estimated_delivery?: string;
  actual_delivery?: string;
}

export interface RideActivity {
  id: string;
  status: string;
  pickup_address?: any;
  destination_address?: any;
  fare?: number;
  role?: 'customer' | 'driver';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  distance_km?: number;
}

export interface ReviewActivity {
  id: string;
  rating: number;
  content?: string;
  product_id?: string;
  user_id?: string;
  created_at: string;
}

export interface VendorInfo {
  id: string;
  business_name?: string;
  business_type?: string;
  is_active?: boolean;
  total_products?: number;
  products?: any[];
  created_at?: string;
  [key: string]: any;
}

export interface DriverInfo {
  id: string;
  vehicle_type?: string;
  license_number?: string;
  status?: string;
  total_deliveries?: number;
  rating?: number;
  created_at?: string;
  [key: string]: any;
}

export interface ActivitySummary {
  totalTransactions: number;
  totalOrders: number;
  totalMessages: number;
  totalDeliveries: number;
  totalRides: number;
  totalReviewsGiven: number;
  totalReviewsReceived: number;
  totalFavorites: number;
  totalLogins: number;
  totalAuditEvents: number;
  moneySpent: number;
  moneyReceived: number;
  ordersAmount: number;
}

export interface UserActivitySummary {
  profile: UserFullProfile | null;
  customId: string | null;
  roleType: string | null;
  userId: string | null;

  // Wallet & Finance
  wallet: WalletInfo | null;
  transactions: TransactionActivity[];
  totalTransactions: number;
  totalSpent: number;
  totalReceived: number;

  // Transactions additionnelles
  financialTransactions: FinancialTransaction[];
  mobileMoneyPayments: any[];
  p2pTransactions: any[];

  // Commerce
  orders: OrderActivity[];
  totalOrders: number;
  totalOrdersAmount: number;

  // Security & Auth
  loginHistory: LoginActivity[];
  totalLogins: number;
  lastLogin: string | null;

  // Audit Trail
  auditLogs: AuditActivity[];
  totalAuditEvents: number;

  // Communication - CONTENU COMPLET
  messages: MessageActivity[];
  totalMessages: number;
  messagesSent: number;
  messagesReceived: number;

  // Delivery & Rides
  deliveries: DeliveryActivity[];
  totalDeliveries: number;
  rides: RideActivity[];
  totalRides: number;

  // Reviews
  reviewsGiven: ReviewActivity[];
  reviewsReceived: ReviewActivity[];
  totalReviews: number;
  averageRating: number;

  // Favoris et Wishlists
  favorites: any[];
  wishlists: any[];
  totalFavorites: number;
  totalWishlists: number;

  // Paniers
  carts: any[];

  // Notifications
  notifications: any[];
  totalNotifications: number;

  // Role-specific
  vendorInfo: VendorInfo | null;
  driverInfo: DriverInfo | null;

  // Meta
  accountAge: number; // en jours
  registrationDate: string | null;
  lastActivity: string | null;

  // Stats résumé
  activitySummary: ActivitySummary;
}

export function useUserActivityTracker() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityData, setActivityData] = useState<UserActivitySummary | null>(null);

  /**
   * Rechercher un utilisateur par son ID public (VND0001, CLT0002, etc.)
   * Utilise l'Edge Function pour bypasser les RLS
   */
  const searchUserById = useCallback(async (publicId: string): Promise<UserActivitySummary | null> => {
    setLoading(true);
    setError(null);

    try {
      const trimmedId = publicId.trim().toUpperCase();

      // Appeler l'Edge Function
      const { data, error: fnError } = await supabase.functions.invoke('get-user-activity', {
        body: { customId: trimmedId }
      });

      if (fnError) {
        console.error('Edge function error:', fnError);
        throw new Error(fnError.message || 'Erreur lors de la recherche');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const summary: UserActivitySummary = {
        profile: data.profile as UserFullProfile,
        customId: data.customId,
        roleType: data.roleType,
        userId: data.userId,

        wallet: data.wallet,
        transactions: data.transactions || [],
        totalTransactions: data.totalTransactions || 0,
        totalSpent: data.totalSpent || 0,
        totalReceived: data.totalReceived || 0,

        financialTransactions: data.financialTransactions || [],
        mobileMoneyPayments: data.mobileMoneyPayments || [],
        p2pTransactions: data.p2pTransactions || [],

        orders: data.orders || [],
        totalOrders: data.totalOrders || 0,
        totalOrdersAmount: data.totalOrdersAmount || 0,

        loginHistory: data.loginHistory || [],
        totalLogins: data.totalLogins || 0,
        lastLogin: data.lastLogin,

        auditLogs: data.auditLogs || [],
        totalAuditEvents: data.totalAuditEvents || 0,

        messages: data.messages || [],
        totalMessages: data.totalMessages || 0,
        messagesSent: data.messagesSent || 0,
        messagesReceived: data.messagesReceived || 0,

        deliveries: data.deliveries || [],
        totalDeliveries: data.totalDeliveries || 0,
        rides: data.rides || [],
        totalRides: data.totalRides || 0,

        reviewsGiven: data.reviewsGiven || [],
        reviewsReceived: data.reviewsReceived || [],
        totalReviews: data.totalReviews || 0,
        averageRating: data.averageRating || 0,

        favorites: data.favorites || [],
        wishlists: data.wishlists || [],
        totalFavorites: data.totalFavorites || 0,
        totalWishlists: data.totalWishlists || 0,

        carts: data.carts || [],

        notifications: data.notifications || [],
        totalNotifications: data.totalNotifications || 0,

        vendorInfo: data.vendorInfo,
        driverInfo: data.driverInfo,

        accountAge: data.accountAge || 0,
        registrationDate: data.registrationDate,
        lastActivity: data.lastActivity,

        activitySummary: data.activitySummary || {
          totalTransactions: 0,
          totalOrders: 0,
          totalMessages: 0,
          totalDeliveries: 0,
          totalRides: 0,
          totalReviewsGiven: 0,
          totalReviewsReceived: 0,
          totalFavorites: 0,
          totalLogins: 0,
          totalAuditEvents: 0,
          moneySpent: 0,
          moneyReceived: 0,
          ordersAmount: 0
        }
      };

      setActivityData(summary);
      toast.success(`Données complètes trouvées pour ${trimmedId}`);
      return summary;

    } catch (err: any) {
      const errorMsg = err.message || 'Erreur lors de la recherche';
      setError(errorMsg);
      toast.error(errorMsg);
      console.error('Search error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Exporter les données en JSON
   */
  const exportToJson = useCallback(() => {
    if (!activityData) return;

    const dataStr = JSON.stringify(activityData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `activite_complete_${activityData.customId}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Données exportées avec succès');
  }, [activityData]);

  /**
   * Réinitialiser les données
   */
  const reset = useCallback(() => {
    setActivityData(null);
    setError(null);
  }, []);

  return {
    loading,
    error,
    activityData,
    searchUserById,
    exportToJson,
    reset
  };
}
