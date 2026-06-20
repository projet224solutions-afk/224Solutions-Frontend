import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Money } from '@/components/Money';
import { BarChart3, TrendingUp, Users, Package, DollarSign } from 'lucide-react';
import type { AgentStats } from '@/hooks/useAgentStats';

interface ViewReportsSectionProps {
  agentId: string;
  agentData: {
    total_users_created?: number;
    total_commissions_earned?: number;
    commission_rate: number;
  };
  agentStats?: AgentStats;
}

export function ViewReportsSection({ agentId, agentData, agentStats }: ViewReportsSectionProps) {
  const { t } = useTranslation();
  const usersThisMonth = agentStats?.usersThisMonth ?? 0;
  const commissionsThisMonth = agentStats?.commissionsThisMonth ?? 0;
  const totalCommissions = agentData.total_commissions_earned ?? agentStats?.totalCommissions ?? 0;
  const totalUsersCreated = agentData.total_users_created ?? agentStats?.totalUsersCreated ?? 0;
  const performance = agentStats?.performance ?? 0;

  const monthlyTarget = 10;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Rapports et Statistiques
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('viewReportsSection.utilisateursCrees')}</span>
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold">{totalUsersCreated}</div>
                  <p className="text-xs text-muted-foreground">{t('viewReportsSection.totalDepuisLeDebut')}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Taux Commission</span>
                    <TrendingUp className="w-4 h-4 text-[#ff4000]" />
                  </div>
                  <div className="text-2xl font-bold">{agentData.commission_rate}%</div>
                  <p className="text-xs text-muted-foreground">{t('viewReportsSection.tauxApplique')}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Commissions</span>
                    <DollarSign className="w-4 h-4 text-[#04439e]" />
                  </div>
                  <div className="text-2xl font-bold">
                    {totalCommissions.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('viewReportsSection.gnfGagnes')}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Performance</span>
                    <Package className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="text-2xl font-bold">{performance}%</div>
                  <p className="text-xs text-muted-foreground">Objectif mensuel</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Graphique des performances */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Performance Mensuelle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{t('viewReportsSection.utilisateursCreesCeMois')}</span>
                    <span className="font-semibold">{usersThisMonth}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((usersThisMonth / monthlyTarget) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Commissions ce mois</span>
                    <span className="font-semibold"><Money amount={commissionsThisMonth} from="GNF" /></span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#ff4000] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(commissionsThisMonth > 0 ? 50 : 0, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
