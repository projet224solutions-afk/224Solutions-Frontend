/**
 * SIDEBAR AGENT - 224SOLUTIONS
 * Navigation latérale professionnelle pour l'interface agent
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Wallet, Users, UserPlus, UserCog, BarChart3,
  DollarSign, Package, Home, ChevronLeft, ChevronRight,
  Key, LogOut, Shield, Menu, Link2,
  TrendingUp, CreditCard, Store, ShoppingCart, Sparkles, FileCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AgentSidebarProps {
  agent: {
    name: string;
    agent_code: string;
    type_agent?: string;
    is_active: boolean;
    permissions: string[];
    can_create_sub_agent?: boolean;
  };
  activeSection: string;
  onSectionChange: (section: string) => void;
  onChangePassword: () => void;
  onLogout: () => void;
  // Nouvelle prop pour les permissions unifiées
  unifiedPermissions?: Record<string, boolean>;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  badge?: string;
  gradient?: string;
}

export default function AgentSidebar({
  agent,
  activeSection,
  onSectionChange,
  onChangePassword,
  onLogout,
  unifiedPermissions = {}
}: AgentSidebarProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  const hasPermission = (permission: string): boolean => {
    if (unifiedPermissions[permission] === true) return true;
    if (agent.permissions.includes(permission)) return true;

    // manage_* implique view_*
    if (permission.startsWith('view_')) {
      const manageKey = permission.replace('view_', 'manage_');
      if (unifiedPermissions[manageKey] === true || agent.permissions.includes(manageKey)) return true;
    }

    // Aliases spécifiques
    const aliases: Record<string, string[]> = {
      view_finance: ['manage_finance'],
      view_banking: ['manage_banking', 'manage_finance', 'view_finance'],
      view_kyc: ['manage_kyc', 'manage_vendor_kyc'],
      manage_wallet_transactions: ['manage_finance', 'manage_banking', 'view_banking', 'view_finance'],
      view_vendors: ['manage_vendors', 'manage_vendor_kyc'],
      view_orders: ['manage_orders'],
      view_service_subscriptions: ['manage_service_subscriptions', 'manage_service_plans'],
    };

    return (aliases[permission] || []).some(
      k => unifiedPermissions[k] === true || agent.permissions.includes(k)
    );
  };

  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Tableau de bord',
      icon: Home,
      gradient: ''
    },
    {
      id: 'wallet',
      label: 'Wallet',
      icon: Wallet,
      gradient: ''
    },
    {
      id: 'create-user',
      label: 'Créer Utilisateur',
      icon: UserPlus,
      permission: 'create_users',
      gradient: ''
    },
    {
      id: 'sub-agents',
      label: 'Sous-Agents',
      icon: UserCog,
      permission: 'create_sub_agents',
      gradient: ''
    },
    {
      id: 'users',
      label: 'Utilisateurs',
      icon: Users,
      permission: 'manage_users',
      gradient: ''
    },
    {
      id: 'products',
      label: 'Produits',
      icon: Package,
      permission: 'manage_products',
      gradient: ''
    },
    {
      id: 'reports',
      label: 'Rapports',
      icon: BarChart3,
      permission: 'view_reports',
      gradient: ''
    },
    {
      id: 'commissions',
      label: 'Commissions',
      icon: DollarSign,
      permission: 'manage_commissions',
      gradient: ''
    },
    {
      id: 'finance',
      label: 'Finance',
      icon: TrendingUp,
      permission: 'view_finance',
      gradient: ''
    },
    {
      id: 'banking',
      label: 'Système Bancaire',
      icon: Shield,
      permission: 'view_banking',
      gradient: ''
    },
    {
      id: 'wallet-transactions',
      label: 'Transactions Wallet',
      icon: CreditCard,
      permission: 'manage_wallet_transactions',
      gradient: ''
    },
    {
      id: 'kyc-management',
      label: 'Gestion KYC',
      icon: FileCheck,
      permission: 'view_kyc',
      gradient: ''
    },
    {
      id: 'vendors-management',
      label: 'Vendeurs',
      icon: Store,
      permission: 'view_vendors',
      gradient: ''
    },
    {
      id: 'orders-management',
      label: 'Commandes',
      icon: ShoppingCart,
      permission: 'view_orders',
      gradient: ''
    },
    {
      id: 'service-subscriptions',
      label: 'Abonnements Services',
      icon: Sparkles,
      permission: 'view_service_subscriptions',
      gradient: ''
    },
    {
      id: 'affiliate',
      label: 'Affiliation',
      icon: Link2,
      gradient: '',
      badge: 'Nouveau'
    }
  ];

  const filteredNavItems = navItems.filter(item => {
    // Toujours afficher les items sans permission requise
    if (!item.permission) return true;

    // Pour les sous-agents, vérifier plusieurs permissions
    if (item.id === 'sub-agents') {
      return agent.can_create_sub_agent || hasPermission('create_sub_agents') || hasPermission('manage_agents');
    }

    // Vérifier la permission spécifique
    const hasPerm = hasPermission(item.permission);
    console.log(`📋 Item "${item.label}" - permission "${item.permission}": ${hasPerm}`);
    return hasPerm;
  });

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-blue-600 text-white rounded-lg shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full bg-slate-900 text-white shadow-2xl transition-all duration-300 z-40 flex flex-col",
          collapsed ? "w-20" : "w-72",
          "lg:relative lg:translate-x-0",
          collapsed ? "-translate-x-full lg:translate-x-0" : "translate-x-0"
        )}
      >
        {/* Header */}
        <div className={cn(
          "p-4 border-b border-slate-700/50",
          collapsed ? "px-2" : ""
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "bg-[#04439e] rounded-xl flex items-center justify-center shadow-lg",
              collapsed ? "w-12 h-12" : "w-14 h-14"
            )}>
              <Shield className={cn("text-white", collapsed ? "w-6 h-6" : "w-8 h-8")} />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-lg truncate">{agent.name}</h2>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-slate-700/50 px-2 py-0.5 rounded text-blue-300">
                    {agent.agent_code}
                  </code>
                </div>
                {agent.type_agent && (
                  <p className="text-xs text-slate-400 mt-1 truncate">{agent.type_agent}</p>
                )}
              </div>
            )}
          </div>

          {!collapsed && (
            <Badge
              variant={agent.is_active ? "default" : "secondary"}
              className={cn(
                "mt-3 w-full justify-center",
                agent.is_active ? "bg-[#ff4000]/20 text-orange-300 border-[#ff4000]/30" : ""
              )}
            >
              {agent.is_active ? '✅ Agent Actif' : '⏸️ Inactif'}
            </Badge>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group",
                  isActive
                    ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg`
                    : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center rounded-lg transition-all",
                  isActive ? "bg-white/20" : "bg-slate-700/50 group-hover:bg-slate-600/50",
                  collapsed ? "w-10 h-10" : "w-10 h-10"
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                {!collapsed && (
                  <span className="font-medium text-sm">{item.label}</span>
                )}
                {!collapsed && item.badge && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-700/50 space-y-2">
          <Button
            variant="ghost"
            onClick={onChangePassword}
            className={cn(
              "w-full justify-start text-slate-300 hover:text-white hover:bg-slate-700/50",
              collapsed ? "px-3" : ""
            )}
          >
            <Key className="w-5 h-5" />
            {!collapsed && <span className="ml-3">{t('agentSidebar.motDePasse')}</span>}
          </Button>

          <Button
            variant="ghost"
            onClick={onLogout}
            className={cn(
              "w-full justify-start text-[#ff4000] hover:text-orange-300 hover:bg-[#ff4000]/10",
              collapsed ? "px-3" : ""
            )}
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span className="ml-3">{t('agentSidebar.deconnexion')}</span>}
          </Button>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-700 rounded-full items-center justify-center text-slate-300 hover:text-white hover:bg-slate-600 shadow-lg border border-slate-600"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Mobile Overlay */}
      {!collapsed && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setCollapsed(true)}
        />
      )}
    </>
  );
}
