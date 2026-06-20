/**
 * SIDEBAR VENDEUR DIGITAL - Interface dédiée produits numériques & affiliations
 * Uniquement les fonctionnalités pertinentes pour le vendeur digital
 */

import { memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Laptop, Link, Wallet, Settings,
  BarChart3, Home, Plus, Eye, ShoppingBag, Bot, DollarSign, Megaphone, Crown
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
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useMerchantDigitalProducts } from "@/hooks/useDigitalProducts";

const DigitalVendorSidebar = memo(function DigitalVendorSidebar() {
  const { state, setOpen, isMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = state === "collapsed" && !isMobile;
  const { products } = useMerchantDigitalProducts();

  const currentPath = location.pathname.replace('/vendeur-digital/', '').replace('/vendeur-digital', '') || 'dashboard';

  const isActive = (path: string) => currentPath === path;

  const handleNavigation = (path: string) => {
    navigate(`/vendeur-digital/${path}`);
    if (isMobile) setOpen(false);
  };

  const publishedCount = products.filter(p => p.status === 'published').length;
  const affiliateCount = products.filter(p => p.product_mode === 'affiliate').length;

  const menuSections = [
    {
      label: "Vue d’ensemble",
      items: [
        { title: "Tableau de bord", icon: LayoutDashboard, path: "dashboard" },
        { title: "Catalogue", icon: Laptop, path: "products", badge: products.length > 0 ? products.length.toString() : null },
        { title: "Ajouter un produit", icon: Plus, path: "add-product" },
      ]
    },
    {
      label: "Croissance",
      items: [
        { title: "Statistiques", icon: BarChart3, path: "analytics" },
        { title: "Campagnes", icon: Megaphone, path: "campaigns" },
        { title: "Affiliation", icon: Link, path: "affiliate", badge: affiliateCount > 0 ? affiliateCount.toString() : null },
        { title: "Liens de paiement", icon: DollarSign, path: "payment-links" },
        { title: "Explorer le marché", icon: Eye, path: "marketplace" },
      ]
    },
    {
      label: "Finance",
      items: [
        { title: "Portefeuille", icon: Wallet, path: "wallet" },
        { title: "Abonnement", icon: Crown, path: "subscription" },
      ]
    },
    {
      label: "Outils",
      items: [
        { title: "Copilote IA", icon: Bot, path: "copilot" },
        { title: "Mes achats", icon: ShoppingBag, path: "my-purchases" },
        { title: "Paramètres", icon: Settings, path: "settings" },
      ]
    },
  ];

  return (
    <Sidebar className={cn(
      collapsed ? "w-[78px]" : "w-[290px]",
      "border-r-0 bg-[#04439e] shadow-[4px_0_32px_rgba(4,67,158,0.38)]"
    )} collapsible="icon">
      <ScrollArea className="h-full overflow-visible">
        <SidebarContent className="bg-transparent py-4 pr-0 pb-28">
          {/* Logo / Brand */}
          <div className={cn("px-3", collapsed ? "mb-3" : "mb-5")}>
            <div className={cn(
              "rounded-[20px] border border-white/15 bg-white/10",
              collapsed ? "px-2 py-3" : "px-4 py-4"
            )}>
              <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
                  <Laptop className="w-5 h-5 text-white" />
                </div>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold tracking-[0.02em] text-white">Cockpit vendeur digital</h2>
                    <p className="mt-1 text-xs text-white/55">{publishedCount} produit{publishedCount !== 1 ? 's' : ''} publié{publishedCount !== 1 ? 's' : ''}</p>
                  </div>
                )}
              </div>
              {!collapsed && (
                <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-white/10 px-3 py-2.5">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">Activité boutique</p>
                    <p className="text-sm font-semibold text-white">{products.length} références digitales</p>
                  </div>
                  <Badge className="inline-flex min-w-[92px] items-center justify-center whitespace-nowrap border-0 bg-[#ff4000] px-2.5 py-1 text-center text-[11px] font-semibold text-white shadow-none">
                    {affiliateCount} affiliation{affiliateCount > 1 ? 's' : ''}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {menuSections.map((section, sectionIndex) => (
            <SidebarGroup key={section.label} className="py-1 px-2">
              {!collapsed && (
                <SidebarGroupLabel className="px-4 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/38">
                  {section.label}
                </SidebarGroupLabel>
              )}

              {collapsed && sectionIndex > 0 && (
                <div className="mx-3 my-3 h-px bg-white/15" />
              )}

              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5 px-1">
                  {section.items.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => handleNavigation(item.path)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') handleNavigation(item.path);
                          }}
                          className={cn(
                            "group relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200 cursor-pointer select-none overflow-hidden",
                            active
                              ? "bg-white text-[#04439e] font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.14)]"
                              : "text-white/80 hover:bg-white/12 hover:text-white",
                            collapsed && "justify-center px-2"
                          )}
                        >
                          {/* Barre orange animée sur hover */}
                          {!active && (
                            <div className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-[#ff4000] -translate-x-full transition-transform duration-200 group-hover:translate-x-0" />
                          )}

                          <div className={cn(
                            "flex items-center justify-center rounded-xl w-9 h-9 transition-all flex-shrink-0",
                            active
                              ? "bg-[#04439e] text-white shadow-[0_6px_16px_rgba(4,67,158,0.35)]"
                              : "bg-white/12 text-white/75 group-hover:bg-[#ff4000]/22 group-hover:text-[#ff6633]"
                          )}>
                            <item.icon className="w-4 h-4 transition-colors" />
                          </div>

                          {!collapsed && (
                            <>
                              <span className="flex-1 text-left leading-tight">{item.title}</span>
                              {item.badge && (
                                <Badge className={cn(
                                  "h-5 min-w-[28px] flex items-center justify-center rounded-full border-0 px-2 py-0 text-[10px] font-semibold shadow-none",
                                  active ? "bg-[#ff4000] text-white" : "bg-white/18 text-white"
                                )}>
                                  {item.badge}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}

          {/* Bouton retour accueil */}
          {!collapsed && (
            <div className="px-3 mt-4">
              <div
                role="button"
                tabIndex={0}
                onClick={() => navigate('/home')}
                className="group relative flex items-center gap-2 rounded-2xl border border-white/18 bg-white/8 px-3 py-3 text-sm font-medium text-white/60 transition-all cursor-pointer hover:bg-white/15 hover:text-white overflow-hidden"
              >
                <div className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-[#ff4000] -translate-x-full transition-transform duration-200 group-hover:translate-x-0" />
                <Home className="w-4 h-4 flex-shrink-0" />
                <span>Retour à l'accueil</span>
              </div>
            </div>
          )}
        </SidebarContent>
      </ScrollArea>
    </Sidebar>
  );
});

export { DigitalVendorSidebar };
export default DigitalVendorSidebar;
