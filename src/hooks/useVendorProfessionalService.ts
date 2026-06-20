/**
 * Hook pour récupérer le professional_service associé au vendor actuel
 * Permet d'identifier le type de service métier et charger le module approprié
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface VendorProfessionalService {
  id: string;
  service_type_id: string;
  business_name: string;
  service_type: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    commission_rate: number;
  } | null;
}

export function useVendorProfessionalService() {
  const { user } = useAuth();
  const [professionalService, setProfessionalService] = useState<VendorProfessionalService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfessionalService() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Récupérer le professional_service de l'utilisateur avec son service_type
        const { data, error: fetchError } = await supabase
          .from('professional_services')
          .select(`
            id,
            service_type_id,
            business_name,
            service_type:service_types (
              id,
              code,
              name,
              description,
              commission_rate
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (fetchError) {
          console.error('Erreur chargement professional_service:', fetchError);
          setError(fetchError.message);
          return;
        }

        if (data) {
          // Gérer le cas où service_type peut être un tableau (Supabase)
          const serviceType = Array.isArray(data.service_type)
            ? data.service_type[0]
            : data.service_type;

          setProfessionalService({
            id: data.id,
            service_type_id: data.service_type_id,
            business_name: data.business_name,
            service_type: serviceType || null
          });
        }
      } catch (err) {
        console.error('Erreur inattendue:', err);
        setError('Erreur de chargement du service professionnel');
      } finally {
        setLoading(false);
      }
    }

    fetchProfessionalService();
  }, [user?.id]);

  return {
    professionalService,
    serviceTypeCode: professionalService?.service_type?.code || null,
    serviceTypeName: professionalService?.service_type?.name || null,
    loading,
    error
  };
}
