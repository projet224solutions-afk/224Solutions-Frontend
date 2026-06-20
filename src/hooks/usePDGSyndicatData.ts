import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { backendFetch } from '@/services/backendApi';

export interface Bureau {
  id: string;
  bureau_code: string;
  prefecture: string;
  commune: string;
  president_name?: string;
  president_email?: string;
  president_phone?: string;
  full_location?: string;
  total_members: number;
  total_vehicles: number;
  total_cotisations: number;
  status: string;
  created_at: string;
  access_token?: string;
  interface_url?: string;
}

export interface SyndicateWorker {
  id: string;
  bureau_id: string;
  nom: string;
  email: string;
  telephone?: string;
  access_level: string;
  permissions: any;
  is_active: boolean;
  created_at: string;
}

export interface SyndicateAlert {
  id: string;
  bureau_id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  is_critical: boolean;
  is_read: boolean;
  created_at: string;
}

export interface BureauFeature {
  id: string;
  feature_name: string;
  feature_code: string;
  description: string;
  version: string;
  is_active: boolean;
}

export interface Member {
  id: string;
  bureau_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  member_code: string;
  status: string;
  created_at: string;
}

export interface SyndicatStats {
  totalBureaus: number;
  activeBureaus: number;
  totalMembers: number;
  totalVehicles: number;
  totalWorkers: number;
  criticalAlerts: number;
  totalCotisations: number;
  activeMembers: number;
}

export const usePDGSyndicatData = () => {
  const [bureaus, setBureaus] = useState<Bureau[]>([]);
  const [workers, setWorkers] = useState<SyndicateWorker[]>([]);
  const [alerts, setAlerts] = useState<SyndicateAlert[]>([]);
  const [features, setFeatures] = useState<BureauFeature[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SyndicatStats>({
    totalBureaus: 0,
    activeBureaus: 0,
    totalMembers: 0,
    totalVehicles: 0,
    totalWorkers: 0,
    criticalAlerts: 0,
    totalCotisations: 0,
    activeMembers: 0,
  });

  // Charger toutes les données
  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);

      const [bureausRes, workersRes, alertsRes, featuresRes, membersRes] = await Promise.all([
        supabase.from('bureaus').select('*').order('created_at', { ascending: false }),
        supabase.from('syndicate_workers').select('*').order('created_at', { ascending: false }),
        supabase.from('syndicate_alerts').select('*').eq('is_critical', true).order('created_at', { ascending: false }).limit(10),
        supabase.from('bureau_features').select('*').eq('is_active', true),
        supabase.from('syndicate_workers').select('*').order('created_at', { ascending: false }) // Remplacé members par syndicate_workers
      ]);

      // Gérer les erreurs individuellement sans bloquer tout le chargement
      if (bureausRes.error) {
        console.error('Erreur chargement bureaux:', bureausRes.error);
        toast.error('Erreur de chargement des bureaux. Vérifiez vos permissions.');
      }
      if (workersRes.error) {
        console.error('Erreur chargement workers:', workersRes.error);
        toast.error('Erreur de chargement des travailleurs.');
      }
      if (alertsRes.error) {
        console.error('Erreur chargement alertes:', alertsRes.error);
      }
      if (featuresRes.error) {
        console.error('Erreur chargement fonctionnalités:', featuresRes.error);
      }
      if (membersRes.error) {
        console.error('Erreur chargement membres:', membersRes.error);
      }

      const bureausData = bureausRes.data || [];
      const workersData = workersRes.data || [];
      const alertsData = alertsRes.data || [];
      const featuresData = featuresRes.data || [];
      const membersData = membersRes.data || [];

      setBureaus(bureausData);
      setWorkers(workersData as any);
      setAlerts(alertsData as any);
      setFeatures(featuresData as any);
      setMembers(membersData as any);

      // Calculer les statistiques
      const activeBureaus = bureausData.filter(b => b.status === 'active').length;
      const totalMembers = membersData.length;
      const activeMembers = membersData.filter((m: any) => m.status === 'active').length;
      const totalVehicles = bureausData.reduce((sum, b) => sum + (b.total_vehicles || 0), 0);
      const totalCotisations = bureausData.reduce((sum, b) => sum + (b.total_cotisations || 0), 0);
      const criticalAlerts = alertsData.filter((a: any) => a.is_critical).length;

      setStats({
        totalBureaus: bureausData.length,
        activeBureaus,
        totalMembers,
        totalVehicles,
        totalWorkers: workersData.length,
        criticalAlerts,
        totalCotisations,
        activeMembers,
      });
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, []);

  // Valider un bureau
  const validateBureau = useCallback(async (bureauId: string) => {
    try {
      const { error } = await supabase
        .from('bureaus')
        .update({
          status: 'active',
          validated_at: new Date().toISOString()
        })
        .eq('id', bureauId);

      if (error) throw error;

      toast.success('Bureau validé avec succès');
      await loadAllData();
      return true;
    } catch (error) {
      console.error('Erreur validation bureau:', error);
      toast.error('Erreur lors de la validation du bureau');
      return false;
    }
  }, [loadAllData]);

  // Créer un bureau
  const createBureau = useCallback(async (formData: {
    bureau_code: string;
    prefecture: string;
    commune: string;
    president_name?: string;
    president_email?: string;
    president_phone?: string;
    full_location?: string;
    password?: string;
  }) => {
    try {
      // Vérifier si l'email est déjà utilisé par un autre bureau
      if (formData.president_email) {
        const { data: existingBureau } = await supabase
          .from('bureaus')
          .select('id, bureau_code')
          .eq('president_email', formData.president_email)
          .maybeSingle();

        if (existingBureau) {
          toast.error(`Cet email est déjà utilisé par le bureau ${(existingBureau as any).bureau_code}`);
          return null;
        }

        // Vérifier si l'email a déjà un compte dans le système
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', formData.president_email)
          .maybeSingle();

        if (existingProfile) {
          toast.error('Cet email a déjà un compte existant dans le système');
          return null;
        }
      }

      const access_token = crypto.randomUUID();

      const { data: bureau, error } = await supabase
        .from('bureaus')
        .insert([{
          bureau_code: formData.bureau_code,
          prefecture: formData.prefecture,
          commune: formData.commune,
          president_name: formData.president_name,
          president_email: formData.president_email,
          president_phone: formData.president_phone,
          full_location: formData.full_location,
          status: 'active',
          total_members: 0,
          total_vehicles: 0,
          total_cotisations: 0,
          access_token: access_token
        }])
        .select()
        .single();

      if (error) throw error;

      // Provisionner le compte de connexion du président (email + mot de passe).
      // ⚠️ Sans cette étape, le président ne peut PAS se connecter : aucun compte Auth
      // n'existe. Le mot de passe saisi à la création était auparavant ignoré.
      let loginProvisioned = false;
      if (formData.president_email && formData.password && bureau?.id) {
        const provision = await backendFetch<{ success: boolean; action?: string; error?: string }>(
          '/edge-functions/auth/reset-bureau-password',
          { method: 'POST', body: { bureau_id: bureau.id, new_password: formData.password } },
        );
        loginProvisioned = provision.success;
        if (!provision.success) {
          console.error('Provisionnement compte président échoué:', provision.error);
          toast.warning(
            "Bureau créé, mais le compte de connexion du président n'a pas pu être créé. " +
            "Utilisez « Réinitialiser le mot de passe » pour réessayer.",
          );
        }
      }

      // Envoyer l'email avec le lien permanent
      if (formData.president_email) {
        await supabase.functions.invoke('send-bureau-access-email', {
          body: {
            type: 'bureau',
            email: formData.president_email,
            name: formData.president_name || formData.bureau_code,
            bureau_code: formData.bureau_code,
            access_token: access_token
          }
        });
        if (loginProvisioned || !formData.password) {
          toast.success('Bureau créé et email envoyé avec le lien d\'accès');
        }
      } else {
        toast.success('Bureau créé avec succès');
      }

      await loadAllData();
      return bureau;
    } catch (error) {
      console.error('Erreur création bureau:', error);
      toast.error('Erreur lors de la création du bureau');
      return null;
    }
  }, [loadAllData]);

  // Mettre à jour un bureau
  const updateBureau = useCallback(async (bureauId: string, updates: Partial<Bureau>) => {
    try {
      const { error } = await supabase
        .from('bureaus')
        .update(updates)
        .eq('id', bureauId);

      if (error) throw error;

      toast.success('Bureau mis à jour avec succès');
      await loadAllData();
      return true;
    } catch (error: any) {
      console.error('Erreur mise à jour bureau:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour du bureau');
      return false;
    }
  }, [loadAllData]);

  // Supprimer un bureau
  const deleteBureau = useCallback(async (bureauId: string) => {
    try {
      // CENTRALISÉ: Supprimer les enregistrements des tables centralisées
      await Promise.all([
        supabase.from('syndicate_workers').delete().eq('bureau_id', bureauId),
        supabase.from('vehicles').delete().eq('bureau_id', bureauId),
        supabase.from('vehicle_security_log').delete().eq('bureau_id', bureauId),
        supabase.from('syndicate_alerts').delete().eq('bureau_id', bureauId),
        supabase.from('bureau_transactions').delete().eq('bureau_id', bureauId),
        supabase.from('bureau_wallets').delete().eq('bureau_id', bureauId),
        supabase.from('bureau_feature_assignments').delete().eq('bureau_id', bureauId),
        supabase.from('badges').delete().eq('bureau_id', bureauId)
      ]);

      // Ensuite supprimer le bureau
      const { error } = await supabase
        .from('bureaus')
        .delete()
        .eq('id', bureauId);

      if (error) throw error;

      toast.success('Bureau supprimé avec succès');
      await loadAllData();
      return true;
    } catch (error: any) {
      console.error('Erreur suppression bureau:', error);
      toast.error(error.message || 'Erreur lors de la suppression du bureau');
      return false;
    }
  }, [loadAllData]);

  // Copier le lien d'accès
  const copyBureauLink = useCallback(async (bureau: Bureau) => {
    try {
      let urlToCopy = bureau.interface_url;

      // Si l'URL n'existe pas, la générer et la sauvegarder
      if (!urlToCopy && bureau.access_token) {
        urlToCopy = `${window.location.origin}/bureau/${bureau.access_token}`;

        // Mettre à jour le bureau avec l'URL générée
        const { error } = await supabase
          .from('bureaus')
          .update({ interface_url: urlToCopy })
          .eq('id', bureau.id);

        if (error) {
          console.error('Erreur mise à jour URL:', error);
        }
      }

      if (!urlToCopy) {
        toast.error('Impossible de générer le lien d\'accès');
        return;
      }

      // Copier le lien dans le presse-papier
      await navigator.clipboard.writeText(urlToCopy);
      toast.success("Lien d'accès copié dans le presse-papier");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la copie du lien");
    }
  }, []);

  // Renvoyer le lien par email
  const resendBureauLink = useCallback(async (bureau: Bureau) => {
    if (!bureau.president_email) {
      toast.error('Aucun email de président renseigné');
      return false;
    }

    if (!bureau.access_token) {
      toast.error('Aucun token d\'accès disponible pour ce bureau');
      return false;
    }

    try {
      toast.info('Envoi de l\'email en cours...');

      const { data, error } = await supabase.functions.invoke('send-bureau-access-email', {
        body: {
          type: 'bureau',
          email: bureau.president_email,
          name: bureau.president_name || bureau.bureau_code,
          bureau_code: bureau.bureau_code,
          access_token: bureau.access_token
        }
      });

      if (error) {
        console.error('Erreur fonction edge:', error);
        throw new Error(error.message || 'Erreur lors de l\'appel de la fonction');
      }

      if (data?.error) {
        console.error('Erreur envoi email:', data.error);
        throw new Error(data.error);
      }

      toast.success(`✓ Email envoyé avec succès à ${bureau.president_email}`);
      return true;
    } catch (error: any) {
      console.error('Erreur renvoi lien:', error);
      toast.error(`Erreur: ${error.message || 'Erreur lors du renvoi du lien'}`);
      return false;
    }
  }, []);

  // Mettre à jour un travailleur
  const updateWorker = useCallback(async (workerId: string, updates: Partial<SyndicateWorker>) => {
    try {
      const { error } = await supabase
        .from('syndicate_workers')
        .update(updates)
        .eq('id', workerId);

      if (error) throw error;

      toast.success('Travailleur mis à jour avec succès');
      await loadAllData();
      return true;
    } catch (error: any) {
      console.error('Erreur mise à jour travailleur:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour du travailleur');
      return false;
    }
  }, [loadAllData]);

  // Supprimer un travailleur
  const deleteWorker = useCallback(async (workerId: string) => {
    try {
      const { error } = await supabase
        .from('syndicate_workers')
        .delete()
        .eq('id', workerId);

      if (error) throw error;

      toast.success('Travailleur supprimé avec succès');
      await loadAllData();
      return true;
    } catch (error: any) {
      console.error('Erreur suppression travailleur:', error);
      toast.error(error.message || 'Erreur lors de la suppression du travailleur');
      return false;
    }
  }, [loadAllData]);

  // Mettre à jour un membre
  const updateMember = useCallback(async (memberId: string, updates: Partial<Member>) => {
    try {
      const { error } = await supabase
        .from('members')
        .update(updates)
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Membre mis à jour avec succès');
      await loadAllData();
      return true;
    } catch (error: any) {
      console.error('Erreur mise à jour membre:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour du membre');
      return false;
    }
  }, [loadAllData]);

  // Supprimer un membre
  const deleteMember = useCallback(async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Membre supprimé avec succès');
      await loadAllData();
      return true;
    } catch (error: any) {
      console.error('Erreur suppression membre:', error);
      toast.error(error.message || 'Erreur lors de la suppression du membre');
      return false;
    }
  }, [loadAllData]);

  // Charger les données au montage
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return {
    bureaus,
    workers,
    alerts,
    features,
    members,
    loading,
    stats,
    validateBureau,
    createBureau,
    updateBureau,
    deleteBureau,
    copyBureauLink,
    resendBureauLink,
    updateWorker,
    deleteWorker,
    updateMember,
    deleteMember,
    refetch: loadAllData,
  };
};
