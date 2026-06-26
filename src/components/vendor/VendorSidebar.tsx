/**
 * SIDEBAR VENDEUR PROFESSIONNELLE - 224SOLUTIONS
 * Navigation complète avec contrôle d'accès par abonnement
 * @version 4.1.0 - Affichage conditionnel produits numériques
 */

import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Package, ShoppingCart, Users, BarChart3, CreditCard,
  Wallet, Receipt, Truck, Megaphone, FileText, Settings,
  Target, TrendingUp, Box, MessageSquare, HeadphonesIcon,
  Store, DollarSign, Boxes, AlertTriangle, Link, Building2,
  LayoutDashboard, ChevronRight, Star, Smartphone, Bot, Lock, MessagesSquare, Briefcase, Laptop, ShieldCheck, Undo2
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useVendorBadges } from "@/hooks/useVendorBadges";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSubscriptionFeatures, MODULE_FEATURE_MAP, SubscriptionFeature } from "@/hooks/useSubscriptionFeatures";
import { UpgradeDialog } from "@/components/subscription/UpgradeDialog";
import { useTranslation } from "@/hooks/useTranslation";
import { useHasDigitalProducts } from "@/hooks/useHasDigitalProducts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PLAN_BADGE_COLORS: Record<string, string> = {
  'basic': 'bg-blue-500',
  'pro': 'bg-[#04439e]',
  'business': 'bg-orange-500',
  'premium': 'bg-[#ff4000]',
};

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  'basic': 'Basic',
  'pro': 'Pro',
  'business': 'Business',
  'premium': 'Premium',
};

export function VendorSidebar() {
  const { state, setOpen, isMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const currentPath = location.pathname.split('/').pop() || 'dashboard';
  const collapsed = state === "collapsed" && !isMobile;
  const { badges, loading: badgesLoading } = useVendorBadges();
  const { canAccessModule, getMinPlanForFeature, loading: subscriptionLoading } = useSubscriptionFeatures();
  const { hasProducts: hasDigitalProducts, loading: digitalProductsLoading } = useHasDigitalProducts();

  // State pour le dialog d'upgrade
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [targetFeature, setTargetFeature] = useState<SubscriptionFeature | undefined>();
  const [targetModuleName, setTargetModuleName] = useState<string | undefined>();

  const linkedPaths = ['products', 'inventory'];
  const isActive = (path: string) => {
    if (linkedPaths.includes(path) && linkedPaths.includes(currentPath)) {
      return true;
    }
    return currentPath === path;
  };

  const getBadgeValue = (path: string): string | null => {
    if (badgesLoading) return null;

    switch (path) {
      case 'pos':
        return 'HOT'; // Badge HOT permanent pour le POS
      case 'products':
        return badges.totalProducts > 0 ? badges.totalProducts.toString() : null;
      case 'inventory':
        return badges.lowStockProducts > 0 ? badges.lowStockProducts.toString() : null;
      case 'orders':
        return badges.pendingOrders > 0 ? badges.pendingOrders.toString() : null;
      case 'expenses':
        return badges.unreadExpenseAlerts > 0 ? badges.unreadExpenseAlerts.toString() : null;
      default:
        return null;
    }
  };

  const handleNavigation = (path: string, title: string) => {
    const feature = MODULE_FEATURE_MAP[path];
    const hasAccess = !feature || canAccessModule(path);

    if (hasAccess) {
      navigate(`/vendeur/${path}`);
      if (isMobile) {
        setOpen(false);
      }
    } else {
      // Afficher le dialog d'upgrade
      setTargetFeature(feature);
      setTargetModuleName(title);
      setUpgradeDialogOpen(true);
    }
  };

  const getRequiredPlan = (path: string): string | null => {
    const feature = MODULE_FEATURE_MAP[path];
    if (!feature) return null;
    return getMinPlanForFeature(feature);
  };

  // Construire les items de commerce conditionnellement
  const commerceItems = useMemo(() => {
    const items = [
      { title: t('sidebar.products'), icon: Package, path: "products" },
    ];

    // Afficher "Produits Numériques" seulement si le vendeur en a créé
    if (hasDigitalProducts) {
      items.push({ title: t('vendorSidebar.produitsNumeriques'), icon: Laptop, path: "digital-products" });
    }

    items.push(
      { title: t('sidebar.orders'), icon: ShoppingCart, path: "orders" },
      { title: t('sidebar.inventory'), icon: Box, path: "inventory" },
      { title: "Ajustements Stock", icon: AlertTriangle, path: "stock-adjustments" },
      { title: t('sidebar.warehouses'), icon: Boxes, path: "warehouse" },
      { title: t('sidebar.suppliers'), icon: Building2, path: "suppliers" },
    );

    return items;
  }, [t, hasDigitalProducts]);

  const menuSections = [
    {
      label: t('sidebar.principal'),
      icon: LayoutDashboard,
      items: [
        { title: t('sidebar.dashboard'), icon: BarChart3, path: "dashboard" },
        { title: t('sidebar.analytics'), icon: TrendingUp, path: "analytics" },
        { title: t('sidebar.pos'), icon: Store, path: "pos", isPOS: true },
        { title: t('vendorSidebar.moduleMetier'), icon: Briefcase, path: "service-module" },
      ]
    },
    {
      label: t('sidebar.commerce'),
      icon: Package,
      items: commerceItems
    },
    {
      label: t('sidebar.crm'),
      icon: Users,
      items: [
        { title: t('sidebar.clients'), icon: Users, path: "clients" },
        { title: t('sidebar.agents'), icon: Users, path: "agents" },
        { title: t('sidebar.prospects'), icon: Target, path: "prospects" },
        { title: t('sidebar.marketing'), icon: Megaphone, path: "marketing" },
        { title: "Campagnes", icon: Megaphone, path: "campaigns" },
      ]
    },
    {
      label: t('sidebar.finance'),
      icon: Wallet,
      items: [
        { title: t('sidebar.wallet'), icon: Wallet, path: "wallet" },
        { title: "Comptes Encaissement", icon: Wallet, path: "accounts" },
        { title: t('sidebar.virtualCard'), icon: Smartphone, path: "virtual-card" },
        { title: t('sidebar.quotesInvoices'), icon: FileText, path: "quotes-invoices" },
        { title: t('sidebar.payments'), icon: CreditCard, path: "payments" },
        { title: "Escrow & Litiges", icon: ShieldCheck, path: "escrow" },
        { title: "Retours", icon: Undo2, path: "returns" },
        { title: t('vendorSidebar.paiementsEchelonnes'), icon: CreditCard, path: "installments" },
        { title: t('vendorSidebar.ventesAvancees'), icon: ShoppingCart, path: "advanced-sales" },
        { title: t('sidebar.paymentLinks'), icon: DollarSign, path: "payment-links" },
        { title: t('sidebar.expenses'), icon: Receipt, path: "expenses" },
        { title: t('sidebar.debts'), icon: AlertTriangle, path: "debts" },
        { title: t('sidebar.contracts'), icon: FileText, path: "contracts" },
        { title: t('sidebar.affiliate'), icon: Link, path: "affiliate" },
      ]
    },
    {
      label: t('sidebar.services'),
      icon: Truck,
      items: [
        { title: "Mes Achats", icon: ShoppingCart, path: "my-purchases" },
        { title: t('sidebar.deliveries'), icon: Truck, path: "delivery" },
        { title: t('sidebar.ratings'), icon: Star, path: "ratings" },
        { title: "Avis Clients", icon: MessagesSquare, path: "reviews" },
        { title: t('sidebar.support'), icon: HeadphonesIcon, path: "support" },
        { title: t('sidebar.messages'), icon: MessageSquare, path: "communication" },
        { title: t('sidebar.reports'), icon: FileText, path: "reports" },
      ]
    },
    {
      label: t('sidebar.system'),
      icon: Settings,
      items: [
        { title: t('sidebar.aiCopilot'), icon: Bot, path: "copilote" },
        { title: t('sidebar.settings'), icon: Settings, path: "settings" },
      ]
    }
  ];

  return (
    <TooltipProvider>
      <Sidebar className={cn(
        collapsed ? "w-12" : "w-52",
        "border-r border-white/10 shadow-lg bg-[hsl(220,96%,32%)]"
      )} collapsible="icon">
        <ScrollArea className="h-full pr-4 overflow-visible">
          <SidebarContent className="bg-transparent py-2 pr-3 pb-96 text-white">
            {menuSections.map((section, sectionIndex) => (
              <SidebarGroup key={section.label} className="py-1">
                {!collapsed && (
                  <SidebarGroupLabel className="flex items-center gap-2 text-[10px] font-semibold text-white/50 uppercase tracking-widest px-4 py-1.5 mb-1">
                    <section.icon className="w-3 h-3" />
                    {section.label}
                  </SidebarGroupLabel>
                )}

                {collapsed && sectionIndex > 0 && (
                  <div className="h-px bg-white/15 mx-2 my-2" />
                )}

                <SidebarGroupContent>
                  <SidebarMenu className="space-y-0.5 px-2">
                    {section.items.map((item: { title: string; icon: any; path: string; isPOS?: boolean }) => {
                      const badgeValue = getBadgeValue(item.path);
                      const active = isActive(item.path);
                      const isPOS = item.isPOS;
                      const hasAccess = subscriptionLoading ? true : canAccessModule(item.path);
                      const requiredPlan = getRequiredPlan(item.path);

                      const menuItem = (
                        <SidebarMenuItem key={item.path}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleNavigation(item.path, item.title);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleNavigation(item.path, item.title);
                              }
                            }}
                            className={cn(
                              "group relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-all duration-200 cursor-pointer select-none text-white/80",
                              hasAccess && "hover:bg-white/10 hover:text-white",
                              !hasAccess && "opacity-50 hover:opacity-70",
                              active && hasAccess && "bg-white/15 text-white font-medium shadow-sm",
                              isPOS && hasAccess && "bg-gradient-to-r from-accent/20 to-transparent border border-accent/30",
                              isPOS && active && hasAccess && "from-accent/30 border-accent/50 shadow-md",
                              collapsed && "justify-center px-1"
                            )}
                          >
                            {/* Icône */}
                            <div className={cn(
                              "flex items-center justify-center rounded-md transition-all flex-shrink-0",
                              isPOS && hasAccess ? "w-6 h-6 bg-accent shadow-sm" : "w-5 h-5",
                              active && !isPOS && hasAccess && "bg-white/10",
                              !hasAccess && "grayscale",
                              collapsed && isPOS && "w-5 h-5"
                            )}>
                              <item.icon className={cn(
                                "w-3.5 h-3.5 transition-colors",
                                isPOS && hasAccess ? "text-white" : "",
                                active && !isPOS && hasAccess && "text-white",
                                !active && !isPOS && hasAccess && "text-white/60 group-hover:text-white",
                                !hasAccess && "text-white/40"
                              )} />
                            </div>

                            {/* Texte et Badge */}
                            {!collapsed && (
                              <>
                                <span className={cn(
                                  "flex-1 text-left leading-tight",
                                  isPOS && hasAccess && "font-semibold",
                                  !hasAccess && "text-white/40"
                                )}>
                                  {item.title}
                                </span>

                                {/* Badge de contenu */}
                                {badgeValue && hasAccess && (
                                  <Badge
                                    variant={badgeValue === "HOT" ? "destructive" : "secondary"}
                                    className={cn(
                                      "text-[10px] px-2 py-0.5 h-5 min-w-[24px] flex items-center justify-center flex-shrink-0 mr-3 font-bold",
                                      isPOS && "bg-accent text-white border-0 animate-pulse shadow-md"
                                    )}
                                  >
                                    {badgeValue}
                                  </Badge>
                                )}

                                {/* Icône de verrouillage si pas accès */}
                                {!hasAccess && requiredPlan && (
                                  <div className="flex items-center gap-1">
                                    <Lock className="w-3 h-3 text-white/40" />
                                    <Badge
                                      className={cn(
                                        "text-[8px] px-1 py-0 h-4 text-white flex-shrink-0",
                                        PLAN_BADGE_COLORS[requiredPlan] || 'bg-gray-500'
                                      )}
                                    >
                                      {PLAN_DISPLAY_NAMES[requiredPlan] || requiredPlan}
                                    </Badge>
                                  </div>
                                )}

                                {active && hasAccess && (
                                  <ChevronRight className="w-3 h-3 text-primary/60 flex-shrink-0" />
                                )}
                              </>
                            )}

                            {/* Badge en mode collapsed */}
                            {collapsed && !hasAccess && (
                              <Lock className="absolute -top-1 -right-1 w-3 h-3 text-muted-foreground bg-background rounded-full p-0.5" />
                            )}

                            {collapsed && badgeValue && hasAccess && (
                              <span className={cn(
                                "absolute -top-1 -right-1 w-4 h-4 rounded-full text-[8px] flex items-center justify-center font-bold",
                                badgeValue === "HOT"
                                  ? "bg-[#ff4000] text-white animate-pulse"
                                  : "bg-primary text-primary-foreground"
                              )}>
                                {badgeValue === "HOT" ? "!" : badgeValue.length > 2 ? "+" : badgeValue}
                              </span>
                            )}
                          </div>
                        </SidebarMenuItem>
                      );

                      // Tooltip pour les items verrouillés en mode collapsed
                      if (collapsed && !hasAccess) {
                        return (
                          <Tooltip key={item.path}>
                            <TooltipTrigger asChild>
                              {menuItem}
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <p className="font-medium">{item.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {t('sidebar.requires')} {PLAN_DISPLAY_NAMES[requiredPlan || ''] || 'un abonnement supérieur'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }

                      return menuItem;
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
        </ScrollArea>
      </Sidebar>

      {/* Dialog d'upgrade */}
      <UpgradeDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        feature={targetFeature}
        moduleName={targetModuleName}
      />
    </TooltipProvider>
  );
}
