/**
 * STATISTIQUES CONDUCTEUR - ULTRA PROFESSIONNEL
 * Cards élégantes optimisées pour mobile
 */

import { Wallet, Car, Star, Clock, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

interface DriverStatsRowProps {
  todayEarnings: number;
  todayRides: number;
  rating: number;
  onlineTime: string;
  onStatClick?: (statId: string) => void;
  onGoToMarketplace?: () => void;
}

export function DriverStatsRow({
  todayEarnings,
  todayRides,
  rating,
  onlineTime,
  onStatClick,
  onGoToMarketplace
}: DriverStatsRowProps) {
  const stats = [
    {
      id: 'earnings',
      value: `${(todayEarnings || 0).toLocaleString()}`,
      suffix: "GNF",
      icon: Wallet,
      iconBg: "bg-[#ff4000]/20",
      iconColor: "text-[#ff4000]",
      clickable: true,
      onClick: () => onStatClick?.('earnings')
    },
    {
      id: 'rides',
      value: (todayRides || 0).toString(),
      suffix: "COURSES",
      icon: Car,
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-400",
      clickable: true,
      onClick: () => onStatClick?.('rides')
    },
    {
      id: 'marketplace',
      value: '🛍️',
      suffix: "ACHATS",
      icon: ShoppingBag,
      iconBg: "bg-orange-500/20",
      iconColor: "text-orange-400",
      clickable: true,
      onClick: onGoToMarketplace
    },
    {
      id: 'rating',
      value: rating > 0 ? rating.toFixed(1) : '—',
      suffix: "NOTE",
      icon: Star,
      iconBg: "bg-[#ff4000]/20",
      iconColor: "text-[#ff4000]",
      clickable: true,
      onClick: () => onStatClick?.('rating')
    },
    {
      id: 'time',
      value: onlineTime || '0m',
      suffix: "EN LIGNE",
      icon: Clock,
      iconBg: "bg-[#04439e]/20",
      iconColor: "text-[#04439e]",
      clickable: false,
      onClick: undefined
    }
  ];

  return (
    <div className="px-2 py-3 w-full overflow-x-auto scrollbar-hide">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 min-w-[320px]">
        {stats.map((stat) => (
          <button
            key={stat.id}
            onClick={() => stat.onClick?.()}
            disabled={!stat.clickable}
            className={cn(
              "relative overflow-hidden",
              "bg-gray-800/80",
              "backdrop-blur-sm",
              "rounded-xl p-1.5",
              "border border-gray-700/50",
              "transition-all duration-200",
              stat.clickable && "active:scale-[0.97] cursor-pointer hover:border-gray-600/50",
              !stat.clickable && "cursor-default",
              "group"
            )}
          >
            <div className="flex flex-col items-center text-center gap-0.5">
              <div className={cn(
                "w-6 h-6 rounded-lg flex items-center justify-center",
                stat.iconBg
              )}>
                <stat.icon className={cn("w-3 h-3", stat.iconColor)} />
              </div>
              <div className="flex flex-col w-full">
                <span className="text-white font-bold text-[10px] leading-tight truncate">
                  {stat.value}
                </span>
                <span className="text-gray-500 text-[7px] font-medium uppercase tracking-wide truncate">
                  {stat.suffix}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
