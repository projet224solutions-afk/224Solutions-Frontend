import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SyndicateWorkerPermissions } from './useSyndicateWorkerPermissions';

export interface SyndicateWorker {
  id: string;
  bureau_id: string;
  custom_id?: string;
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  role?: string;
  access_level: string;
  permissions?: SyndicateWorkerPermissions;
  is_active: boolean;
  commission_rate?: number;
  access_token?: string;
  last_login_at?: string;
  login_attempts?: number;
  locked_until?: string;
  created_at: string;
  updated_at?: string;
}

export interface SyndicateWorkerStats {
  totalWorkers: number;
  activeWorkers: number;
  presidentCount: number;
  secretaryCount: number;
  memberCount: number;
}

export const useSyndicateWorkersData = (bureauId?: string) => {
  const [workers, setWorkers] = useState<SyndicateWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SyndicateWorkerStats>({
    totalWorkers: 0,
    activeWorkers: 0,
    presidentCount: 0,
    secretaryCount: 0,
    memberCount: 0,
  });

  const loadWorkers = useCallback(async () => {
    if (!bureauId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('syndicate_workers')
        .select('*')
        .eq('bureau_id', bureauId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading syndicate workers:', error);
        toast.error('Erreur lors du chargement des membres');
        return;
      }

      const formattedWorkers = (data || []).map(worker => ({
        ...worker,
        permissions: worker.permissions as SyndicateWorkerPermissions
      }));

      setWorkers(formattedWorkers);

      // Calculate stats
      const totalWorkers = data?.length || 0;
      const activeWorkers = data?.filter(w => w.is_active).length || 0;
      const presidentCount = data?.filter(w => w.access_level === 'president').length || 0;
      const secretaryCount = data?.filter(w => w.access_level === 'secretary').length || 0;
      const memberCount = data?.filter(w => w.access_level === 'member').length || 0;

      setStats({
        totalWorkers,
        activeWorkers,
        presidentCount,
        secretaryCount,
        memberCount,
      });
    } catch (err) {
      console.error('Error in loadWorkers:', err);
      toast.error('Erreur lors du chargement des membres');
    } finally {
      setLoading(false);
    }
  }, [bureauId]);

  const createWorker = useCallback(async (workerData: {
    nom: string;
    prenom?: string;
    email?: string;
    telephone?: string;
    access_level?: string;
    permissions?: SyndicateWorkerPermissions;
  }) => {
    if (!bureauId) {
      toast.error('Bureau non identifié');
      return null;
    }

    try {
      // Utiliser la fonction SECURITY DEFINER pour contourner les RLS
      const { data: workerId, error } = await supabase.rpc('create_syndicate_worker_secure', {
        p_bureau_id: bureauId,
        p_nom: workerData.nom,
        p_prenom: workerData.prenom || null,
        p_email: workerData.email || null,
        p_telephone: workerData.telephone || null,
        p_access_level: workerData.access_level || 'member',
        p_permissions: workerData.permissions || {}
      });

      if (error) {
        console.error('Error creating worker:', error);
        toast.error('Erreur lors de la création du membre');
        return null;
      }

      toast.success('Membre créé avec succès');
      await loadWorkers();
      return { id: workerId };
    } catch (err) {
      console.error('Error in createWorker:', err);
      toast.error('Erreur lors de la création du membre');
      return null;
    }
  }, [bureauId, loadWorkers]);

  const updateWorker = useCallback(async (workerId: string, updates: Partial<SyndicateWorker>) => {
    if (!bureauId) {
      toast.error('Bureau non identifié');
      return;
    }

    try {
      // Utiliser la fonction SECURITY DEFINER pour contourner les RLS
      const { error } = await supabase.rpc('update_syndicate_worker_secure', {
        p_worker_id: workerId,
        p_bureau_id: bureauId,
        p_nom: updates.nom || null,
        p_prenom: updates.prenom || null,
        p_email: updates.email || null,
        p_telephone: updates.telephone || null,
        p_access_level: updates.access_level || null,
        p_permissions: updates.permissions || null,
        p_is_active: updates.is_active !== undefined ? updates.is_active : null
      });

      if (error) {
        console.error('Error updating worker:', error);
        toast.error('Erreur lors de la modification du membre');
        return;
      }

      toast.success('Membre modifié avec succès');
      await loadWorkers();
    } catch (err) {
      console.error('Error in updateWorker:', err);
      toast.error('Erreur lors de la modification du membre');
    }
  }, [bureauId, loadWorkers]);

  const deleteWorker = useCallback(async (workerId: string) => {
    if (!bureauId) {
      toast.error('Bureau non identifié');
      return;
    }

    try {
      // Utiliser la fonction SECURITY DEFINER pour contourner les RLS
      const { error } = await supabase.rpc('delete_syndicate_worker_secure', {
        p_worker_id: workerId,
        p_bureau_id: bureauId
      });

      if (error) {
        console.error('Error deleting worker:', error);
        toast.error('Erreur lors de la suppression du membre');
        return;
      }

      toast.success('Membre supprimé définitivement');
      await loadWorkers();
    } catch (err) {
      console.error('Error in deleteWorker:', err);
      toast.error('Erreur lors de la suppression du membre');
    }
  }, [bureauId, loadWorkers]);

  const toggleWorkerStatus = useCallback(async (workerId: string, isActive: boolean) => {
    if (!bureauId) {
      toast.error('Bureau non identifié');
      return;
    }

    try {
      // Utiliser la fonction SECURITY DEFINER pour contourner les RLS
      const { error } = await supabase.rpc('toggle_syndicate_worker_status_secure', {
        p_worker_id: workerId,
        p_bureau_id: bureauId,
        p_is_active: isActive
      });

      if (error) {
        console.error('Error toggling worker status:', error);
        toast.error('Erreur lors du changement de statut');
        return;
      }

      toast.success(`Membre ${isActive ? 'activé' : 'désactivé'} avec succès`);
      await loadWorkers();
    } catch (err) {
      console.error('Error in toggleWorkerStatus:', err);
      toast.error('Erreur lors du changement de statut');
    }
  }, [bureauId, loadWorkers]);

  useEffect(() => {
    if (bureauId) {
      loadWorkers();
    }
  }, [bureauId, loadWorkers]);

  return {
    workers,
    loading,
    stats,
    createWorker,
    updateWorker,
    deleteWorker,
    toggleWorkerStatus,
    refetch: loadWorkers,
  };
};
