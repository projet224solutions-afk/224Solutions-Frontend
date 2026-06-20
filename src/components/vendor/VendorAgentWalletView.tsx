import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, Info, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UniversalWalletTransactions from '@/components/wallet/UniversalWalletTransactions';
import { useTranslation } from '@/hooks/useTranslation';

interface VendorAgentWalletViewProps {
  vendorId: string;
  agentName: string;
}

export function VendorAgentWalletView({ vendorId, agentName }: VendorAgentWalletViewProps) {
  const { t } = useTranslation();
  const [vendorUserId, setVendorUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVendorUserId();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const loadVendorUserId = async () => {
    if (!vendorId) return;

    try {
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('user_id')
        .eq('id', vendorId)
        .single();

      if (vendorError) throw vendorError;

      setVendorUserId(vendorData?.user_id || null);
    } catch (error) {
      console.error('Erreur chargement vendor user_id:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="text-sm text-muted-foreground">{t('vendorAgentWallet.loading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!vendorUserId) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {t('vendorAgentWallet.cannotLoad')}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Agent */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>{agentName}</strong>, {t('vendorAgentWallet.sharedWalletInfo')}
        </AlertDescription>
      </Alert>

      {/* Interface wallet complète du vendeur */}
      <UniversalWalletTransactions userId={vendorUserId || undefined} />
    </div>
  );
}

export default VendorAgentWalletView;
