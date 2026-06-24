/**
 * NAVIGATION INFÉRIEURE - ULTRA PROFESSIONNEL
 * Design glassmorphism avec animations fluides
 */

import { Home, MapPin, Settings, Wallet, Navigation, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasActiveRide?: boolean;
  onMarketplace?: () => void;
}

export function BottomNavigation({
  activeTab,
  onTabChange,
  hasActiveRide,
}: BottomNavigationProps) {
  const navItems = [
    { id: 'dashboard', label: 'Accueil', icon: Home },
    {
      id: 'navigation',
      label: hasActiveRide ? 'Navigation' : 'Course',
      icon: hasActiveRide ? Navigation : MapPin,
      badge: hasActiveRide,
      highlight: hasActiveRide
    },
    { id: 'my-purchases', label: 'Mes achats', icon: ShoppingBag },
    { id: 'earnings', label: 'Gains', icon: Wallet },
    { id: 'settings', label: 'Réglages', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-inset-bottom">
      {/* Gradient overlay for seamless blend */}
      <div className="absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none" />

      {/* Main navigation bar */}
      <div className="bg-gray-950/95 backdrop-blur-xl border-t border-gray-800/50">
        <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 relative",
                  "transition-all duration-200 ease-out",
                  "active:scale-95"
                )}
              >
                {/* Active background pill */}
                {isActive && (
                  <div className="absolute inset-x-2 inset-y-1.5 rounded-xl border border-[#ff4000]/20" />
                )}

                {/* Highlight glow for active ride */}
                {item.highlight && !isActive && (
                  <div className="absolute inset-x-3 inset-y-2 rounded-xl bg-[#ff4000]/5 animate-pulse" />
                )}

                {/* Icon container */}
                <div className="relative z-10">
                  <item.icon className={cn(
                    "w-5 h-5 transition-all duration-200",
                    isActive
                      ? "text-[#ff4000] scale-110"
                      : item.highlight
                        ? "text-[#ff4000]/70 animate-pulse"
                        : "text-gray-500"
                  )} />

                  {/* Active ride badge */}
                  {item.badge && (
                    <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-[#ff4000] rounded-full animate-pulse shadow-lg shadow-[#ff4000]/50" />
                  )}
                </div>

                {/* Label */}
                <span className={cn(
                  "text-[10px] font-medium relative z-10 transition-colors duration-200",
                  isActive
                    ? "text-[#ff4000] font-semibold"
                    : item.highlight
                      ? "text-[#ff4000]/70"
                      : "text-gray-500"
                )}>
                  {item.label}
                </span>

                {/* Active indicator line */}
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-transparent via-[#ff4000] to-transparent rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
