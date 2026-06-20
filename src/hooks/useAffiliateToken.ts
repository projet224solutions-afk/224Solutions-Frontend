import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface AffiliateData {
  valid: boolean;
  agent_id?: string;
  agent_name?: string;
  target_role?: string;
  commission_rate?: number;
  token?: string;
}

const AFFILIATE_STORAGE_KEY = 'affiliate_token';
const AFFILIATE_EXPIRY_DAYS = 30;

export function useAffiliateToken() {
  const [searchParams] = useSearchParams();
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAffiliateToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const initializeAffiliateToken = async () => {
    setLoading(true);

    // Vérifier si un token est dans l'URL
    const urlToken = searchParams.get('ref');

    if (urlToken) {
      // Valider et stocker le nouveau token
      await validateAndStoreToken(urlToken);
    } else {
      // Charger le token stocké
      loadStoredToken();
    }

    setLoading(false);
  };

  const validateAndStoreToken = async (token: string) => {
    try {
      // Tracker le clic
      await supabase.functions.invoke('agent-affiliate-link?action=track-click', {
        body: {
          token,
          referrer: document.referrer,
          fingerprint: await getDeviceFingerprint()
        }
      });

      // Valider le token
      const { data, error } = await supabase.functions.invoke(
        `agent-affiliate-link?action=validate-token&token=${token}`
      );

      if (error || !data?.valid) {
        console.warn('Token invalide:', token);
        setAffiliateData({ valid: false });
        return;
      }

      // Stocker dans localStorage
      const storedData = {
        token,
        agent_id: data.agent_id,
        agent_name: data.agent_name,
        target_role: data.target_role,
        commission_rate: data.commission_rate,
        stored_at: Date.now(),
        expires_at: Date.now() + AFFILIATE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
      };

      localStorage.setItem(AFFILIATE_STORAGE_KEY, JSON.stringify(storedData));

      setAffiliateData({
        valid: true,
        token,
        ...data
      });
    } catch (error) {
      console.error('Erreur validation token:', error);
      setAffiliateData({ valid: false });
    }
  };

  const loadStoredToken = () => {
    try {
      const stored = localStorage.getItem(AFFILIATE_STORAGE_KEY);
      if (!stored) {
        setAffiliateData(null);
        return;
      }

      const data = JSON.parse(stored);

      // Vérifier expiration
      if (data.expires_at && Date.now() > data.expires_at) {
        localStorage.removeItem(AFFILIATE_STORAGE_KEY);
        setAffiliateData(null);
        return;
      }

      setAffiliateData({
        valid: true,
        token: data.token,
        agent_id: data.agent_id,
        agent_name: data.agent_name,
        target_role: data.target_role,
        commission_rate: data.commission_rate
      });
    } catch {
      setAffiliateData(null);
    }
  };

  const getDeviceFingerprint = async (): Promise<string> => {
    // Fingerprint simple basé sur les caractéristiques du navigateur
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      navigator.platform
    ];

    const str = components.join('|');

    // Hash simple
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(36);
  };

  const clearAffiliateToken = () => {
    localStorage.removeItem(AFFILIATE_STORAGE_KEY);
    setAffiliateData(null);
  };

  const getStoredToken = (): string | null => {
    try {
      const stored = localStorage.getItem(AFFILIATE_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.expires_at && Date.now() < data.expires_at) {
          return data.token;
        }
      }
    } catch {}
    return null;
  };

  const getStoredFingerprint = async (): Promise<string> => {
    return getDeviceFingerprint();
  };

  return {
    affiliateData,
    loading,
    hasValidAffiliate: affiliateData?.valid === true,
    agentName: affiliateData?.agent_name,
    clearAffiliateToken,
    getStoredToken,
    getStoredFingerprint
  };
}
