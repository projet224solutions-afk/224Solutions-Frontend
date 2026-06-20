import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { DollarSign, TrendingUp, Calendar, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Commission {
  id: string;
  amount: number;
  date: string;
  status: string;
  description?: string;
}

interface ManageCommissionsSectionProps {
  agentId: string;
  totalCommissions: number;
  commissionRate: number;
}

export function ManageCommissionsSection({
  agentId,
  totalCommissions,
  commissionRate
}: ManageCommissionsSectionProps) {
  const { t } = useTranslation();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCommissions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const loadCommissions = async () => {
    try {
      setLoading(true);

      // Charger vraies commissions depuis agent_commissions_log
      // (table typée dans Supabase; évite aussi les types trop profonds avec select('*'))
      const { data, error } = await supabase
        .from('agent_commissions_log')
        .select('id, amount, created_at, source_type, description')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Mapper vers format Commission
      const mappedCommissions: Commission[] = (data || []).map((c: any) => ({
        id: c.id,
        amount: Number(c.amount || 0),
        date: c.created_at,
        status: 'paid',
        description: c.description || `Commission - ${c.source_type}`,
      }));

      setCommissions(mappedCommissions);
    } catch (error) {
      console.error('Erreur chargement commissions:', error);
      toast.error(t('manageCommissionsSection.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Chargement...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Commissions</span>
                <DollarSign className="w-4 h-4 text-[#ff4000]" />
              </div>
              <div className="text-2xl font-bold text-[#ff4000]">
                <Money amount={totalCommissions} from="GNF" />
              </div>
              <p className="text-xs text-muted-foreground">{t('manageCommissionsSection.depuisLeDebut')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Taux Commission</span>
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-blue-600">{commissionRate}%</div>
              <p className="text-xs text-muted-foreground">Taux actuel</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ce Mois</span>
                <Calendar className="w-4 h-4 text-[#04439e]" />
              </div>
              <div className="text-2xl font-bold text-[#04439e]">0 GNF</div>
              <p className="text-xs text-muted-foreground">{t('manageCommissionsSection.commissionsDuMois')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Historique des Commissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>{t('manageCommissionsSection.aucuneCommissionPourLeMoment')}</p>
              <p className="text-sm mt-2">{t('manageCommissionsSection.lesCommissionsApparaitrontIciDes')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {commissions.map((commission) => (
                <Card key={commission.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-semibold"><Money amount={commission.amount} from="GNF" /></p>
                        {commission.description && (
                          <p className="text-sm text-muted-foreground">{commission.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(commission.date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <Badge variant={commission.status === 'paid' ? 'default' : 'secondary'}>
                        {commission.status === 'paid' ? 'Payé' : 'En attente'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
