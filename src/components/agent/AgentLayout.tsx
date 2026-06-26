import { ReactNode, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  Wallet,
  Users,
  UserPlus,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Bell,
  Menu,
  X,
  FileText
} from 'lucide-react';
import { WalletBalanceDisplay } from '@/components/wallet/WalletBalanceDisplay';

interface AgentLayoutProps {
  children: ReactNode;
  agent: {
    id: string;
    name: string;
    email: string;
    agent_code: string;
    type_agent?: string;
    is_active: boolean;
    commission_rate: number;
    can_create_sub_agent?: boolean;
  };
  activeTab: string;
  onTabChange: (tab: string) => void;
  pdgUserId?: string | null;
  onSignOut: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: string | number;
}

export function AgentLayout({
  children,
  agent,
  activeTab,
  onTabChange,
  pdgUserId,
  onSignOut
}: AgentLayoutProps) {
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: t('agentLayout.tableauDeBord'),
      icon: <LayoutDashboard className="w-5 h-5" />
    },
    {
      id: 'wallet',
      label: 'Wallet',
      icon: <Wallet className="w-5 h-5" />
    },
    {
      id: 'create-user',
      label: t('agentLayout.creerUtilisateur'),
      icon: <UserPlus className="w-5 h-5" />
    },
    {
      id: 'sub-agents',
      label: 'Sous-Agents',
      icon: <Users className="w-5 h-5" />,
      badge: agent.can_create_sub_agent ? undefined : 'Désactivé'
    },
    {
      id: 'reports',
      label: 'Rapports',
      icon: <FileText className="w-5 h-5" />
    },
    {
      id: 'settings',
      label: t('agentLayout.parametres'),
      icon: <Settings className="w-5 h-5" />
    }
  ];

  const handleNavClick = (itemId: string) => {
    onTabChange(itemId);
    setMobileMenuOpen(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-blue-50">
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
              <div className="p-1.5 bg-[#04439e] rounded-lg">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-slate-800">Agent</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#ff4000] rounded-full" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onSignOut}
              className="text-[#ff4000] hover:bg-orange-50"
            >
              <LogOut className="w-5 h-5" />
            </Button>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-[#04439e] text-white text-xs">
                {getInitials(agent.name)}
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
                <div className="p-2 bg-[#04439e] rounded-xl shadow-lg">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-slate-800">224Solutions</h1>
                  <p className="text-xs text-slate-500">Interface Agent</p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="p-2 bg-[#04439e] rounded-xl">
                <Shield className="w-5 h-5 text-white" />
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

          {/* Agent Info */}
          {!sidebarCollapsed && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-50 mx-3 mt-3 rounded-xl">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-white shadow">
                  <AvatarFallback className="bg-[#04439e] text-white font-semibold">
                    {getInitials(agent.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 truncate">{agent.name}</h3>
                  <p className="text-xs text-slate-500 truncate">{agent.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {agent.agent_code}
                    </Badge>
                    {agent.type_agent && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 hover:bg-blue-100">
                        {agent.type_agent}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {pdgUserId && (
                <div className="mt-3">
                  <WalletBalanceDisplay userId={pdgUserId} compact={true} />
                </div>
              )}
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
                      ? "bg-[#04439e] text-white shadow-md"
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
                        <Badge variant="secondary" className="text-[10px]">
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
            <div className="space-y-2">
              {!sidebarCollapsed && (
                <div className="flex items-center justify-between px-2 py-1.5 bg-slate-50 rounded-lg">
                  <span className="text-xs text-slate-500">Commission</span>
                  <Badge variant="outline" className="bg-orange-50 text-[#ff4000] border-orange-200">
                    {agent.commission_rate}%
                  </Badge>
                </div>
              )}
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 text-[#ff4000] hover:bg-orange-50 hover:text-[#ff4000]",
                  sidebarCollapsed && "justify-center"
                )}
                onClick={onSignOut}
              >
                <LogOut className="w-5 h-5" />
                {!sidebarCollapsed && <span>{t('agentLayout.deconnexion')}</span>}
              </Button>
            </div>
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
              Bienvenue, {agent.name}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={agent.is_active ? "default" : "secondary"} className={cn(
              "px-3 py-1",
              agent.is_active
                ? "bg-orange-100 text-[#ff4000] hover:bg-orange-100"
                : "bg-slate-100 text-slate-600"
            )}>
              {agent.is_active ? '● Actif' : '○ Inactif'}
            </Badge>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#ff4000] rounded-full" />
            </Button>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 ring-2 ring-slate-100">
                <AvatarFallback className="bg-[#04439e] text-white">
                  {getInitials(agent.name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden xl:block">
                <p className="font-medium text-slate-800 text-sm">{agent.name}</p>
                <p className="text-xs text-slate-500">{agent.agent_code}</p>
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
