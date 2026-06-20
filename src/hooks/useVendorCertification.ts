/**
 * HOOK: useVendorCertification
 * Hook pour récupérer et gérer le statut de certification d'un vendeur
 * 224SOLUTIONS
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VendorCertification, VendorCertificationStatus } from '@/types/vendorCertification';

interface UseVendorCertificationResult {
  certification: VendorCertification | null;
  loading: boolean;
  error: Error | null;
  isCertified: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook principal pour récupérer le statut de certification d'un vendeur
 */
export function useVendorCertification(vendorId: string | undefined): UseVendorCertificationResult {
  const [certification, setCertification] = useState<VendorCertification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCertification = async () => {
    if (!vendorId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const fetchByCertificationVendorId = async (certVendorId: string) => {
        const { data, error } = await supabase
          .from('vendor_certifications')
          .select('*')
          .eq('vendor_id', certVendorId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        return data;
      };

      // 1) Cas nominal: vendorId correspond directement à vendor_certifications.vendor_id
      let certificationRecord = await fetchByCertificationVendorId(vendorId);

      // 2) Fallback: certaines certifications sont stockées avec le user_id du vendeur
      if (!certificationRecord) {
        const { data: vendorById, error: vendorByIdError } = await supabase
          .from('vendors')
          .select('user_id')
          .eq('id', vendorId)
          .maybeSingle();

        if (vendorByIdError && vendorByIdError.code !== 'PGRST116') {
          console.warn('Could not resolve vendor user_id from vendors.id:', vendorByIdError);
        }

        if (vendorById?.user_id) {
          certificationRecord = await fetchByCertificationVendorId(vendorById.user_id);
        }
      }

      // 3) Fallback inverse: vendorId reçu = user_id (sécurité/compatibilité)
      if (!certificationRecord) {
        const { data: vendorByUserId, error: vendorByUserIdError } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', vendorId)
          .maybeSingle();

        if (vendorByUserIdError && vendorByUserIdError.code !== 'PGRST116') {
          console.warn('Could not resolve vendor id from vendors.user_id:', vendorByUserIdError);
        }

        if (vendorByUserId?.id) {
          certificationRecord = await fetchByCertificationVendorId(vendorByUserId.id);
        }
      }

      if (certificationRecord) {
        setCertification({
          id: certificationRecord.id,
          vendor_id: certificationRecord.vendor_id,
          status: certificationRecord.status as VendorCertificationStatus,
          verified_at: certificationRecord.verified_at,
          kyc_verified_at: certificationRecord.kyc_verified_at,
          kyc_status: certificationRecord.kyc_status,
          last_status_change: certificationRecord.last_status_change,
          internal_notes: certificationRecord.internal_notes,
          rejection_reason: certificationRecord.rejection_reason,
          created_at: certificationRecord.created_at,
          updated_at: certificationRecord.updated_at
        });
      } else {
        setCertification(null);
      }
    } catch (err) {
      console.error('Error fetching vendor certification:', err);
      setError(err as Error);
      setCertification(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertification();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const isCertified = certification?.status === 'CERTIFIE';

  return {
    certification,
    loading,
    error,
    isCertified,
    refetch: fetchCertification
  };
}

// Re-export types for convenience
export type { VendorCertification, VendorCertificationStatus };
