import { useAuth } from '@/hooks/useAuth';
import { useAgent } from '@/contexts/AgentContext';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cacheData, getCachedData } from '@/lib/offlineDB';

// Clés de cache pour IndexedDB
const CACHE_KEY_VENDOR_PROFILE = 'vendor_profile';
const CACHE_TTL_VENDOR = 24 * 60 * 60 * 1000; // 24 heures

export interface VendorAgentPermissions {
  view_dashboard?: boolean;
  view_analytics?: boolean;
  access_pos?: boolean;
  manage_products?: boolean;
  manage_orders?: boolean;
  manage_inventory?: boolean;
  manage_warehouse?: boolean;
  manage_suppliers?: boolean;
  manage_agents?: boolean;
  manage_clients?: boolean;
  manage_prospects?: boolean;
  manage_marketing?: boolean;
  access_wallet?: boolean;
  manage_payments?: boolean;
  manage_payment_links?: boolean;
  manage_expenses?: boolean;
  manage_debts?: boolean;
  access_affiliate?: boolean;
  manage_delivery?: boolean;
  access_support?: boolean;
  access_communication?: boolean;
  view_reports?: boolean;
  access_settings?: boolean;
}

interface VendorData {
  vendorId: string;
  userId: string; // L'ID auth.users - utilisé par vendor_expenses
  isAgent: boolean;
  agentPermissions?: VendorAgentPermissions;
  user: any;
  profile: any;
  // business_type vient de vendors.business_type (physical | digital | hybrid)
  businessType?: 'physical' | 'digital' | 'hybrid' | 'online';
}

/**
 * Hook unifié pour obtenir les données du vendeur actuel
 * Fonctionne à la fois pour :
 * - Un vendeur connecté directement (via useAuth)
 * - Un agent accédant aux données du vendeur (via useAgent)
 */
export const useCurrentVendor = () => {
  const auth = useAuth();
  const agentContext = useAgent();
  const [vendorData, setVendorData] = useState<VendorData | null>(null);
  const [internalLoading, setInternalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mémoriser les IDs pour éviter les re-renders inutiles
  const authUserId = auth.user?.id;
  const authProfileId = auth.profile?.id;
  const agentVendorId = agentContext.vendorId;
  const hasAgent = !!agentContext.agent;

  // Le loading global inclut le chargement du profil auth
  const loading = auth.loading || auth.profileLoading || internalLoading;

  const loadVendorData = useCallback(async () => {
    // ⚡ Ne pas charger si auth n'est pas encore prêt
    if (auth.loading || auth.profileLoading) {
      console.log('⏳ useCurrentVendor: En attente du profil auth...');
      return;
    }

    try {
      setInternalLoading(true);
      setError(null);

      // CAS 1: On est dans un contexte AGENT (prioritaire)
      if (hasAgent && agentVendorId) {
        console.log('🔄 Mode Agent - Chargement données vendeur:', agentVendorId);

        let vendorInfo = null;

        try {
          // Récupérer le business_type et user_id du vendeur
          const { data, error: vendorInfoError } = await supabase
            .from('vendors')
            .select('business_type, user_id')
            .eq('id', agentVendorId)
            .maybeSingle();

          if (vendorInfoError) throw vendorInfoError;

          vendorInfo = data;

          if (vendorInfo) {
            await cacheData(`${CACHE_KEY_VENDOR_PROFILE}_agent_${agentVendorId}`, vendorInfo, CACHE_TTL_VENDOR);
          }
        } catch (agentVendorError) {
          console.log('📴 Requête vendeur agent indisponible - récupération cache');
          vendorInfo = await getCachedData<{ business_type: string; user_id: string }>(`${CACHE_KEY_VENDOR_PROFILE}_agent_${agentVendorId}`);
        }

        const vendorAuthUserId = vendorInfo?.user_id || agentVendorId;
        setVendorData({
          vendorId: agentVendorId,
          userId: vendorAuthUserId,
          isAgent: true,
          agentPermissions: (agentContext.agent?.permissions as VendorAgentPermissions) || {},
          user: { id: vendorAuthUserId }, // Auth user_id du vendeur, pas le vendor table id
          profile: null,
          businessType: vendorInfo?.business_type as 'physical' | 'digital' | 'hybrid' | 'online' | undefined
        });

        console.log('✅ Données vendeur chargées (mode agent):', {
          vendorId: agentVendorId,
          userId: vendorInfo?.user_id,
          businessType: vendorInfo?.business_type,
          agentPermissions: agentContext.agent?.permissions,
          fromCache: !vendorInfo
        });
        setInternalLoading(false);
        return;
      }

      // CAS 2: On est dans un contexte VENDEUR DIRECT
      if (authUserId) {
        console.log('🔄 Mode Vendeur Direct - Utilisation user actuel:', authUserId);

        let vendorProfile = null;

        try {
          // Trouver le vendor_id et business_type du profil vendeur
          const { data, error: vendorError } = await supabase
            .from('vendors')
            .select('id, business_type')
            .eq('user_id', authUserId)
            .maybeSingle();

          if (vendorError) throw vendorError;

          vendorProfile = data;

          if (vendorProfile) {
            await cacheData(`${CACHE_KEY_VENDOR_PROFILE}_${authUserId}`, vendorProfile, CACHE_TTL_VENDOR);
            console.log('💾 Profil vendeur mis en cache');
          }
        } catch (vendorProfileError) {
          console.log('📴 Requête vendeur indisponible - récupération cache');
          vendorProfile = await getCachedData<{ id: string; business_type: string }>(`${CACHE_KEY_VENDOR_PROFILE}_${authUserId}`);

          if (!vendorProfile) {
            console.warn('⚠️ Pas de cache vendeur disponible après échec réseau');
          }
        }

        // Utiliser l'user_id comme vendorId si pas d'entrée vendors (nouveau vendeur)
        const vendorId = vendorProfile?.id || authUserId;
        const businessType = vendorProfile?.business_type as 'physical' | 'digital' | 'hybrid' | 'online' | undefined;

        setVendorData({
          vendorId: vendorId,
          userId: authUserId, // L'ID auth.users
          isAgent: false,
          user: auth.user,
          profile: auth.profile,
          businessType: businessType || 'hybrid' // Default pour nouveaux vendeurs
        });

        console.log('✅ Données vendeur chargées (mode direct):', { vendorId, userId: authUserId, businessType, fromCache: !vendorProfile });
      } else if (!hasAgent) {
        // CAS 3: Aucun contexte valide (ni agent ni vendeur)
        console.warn('⚠️ Aucun contexte vendeur valide');
        setError('Session non valide');
      }
    } catch (error: any) {
      console.error('❌ Erreur chargement vendeur:', error);

      // En cas d'erreur, essayer le cache si disponible
      if (authUserId) {
        console.log('🔄 Tentative récupération cache après erreur...');
        try {
          const cachedProfile = await getCachedData<{ id: string; business_type: string }>(`${CACHE_KEY_VENDOR_PROFILE}_${authUserId}`);
          if (cachedProfile) {
            setVendorData({
              vendorId: cachedProfile.id || authUserId,
              userId: authUserId,
              isAgent: false,
              user: auth.user,
              profile: auth.profile,
              businessType: (cachedProfile.business_type as 'physical' | 'digital' | 'hybrid' | 'online') || 'hybrid'
            });
            console.log('✅ Données vendeur récupérées du cache après erreur');
            setError(null);
            return;
          }
        } catch (cacheError) {
          console.error('❌ Erreur récupération cache:', cacheError);
        }
      }

      setError(error.message || 'Erreur lors du chargement des données');
    } finally {
      setInternalLoading(false);
    }
  }, [authUserId, authProfileId, agentVendorId, hasAgent, auth.user, auth.profile, agentContext.agent, auth.loading, auth.profileLoading]);

  useEffect(() => {
    // Seulement charger si auth est prêt
    if (!auth.loading && !auth.profileLoading) {
      loadVendorData();
    }
  }, [loadVendorData, auth.loading, auth.profileLoading]);

  return {
    vendorId: vendorData?.vendorId || null,
    // ⚡ Exposer l'userId IMMÉDIATEMENT (= auth.users.id, connu de façon synchrone) sans
    // attendre la requête `vendors` : permet aux hooks dépendants (stats…) de peindre
    // depuis le cache tout de suite au lieu d'attendre ~1,5 s le réseau.
    userId: vendorData?.userId || authUserId || null, // L'ID auth.users - pour vendor_expenses
    isAgent: vendorData?.isAgent || false,
    agentPermissions: vendorData?.agentPermissions,
    user: vendorData?.user,
    profile: vendorData?.profile,
    businessType: vendorData?.businessType,
    loading,
    error,
    reload: loadVendorData,
    hasPermission: (permission: string) => {
      if (vendorData?.isAgent && vendorData.agentPermissions) {
        return vendorData.agentPermissions[permission as keyof VendorAgentPermissions] || false;
      }
      return true; // Vendeur direct a toutes les permissions
    },
    // POS accessible uniquement pour physical et hybrid (pas pour digital/online)
    canAccessPOS: vendorData?.businessType !== 'digital' && vendorData?.businessType !== 'online'
  };
};
