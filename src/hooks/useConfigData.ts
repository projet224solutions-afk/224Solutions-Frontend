/**
 * ⚙️ HOOK CONFIG DATA
 * Gestion centralisée des configurations pour l'interface PDG
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CommissionConfig {
  id: string;
  service_name: string;
  transaction_type: string;
  commission_type: string;
  commission_value: number;
  min_amount?: number;
  max_amount?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

interface ConfigStats {
  total_configs: number;
  active_configs: number;
  inactive_configs: number;
  services_count: number;
}

export function useConfigData(autoLoad: boolean = true) {
  const [configs, setConfigs] = useState<CommissionConfig[]>([]);
  const [stats, setStats] = useState<ConfigStats>({
    total_configs: 0,
    active_configs: 0,
    inactive_configs: 0,
    services_count: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: configError } = await supabase
        .from('commission_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (configError) {
        console.error('Erreur configs:', configError);
        throw new Error(`Erreur configs: ${configError.message}`);
      }

      const configData = (data || []) as CommissionConfig[];
      setConfigs(configData);

      // Calculer les statistiques
      const uniqueServices = new Set(configData.map(c => c.service_name)).size;

      const newStats: ConfigStats = {
        total_configs: configData.length,
        active_configs: configData.filter(c => c.is_active).length,
        inactive_configs: configData.filter(c => !c.is_active).length,
        services_count: uniqueServices
      };

      setStats(newStats);

      console.log('✅ Configurations chargées:', newStats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      console.error('❌ Erreur chargement configs:', err);
      setError(errorMessage);
      toast.error('Erreur lors du chargement des configurations');
    } finally {
      setLoading(false);
    }
  }, []);

  const createConfig = useCallback(async (configData: Omit<CommissionConfig, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('commission_config').insert({
        ...configData,
        created_by: user?.id
      });

      if (error) throw error;

      // Log action
      await supabase.from('audit_logs').insert({
        actor_id: user?.id,
        action: 'COMMISSION_CONFIG_CREATED',
        target_type: 'commission_config',
        data_json: configData
      });

      toast.success('Configuration créée avec succès');
      await loadConfigs();
    } catch (err) {
      console.error('Erreur création config:', err);
      toast.error('Erreur lors de la création');
      throw err;
    }
  }, [loadConfigs]);

  const updateConfig = useCallback(async (id: string, updates: Partial<CommissionConfig>) => {
    try {
      const { error } = await supabase
        .from('commission_config')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast.success('Configuration mise à jour');
      await loadConfigs();
    } catch (err) {
      console.error('Erreur mise à jour config:', err);
      toast.error('Erreur lors de la mise à jour');
      throw err;
    }
  }, [loadConfigs]);

  const deleteConfig = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('commission_config')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Configuration supprimée');
      await loadConfigs();
    } catch (err) {
      console.error('Erreur suppression config:', err);
      toast.error('Erreur lors de la suppression');
      throw err;
    }
  }, [loadConfigs]);

  const toggleActive = useCallback(async (id: string, currentStatus: boolean) => {
    await updateConfig(id, { is_active: !currentStatus });
  }, [updateConfig]);

  const initializeDefaultConfigs = useCallback(async () => {
    const defaultConfigs = [
      {
        service_name: 'marketplace',
        transaction_type: 'achat',
        commission_type: 'percentage',
        commission_value: 2.5,
        min_amount: 0,
        max_amount: null,
        is_active: true
      },
      {
        service_name: 'taxi',
        transaction_type: 'course',
        commission_type: 'percentage',
        commission_value: 15,
        min_amount: 0,
        max_amount: null,
        is_active: true
      },
      {
        service_name: 'delivery',
        transaction_type: 'livraison',
        commission_type: 'fixed',
        commission_value: 5000,
        min_amount: 0,
        max_amount: null,
        is_active: true
      },
      {
        service_name: 'wallet',
        transaction_type: 'transfer',
        commission_type: 'percentage',
        commission_value: 1,
        min_amount: 10000,
        max_amount: null,
        is_active: true
      }
    ];

    try {
      for (const config of defaultConfigs) {
        await createConfig(config);
      }
      toast.success('Configurations par défaut initialisées');
    } catch (err) {
      console.error('Erreur initialisation:', err);
      toast.error('Erreur lors de l\'initialisation');
    }
  }, [createConfig]);

  useEffect(() => {
    if (autoLoad) {
      loadConfigs();
    }
  }, [autoLoad, loadConfigs]);

  return {
    configs,
    stats,
    loading,
    error,
    refetch: loadConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    toggleActive,
    initializeDefaultConfigs
  };
}
