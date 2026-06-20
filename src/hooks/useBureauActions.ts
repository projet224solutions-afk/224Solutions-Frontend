/**
 * Hook d'actions centralisées pour l'interface Bureau Syndicat
 * Toutes les opérations CRUD pour workers, members, vehicles
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ==================== TYPES ====================

export interface WorkerData {
  nom: string;
  email: string;
  telephone?: string;
  access_level: 'limited' | 'standard' | 'advanced';
  permissions: {
    view_members: boolean;
    add_members: boolean;
    edit_members: boolean;
    view_vehicles: boolean;
    add_vehicles: boolean;
    view_reports: boolean;
  };
}

export interface MemberData {
  full_name: string;
  email: string;
  phone: string;
  address?: string;
  membership_type: 'individual' | 'family' | 'corporate';
}

export interface VehicleData {
  plate_number: string;
  moto_serial: string;
  owner_name: string;
  owner_phone: string;
  model?: string;
  year?: number;
  color?: string;
}

interface UseBureauActionsProps {
  bureauId?: string;
  onWorkerCreated?: () => void;
  onWorkerUpdated?: () => void;
  onWorkerDeleted?: () => void;
  onMemberCreated?: () => void;
  onMemberUpdated?: () => void;
  onVehicleRegistered?: () => void;
}

// ==================== HOOK ====================

export function useBureauActions({
  bureauId,
  onWorkerCreated,
  onWorkerUpdated,
  onWorkerDeleted,
  onMemberCreated,
  onMemberUpdated,
  onVehicleRegistered,
}: UseBureauActionsProps = {}) {

  // ==================== WORKERS ====================

  /**
   * Ajouter un membre du bureau (worker)
   */
  const addWorker = useCallback(async (
    workerData: WorkerData,
    targetBureauId?: string
  ): Promise<{ success: boolean; error?: string; worker?: any }> => {
    const effectiveBureauId = targetBureauId || bureauId;

    if (!effectiveBureauId) {
      return { success: false, error: 'ID du bureau manquant' };
    }

    // Validation
    if (!workerData.nom?.trim()) {
      return { success: false, error: 'Le nom complet est requis' };
    }

    if (!workerData.email?.trim()) {
      return { success: false, error: "L'email est requis" };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workerData.email)) {
      return { success: false, error: "Format d'email invalide" };
    }

    try {
      const access_token = crypto.randomUUID();
      const interface_url = `${window.location.origin}/worker/${access_token}`;

      const { data, error } = await supabase
        .from('syndicate_workers')
        .insert([{
          bureau_id: effectiveBureauId,
          nom: workerData.nom.trim(),
          email: workerData.email.trim().toLowerCase(),
          telephone: workerData.telephone?.trim() || null,
          access_level: workerData.access_level,
          permissions: workerData.permissions,
          access_token: access_token,
          interface_url: interface_url,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      // Envoyer l'email (ne pas bloquer si ça échoue)
      try {
        await supabase.functions.invoke('send-bureau-access-email', {
          body: {
            type: 'worker',
            email: workerData.email,
            name: workerData.nom,
            access_token: access_token,
            interface_url: interface_url,
            permissions: workerData.permissions
          }
        });
        toast.success('✅ Membre du bureau ajouté et email envoyé');
      } catch (emailError) {
        console.error('⚠️ Erreur email:', emailError);
        toast.success('✅ Membre du bureau ajouté (email non envoyé)');
      }

      onWorkerCreated?.();
      return { success: true, worker: data };
    } catch (error: any) {
      console.error('Erreur ajout worker:', error);
      return { success: false, error: error.message || 'Erreur lors de l\'ajout du membre' };
    }
  }, [bureauId, onWorkerCreated]);

  /**
   * Modifier un membre du bureau
   */
  const updateWorker = useCallback(async (
    workerId: string,
    updates: Partial<WorkerData>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('syndicate_workers')
        .update(updates)
        .eq('id', workerId);

      if (error) throw error;

      toast.success('Membre du bureau modifié');
      onWorkerUpdated?.();
      return { success: true };
    } catch (error: any) {
      console.error('Erreur modification worker:', error);
      return { success: false, error: error.message };
    }
  }, [onWorkerUpdated]);

  /**
   * Supprimer un membre du bureau
   */
  const deleteWorker = useCallback(async (workerId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Soft delete
      const { error } = await supabase
        .from('syndicate_workers')
        .update({ is_active: false })
        .eq('id', workerId);

      if (error) throw error;

      toast.success('Membre du bureau supprimé');
      onWorkerDeleted?.();
      return { success: true };
    } catch (error: any) {
      console.error('Erreur suppression worker:', error);
      return { success: false, error: error.message };
    }
  }, [onWorkerDeleted]);

  // ==================== MEMBERS ====================

  /**
   * Ajouter un adhérent
   */
  const addMember = useCallback(async (
    memberData: MemberData,
    targetBureauId?: string
  ): Promise<{ success: boolean; error?: string; member?: any }> => {
    const effectiveBureauId = targetBureauId || bureauId;

    if (!effectiveBureauId) {
      return { success: false, error: 'ID du bureau manquant' };
    }

    // Validation
    if (!memberData.full_name?.trim()) {
      return { success: false, error: 'Le nom complet est requis' };
    }

    if (!memberData.email?.trim() || !memberData.phone?.trim()) {
      return { success: false, error: 'Email et téléphone requis' };
    }

    try {
      // Utiliser syndicate_workers au lieu de members
      const { data, error } = await supabase
        .from('syndicate_workers')
        .insert([{
          bureau_id: effectiveBureauId,
          nom: memberData.full_name.trim(),
          email: memberData.email.trim().toLowerCase(),
          telephone: memberData.phone.trim(),
          access_level: 'standard',
          is_active: true,
          access_token: crypto.randomUUID(),
          interface_url: `/worker/dashboard`
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Adhérent ajouté avec succès');
      onMemberCreated?.();
      return { success: true, member: data };
    } catch (error: any) {
      console.error('Erreur ajout membre:', error);
      return { success: false, error: error.message || 'Erreur lors de l\'ajout de l\'adhérent' };
    }
  }, [bureauId, onMemberCreated]);

  /**
   * Modifier un adhérent
   */
  const updateMember = useCallback(async (
    memberId: string,
    updates: Partial<MemberData>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Mapper les champs pour syndicate_workers
      const workerUpdates: any = {};
      if (updates.full_name) workerUpdates.nom = updates.full_name;
      if (updates.email) workerUpdates.email = updates.email;
      if (updates.phone) workerUpdates.telephone = updates.phone;

      const { error } = await supabase
        .from('syndicate_workers')
        .update(workerUpdates)
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Adhérent modifié');
      onMemberUpdated?.();
      return { success: true };
    } catch (error: any) {
      console.error('Erreur modification membre:', error);
      return { success: false, error: error.message };
    }
  }, [onMemberUpdated]);

  /**
   * Valider un adhérent
   */
  const validateMember = useCallback(async (memberId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('syndicate_workers')
        .update({ is_active: true })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Adhérent validé');
      return { success: true };
    } catch (error: any) {
      console.error('Erreur validation membre:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // ==================== VEHICLES ====================

  /**
   * Enregistrer un véhicule
   */
  const registerVehicle = useCallback(async (
    vehicleData: VehicleData,
    targetBureauId?: string
  ): Promise<{ success: boolean; error?: string; vehicle?: any }> => {
    const effectiveBureauId = targetBureauId || bureauId;

    if (!effectiveBureauId) {
      return { success: false, error: 'ID du bureau manquant' };
    }

    // Validation
    if (!vehicleData.plate_number?.trim() || !vehicleData.moto_serial?.trim()) {
      return { success: false, error: 'Plaque et numéro de série requis' };
    }

    if (!vehicleData.owner_name?.trim() || !vehicleData.owner_phone?.trim()) {
      return { success: false, error: 'Nom et téléphone du propriétaire requis' };
    }

    try {
      // Utiliser la table vehicles au lieu de registered_motos
      const { data, error } = await supabase
        .from('vehicles')
        .insert([{
          bureau_id: effectiveBureauId,
          license_plate: vehicleData.plate_number.trim().toUpperCase(),
          serial_number: vehicleData.moto_serial.trim().toUpperCase(),
          brand: vehicleData.model?.split(' ')[0] || 'Inconnu',
          model: vehicleData.model?.trim() || 'Inconnu',
          color: vehicleData.color?.trim() || null,
          status: 'active',
          stolen_status: 'clean'
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Véhicule enregistré avec succès');
      onVehicleRegistered?.();
      return { success: true, vehicle: data };
    } catch (error: any) {
      console.error('Erreur enregistrement véhicule:', error);
      return { success: false, error: error.message || 'Erreur lors de l\'enregistrement du véhicule' };
    }
  }, [bureauId, onVehicleRegistered]);

  /**
   * Signaler un véhicule volé - CENTRALISÉ via RPC
   */
  const reportStolenVehicle = useCallback(async (
    vehicleId: string,
    details: {
      location?: string;
      description?: string;
      police_report?: string;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Utiliser le RPC centralisé declare_vehicle_stolen
      const reason = [
        details.description,
        details.police_report ? `Rapport police: ${details.police_report}` : null
      ].filter(Boolean).join(' - ') || 'Vol signalé par le bureau';

      const { data, error } = await supabase.rpc('declare_vehicle_stolen', {
        p_vehicle_id: vehicleId,
        p_bureau_id: bureauId,
        p_declared_by: bureauId,
        p_reason: reason,
        p_location: details.location || null,
        p_ip_address: null,
        p_user_agent: navigator.userAgent
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result.success) {
        throw new Error(result.error || 'Erreur lors de la déclaration');
      }

      toast.success('Véhicule signalé comme volé');
      return { success: true };
    } catch (error: any) {
      console.error('Erreur signalement vol:', error);
      return { success: false, error: error.message };
    }
  }, [bureauId]);

  return {
    // Workers
    addWorker,
    updateWorker,
    deleteWorker,

    // Members
    addMember,
    updateMember,
    validateMember,

    // Vehicles
    registerVehicle,
    reportStolenVehicle,
  };
}
