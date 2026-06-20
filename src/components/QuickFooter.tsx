import { Home, ShoppingBag, MapPin, MessageSquare, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { Badge } from "@/components/ui/badge";

export default function QuickFooter() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const { unreadCount } = useUnreadMessages();

  // Navigation principale
  const navigationItems = [
    {
      id: 'home',
      labelKey: 'nav.home',
      icon: Home,
      // IMPORTANT: Accueil doit toujours aller vers /home (page services)
      path: '/home',
      badge: 0,
    },
    {
      id: 'marketplace',
      labelKey: 'nav.marketplace',
      icon: ShoppingBag,
      path: '/marketplace',
      badge: 0,
    },
    {
      id: 'proximite',
      labelKey: 'nav.proximite',
      icon: MapPin,
      path: '/proximite',
      badge: 0,
    },
    {
      id: 'messages',
      labelKey: 'nav.messages',
      icon: MessageSquare,
      path: '/messages',
      badge: unreadCount,
    },
    {
      id: 'profil',
      labelKey: 'nav.profile',
      icon: User,
      path: user ? '/profil' : '/auth',
      badge: 0,
    },
  ];

  // Pages publiques plein écran (paiement / signature de contrat) : pas de nav d'app
  // (sinon elle recouvre le bouton « Payer » et déroute un client non connecté).
  if (/^\/(pay|contrat)\//.test(location.pathname)) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-card/98 backdrop-blur-md border-t border-border z-[100] shadow-lg"
      role="navigation"
      aria-label="Navigation principale"
      style={{
        paddingTop: '0.5rem',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))'
      }}
    >
      <div className="flex items-center justify-around px-2 max-w-screen-xl mx-auto">
        {navigationItems.map((item) => {
          // Le bouton Home n'est actif QUE sur /home, pas sur les dashboards
          const isActive = item.id === 'home'
            ? location.pathname === '/home'
            : item.id === 'proximite'
              ? (location.pathname === '/proximite' || location.pathname.startsWith('/proximite/') || location.pathname.startsWith('/services-proximite'))
              : location.pathname === item.path || (item.id === 'profil' && !profile && location.pathname === '/auth');
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center p-1.5 rounded-lg transition-all duration-300 min-w-[56px] group relative",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md scale-105 ring-1 ring-primary/20"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/5 hover:scale-105"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-full transition-all duration-300 relative",
                isActive
                  ? "bg-white/15 text-primary-foreground"
                  : "group-hover:text-primary"
              )}>
                <Icon size={18} />
                {/* Badge de notification */}
                {item.badge > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 min-w-5 px-1 flex items-center justify-center text-[10px] font-bold animate-pulse"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium mt-0.5 leading-tight",
                isActive ? "text-primary-foreground font-semibold" : "text-muted-foreground group-hover:text-primary"
              )}>
                {t(item.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
