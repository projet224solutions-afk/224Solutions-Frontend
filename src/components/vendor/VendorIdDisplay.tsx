/**
 * 🔧 COMPOSANT: AFFICHAGE ID VENDEUR (NOUVEAU SYSTÈME)
 * Affiche le custom_id du vendeur (VEN0001) avec son nom
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StandardIdBadge } from '@/components/StandardIdBadge';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface VendorIdDisplayProps {
  className?: string;
  showName?: boolean;
}

export function VendorIdDisplay({
  className = '',
  showName = true
}: VendorIdDisplayProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [vendorData, setVendorData] = useState<{
    custom_id: string | null;
    business_name: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchVendorData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Récupération custom_id vendeur pour user:', user.id);

      // ÉTAPE 1: Récupérer le custom_id depuis user_ids
      const { data: userIdData, error: userIdError } = await supabase
        .from('user_ids')
        .select('custom_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (userIdError) throw userIdError;

      // ÉTAPE 2: Récupérer les infos du vendeur
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('business_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (vendorError) throw vendorError;

      if (userIdData?.custom_id) {
        setVendorData({
          custom_id: userIdData.custom_id,
          business_name: vendor?.business_name || null
        });
        console.log('✅ Custom ID vendeur:', userIdData.custom_id);
      } else {
        console.log('⚠️ Aucun custom_id trouvé pour ce vendeur');
      }

    } catch (error) {
      console.error('❌ Erreur récupération données vendeur:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVendorData();
  }, [fetchVendorData]);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t('vendorIdDisplay.loading')}</span>
      </div>
    );
  }

  if (!vendorData?.custom_id) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <StandardIdBadge
        standardId={vendorData.custom_id}
        variant="outline"
        size="md"
        copyable={true}
        className="bg-transparent border-2 border-[#ff4000] text-blue-600 font-bold"
      />
      {showName && vendorData.business_name && (
        <span className="text-sm font-medium break-words">
          {vendorData.business_name}
        </span>
      )}
    </div>
  );
}

export default VendorIdDisplay;
