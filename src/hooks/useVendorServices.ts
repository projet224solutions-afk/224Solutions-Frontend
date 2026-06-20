/**
 * Hook pour récupérer TOUS les professional_services du vendor actuel
 * Support multi-services avec gestion de la sélection active
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface VendorProfessionalService {
  id: string;
  service_type_id: string;
  business_name: string;
  description: string | null;
  address: string | null;
  status: 'active' | 'pending' | 'suspended' | 'inactive';
  verification_status: 'unverified' | 'verified' | 'rejected';
  rating: number;
  total_reviews: number;
  created_at: string;
  service_type: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    commission_rate: number;
  } | null;
}

export function useVendorServices() {
  const { user } = useAuth();
  const [services, setServices] = useState<VendorProfessionalService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchServices() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Récupérer TOUS les professional_services actifs de l'utilisateur
        const { data, error: fetchError } = await supabase
          .from('professional_services')
          .select(`
            id,
            service_type_id,
            business_name,
            description,
            address,
            status,
            verification_status,
            rating,
            total_reviews,
            created_at,
            service_type:service_types (
              id,
              code,
              name,
              description,
              commission_rate
            )
          `)
          .eq('user_id', user.id)
          .in('status', ['active', 'pending'])
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Erreur chargement professional_services:', fetchError);
          setError(fetchError.message);
          return;
        }

        if (data && data.length > 0) {
          // Normaliser les données (gérer le cas où service_type est un tableau)
          const normalizedServices: VendorProfessionalService[] = data.map(service => {
            const normalizedServiceType = Array.isArray(service.service_type)
              ? service.service_type[0]
              : service.service_type;

            console.log('📦 Service chargé:', {
              id: service.id,
              business_name: service.business_name,
              service_type_id: service.service_type_id,
              service_type: normalizedServiceType,
              service_type_code: normalizedServiceType?.code
            });

            return {
              ...service,
              status: service.status as 'active' | 'pending' | 'suspended' | 'inactive',
              verification_status: service.verification_status as 'unverified' | 'verified' | 'rejected',
              service_type: normalizedServiceType
            };
          });

          setServices(normalizedServices);

          // Sélectionner automatiquement le premier service par défaut
          if (!selectedServiceId) {
            setSelectedServiceId(normalizedServices[0].id);
          }
        } else {
          setServices([]);
        }
      } catch (err) {
        console.error('Erreur inattendue:', err);
        setError('Erreur de chargement des services professionnels');
      } finally {
        setLoading(false);
      }
    }

    fetchServices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Sélectionner un service spécifique
  const selectService = (serviceId: string) => {
    setSelectedServiceId(serviceId);
  };

  // Récupérer le service actuellement sélectionné
  const selectedService = services.find(s => s.id === selectedServiceId) || null;

  // Rafraîchir la liste des services
  const refresh = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('professional_services')
        .select(`
          id,
          service_type_id,
          business_name,
          description,
          address,
          status,
          verification_status,
          rating,
          total_reviews,
          created_at,
          service_type:service_types (
            id,
            code,
            name,
            description,
            commission_rate
          )
        `)
        .eq('user_id', user.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        const normalizedServices: VendorProfessionalService[] = data.map(service => ({
          ...service,
          status: service.status as 'active' | 'pending' | 'suspended' | 'inactive',
          verification_status: service.verification_status as 'unverified' | 'verified' | 'rejected',
          service_type: Array.isArray(service.service_type)
            ? service.service_type[0]
            : service.service_type
        }));
        setServices(normalizedServices);
      }
    } catch (err) {
      console.error('Erreur refresh:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    services,
    selectedService,
    selectedServiceId,
    selectService,
    hasMultipleServices: services.length > 1,
    loading,
    error,
    refresh
  };
}
