import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Users, DollarSign, TrendingUp, UserPlus, Wallet, Target, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentStatsCardsProps {
  stats: {
    totalUsersCreated: number;
    usersThisMonth: number;
    subAgentsCount: number;
    activeSubAgentsCount: number;
  };
  commissionRate: number;
  walletBalance?: number;
  currency?: string;
}

interface StatCard {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    positive: boolean;
  };
  gradient: string;
  iconBg: string;
  textColor: string;
}

export function AgentStatsCards({ stats, commissionRate, walletBalance = 0, currency = 'GNF' }: AgentStatsCardsProps) {
  const { t } = useTranslation();
  const formatAmount = useFormatCurrency();

  const statCards: StatCard[] = [
    {
      title: t('agentStatsCards.utilisateursCrees'),
      value: stats.totalUsersCreated,
      subtitle: `+${stats.usersThisMonth} ce mois`,
      icon: <Users className="w-5 h-5" />,
      trend: stats.usersThisMonth > 0 ? { value: stats.usersThisMonth, positive: true } : undefined,
      gradient: '',
      iconBg: 'bg-blue-500/10',
      textColor: 'text-blue-600'
    },
    {
      title: t('agentStatsCards.soldeWallet'),
      value: formatAmount(walletBalance, currency),
      subtitle: currency,
      icon: <Wallet className="w-5 h-5" />,
      gradient: '',
      iconBg: 'bg-[#ff4000]/10',
      textColor: 'text-[#ff4000]'
    },
    {
      title: 'Taux Commission',
      value: `${commissionRate}%`,
      subtitle: 'Par transaction',
      icon: <DollarSign className="w-5 h-5" />,
      gradient: '',
      iconBg: 'bg-[#04439e]/10',
      textColor: 'text-[#04439e]'
    },
    {
      title: 'Sous-Agents',
      value: stats.subAgentsCount,
      subtitle: `${stats.activeSubAgentsCount} actif(s)`,
      icon: <UserPlus className="w-5 h-5" />,
      gradient: '',
      iconBg: 'bg-orange-500/10',
      textColor: 'text-orange-600'
    },
    {
      title: 'Performance',
      value: '100%',
      subtitle: 'Objectif atteint',
      icon: <TrendingUp className="w-5 h-5" />,
      gradient: '',
      iconBg: 'bg-[#ff4000]/10',
      textColor: 'text-[#ff4000]'
    },
    {
      title: 'Objectif Mensuel',
      value: stats.usersThisMonth,
      subtitle: t('agentStatsCards.utilisateursCrees2'),
      icon: <Target className="w-5 h-5" />,
      gradient: '',
      iconBg: 'bg-slate-500/10',
      textColor: 'text-slate-600'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {statCards.map((stat, index) => (
        <Card
          key={index}
          className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white"
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "p-2.5 rounded-xl transition-colors",
                stat.iconBg
              )}>
                <span className={stat.textColor}>
                  {stat.icon}
                </span>
              </div>
              {stat.trend && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 text-[#ff4000]">
                  <ArrowUpRight className="w-3 h-3" />
                  <span className="text-xs font-semibold">+{stat.trend.value}</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{stat.title}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {stat.value}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{stat.subtitle}</p>
            </div>

            {/* Bottom accent line */}
            <div className={cn(
              "h-1 w-full mt-4 rounded-full bg-gradient-to-r opacity-60 group-hover:opacity-100 transition-opacity",
              stat.gradient
            )} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
