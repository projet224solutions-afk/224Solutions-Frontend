/**
 * 📦 HOOK - useBackendOrders — Phase 5
 * React Query hooks avec gestion d'erreurs métier structurées
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  createOrder,
  listMyOrders,
  listVendorOrders,
  getOrder,
  cancelOrder,
  updateOrderStatus,
  type CreateOrderPayload,
  type OrderStatusTransition,
} from '@/services/orderBackendService';
import { translateBackendError } from '@/services/backendApi';
import { toast } from 'sonner';

const ORDERS_KEY = ['backend-orders'];
const VENDOR_ORDERS_KEY = ['backend-vendor-orders'];

export function useBackendOrders(params?: { status?: string; limit?: number }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...ORDERS_KEY, params],
    queryFn: async ({ signal }) => {
      const res = await listMyOrders(params, signal);
      if (!res.success) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useVendorOrders(params?: { status?: string; limit?: number }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...VENDOR_ORDERS_KEY, params],
    queryFn: async ({ signal }) => {
      const res = await listVendorOrders(params, signal);
      if (!res.success) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useBackendOrder(orderId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...ORDERS_KEY, orderId],
    queryFn: async ({ signal }) => {
      const res = await getOrder(orderId!, signal);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!user && !!orderId,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => createOrder(payload),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Commande créée avec succès');
        qc.invalidateQueries({ queryKey: ORDERS_KEY });
      } else {
        toast.error(translateBackendError(res));
      }
    },
    onError: () => {
      toast.error('Erreur réseau lors de la commande');
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      cancelOrder(orderId, reason),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Commande annulée');
        qc.invalidateQueries({ queryKey: ORDERS_KEY });
      } else {
        toast.error(translateBackendError(res));
      }
    },
    onError: () => {
      toast.error('Erreur réseau');
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      status,
      options,
    }: {
      orderId: string;
      status: OrderStatusTransition;
      options?: { tracking_number?: string; cancellation_reason?: string };
    }) => updateOrderStatus(orderId, status, options),
    onSuccess: (res) => {
      if (res.success) {
        toast.success('Statut mis à jour');
        qc.invalidateQueries({ queryKey: ORDERS_KEY });
        qc.invalidateQueries({ queryKey: VENDOR_ORDERS_KEY });
      } else {
        toast.error(translateBackendError(res));
      }
    },
    onError: () => {
      toast.error('Erreur réseau');
    },
  });
}
