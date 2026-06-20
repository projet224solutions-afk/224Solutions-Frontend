import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function AffiliateRedirect() {
  const { t } = useTranslation();
  const { vendorId } = useParams<{ vendorId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    handleAffiliateRedirect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const handleAffiliateRedirect = async () => {
    if (!vendorId) {
      toast.error('Lien d\'affiliation invalide');
      navigate('/marketplace');
      return;
    }

    try {
      // Récupérer le pourcentage d'affiliation
      const affPercentage = searchParams.get('aff');

      // Stocker les informations d'affiliation dans localStorage
      if (affPercentage) {
        localStorage.setItem('affiliate_data', JSON.stringify({
          vendorId,
          percentage: parseFloat(affPercentage),
          timestamp: Date.now()
        }));
      }

      // Vérifier que le vendeur existe
      const { data: userIdData, error: userIdError } = await supabase
        .from('user_ids')
        .select('user_id')
        .eq('custom_id', vendorId)
        .maybeSingle();

      if (userIdError) throw userIdError;

      if (!userIdData) {
        toast.error(t('affiliateRedirect.vendeurIntrouvable'));
        navigate('/marketplace');
        return;
      }

      // Récupérer les infos du vendeur
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('id, user_id, business_name, business_type')
        .eq('user_id', userIdData.user_id)
        .maybeSingle();

      if (vendorError) throw vendorError;

      if (!vendor) {
        toast.error(t('affiliateRedirect.boutiqueIntrouvable'));
        navigate('/marketplace');
        return;
      }

      // Message de succès
      toast.success(`Bienvenue chez ${vendor.business_name}!`, {
        description: affPercentage
          ? `Lien d'affiliation activé (${affPercentage}% de commission)`
          : 'Découvrez nos produits'
      });

      const [physicalProductsRes, digitalProductsRes] = await Promise.all([
        supabase
          .from('products')
          .select('id')
          .eq('vendor_id', vendor.id)
          .eq('is_active', true)
          .limit(1),
        supabase
          .from('digital_products')
          .select('id')
          .eq('status', 'published')
          .or(`vendor_id.eq.${vendor.id},merchant_id.eq.${vendor.user_id}`)
          .limit(1)
      ]);

      if (physicalProductsRes.error) throw physicalProductsRes.error;
      if (digitalProductsRes.error) throw digitalProductsRes.error;

      const firstPhysicalProduct = physicalProductsRes.data?.[0];
      const firstDigitalProduct = digitalProductsRes.data?.[0];

      if (vendor.business_type === 'digital' && firstDigitalProduct) {
        navigate(`/digital-product/${firstDigitalProduct.id}`);
      } else if (firstPhysicalProduct) {
        navigate(`/product/${firstPhysicalProduct.id}`);
      } else if (firstDigitalProduct) {
        navigate(`/digital-product/${firstDigitalProduct.id}`);
      } else {
        navigate('/marketplace');
      }

    } catch (error) {
      console.error('Erreur redirection affiliation:', error);
      toast.error(t('affiliateRedirect.erreurLorsDuChargement'));
      navigate('/marketplace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <h2 className="text-xl font-semibold">{t('affiliateRedirect.chargementDeLaBoutique')}</h2>
          <p className="text-sm text-muted-foreground text-center">
            Vous allez être redirigé vers les produits du vendeur
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
