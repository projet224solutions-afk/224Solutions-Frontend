import { Card, CardContent } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Users, Bike, AlertCircle, Wallet, Building2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BureauStatsCardsProps {
  workersCount: number;
  membersCount: number;
  motosCount: number;
  alertsCount: number;
  walletBalance?: number;
  currency?: string;
}

interface StatCard {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
}

export function BureauStatsCards({
  workersCount,
  membersCount,
  motosCount,
  alertsCount,
  walletBalance = 0,
  currency = 'GNF'
}: BureauStatsCardsProps) {
  const formatAmount = useFormatCurrency();

  // Performance réelle calculée depuis les adhérents (pas de valeur hardcodée)
  const performanceScore = membersCount === 0
    ? 0
    : Math.min(Math.round((membersCount / 100) * 100), 100);

  // NB: `gradient` porte désormais une couleur SOLIDE (charte 224: pas de dégradés).
  const statCards: StatCard[] = [
    {
      title: 'Membres Bureau',
      value: workersCount,
      subtitle: 'Membres actifs',
      icon: <Building2 className="w-6 h-6 text-white" />,
      gradient: 'bg-[#04439e]'
    },
    {
      title: 'Adhérents',
      value: membersCount,
      subtitle: 'Total membres',
      icon: <Users className="w-6 h-6 text-white" />,
      gradient: 'bg-[#023a8a]'
    },
    {
      title: 'Véhicules',
      value: motosCount,
      subtitle: 'Enregistrés',
      icon: <Bike className="w-6 h-6 text-white" />,
      gradient: 'bg-[#ff4000]'
    },
    {
      title: 'Alertes',
      value: alertsCount,
      subtitle: alertsCount > 0 ? 'Non lues — action requise' : 'Aucune alerte',
      icon: <AlertCircle className="w-6 h-6 text-white" />,
      gradient: alertsCount > 0 ? 'bg-red-600' : 'bg-slate-600'
    },
    {
      title: 'Solde Wallet',
      value: formatAmount(walletBalance, currency),
      subtitle: currency,
      icon: <Wallet className="w-6 h-6 text-white" />,
      gradient: 'bg-[#16a34a]'
    },
    {
      title: 'Performance',
      value: `${performanceScore}%`,
      subtitle: performanceScore >= 100 ? 'Objectif mensuel atteint 🎯' : `${membersCount} / 100 adhérents`,
      icon: <TrendingUp className="w-6 h-6 text-white" />,
      gradient: performanceScore >= 80 ? 'bg-[#16a34a]' : 'bg-[#04439e]'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
      {statCards.map((stat, index) => (
        <Card
          key={index}
          className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
        >
          <CardContent className="p-0">
            <div className={cn(
              "p-4 lg:p-5",
              stat.gradient
            )}>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white/80">{stat.title}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl lg:text-3xl font-bold text-white">
                      {stat.value}
                    </span>
                  </div>
                  <p className="text-xs text-white/70">{stat.subtitle}</p>
                </div>
                <div className="p-3 rounded-xl">
                  {stat.icon}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
