import { ReactNode, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { NotificationBellButton } from '@/components/shared/NotificationBellButton';
import {
  LayoutDashboard,
  Wallet,
  Users,
  Bike,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Building2,
  Bell,
  Menu,
  X,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  MapPin,
  ShieldAlert,
  Ticket,
  ShoppingBag,
  Headphones
} from 'lucide-react';
import { BureauWalletDisplay } from '@/components/wallet/BureauWalletDisplay';

interface BureauLayoutProps {
  children: ReactNode;
  bureau: {
    id: string;
    bureau_code: string;
    prefecture: string;
    commune: string;
    president_name?: string;
    president_email?: string;
    status?: string;
    total_members?: number;
  };
  activeTab: string;
  onTabChange: (tab: string) => void;
  alertsCount?: number;
  onLogout: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: string | number;
}

export function BureauLayout({
  children,
  bureau,
  activeTab,
  onTabChange,
  alertsCount = 0,
  onLogout
}: BureauLayoutProps) {
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: t('bureauLayout.tableauDeBord'),
      icon: <LayoutDashboard className="w-5 h-5" />
    },
    {
      id: 'sos',
      label: 'Alertes SOS',
      icon: <AlertTriangle className="w-5 h-5 text-[#ff4000]" />
    },
    {
      id: 'motos',
      label: t('bureauLayout.vehicules'),
      icon: <Bike className="w-5 h-5" />
    },
    {
      id: 'security',
      label: t('bureauLayout.securiteVol'),
      icon: <ShieldAlert className="w-5 h-5 text-[#ff4000]" />
    },
    {
      id: 'wallet',
      label: 'Wallet',
      icon: <Wallet className="w-5 h-5" />
    },
    {
      id: 'tickets',
      label: 'Tickets Transport',
      icon: <Ticket className="w-5 h-5 text-[#ff4000]" />
    },
    {
      id: 'my-purchases',
      label: 'Mes Achats',
      icon: <ShoppingBag className="w-5 h-5 text-[#ff4000]" />
    },
    {
      id: 'workers',
      label: 'Membres Bureau',
      icon: <Users className="w-5 h-5" />
    },
    {
      id: 'sync',
      label: 'Synchronisation',
      icon: <RefreshCw className="w-5 h-5" />
    },
    {
      id: 'alerts',
      label: 'Alertes',
      icon: <AlertCircle className="w-5 h-5" />,
      badge: alertsCount > 0 ? alertsCount : undefined
    },
    {
      id: 'communication',
      label: 'Communication',
      icon: <MessageSquare className="w-5 h-5" />
    },
    {
      id: 'support',
      label: 'Support Technique',
      icon: <Headphones className="w-5 h-5 text-[#04439e]" />
    },
    {
      id: 'settings',
      label: t('bureauLayout.parametres'),
      icon: <Settings className="w-5 h-5" />
    }
  ];

  const handleNavClick = (itemId: string) => {
    onTabChange(itemId);
    setMobileMenuOpen(false);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'BS';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#ff4000] rounded-lg">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-slate-800">Bureau</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBellButton />
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-[#ff4000] text-white text-xs">
                {getInitials(bureau.president_name)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-white border-r border-slate-200 shadow-xl transition-all duration-300",
          "lg:translate-x-0 lg:shadow-none",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "lg:w-20" : "lg:w-72"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className={cn(
            "flex items-center p-4 border-b border-slate-100",
            sidebarCollapsed ? "justify-center" : "justify-between"
          )}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3">
                <img src="/logo-224solutions.png" alt="224Solutions" className="w-10 h-10 rounded-xl object-contain" />
                <div>
                  <h1 className="font-bold text-slate-800">224Solutions</h1>
                  <p className="text-xs text-slate-500">Bureau Syndicat</p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="p-2 bg-[#ff4000] rounded-xl">
                <Building2 className="w-5 h-5 text-white" />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Bureau Info */}
          {!sidebarCollapsed && (
            <div className="p-4 mx-3 mt-3 rounded-xl">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-white shadow">
                  <AvatarFallback className="bg-[#ff4000] text-white font-semibold">
                    {getInitials(bureau.president_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 truncate">
                    {bureau.president_name || 'Bureau Syndicat'}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{bureau.commune}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {bureau.bureau_code}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <BureauWalletDisplay
                  bureauId={bureau.id}
                  bureauCode={bureau.bureau_code}
                  compact={true}
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="space-y-1 px-3">
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 h-11 transition-all",
                    activeTab === item.id
                      ? "bg-[#ff4000] text-white shadow-md"
                      : "text-slate-600 hover:bg-slate-100",
                    sidebarCollapsed && "justify-center px-2"
                  )}
                  onClick={() => handleNavClick(item.id)}
                >
                  {item.icon}
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <Badge variant="destructive" className="text-[10px]">
                          {item.badge}
                        </Badge>
                      )}
                    </>
                  )}
                </Button>
              ))}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="p-3 border-t border-slate-100">
            <Separator className="mb-3" />
            {!sidebarCollapsed && (
              <div className="px-2 py-1.5 bg-slate-50 rounded-lg mb-2">
                <p className="text-xs text-slate-500">{t('bureauLayout.prefecture')}</p>
                <p className="text-sm font-medium text-slate-800">{bureau.prefecture}</p>
              </div>
            )}
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 text-[#ff4000] hover:bg-orange-50 hover:text-[#ff4000]",
                sidebarCollapsed && "justify-center"
              )}
              onClick={onLogout}
            >
              <LogOut className="w-5 h-5" />
              {!sidebarCollapsed && <span>{t('bureauLayout.deconnexion')}</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "transition-all duration-300 pt-16 lg:pt-0",
          sidebarCollapsed ? "lg:ml-20" : "lg:ml-72"
        )}
      >
        {/* Desktop Header */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              {navItems.find(item => item.id === activeTab)?.label || 'Tableau de bord'}
            </h2>
            <p className="text-sm text-slate-500">
              {bureau.prefecture} - {bureau.commune}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={bureau.status === 'active' ? "default" : "secondary"} className={cn(
              "px-3 py-1",
              bureau.status === 'active'
                ? "bg-orange-100 text-[#ff4000] hover:bg-orange-100"
                : "bg-slate-100 text-slate-600"
            )}>
              {bureau.status === 'active' ? '● Actif' : '○ Inactif'}
            </Badge>
            <Button variant="ghost" size="icon" className="relative" onClick={() => onTabChange('alerts')}>
              <Bell className="w-5 h-5" />
              {alertsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#ff4000] rounded-full text-white text-xs flex items-center justify-center">
                  {alertsCount}
                </span>
              )}
            </Button>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 ring-2 ring-slate-100">
                <AvatarFallback className="bg-[#ff4000] text-white">
                  {getInitials(bureau.president_name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden xl:block">
                <p className="font-medium text-slate-800 text-sm">{bureau.president_name || 'Bureau'}</p>
                <p className="text-xs text-slate-500">{bureau.bureau_code}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
