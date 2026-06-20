/**
 * 🛡️ HOOK DONNÉES PDG - VERSION ENTERPRISE ROBUSTE
 * Gestion des données réelles pour le dashboard PDG
 * Avec Circuit Breaker, Retry, Cache et Error Boundary
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { circuitBreaker, CircuitState } from '@/lib/circuitBreaker';
import { retryWithBackoff, RetryConfig } from '@/lib/retryWithBackoff';

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinDate: string;
  lastActivity: string;
  revenue: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  method: string;
  status: string;
  date: string;
  user: string;
  commission: number;
}

interface Product {
  id: string;
  name: string;
  vendor: string;
  status: string;
  price: number;
  sales: number;
  compliance: string;
}

interface PDGStats {
  totalUsers: number;
  totalRevenue: number;
  activeVendors: number;
  pendingOrders: number;
  systemHealth: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  staleTime: number;
}

interface LoadingState {
  users: boolean;
  transactions: boolean;
  products: boolean;
  stats: boolean;
}

// Configuration robuste
const RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const STALE_TIME = 2 * 60 * 1000; // 2 minutes

export function usePDGData() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<PDGStats>({
    totalUsers: 0,
    totalRevenue: 0,
    activeVendors: 0,
    pendingOrders: 0,
    systemHealth: 0
  });

  const [loadingState, setLoadingState] = useState<LoadingState>({
    users: true,
    transactions: true,
    products: true,
    stats: true
  });

  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [circuitState, setCircuitState] = useState<CircuitState>('CLOSED');

  // Références pour le cache
  const cacheRef = useRef<Map<string, CacheEntry<any>>>(new Map());
  const circuitName = 'pdg-data';

  // Subscribe to circuit state changes
  useEffect(() => {
    const unsubscribe = circuitBreaker.subscribe(circuitName, (state) => {
      setCircuitState(state);
      if (state === 'OPEN') {
        toast.warning('Service temporairement indisponible, récupération en cours...');
      } else if (state === 'CLOSED') {
        toast.success('Service restauré');
      }
    });
    return unsubscribe;
  }, []);

  // Helpers de cache
  const getFromCache = <T,>(key: string): T | null => {
    const entry = cacheRef.current.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > CACHE_TTL) {
      cacheRef.current.delete(key);
      return null;
    }

    return entry.data as T;
  };

  const setToCache = <T,>(key: string, data: T): void => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
      staleTime: STALE_TIME
    });
  };

  const isStale = (key: string): boolean => {
    const entry = cacheRef.current.get(key);
    if (!entry) return true;
    return Date.now() - entry.timestamp > entry.staleTime;
  };

  // Exécution robuste avec circuit breaker + retry
  const executeRobust = async <T,>(
    key: string,
    operation: () => Promise<T>,
    options?: { useCache?: boolean; silent?: boolean }
  ): Promise<T | null> => {
    const { useCache = true, silent = false } = options || {};

    // Vérifier le cache d'abord
    if (useCache) {
      const cached = getFromCache<T>(key);
      if (cached && !isStale(key)) {
        return cached;
      }
    }

    try {
      const result = await circuitBreaker.execute(circuitName, async () => {
        return await retryWithBackoff(operation, RETRY_CONFIG);
      });

      if (result !== null && useCache) {
        setToCache(key, result);
      }

      return result;
    } catch (err: any) {
      console.error(`❌ [PDG] Erreur ${key}:`, err);

      // Retourner les données en cache même si stale en cas d'erreur
      if (useCache) {
        const staleData = getFromCache<T>(key);
        if (staleData) {
          if (!silent) {
            toast.warning('Données potentiellement obsolètes');
          }
          return staleData;
        }
      }

      if (!silent) {
        setError(`Erreur lors du chargement: ${key}`);
      }
      return null;
    }
  };

  // Charger les utilisateurs
  const loadUsers = useCallback(async (silent = false) => {
    setLoadingState(prev => ({ ...prev, users: true }));

    const result = await executeRobust<UserAccount[]>(
      'pdg_users',
      async () => {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select(`
            id,
            first_name,
            last_name,
            email,
            role,
            status,
            created_at,
            updated_at,
            user_ids(custom_id)
          `)
          .order('created_at', { ascending: false })
          .limit(50);

        if (profilesError) throw profilesError;

        return profiles?.map(profile => ({
          id: profile.id,
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'N/A',
          email: profile.email || '',
          role: profile.role || 'client',
          status: profile.status || 'active',
          joinDate: new Date(profile.created_at).toISOString().split('T')[0],
          lastActivity: new Date(profile.updated_at).toISOString().split('T')[0],
          revenue: 0
        })) || [];
      },
      { silent }
    );

    if (result) {
      setUsers(result);
    }

    setLoadingState(prev => ({ ...prev, users: false }));
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charger les transactions
  const loadTransactions = useCallback(async (silent = false) => {
    setLoadingState(prev => ({ ...prev, transactions: true }));

    const result = await executeRobust<Transaction[]>(
      'pdg_transactions',
      async () => {
        const { data: walletTransactions, error: transactionsError } = await supabase
          .from('wallet_transactions')
          .select(`
            id,
            amount,
            transaction_type,
            status,
            created_at
          `)
          .order('created_at', { ascending: false })
          .limit(100);

        if (transactionsError) throw transactionsError;

        return walletTransactions?.map(tx => ({
          id: String(tx.id),
          type: tx.transaction_type || 'Transaction',
          amount: tx.amount,
          method: 'mobile_money',
          status: tx.status || 'completed',
          date: new Date(tx.created_at).toISOString().split('T')[0],
          user: 'Utilisateur',
          commission: Math.floor(tx.amount * 0.015)
        })) || [];
      },
      { silent }
    );

    if (result) {
      setTransactions(result);
    }

    setLoadingState(prev => ({ ...prev, transactions: false }));
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charger les produits
  const loadProducts = useCallback(async (silent = false) => {
    setLoadingState(prev => ({ ...prev, products: true }));

    const result = await executeRobust<Product[]>(
      'pdg_products',
      async () => {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            price,
            is_active,
            created_at,
            vendors(business_name)
          `)
          .order('created_at', { ascending: false })
          .limit(50);

        if (productsError) throw productsError;

        return productsData?.map((product: any) => {
          const vendor = product.vendors;
          return {
            id: product.id,
            name: product.name,
            vendor: vendor?.business_name || 'Vendeur',
            status: product.is_active ? 'active' : 'inactive',
            price: product.price,
            sales: 0,
            compliance: 'compliant'
          };
        }) || [];
      },
      { silent }
    );

    if (result) {
      setProducts(result);
    }

    setLoadingState(prev => ({ ...prev, products: false }));
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charger les statistiques
  const loadStats = useCallback(async (silent = false) => {
    setLoadingState(prev => ({ ...prev, stats: true }));

    const result = await executeRobust<PDGStats>(
      'pdg_stats',
      async () => {
        // 🚀 Optimized: use 'id' instead of '*' for count queries, limit revenue query
        const [
          { count: totalUsers },
          { count: activeVendors },
          { count: pendingOrders },
          { data: revenueData }
        ] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'vendeur')
            .eq('status', 'active'),
          supabase.from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase.from('wallet_transactions')
            .select('amount')
            .eq('status', 'completed')
            .limit(1000)
        ]);

        const totalRevenue = revenueData?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;

        return {
          totalUsers: totalUsers || 0,
          totalRevenue,
          activeVendors: activeVendors || 0,
          pendingOrders: pendingOrders || 0,
          systemHealth: 98.7
        };
      },
      { silent }
    );

    if (result) {
      setStats(result);
    }

    setLoadingState(prev => ({ ...prev, stats: false }));
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charger toutes les données
  const loadAllData = useCallback(async (silent = false) => {
    if (!silent) {
      setError(null);
    }

    const startTime = Date.now();

    await Promise.all([
      loadUsers(silent),
      loadTransactions(silent),
      loadProducts(silent),
      loadStats(silent)
    ]);

    setLastRefresh(new Date());

    const duration = Date.now() - startTime;
    console.log(`✅ [PDG] Données chargées en ${duration}ms`);
  }, [loadUsers, loadTransactions, loadProducts, loadStats]);

  // Actions utilisateur robustes
  const handleUserAction = useCallback(async (
    userId: string,
    action: 'suspend' | 'activate' | 'delete'
  ): Promise<boolean> => {
    try {
      const result = await retryWithBackoff(async () => {
        if (action === 'delete') {
          const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('profiles')
            .update({ status: action === 'suspend' ? 'suspended' : 'active' })
            .eq('id', userId);
          if (error) throw error;
        }
        return true;
      }, { ...RETRY_CONFIG, maxRetries: 2 });

      if (result) {
        // Invalider le cache
        cacheRef.current.delete('pdg_users');
        await loadUsers(true);

        const actionText = action === 'delete' ? 'supprimé'
          : action === 'suspend' ? 'suspendu' : 'activé';
        toast.success(`Utilisateur ${actionText} avec succès`);
      }

      return result || false;
    } catch (error: any) {
      console.error('❌ Erreur action utilisateur:', error);
      toast.error(`Erreur: ${error.message}`);
      return false;
    }
  }, [loadUsers]);

  // Actions produit robustes
  const handleProductAction = useCallback(async (
    productId: string,
    action: 'block' | 'unblock' | 'delete'
  ): Promise<boolean> => {
    try {
      const result = await retryWithBackoff(async () => {
        if (action === 'delete') {
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('products')
            .update({ is_active: action !== 'block' })
            .eq('id', productId);
          if (error) throw error;
        }
        return true;
      }, { ...RETRY_CONFIG, maxRetries: 2 });

      if (result) {
        // Invalider le cache
        cacheRef.current.delete('pdg_products');
        await loadProducts(true);

        const actionText = action === 'delete' ? 'supprimé'
          : action === 'block' ? 'bloqué' : 'débloqué';
        toast.success(`Produit ${actionText} avec succès`);
      }

      return result || false;
    } catch (error: any) {
      console.error('❌ Erreur action produit:', error);
      toast.error(`Erreur: ${error.message}`);
      return false;
    }
  }, [loadProducts]);

  // Invalider tout le cache
  const invalidateCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  // Charger les données au montage
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Actualisation périodique en arrière-plan
  useEffect(() => {
    const interval = setInterval(() => {
      loadAllData(true); // Silent refresh
    }, 2 * 60 * 1000); // Toutes les 2 minutes

    return () => clearInterval(interval);
  }, [loadAllData]);

  // État de chargement global
  const loading = loadingState.users || loadingState.transactions ||
                  loadingState.products || loadingState.stats;

  return {
    // Données
    users,
    transactions,
    products,
    stats,

    // États
    loading,
    loadingState,
    error,
    lastRefresh,
    circuitState,

    // Actions
    loadAllData,
    handleUserAction,
    handleProductAction,
    refetch: loadAllData,

    // Cache
    invalidateCache,

    // Helpers
    isCircuitOpen: circuitState === 'OPEN',
    isHealthy: circuitState === 'CLOSED' && !error
  };
}

export default usePDGData;
