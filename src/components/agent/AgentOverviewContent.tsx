import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Mail,
  Phone,
  Shield,
  Calendar,
  TrendingUp,
  Users,
  Clock
} from 'lucide-react';
import { AgentStatsCards } from './AgentStatsCards';
import { AgentIdDisplay } from './AgentIdDisplay';

interface AgentOverviewContentProps {
  agent: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    agent_code: string;
    type_agent?: string;
    is_active: boolean;
    commission_rate: number;
    can_create_sub_agent?: boolean;
    permissions?: string[];
    created_at?: string;
  };
  stats: {
    totalUsersCreated: number;
    usersThisMonth: number;
    subAgentsCount: number;
    activeSubAgentsCount: number;
  };
  walletBalance?: number;
}

export function AgentOverviewContent({ agent, stats, walletBalance = 0 }: AgentOverviewContentProps) {
  const { t } = useTranslation();
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Non disponible';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const monthlyGoal = 50; // Objectif mensuel d'utilisateurs
  const monthlyProgress = Math.min((stats.usersThisMonth / monthlyGoal) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <AgentStatsCards
        stats={stats}
        commissionRate={agent.commission_rate}
        walletBalance={walletBalance}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Profile Card */}
        <Card className="lg:col-span-2 border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Shield className="w-5 h-5 text-blue-600" />
              Informations Agent
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Mail className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Email</p>
                    <p className="font-medium text-slate-800">{agent.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <Phone className="w-4 h-4 text-[#ff4000]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">{t('agentOverviewContent.telephone')}</p>
                    <p className="font-medium text-slate-800">{agent.phone || 'Non renseigné'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Calendar className="w-4 h-4 text-[#04439e]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">{t('agentOverviewContent.dateDInscription')}</p>
                    <p className="font-medium text-slate-800">{formatDate(agent.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Code Agent</p>
                  <AgentIdDisplay agentCode={agent.agent_code} />
                </div>

                {agent.type_agent && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Type d'Agent</p>
                    <Badge className="bg-[#04439e] text-white">
                      {agent.type_agent}
                    </Badge>
                  </div>
                )}

                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Permissions</p>
                  <div className="flex flex-wrap gap-2">
                    {agent.permissions?.length ? (
                      agent.permissions.map((perm: string) => (
                        <Badge
                          key={perm}
                          variant="outline"
                          className="text-xs bg-slate-50"
                        >
                          {perm}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">{t('agentOverviewContent.aucunePermissionSpecifique')}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Card */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-50 border-b">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <TrendingUp className="w-5 h-5 text-[#ff4000]" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Monthly Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-600">Objectif Mensuel</span>
                <span className="text-sm font-bold text-[#ff4000]">
                  {stats.usersThisMonth}/{monthlyGoal}
                </span>
              </div>
              <Progress value={monthlyProgress} className="h-2" />
              <p className="text-xs text-slate-500 mt-1">
                {monthlyProgress.toFixed(0)}% de l'objectif atteint
              </p>
            </div>

            <Separator />

            {/* Quick Stats */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-slate-600">Total Utilisateurs</span>
                </div>
                <span className="font-bold text-slate-800">{stats.totalUsersCreated}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#ff4000]" />
                  <span className="text-sm text-slate-600">Ce Mois</span>
                </div>
                <span className="font-bold text-slate-800">+{stats.usersThisMonth}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#04439e]" />
                  <span className="text-sm text-slate-600">Sous-Agents Actifs</span>
                </div>
                <span className="font-bold text-slate-800">{stats.activeSubAgentsCount}</span>
              </div>
            </div>

            <Separator />

            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Statut</span>
              <Badge
                className={agent.is_active
                  ? "bg-orange-100 text-[#ff4000] hover:bg-orange-100"
                  : "bg-slate-100 text-slate-600"
                }
              >
                {agent.is_active ? '● Actif' : '○ Inactif'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
