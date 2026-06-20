import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface VendorKYC {
  id: string;
  status: 'pending' | 'verified' | 'rejected' | 'under_review';
  phone_verified: boolean;
  phone_number?: string;
  id_document_url?: string;
  id_document_type?: string;
  verified_at?: string;
  rejection_reason?: string;
}

export interface VendorTrustScore {
  score: number;
  total_sales: number;
  successful_orders: number;
  cancelled_orders: number;
  disputes: number;
  account_age_days: number;
  last_calculated_at: string;
}

export interface SuspiciousActivity {
  id: string;
  activity_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  resolved: boolean;
  created_at: string;
}

export const useVendorSecurity = () => {
  const { user } = useAuth();
  const [kyc, setKyc] = useState<VendorKYC | null>(null);
  const [trustScore, setTrustScore] = useState<VendorTrustScore | null>(null);
  const [suspiciousActivities, setSuspiciousActivities] = useState<SuspiciousActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSecurityData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Charger KYC
      const { data: kycData, error: kycError } = await supabase
        .from('vendor_kyc' as any)
        .select('*')
        .eq('vendor_id', user.id)
        .maybeSingle();

      if (kycError) console.error('Error loading KYC:', kycError);
      setKyc(kycData as any);

      // Charger Trust Score
      const { data: scoreData, error: scoreError } = await supabase
        .from('vendor_trust_score' as any)
        .select('*')
        .eq('vendor_id', user.id)
        .maybeSingle();

      if (scoreError) console.error('Error loading trust score:', scoreError);
      setTrustScore(scoreData as any);

      // Charger activités suspectes
      const { data: activitiesData } = await supabase
        .from('suspicious_activities' as any)
        .select('*')
        .eq('vendor_id', user.id)
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      setSuspiciousActivities((activitiesData as any) || []);
    } catch (error) {
      console.error('Erreur chargement sécurité:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitKYC = async (data: {
    phone_number: string;
    id_document_type: string;
    id_document_url: string;
  }) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('vendor_kyc' as any)
        .upsert({
          vendor_id: user.id,
          phone_number: data.phone_number,
          id_document_type: data.id_document_type,
          id_document_url: data.id_document_url,
          status: 'under_review'
        });

      if (error) throw error;

      await loadSecurityData();
      toast.success('Documents soumis pour vérification');
      return true;
    } catch (error) {
      console.error('Erreur soumission KYC:', error);
      toast.error('Erreur lors de la soumission');
      return false;
    }
  };

  const calculateTrustScore = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('calculate_vendor_trust_score', {
        p_vendor_id: user.id
      });

      if (error) throw error;

      await loadSecurityData();
      toast.success(`Score de confiance mis à jour: ${data}/100`);
    } catch (error) {
      console.error('Erreur calcul score:', error);
      toast.error('Erreur lors du calcul du score');
    }
  };

  useEffect(() => {
    loadSecurityData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return {
    kyc,
    trustScore,
    suspiciousActivities,
    loading,
    submitKYC,
    calculateTrustScore,
    reload: loadSecurityData
  };
};
