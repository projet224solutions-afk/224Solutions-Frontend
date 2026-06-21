import { useTranslation } from "@/hooks/useTranslation";
﻿import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users, TrendingUp, Package, ShoppingCart, Warehouse,
  Truck, UserPlus, LogOut, BarChart3, FileText,
  MessageSquare, Settings, Shield, Wallet, CreditCard, DollarSign,
  Menu, X, ChevronRight, Home
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { AgentProvider, type VendorAgent, type VendorAgentPermissions } from '@/contexts/AgentContext';
import { AgentModuleWrapper } from '@/components/vendor/AgentModuleWrapper';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// Import des modules fonctionnels du vendeur
import ProductManagement from '@/components/vendor/ProductManagement';
import OrderManagement from '@/components/vendor/OrderManagement';
import POSSystemWrapper from '@/components/vendor/POSSystemWrapper';
import { VendorAgentWalletView } from '@/components/vendor/VendorAgentWalletView';
import { VendorAnalyticsDashboard } from '@/components/vendor/VendorAnalyticsDashboard';
import InventoryManagement from '@/components/vendor/InventoryManagement';
import MultiWarehouseManagement from '@/components/vendor/MultiWarehouseManagement';
import ClientManagement from '@/components/vendor/ClientManagement';
import { VendorDeliveriesPanel } from '@/components/vendor/VendorDeliveriesPanel';
import PaymentManagement from '@/components/vendor/PaymentManagement';
import PaymentLinksManager from '@/components/vendor/PaymentLinksManager';
import SupportTickets from '@/components/vendor/SupportTickets';
const UniversalCommunicationHub = React.lazy(() => import('@/components/communication/UniversalCommunicationHub'));
import SupplierManagement from '@/components/vendor/SupplierManagement';
import ProspectManagement from '@/components/vendor/ProspectManagement';
import MarketingManagement from '@/components/vendor/MarketingManagement';
import ExpenseManagementDashboard from '@/components/vendor/ExpenseManagementDashboard';
import CommissionsManagement from '@/components/vendor/CommissionsManagement';
import AgentManagement from '@/components/vendor/AgentManagement';
import AffiliateManagement from '@/components/vendor/AffiliateManagement';
import { VendorDebtManagement } from '@/components/vendor/debts/VendorDebtManagement';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export default function VendorAgentInterface() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [agent, setAgent] = useState<VendorAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [vendorBusinessType, setVendorBusinessType] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canAccessPOS = vendorBusinessType !== 'digital' && vendorBusinessType !== 'online';

  useEffect(() => {
    if (!token) {
      toast.error(t('vendorAgentInterface.tokenDAccesManquant'));
      setLoading(false);
      return;
    }
    loadAgentData(token);
  }, [token]);

  const loadAgentData = async (accessToken: string) => {
    setLoading(true);
    try {
      const { data: agentData, error: agentError } = await supabase
        .from('vendor_agents')
        .select('*')
        .eq('access_token', accessToken)
        .maybeSingle();

      if (agentError) {
        toast.error(`Erreur base de données: ${agentError.message}`);
        return;
      }

      if (!agentData) {
        toast.error(t('vendorAgentInterface.agentNonTrouveVerifiezLe'));
        return;
      }

      if (!agentData.is_active) {
        toast.error(t('vendorAgentInterface.ceCompteAgentEstDesactive'));
        return;
      }

      const formattedAgent = {
        ...agentData,
        permissions: agentData.permissions as VendorAgentPermissions
      };
      setAgent(formattedAgent);

      const { data: vendorInfo } = await supabase
        .from('vendors')
        .select('business_type')
        .eq('id', agentData.vendor_id)
        .maybeSingle();
      setVendorBusinessType(vendorInfo?.business_type ?? null);

      toast.success(`Bienvenue ${agentData.name} !`);
    } catch (error: any) {
      toast.error(`Erreur: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('agent_session');
      localStorage.removeItem('agent_user');
      localStorage.removeItem('agent_token');
      sessionStorage.removeItem('agent_session');
      sessionStorage.removeItem('agent_user');
      await supabase.auth.signOut();
      toast.success(t('vendorAgentInterface.deconnexionReussie'));
      navigate('/auth', { replace: true });
    } catch (_error) {
      navigate('/auth', { replace: true });
    }
  };

  const hasPermission = (permission: string) => {
    return agent?.permissions?.[permission as keyof VendorAgentPermissions] || false;
  };

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  // Build navigation items
  const getNavItems = (): NavItem[] => {
    if (!agent) return [];
    const items: NavItem[] = [
      { id: 'overview', label: 'Vue d\'ensemble', icon: Home },
    ];

    if (hasPermission('view_dashboard')) items.push({ id: 'dashboard', label: 'Dashboard', icon: BarChart3 });
    if (hasPermission('view_analytics')) items.push({ id: 'analytics', label: 'Analytics', icon: TrendingUp });
    if (hasPermission('access_pos')) items.push({ id: 'pos', label: 'POS', icon: CreditCard, disabled: !canAccessPOS, disabledReason: 'Boutiques physiques uniquement' });
    if (hasPermission('manage_products')) items.push({ id: 'products', label: 'Produits', icon: Package });
    if (hasPermission('manage_orders')) items.push({ id: 'orders', label: 'Commandes', icon: ShoppingCart });
    if (hasPermission('manage_inventory')) items.push({ id: 'inventory', label: 'Inventaire', icon: Package });
    if (hasPermission('manage_warehouse')) items.push({ id: 'warehouse', label: 'Entrepôt', icon: Warehouse });
    if (hasPermission('manage_suppliers')) items.push({ id: 'suppliers', label: 'Fournisseurs', icon: Truck });
    if (hasPermission('manage_clients')) items.push({ id: 'clients', label: 'Clients', icon: Users });
    if (hasPermission('manage_prospects')) items.push({ id: 'prospects', label: 'Prospects', icon: UserPlus });
    if (hasPermission('manage_marketing')) items.push({ id: 'marketing', label: 'Marketing', icon: TrendingUp });
    if (hasPermission('manage_delivery')) items.push({ id: 'delivery', label: 'Livraisons', icon: Truck });
    if (hasPermission('access_wallet')) items.push({ id: 'wallet', label: 'Wallet', icon: Wallet });
    if (hasPermission('manage_payments')) items.push({ id: 'payments', label: 'Paiements', icon: CreditCard });
    if (hasPermission('manage_payment_links')) items.push({ id: 'payment_links', label: 'Liens Paiement', icon: DollarSign });
    if (hasPermission('manage_expenses')) items.push({ id: 'expenses', label: 'Dépenses', icon: FileText });
    if (hasPermission('manage_debts')) items.push({ id: 'debts', label: 'Dettes', icon: FileText });
    if (hasPermission('access_affiliate')) items.push({ id: 'affiliate', label: 'Affiliation', icon: Users });
    if (hasPermission('access_support')) items.push({ id: 'support', label: 'Support', icon: MessageSquare });
    if (hasPermission('access_communication')) items.push({ id: 'communication', label: 'Messages', icon: MessageSquare });
    if (hasPermission('view_reports')) items.push({ id: 'reports', label: 'Rapports', icon: FileText });
    if (hasPermission('view_reports')) items.push({ id: 'commissions', label: 'Commissions', icon: DollarSign });
    if (hasPermission('manage_agents') && agent.can_create_sub_agent) items.push({ id: 'sub_agents', label: 'Sous-Agents', icon: UserPlus });
    if (hasPermission('access_settings')) items.push({ id: 'settings', label: 'Paramètres', icon: Settings });

    return items;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-vendeur-primary/10 to-vendeur-secondary/10">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-vendeur-primary mx-auto" />
          <p className="text-muted-foreground">{t('vendorAgentInterface.chargementDeVotreEspaceAgent')}</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-vendeur-primary/10 to-vendeur-secondary/10 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('vendorAgentInterface.accesAgentVendeur')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Aucun profil agent trouvé avec ce lien d'accès.
            </p>
            <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
              <p className="font-medium">{t('vendorAgentInterface.verifiezQue')}</p>
              <ul className="list-disc list-inside text-left space-y-1 text-muted-foreground">
                <li>{t('vendorAgentInterface.leLienDAccesEst')}</li>
                <li>{t('vendorAgentInterface.votreCompteAgentEstActif')}</li>
                <li>{t('vendorAgentInterface.leLienNAPas')}</li>
              </ul>
            </div>
            <Button onClick={handleSignOut} className="w-full" variant="outline">
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const navItems = getNavItems();
  const activeNavItem = navItems.find(i => i.id === activeTab);
  const mobilePrimaryItems = ['overview', 'products', 'orders', 'wallet', 'commissions']
    .map(id => navItems.find(item => item.id === id))
    .filter(Boolean) as NavItem[];

  const NavigationContent = () => (
    <div className="flex flex-col h-full">
      {/* Agent info in sidebar */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-vendeur-primary/20 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-vendeur-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{agent.name}</p>
            <p className="text-xs text-muted-foreground truncate">{agent.agent_code}</p>
          </div>
        </div>
        <Badge variant="outline" className="mt-2 bg-orange-50 text-[#ff4000] border-orange-200 text-xs">
          Agent Actif
        </Badge>
      </div>

      {/* Nav items */}
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.disabled) {
                    toast.error(item.disabledReason || 'Non disponible');
                    return;
                  }
                  handleNavClick(item.id);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  "hover:bg-vendeur-primary/10",
                  active && "bg-vendeur-primary/15 text-vendeur-primary font-medium",
                  !active && "text-foreground/70",
                  item.disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0", active && "text-vendeur-primary")} />
                <span className="truncate">{item.label}</span>
                {item.disabled && <span className="ml-auto text-xs">🔒</span>}
                {active && <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0 text-vendeur-primary" />}
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Sign out */}
      <div className="p-3 border-t border-border/50">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('vendorAgentInterface.deconnexion')}</span>
        </button>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewContent agent={agent} hasPermission={hasPermission} canAccessPOS={canAccessPOS} onTabChange={handleNavClick} />;
      case 'dashboard':
        return <AgentModuleWrapper permission="view_dashboard"><VendorAnalyticsDashboard /></AgentModuleWrapper>;
      case 'products':
        return <AgentModuleWrapper permission="manage_products"><ProductManagement /></AgentModuleWrapper>;
      case 'orders':
        return <AgentModuleWrapper permission="manage_orders"><OrderManagement /></AgentModuleWrapper>;
      case 'wallet':
        return <AgentModuleWrapper permission="access_wallet"><VendorAgentWalletView vendorId={agent.vendor_id} agentName={agent.name} /></AgentModuleWrapper>;

      case 'pos':
        if (!hasPermission('access_pos')) {
          return <AgentModuleWrapper permission="access_pos"><POSSystemWrapper /></AgentModuleWrapper>;
        }
        if (canAccessPOS) {
          return <AgentModuleWrapper permission="access_pos"><POSSystemWrapper /></AgentModuleWrapper>;
        }
        return (
          <AgentModuleWrapper>
            <Card>
              <CardHeader>
                <CardTitle>POS non accessible</CardTitle>
                <CardDescription>
                  Le système de caisse (POS) est désactivé pour ce vendeur.<br />
                  <span className="text-sm text-muted-foreground">{t('vendorAgentInterface.motifNbspBoutiqueConfigureeEn')}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Si vous pensez qu'il s'agit d'une erreur ou souhaitez activer le POS, contactez le responsable ou cliquez sur le bouton ci-dessous.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      toast.info(t('vendorAgentInterface.demandeDActivationPosEnvoyee'));
                      // TODO: Envoyer une vraie demande d’activation (API/notification)
                    }}
                  >
                    Demander l’activation du POS
                  </Button>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-4">
                    <p className="text-xs text-blue-700">
                      Pour activer le POS, le vendeur doit être configuré comme boutique physique.<br />
                      Vérifiez les paramètres du vendeur ou contactez le support.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </AgentModuleWrapper>
        );
      case 'inventory':
        return <AgentModuleWrapper permission="manage_inventory"><InventoryManagement /></AgentModuleWrapper>;
      case 'warehouse':
        return <AgentModuleWrapper permission="manage_warehouse"><MultiWarehouseManagement /></AgentModuleWrapper>;
      case 'clients':
        return <AgentModuleWrapper permission="manage_clients"><ClientManagement /></AgentModuleWrapper>;
      case 'delivery':
        return <AgentModuleWrapper permission="manage_delivery"><VendorDeliveriesPanel /></AgentModuleWrapper>;
      case 'payments':
        return <AgentModuleWrapper permission="manage_payments"><PaymentManagement /></AgentModuleWrapper>;
      case 'payment_links':
        return <AgentModuleWrapper permission="manage_payment_links"><PaymentLinksManager /></AgentModuleWrapper>;
      case 'support':
        return <AgentModuleWrapper permission="access_support"><SupportTickets /></AgentModuleWrapper>;
      case 'communication':
        return <AgentModuleWrapper permission="access_communication"><UniversalCommunicationHub /></AgentModuleWrapper>;
      case 'suppliers':
        return <AgentModuleWrapper permission="manage_suppliers"><SupplierManagement /></AgentModuleWrapper>;
      case 'prospects':
        return <AgentModuleWrapper permission="manage_prospects"><ProspectManagement /></AgentModuleWrapper>;
      case 'marketing':
        return <AgentModuleWrapper permission="manage_marketing"><MarketingManagement /></AgentModuleWrapper>;
      case 'expenses':
        return <AgentModuleWrapper permission="manage_expenses"><ExpenseManagementDashboard /></AgentModuleWrapper>;
      case 'debts':
        return <AgentModuleWrapper permission="manage_debts"><VendorDebtManagement vendorId={agent.vendor_id} /></AgentModuleWrapper>;
      case 'analytics':
        return <AgentModuleWrapper permission="view_analytics"><VendorAnalyticsDashboard /></AgentModuleWrapper>;
      case 'affiliate':
        return <AgentModuleWrapper permission="access_affiliate"><AffiliateManagement /></AgentModuleWrapper>;
      case 'reports':
        return <AgentModuleWrapper permission="view_reports"><Card><CardHeader><CardTitle>Rapports & Analyses</CardTitle></CardHeader><CardContent><VendorAnalyticsDashboard /></CardContent></Card></AgentModuleWrapper>;
      case 'commissions':
        return <AgentModuleWrapper permission="view_reports"><CommissionsManagement /></AgentModuleWrapper>;
      case 'sub_agents':
        return <AgentModuleWrapper permission="manage_agents"><AgentManagement /></AgentModuleWrapper>;
      case 'settings':
        return <AgentModuleWrapper permission="access_settings"><Card><CardHeader><CardTitle>{t('vendorAgentInterface.parametresAgent')}</CardTitle><CardDescription>{t('vendorAgentInterface.configurezVosPreferences')}</CardDescription></CardHeader><CardContent><p className="text-muted-foreground">{t('vendorAgentInterface.parametresLimitesDisponiblesPourLes')}</p></CardContent></Card></AgentModuleWrapper>;
      default:
        return null;
    }
  };

  return (
    <AgentProvider agent={agent}>
      <div className="min-h-screen bg-vendeur-primary/5 to-vendeur-secondary/5">
        {/* === MOBILE LAYOUT === */}
        {isMobile ? (
          <div className="flex flex-col h-screen">
            {/* Mobile Header */}
            <header className="bg-background/95 backdrop-blur-md border-b border-border/50 sticky top-0 z-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72 p-0 max-h-[90vh] overflow-y-auto">
                    <NavigationContent />
                  </SheetContent>
                </Sheet>

                <div className="flex-1 text-center mx-2">
                  <h1 className="text-sm font-bold truncate">{activeNavItem?.label || 'Agent'}</h1>
                  <p className="text-[10px] text-muted-foreground truncate">{agent.name}</p>
                </div>

                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </header>

            {/* Mobile Content */}
            {activeTab === 'pos' ? (
              /* POS gère son propre scroll interne — pas d'overflow-y-auto ici */
              <div className="flex-1 min-h-0 overflow-hidden">
                {renderTabContent()}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto overscroll-y-contain">
                <div className="p-3 pb-20">
                  {renderTabContent()}
                </div>
              </div>
            )}

            {/* Mobile Bottom Nav - Hidden when POS is active (POS has its own tabs) */}
            {activeTab !== 'pos' && (
              <nav className="bg-background/95 backdrop-blur-md border-t border-border/50 px-2 py-1.5 safe-area-pb">
                <div className="flex items-center justify-around">
                  {mobilePrimaryItems.map(item => {
                    const active = activeTab === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={cn(
                          "flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg transition-colors min-w-0",
                          active ? "text-vendeur-primary" : "text-muted-foreground"
                        )}
                      >
                        <Icon className={cn("w-5 h-5", active && "text-vendeur-primary")} />
                        <span className="text-[10px] font-medium truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </nav>
            )}
          </div>
        ) : (
          /* === DESKTOP LAYOUT === */
          <div className="flex h-screen">
            {/* Desktop Sidebar */}
            <aside className="w-60 bg-background border-r border-border/50 flex-shrink-0">
              <NavigationContent />
            </aside>

            {/* Desktop Content */}
            <main className="flex-1 flex flex-col min-w-0">
              {/* Desktop Header */}
              <header className="bg-background border-b border-border/50 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold">{activeNavItem?.label || 'Espace Agent'}</h1>
                    <p className="text-sm text-muted-foreground">
                      {agent.name} • {agent.agent_code}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-orange-50 text-[#ff4000] border-orange-200">
                      Actif
                    </Badge>
                    <Button onClick={handleSignOut} variant="outline" size="sm">
                      <LogOut className="w-4 h-4 mr-2" />
                      Déconnexion
                    </Button>
                  </div>
                </div>
              </header>

              {/* Desktop Content — POS sans scroll parent, autres modules avec scroll */}
              {activeTab === 'pos' ? (
                /* POS gère son propre scroll interne — container borné sans overflow-y-auto ni padding */
                <div className="flex-1 min-h-0 overflow-hidden">
                  {renderTabContent()}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="p-6">
                    {renderTabContent()}
                  </div>
                </div>
              )}
            </main>
          </div>
        )}
      </div>
    </AgentProvider>
  );
}

/* --- Overview Content --- */
function OverviewContent({ agent, hasPermission, canAccessPOS, onTabChange }: {
  agent: VendorAgent;
  hasPermission: (p: string) => boolean;
  canAccessPOS: boolean;
  onTabChange: (tab: string) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const moduleButtons: { id: string; icon: React.ElementType; label: string; permission?: string; disabled?: boolean }[] = [
    hasPermission('view_dashboard') ? { id: 'dashboard', icon: BarChart3, label: 'Dashboard' } : null,
    hasPermission('access_pos') ? { id: 'pos', icon: CreditCard, label: canAccessPOS ? 'POS' : 'POS 🔒', disabled: !canAccessPOS } : null,
    hasPermission('manage_products') ? { id: 'products', icon: Package, label: 'Produits' } : null,
    hasPermission('manage_orders') ? { id: 'orders', icon: ShoppingCart, label: 'Commandes' } : null,
    hasPermission('manage_inventory') ? { id: 'inventory', icon: Package, label: 'Inventaire' } : null,
    hasPermission('manage_warehouse') ? { id: 'warehouse', icon: Warehouse, label: 'Entrepôt' } : null,
    hasPermission('manage_clients') ? { id: 'clients', icon: Users, label: 'Clients' } : null,
    hasPermission('manage_delivery') ? { id: 'delivery', icon: Truck, label: 'Livraisons' } : null,
    hasPermission('access_wallet') ? { id: 'wallet', icon: Wallet, label: 'Wallet' } : null,
    hasPermission('view_reports') ? { id: 'analytics', icon: FileText, label: 'Rapports' } : null,
    hasPermission('access_communication') ? { id: 'communication', icon: MessageSquare, label: 'Messages' } : null,
    hasPermission('manage_agents') ? { id: 'sub_agents', icon: UserPlus, label: 'Sous-Agents' } : null,
    hasPermission('view_reports') ? { id: 'commissions', icon: DollarSign, label: 'Commissions' } : null,
    hasPermission('access_settings') ? { id: 'settings', icon: Settings, label: 'Paramètres' } : null,
  ].filter(Boolean) as typeof moduleButtons;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Stats */}
      <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "grid-cols-4")}>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-vendeur-primary" />
              <span className="text-xs text-muted-foreground">Permissions</span>
            </div>
            <p className="text-xl md:text-2xl font-bold">{Object.values(agent.permissions).filter(Boolean).length}</p>
            <p className="text-[10px] text-muted-foreground">{t('vendorAgentInterface.accesActifs')}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="w-4 h-4 text-vendeur-secondary" />
              <span className="text-xs text-muted-foreground">Sous-Agents</span>
            </div>
            <p className="text-xl md:text-2xl font-bold">0</p>
            <p className="text-[10px] text-muted-foreground">{agent.can_create_sub_agent ? 'Autorisé' : 'Non autorisé'}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-[#ff4000]" />
              <span className="text-xs text-muted-foreground">Statut</span>
            </div>
            <p className="text-xl md:text-2xl font-bold">Actif</p>
            <p className="text-[10px] text-muted-foreground">{t('vendorAgentInterface.compteVerifie')}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Contact</span>
            </div>
            <p className="text-xs md:text-sm font-medium truncate">{agent.email}</p>
            <p className="text-[10px] text-muted-foreground truncate">{agent.phone}</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="bg-vendeur-primary/5 border-b p-3 md:p-4">
          <CardTitle className="text-sm md:text-base">{t('vendorAgentInterface.informationsDuCompte')}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Nom</p>
              <p className="text-sm font-semibold">{agent.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Code Agent</p>
              <p className="text-sm font-mono font-semibold text-vendeur-primary">{agent.agent_code}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Email</p>
              <p className="text-sm truncate">{agent.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{t('vendorAgentInterface.telephone')}</p>
              <p className="text-sm">{agent.phone}</p>
            </div>
            <div className={cn(isMobile ? "" : "col-span-2")}>
              <p className="text-xs text-muted-foreground mb-1.5">Permissions Actives</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(agent.permissions)
                  .filter(([_, value]) => value)
                  .map(([perm]) => (
                  <Badge
                    key={perm}
                    variant="secondary"
                    className="bg-vendeur-primary/10 text-vendeur-primary border-vendeur-primary/20 text-[10px] px-2 py-0.5"
                  >
                    {perm.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modules */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="bg-vendeur-primary/5 border-b p-3 md:p-4">
          <CardTitle className="text-sm md:text-base">Modules Disponibles</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <div className={cn("grid gap-2 md:gap-3", isMobile ? "grid-cols-3" : "grid-cols-4 lg:grid-cols-6")}>
            {moduleButtons.map((mod) => (
              <Button
                key={mod.id}
                variant="outline"
                className={cn(
                  "flex flex-col gap-1.5 h-auto py-3 px-2",
                  mod.disabled && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => {
                  if (mod.disabled) {
                    toast.error(t('vendorAgentInterface.posVerrouilleVendeurEnLigne'));
                    return;
                  }
                  onTabChange(mod.id);
                }}
              >
                <mod.icon className="h-5 w-5" />
                <span className="text-[10px] md:text-xs text-center leading-tight">{mod.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
