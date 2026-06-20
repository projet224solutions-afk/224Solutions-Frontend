/**
 * Composant d'affichage des permissions d'un agent
 * Affiche TOUTES les permissions groupées par catégories avec état actif/inactif
 */

import { Badge } from '@/components/ui/badge';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Shield, DollarSign, Users, Briefcase, Settings, Brain, ChevronDown, Check, X, Store } from 'lucide-react';
import {
  PERMISSION_CATEGORIES,
  getPermissionLabel,
  countActivePermissions
} from '@/constants/agentPermissionCategories';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  finance: DollarSign,
  gestion: Users,
  services_pro: Store,
  operations: Briefcase,
  systeme: Settings,
  intelligence: Brain,
  special: Shield,
};

interface AgentPermissionsDisplayProps {
  permissions: Record<string, boolean>;
  loading?: boolean;
  compact?: boolean;
  showAllPermissions?: boolean; // Nouveau: afficher toutes les permissions ou seulement les actives
  className?: string;
}

export function AgentPermissionsDisplay({
  permissions,
  loading = false,
  compact = false,
  showAllPermissions = true, // Par défaut, affiche toutes les permissions
  className
}: AgentPermissionsDisplayProps) {
  const { t } = useTranslation();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(PERMISSION_CATEGORIES.map(cat => [cat.key, true]))
  );

  if (loading) {
    return (
      <Card className={cn("border-0 shadow-lg", className)}>
        <CardContent className="py-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">{t('agentPermissionsDisplay.chargementDesPermissions')}</p>
        </CardContent>
      </Card>
    );
  }

  const totalActive = countActivePermissions(permissions);
  const totalPermissions = PERMISSION_CATEGORIES.reduce((acc, cat) => acc + cat.permissions.length, 0);

  const toggleCategory = (key: string) => {
    setOpenCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (compact) {
    // Mode compact: affiche seulement les permissions actives
    const activeByCategory = PERMISSION_CATEGORIES.map((category) => ({
      category,
      activePermissions: category.permissions.filter((perm) => permissions[perm] === true),
    })).filter((item) => item.activePermissions.length > 0);

    if (activeByCategory.length === 0) {
      return (
        <div className={cn("text-sm text-muted-foreground", className)}>
          Aucune permission active.
        </div>
      );
    }

    return (
      <div className={cn("space-y-3", className)}>
        {activeByCategory.map(({ category, activePermissions }) => {
          const Icon = CATEGORY_ICONS[category.key] || Shield;
          return (
            <div key={category.key} className="space-y-2">
              <div className={cn("flex items-center gap-2 text-sm font-semibold", category.colorClass)}>
                <Icon className="w-4 h-4" />
                {category.label} ({activePermissions.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activePermissions.map((perm) => (
                  <Badge
                    key={perm}
                    variant="outline"
                    className={cn("text-xs", category.bgClass, category.colorClass.replace('text-', 'border-').replace('-600', '-200'))}
                  >
                    {getPermissionLabel(perm)}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Mode complet: affiche toutes les permissions par catégorie
  return (
    <Card className={cn("border-0 shadow-lg", className)}>
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
        <CardTitle className="flex items-center justify-between text-foreground">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Mes Permissions
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {totalActive} / {totalPermissions} actives
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          {PERMISSION_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category.key] || Shield;
            const activeCount = category.permissions.filter(p => permissions[p] === true).length;
            const isOpen = openCategories[category.key];

            return (
              <Collapsible
                key={category.key}
                open={isOpen}
                onOpenChange={() => toggleCategory(category.key)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-sm",
                      category.bgClass
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn("w-5 h-5", category.colorClass)} />
                      <span className={cn("font-semibold", category.colorClass)}>
                        {category.label}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          activeCount > 0 ? "bg-orange-100 text-[#ff4000] border-orange-300" : "bg-slate-100 text-slate-500"
                        )}
                      >
                        {activeCount} / {category.permissions.length}
                      </Badge>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform",
                        category.colorClass,
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                    {category.permissions.map((perm) => {
                      const isActive = permissions[perm] === true;
                      return (
                        <div
                          key={perm}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-md text-sm transition-all",
                            isActive
                              ? "bg-orange-50 text-[#ff4000] border border-orange-200"
                              : "bg-slate-50 text-slate-400 border border-slate-100"
                          )}
                        >
                          {isActive ? (
                            <Check className="w-4 h-4 text-[#ff4000] flex-shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-slate-300 flex-shrink-0" />
                          )}
                          <span className={cn(!isActive && "line-through opacity-60")}>
                            {getPermissionLabel(perm)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
