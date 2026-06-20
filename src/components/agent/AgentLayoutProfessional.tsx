import { ReactNode, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useWallet } from '@/hooks/useWallet';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  Wallet,
  Users,
  UserPlus,
  Settings,
  LogOut,
  Shield,
  Bell,
  Menu,
  X,
  BarChart3,
  ChevronRight,
  Zap,
  CreditCard,
  ArrowUpRight,
  Link2,
  DollarSign,
  FileCheck,
  Sparkles,
  Headphones
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AgentLayoutProfessionalProps {
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
    permissions?: string[];
  };
  activeTab: string;
  onTabChange: (tab: string) => void;
  walletBalance?: number;
  stats?: {
    totalUsersCreated: number;
    totalCommissions: number;
  };
  onSignOut: () => void;
  /** Permissions unifiées (table agent_permissions + legacy) */
  unifiedPermissions?: Record<string, boolean>;
}

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: string | number;
  gradient?: string;
  disabled?: boolean;
  /** Clé de permission requise pour afficher cet item */
  permission?: string;
  /** Si défini, le clic navigue vers cette route (au lieu de changer d'onglet interne) */
  external?: string;
}

export function AgentLayoutProfessional({
  children,
  agent,
  activeTab,
  onTabChange,
  walletBalance = 0,
  stats,
  onSignOut,
  unifiedPermissions = {}
}: AgentLayoutProfessionalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { wallet } = useWallet();

  /**
   * Vérifie si l'agent a une permission donnée (unifié + legacy)
   * Gère les alias de permissions pour compatibilité:
   * - manage_* implique automatiquement view_* (héritage)
   * - certaines permissions avancées satisfont les permissions basiques
   */
  const hasPermission = (key: string): boolean => {
    // Mapping d'alias de permissions (héritage + compatibilité)
    const permissionAliases: Record<string, string[]> = {
      // Gestion - toute permission manage_* implique view_*
      'view_users': ['view_users', 'manage_users', 'create_users'],
      'manage_users': ['manage_users'],
      'create_users': ['create_users', 'manage_users'],
      'view_kyc': ['view_kyc', 'manage_kyc', 'manage_vendor_kyc'],
      'manage_kyc': ['manage_kyc'],
      'view_vendor_kyc': ['view_vendor_kyc', 'manage_vendor_kyc', 'manage_kyc'],
      'manage_vendor_kyc': ['manage_vendor_kyc', 'manage_kyc'],
      'view_products': ['view_products', 'manage_products'],
      'manage_products': ['manage_products'],
      'view_transfer_fees': ['view_transfer_fees', 'manage_transfer_fees'],
      'manage_transfer_fees': ['manage_transfer_fees'],
      'view_service_subscriptions': ['view_service_subscriptions', 'manage_service_subscriptions'],
      'manage_service_subscriptions': ['manage_service_subscriptions'],
      'view_service_plans': ['view_service_plans', 'manage_service_plans', 'manage_service_subscriptions'],
      'manage_service_plans': ['manage_service_plans'],
      // Services Professionnels (15 types)
      'view_beauty_services': ['view_beauty_services', 'manage_beauty_services'],
      'manage_beauty_services': ['manage_beauty_services'],
      'view_fitness_services': ['view_fitness_services', 'manage_fitness_services'],
      'manage_fitness_services': ['manage_fitness_services'],
      'view_restaurant_services': ['view_restaurant_services', 'manage_restaurant_services'],
      'manage_restaurant_services': ['manage_restaurant_services'],
      'view_health_services': ['view_health_services', 'manage_health_services'],
      'manage_health_services': ['manage_health_services'],
      'view_education_services': ['view_education_services', 'manage_education_services'],
      'manage_education_services': ['manage_education_services'],
      'view_transport_services': ['view_transport_services', 'manage_transport_services'],
      'manage_transport_services': ['manage_transport_services'],
      'view_hotel_services': ['view_hotel_services', 'manage_hotel_services'],
      'manage_hotel_services': ['manage_hotel_services'],
      'view_event_services': ['view_event_services', 'manage_event_services'],
      'manage_event_services': ['manage_event_services'],
      'view_repair_services': ['view_repair_services', 'manage_repair_services'],
      'manage_repair_services': ['manage_repair_services'],
      'view_legal_services': ['view_legal_services', 'manage_legal_services'],
      'manage_legal_services': ['manage_legal_services'],
      'view_finance_services': ['view_finance_services', 'manage_finance_services'],
      'manage_finance_services': ['manage_finance_services'],
      'view_tech_services': ['view_tech_services', 'manage_tech_services'],
      'manage_tech_services': ['manage_tech_services'],
      'view_cleaning_services': ['view_cleaning_services', 'manage_cleaning_services'],
      'manage_cleaning_services': ['manage_cleaning_services'],
      'view_real_estate_services': ['view_real_estate_services', 'manage_real_estate_services'],
      'manage_real_estate_services': ['manage_real_estate_services'],
      'view_agriculture_services': ['view_agriculture_services', 'manage_agriculture_services'],
      'manage_agriculture_services': ['manage_agriculture_services'],

      // Finance
      'view_finance': ['view_finance', 'manage_finance'],
      'manage_finance': ['manage_finance'],
      'view_banking': ['view_banking', 'manage_banking', 'manage_finance'],
      'manage_banking': ['manage_banking'],
      'view_payments': ['view_payments', 'manage_payments', 'manage_finance'],
      'manage_payments': ['manage_payments'],
      'view_financial_module': ['view_financial_module', 'manage_finance', 'view_finance'],
      'manage_wallet_transactions': ['manage_wallet_transactions', 'manage_finance', 'manage_banking'],

      // Opérations
      'view_agents': ['view_agents', 'manage_agents'],
      'manage_agents': ['manage_agents'],
      'create_sub_agents': ['create_sub_agents', 'manage_agents'],
      'view_syndicat': ['view_syndicat', 'manage_syndicat'],
      'manage_syndicat': ['manage_syndicat'],
      'view_bureau_monitoring': ['view_bureau_monitoring', 'manage_bureau_monitoring'],
      'manage_bureau_monitoring': ['manage_bureau_monitoring'],
      'view_driver_subscriptions': ['view_driver_subscriptions', 'manage_driver_subscriptions'],
      'manage_driver_subscriptions': ['manage_driver_subscriptions'],
      'view_stolen_vehicles': ['view_stolen_vehicles', 'manage_stolen_vehicles'],
      'manage_stolen_vehicles': ['manage_stolen_vehicles'],
      'view_orders': ['view_orders', 'manage_orders'],
      'manage_orders': ['manage_orders'],
      'view_vendors': ['view_vendors', 'manage_vendors', 'manage_vendor_kyc'],
      'manage_vendors': ['manage_vendors'],
      'view_vendor_certification': ['view_vendor_certification', 'manage_vendor_certification'],
      'manage_vendor_certification': ['manage_vendor_certification'],
      'view_drivers': ['view_drivers', 'manage_drivers'],
      'manage_drivers': ['manage_drivers'],
      'view_quotes_invoices': ['view_quotes_invoices', 'manage_quotes_invoices'],
      'manage_quotes_invoices': ['manage_quotes_invoices'],
      'access_communication': ['access_communication', 'manage_communication'],
      'manage_communication': ['manage_communication'],
      'view_agent_wallet_audit': ['view_agent_wallet_audit', 'manage_agent_wallet_audit'],
      'manage_agent_wallet_audit': ['manage_agent_wallet_audit'],

      // Système
      'view_security': ['view_security', 'manage_security'],
      'manage_security': ['manage_security'],
      'view_id_normalization': ['view_id_normalization', 'manage_id_normalization'],
      'manage_id_normalization': ['manage_id_normalization'],
      'view_bug_bounty': ['view_bug_bounty', 'manage_bug_bounty'],
      'manage_bug_bounty': ['manage_bug_bounty'],
      'view_config': ['view_config', 'manage_config'],
      'manage_config': ['manage_config'],
      'view_maintenance': ['view_maintenance', 'manage_maintenance'],
      'manage_maintenance': ['manage_maintenance'],
      'view_api': ['view_api', 'manage_api'],
      'manage_api': ['manage_api'],
      'view_debug': ['view_debug', 'manage_debug'],
      'manage_debug': ['manage_debug'],

      // Intelligence
      'view_reports': ['view_reports', 'manage_reports', 'view_analytics', 'view_finance', 'manage_finance'],
      'manage_reports': ['manage_reports'],
      'view_copilot_audit': ['view_copilot_audit', 'access_copilot'],
      'access_copilot': ['access_copilot'],
      'view_analytics': ['view_analytics', 'manage_analytics', 'view_reports', 'manage_reports'],
      'manage_analytics': ['manage_analytics'],
    };

    const keysToCheck = permissionAliases[key] || [key];

    for (const k of keysToCheck) {
      if (unifiedPermissions[k] === true) return true;
      if (agent.permissions?.includes(k)) return true;
    }
    return false;
  };

  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Tableau de Bord',
      icon: <LayoutDashboard className="w-5 h-5" />,
      gradient: ''
    },
    {
      id: 'wallet',
      label: 'Portefeuille',
      icon: <Wallet className="w-5 h-5" />,
      gradient: ''
    },
    // --- Nouvelles fonctionnalités opérationnelles ---
    {
      id: 'finance',
      label: 'Finance & Revenus',
      icon: <DollarSign className="w-5 h-5" />,
      gradient: '',
      permission: 'view_finance'
    },
    {
      id: 'banking',
      label: 'Système Bancaire',
      icon: <Shield className="w-5 h-5" />,
      gradient: '',
      permission: 'view_banking'
    },
    {
      id: 'kyc-management',
      label: 'Gestion KYC',
      icon: <FileCheck className="w-5 h-5" />,
      gradient: '',
      permission: 'view_kyc'
    },
    {
      id: 'wallet-transactions',
      label: 'Transactions Wallet',
      icon: <CreditCard className="w-5 h-5" />,
      gradient: '',
      permission: 'manage_wallet_transactions'
    },
    {
      id: 'users-management',
      label: 'Utilisateurs',
      icon: <Users className="w-5 h-5" />,
      gradient: '',
      permission: 'view_users'
    },
    {
      id: 'vendors-management',
      label: 'Vendeurs',
      icon: <Wallet className="w-5 h-5" />,
      gradient: '',
      permission: 'view_vendors'
    },
    {
      id: 'orders-management',
      label: 'Commandes',
      icon: <ArrowUpRight className="w-5 h-5" />,
      gradient: '',
      permission: 'view_orders'
    },
    {
      id: 'service-subscriptions',
      label: 'Abonnements Services',
      icon: <Sparkles className="w-5 h-5" />,
      gradient: '',
      permission: 'view_service_subscriptions',
      badge: 'Nouveau'
    },
    // --- Fin nouvelles fonctionnalités ---
    // Passerelle vers l'interface PDG filtrée : donne accès à TOUTES les permissions
    // accordées par le PDG (y compris celles sans module dédié ici : syndicat, agents,
    // paiements, id-normalization, etc.). Visible dès qu'au moins une permission est accordée.
    ...(Object.values(unifiedPermissions).some((v) => v === true)
      ? ([{
          id: 'pdg-access',
          label: 'Mes accès PDG',
          icon: <Shield className="w-5 h-5" />,
          gradient: '',
          external: '/pdg',
          badge: 'Accès',
        }] as NavItem[])
      : []),
    {
      id: 'create-user',
      label: 'Créer Utilisateur',
      icon: <UserPlus className="w-5 h-5" />,
      gradient: '',
      permission: 'create_users'
    },
    {
      id: 'my-users',
      label: 'Mes Utilisateurs',
      icon: <Users className="w-5 h-5" />,
      gradient: '',
      permission: 'manage_users'
    },
    {
      id: 'my-purchases',
      label: 'Mes Achats',
      icon: <ArrowUpRight className="w-5 h-5" />,
      gradient: ''
    },
    {
      id: 'sub-agents',
      label: 'Sous-Agents',
      icon: <Users className="w-5 h-5" />,
      gradient: '',
      badge: (agent.can_create_sub_agent || hasPermission('create_sub_agents')) ? undefined : 'Pro',
      disabled: !(agent.can_create_sub_agent || hasPermission('create_sub_agents')),
      permission: 'create_sub_agents'
    },
    {
      id: 'reports',
      label: 'Analytics',
      icon: <BarChart3 className="w-5 h-5" />,
      gradient: '',
      permission: 'view_reports'
    },
    {
      id: 'affiliate',
      label: 'Affiliation',
      icon: <Link2 className="w-5 h-5" />,
      gradient: '',
      badge: 'Nouveau'
    },
    {
      id: 'support',
      label: 'Support Technique',
      icon: <Headphones className="w-5 h-5" />,
      gradient: ''
    },
    {
      id: 'settings',
      label: 'Paramètres',
      icon: <Settings className="w-5 h-5" />,
      gradient: ''
    }
  ];

  // Filtrer les items selon les permissions
  const filteredNavItems = navItems.filter(item => {
    // Items sans permission requise: toujours visibles
    if (!item.permission) return true;
    // Sinon, vérifier la permission
    return hasPermission(item.permission);
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatCurrency = useFormatCurrency();

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
        <div className={cn("flex items-center gap-3", sidebarCollapsed && !isMobile && "hidden")}>
          <div className="relative">
            <div className="absolute inset-0 bg-[#04439e] rounded-xl blur-md opacity-70 animate-pulse" />
            <div className="relative p-2 bg-[#04439e] rounded-xl shadow-2xl">
              <Shield className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h1 className="font-bold text-white text-lg tracking-tight">Agent Pro</h1>
            <p className="text-[10px] text-[#ff4000] font-semibold tracking-wide">224SOLUTIONS</p>
          </div>
        </div>
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              "text-white/70 hover:text-white hover:bg-white/10",
              sidebarCollapsed && "mx-auto"
            )}
          >
            {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </Button>
        )}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Profile Section */}
      <div className={cn(
        "p-4 border-b border-white/10",
        sidebarCollapsed && !isMobile && "hidden"
      )}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-12 w-12 ring-2 ring-white/20 ring-offset-2 ring-offset-slate-900">
              <AvatarFallback className="bg-[#04439e] text-white font-bold">
                {getInitials(agent.name)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#ff4000] border-2 border-slate-900 rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{agent.name}</h3>
            <p className="text-xs text-white/50 truncate">{agent.email}</p>
          </div>
        </div>

        {/* Agent Code Badge */}
        <div className="flex items-center gap-2 mt-3">
          <Badge className="bg-white/10 text-white/90 hover:bg-white/20 border-0">
            <Zap className="w-3 h-3 mr-1 text-[#ff4000]" />
            {agent.agent_code}
          </Badge>
          <Badge className={cn(
            "border-0",
            agent.is_active
              ? "bg-[#ff4000]/20 text-[#ff4000]"
              : "bg-[#ff4000]/20 text-[#ff4000]"
          )}>
            {agent.is_active ? 'Actif' : 'Inactif'}
          </Badge>
        </div>

        {/* Wallet Balance Card */}
        <div className="mt-4 p-4 bg-gradient-to-br from-[#ff4000]/20 via-[#ff4000]/10 to-blue-500/10 rounded-xl border border-[#ff4000]/30 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/70 font-semibold uppercase tracking-wide">{t('agentLayoutProfessional.soldeDisponible')}</span>
            <div className="p-1.5 bg-[#ff4000]/20 rounded-lg">
              <CreditCard className="w-4 h-4 text-[#ff4000]" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">{formatCurrency(walletBalance)}</span>
            <span className="text-sm text-[#ff4000] font-semibold">{wallet?.currency || 'GNF'}</span>
          </div>
          {stats && stats.totalUsersCreated > 0 && (
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/10">
              <div className="p-1 bg-blue-500/20 rounded">
                <Users className="w-3 h-3 text-blue-400" />
              </div>
              <span className="text-xs text-white/80 font-medium">{stats.totalUsersCreated} utilisateurs créés</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = activeTab === item.id;
            const isDisabled = item.disabled;

            return (
              <TooltipProvider key={item.id} delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full h-12 transition-all duration-200",
                        sidebarCollapsed && !isMobile ? "justify-center px-3" : "justify-start gap-3 px-4",
                        isActive && !isDisabled && [
                          "bg-gradient-to-r text-white shadow-lg",
                          item.gradient
                        ],
                        !isActive && !isDisabled && [
                          "text-white/70 hover:text-white hover:bg-white/10"
                        ],
                        isDisabled && "opacity-40 cursor-not-allowed"
                      )}
                      onClick={() => {
                        if (isDisabled) return;
                        if (item.external) { setMobileMenuOpen(false); navigate(item.external); return; }
                        onTabChange(item.id);
                      }}
                      disabled={isDisabled}
                    >
                      <span className={cn(
                        "transition-transform",
                        isActive && "scale-110"
                      )}>
                        {item.icon}
                      </span>
                      {(!sidebarCollapsed || isMobile) && (
                        <>
                          <span className="flex-1 text-left font-medium text-sm">
                            {item.label}
                          </span>
                          {item.badge && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0 border-white/30 text-white/70">
                              {item.badge}
                            </Badge>
                          )}
                          {isActive && <ChevronRight className="w-4 h-4" />}
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  {sidebarCollapsed && !isMobile && (
                    <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
                      {item.label}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 space-y-1">
        <Button
          variant="ghost"
          className={cn(
            "w-full h-11 text-[#ff4000] hover:text-orange-300 hover:bg-[#ff4000]/10",
            sidebarCollapsed && !isMobile ? "justify-center px-3" : "justify-start gap-3 px-4"
          )}
          onClick={onSignOut}
        >
          <LogOut className="w-5 h-5" />
          {(!sidebarCollapsed || isMobile) && <span className="font-medium">{t('agentLayoutProfessional.deconnexion')}</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex fixed left-0 top-0 bottom-0 z-40 flex-col transition-all duration-300",
        sidebarCollapsed ? "w-20" : "w-72",
        "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        "lg:hidden fixed left-0 top-0 bottom-0 z-50 w-72 transform transition-transform duration-300",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 shadow-2xl"
      )}>
        <SidebarContent isMobile />
      </aside>

      {/* Main Content */}
      <main className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "lg:ml-20" : "lg:ml-72"
      )}>
        {/* Top Header - Mobile Optimized */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-2xl border-b border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-4 lg:px-6">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-700 hover:bg-slate-100 h-9 w-9"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Page Title - Mobile visible */}
            <div className="flex-1 mx-2 lg:mx-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-lg font-bold text-slate-900 truncate">
                  {navItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
                </h2>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-[10px] sm:text-xs hidden sm:inline-flex">
                  Pro
                </Badge>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 hidden lg:block">
                Agent {agent.agent_code} • Taux {agent.commission_rate}%
              </p>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Notification Bell */}
              <Button variant="ghost" size="icon" className="relative text-slate-600 hover:text-slate-900 hover:bg-slate-100 h-8 w-8 sm:h-9 sm:w-9">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-2 h-2 bg-[#ff4000] rounded-full animate-pulse shadow-lg shadow-[#ff4000]/50" />
              </Button>

              {/* Quick Stats Badge - Show on mobile too but compact */}
              <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-[#ff4000] rounded-full shadow-lg shadow-[#ff4000]/40 hover:shadow-xl transition-all cursor-pointer"
                   onClick={() => onTabChange('wallet')}>
                <Wallet className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                <span className="text-xs sm:text-sm font-bold text-white">
                  {formatCurrency(walletBalance)}
                </span>
              </div>

              {/* Profile Avatar */}
              <Avatar className="h-8 w-8 sm:h-9 sm:w-9 ring-2 ring-blue-500/20 shadow-md hover:ring-blue-500/40 transition-all cursor-pointer">
                <AvatarFallback className="bg-[#04439e] text-white text-xs sm:text-sm font-bold">
                  {getInitials(agent.name)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page Content - Mobile padding */}
        <div className="p-3 sm:p-4 lg:p-6 pb-20 sm:pb-6">
          {children}
        </div>
      </main>
    </div>
  );
}
