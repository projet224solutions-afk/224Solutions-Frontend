/**
 * USE SUPABASE ROBUST - 224Solutions Enterprise
 * Hook Supabase avec toutes les protections Enterprise
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRobustQuery, useRobustMutation, RobustQueryOptions } from './useRobustQuery';
import { retryPresets } from '@/lib/retryWithBackoff';

type _SupabaseTable = keyof (typeof supabase)['from'] extends (table: infer T) => any ? T : never;

interface UseSupabaseRobustOptions<T> extends Omit<RobustQueryOptions<T>, 'key'> {
  table: string;
  select?: string;
  filters?: (query: any) => any;
  single?: boolean;
  count?: 'exact' | 'planned' | 'estimated';
}

/**
 * Hook pour requêtes SELECT robustes
 */
export function useSupabaseSelect<T = any>(options: UseSupabaseRobustOptions<T[]>) {
  const {
    table,
    select = '*',
    filters,
    single = false,
    count,
    ...robustOptions
  } = options;

  const queryFn = useCallback(async (): Promise<T[]> => {
    let query = (supabase.from as any)(table).select(select, count ? { count } : undefined);

    if (filters) {
      query = filters(query);
    }

    if (single) {
      const { data, error } = await query.single();
      if (error) throw error;
      return [data as T];
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as T[];
  }, [table, select, filters, single, count]);

  return useRobustQuery<T[]>(queryFn, {
    key: `supabase:${table}:${select}`,
    retry: retryPresets.database,
    circuitBreaker: { enabled: true, failureThreshold: 3 },
    fallback: [],
    ...robustOptions
  });
}

/**
 * Hook pour un seul enregistrement
 */
export function useSupabaseSingle<T = any>(
  options: Omit<UseSupabaseRobustOptions<T>, 'single'> & { id?: string; idColumn?: string }
) {
  const { table, select = '*', id, idColumn = 'id', filters, ...robustOptions } = options;

  const queryFn = useCallback(async (): Promise<T | null> => {
    let query = (supabase.from as any)(table).select(select);

    if (id) {
      query = query.eq(idColumn, id);
    }

    if (filters) {
      query = filters(query);
    }

    const { data, error } = await query.single();
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data as T;
  }, [table, select, id, idColumn, filters]);

  return useRobustQuery<T | null>(queryFn, {
    key: `supabase:${table}:single:${id || 'filtered'}`,
    retry: retryPresets.database,
    circuitBreaker: { enabled: true },
    enabled: !!id || !!filters,
    ...robustOptions
  });
}

/**
 * Hook pour INSERT robuste
 */
export function useSupabaseInsert<T = any>(table: string) {
  return useRobustMutation<T, Partial<T> | Partial<T>[]>(
    async (data) => {
      const { data: result, error } = await (supabase.from as any)(table)
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result as T;
    },
    {
      key: `supabase:${table}:insert`,
      retry: retryPresets.database,
      circuitBreaker: { enabled: true, failureThreshold: 5 }
    }
  );
}

/**
 * Hook pour UPDATE robuste
 */
export function useSupabaseUpdate<T = any>(table: string) {
  return useRobustMutation<T, { id: string; data: Partial<T> }>(
    async ({ id, data }) => {
      const { data: result, error } = await (supabase.from as any)(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result as T;
    },
    {
      key: `supabase:${table}:update`,
      retry: retryPresets.database,
      circuitBreaker: { enabled: true }
    }
  );
}

/**
 * Hook pour DELETE robuste
 */
export function useSupabaseDelete(table: string) {
  return useRobustMutation<void, string | string[]>(
    async (ids) => {
      const idArray = Array.isArray(ids) ? ids : [ids];

      const { error } = await (supabase.from as any)(table)
        .delete()
        .in('id', idArray);

      if (error) throw error;
    },
    {
      key: `supabase:${table}:delete`,
      retry: { ...retryPresets.database, maxRetries: 1 },
      circuitBreaker: { enabled: true }
    }
  );
}

/**
 * Hook pour UPSERT robuste
 */
export function useSupabaseUpsert<T = any>(table: string) {
  return useRobustMutation<T, Partial<T> | Partial<T>[]>(
    async (data) => {
      const { data: result, error } = await (supabase.from as any)(table)
        .upsert(data)
        .select()
        .single();

      if (error) throw error;
      return result as T;
    },
    {
      key: `supabase:${table}:upsert`,
      retry: retryPresets.database,
      circuitBreaker: { enabled: true }
    }
  );
}

/**
 * Hook pour appels RPC robustes
 */
export function useSupabaseRpc<T = any, P = any>(functionName: string) {
  return useRobustMutation<T, P>(
    async (params) => {
      const { data, error } = await (supabase.rpc as any)(functionName, params);
      if (error) throw error;
      return data as T;
    },
    {
      key: `supabase:rpc:${functionName}`,
      retry: retryPresets.api,
      circuitBreaker: { enabled: true, failureThreshold: 5 }
    }
  );
}

/**
 * Hook pour Edge Functions robustes
 */
export function useSupabaseEdgeFunction<T = any, P = any>(functionName: string) {
  return useRobustMutation<T, P>(
    async (body) => {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: body as any
      });
      if (error) throw error;
      return data as T;
    },
    {
      key: `supabase:edge:${functionName}`,
      retry: retryPresets.api,
      circuitBreaker: { enabled: true, failureThreshold: 3, timeout: 60000 }
    }
  );
}
