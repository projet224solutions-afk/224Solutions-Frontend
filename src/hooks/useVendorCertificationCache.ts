/**
 * CACHE GLOBAL pour les certifications vendeur.
 * Charge TOUTES les certifications en une seule requête,
 * puis chaque composant lit depuis le cache.
 * Élimine le problème N+1 (3 requêtes × N produits).
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VendorCertificationStatus } from '@/types/vendorCertification';

interface CachedCertification {
  vendor_id: string;
  status: VendorCertificationStatus;
}

// Cache global partagé entre tous les composants
let certCache: Map<string, CachedCertification> | null = null;
let certCacheFetchedAt = 0;
let certInflight: Promise<Map<string, CachedCertification>> | null = null;
const CERT_CACHE_TTL = 5 * 60_000; // 5 minutes

async function loadAllCertifications(): Promise<Map<string, CachedCertification>> {
  if (certCache && Date.now() - certCacheFetchedAt < CERT_CACHE_TTL) {
    return certCache;
  }

  if (certInflight) return certInflight;

  certInflight = (async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_certifications')
        .select('vendor_id, status');

      const map = new Map<string, CachedCertification>();

      if (!error && data) {
        for (const row of data) {
          map.set(row.vendor_id, {
            vendor_id: row.vendor_id,
            status: row.status as VendorCertificationStatus,
          });
        }
      }

      certCache = map;
      certCacheFetchedAt = Date.now();
      return map;
    } finally {
      certInflight = null;
    }
  })();

  return certInflight;
}

/**
 * Hook léger pour la certification vendeur dans les listes (ProductCard).
 * Utilise un cache global au lieu de requêtes individuelles.
 */
export function useVendorCertificationCached(vendorId: string | undefined) {
  const [isCertified, setIsCertified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    loadAllCertifications()
      .then((cache) => {
        if (cancelled) return;
        const cert = cache.get(vendorId);
        setIsCertified(cert?.status === 'CERTIFIE');
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [vendorId]);

  return { isCertified, loading };
}

export function invalidateCertCache() {
  certCache = null;
  certCacheFetchedAt = 0;
}
