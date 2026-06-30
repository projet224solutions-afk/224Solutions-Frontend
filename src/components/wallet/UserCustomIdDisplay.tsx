import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StandardIdBadge } from '@/components/StandardIdBadge';
import { User } from 'lucide-react';
import { useTranslation } from "@/hooks/useTranslation";

export const UserCustomIdDisplay = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [standardId, setStandardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadStandardId();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadStandardId = async () => {
    if (!user?.id) return;

    try {
      // Source unique: profiles.public_id (ID standardisé)
      const { data, error } = await supabase
        .from('profiles')
        .select('public_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setStandardId(data?.public_id || null);
    } catch (error) {
      console.error('❌ Erreur chargement public_id:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-elegant">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!standardId) {
    return null;
  }

  return (
    <Card className="shadow-elegant bg-primary/10">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{t('userCustomIdDisplay.votreIdClient')}</CardTitle>
            <CardDescription>{t('userCustomIdDisplay.identifiantUniqueDeCompte')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center">
          <StandardIdBadge
            standardId={standardId}
            variant="default"
            size="lg"
            copyable={true}
            showIcon={true}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          💡 Partagez cet ID pour recevoir des paiements ou être identifié
        </p>
      </CardContent>
    </Card>
  );
};
