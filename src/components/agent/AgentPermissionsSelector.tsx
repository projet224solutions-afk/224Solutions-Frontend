/**
 * Composant de sélection des permissions pour un agent/sous-agent
 * Affiche toutes les permissions groupées par catégories avec des checkboxes
 */

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Shield, DollarSign, Users, Briefcase, Settings, Brain, ChevronDown, ChevronUp, CheckSquare, Square, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PERMISSION_CATEGORIES,
  getPermissionLabel
} from '@/constants/agentPermissionCategories';
import { PermissionKey } from '@/hooks/useAgentPermissions';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  finance: DollarSign,
  gestion: Users,
  services_pro: Store,
  operations: Briefcase,
  systeme: Settings,
  intelligence: Brain,
  special: Shield,
};

interface AgentPermissionsSelectorProps {
  selectedPermissions: Record<string, boolean>;
  onChange: (permissions: Record<string, boolean>) => void;
  disabled?: boolean;
  className?: string;
}

export function AgentPermissionsSelector({
  selectedPermissions,
  onChange,
  disabled = false,
  className,
}: AgentPermissionsSelectorProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    PERMISSION_CATEGORIES.map((c) => c.key) // Toutes ouvertes par défaut
  );

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryKey)
        ? prev.filter((k) => k !== categoryKey)
        : [...prev, categoryKey]
    );
  };

  const togglePermission = (permKey: string) => {
    if (disabled) return;
    onChange({
      ...selectedPermissions,
      [permKey]: !selectedPermissions[permKey],
    });
  };

  const selectAllInCategory = (permissions: PermissionKey[]) => {
    if (disabled) return;
    const newPerms = { ...selectedPermissions };
    permissions.forEach((perm) => {
      newPerms[perm] = true;
    });
    onChange(newPerms);
  };

  const deselectAllInCategory = (permissions: PermissionKey[]) => {
    if (disabled) return;
    const newPerms = { ...selectedPermissions };
    permissions.forEach((perm) => {
      newPerms[perm] = false;
    });
    onChange(newPerms);
  };

  const countSelectedInCategory = (permissions: PermissionKey[]): number => {
    return permissions.filter((p) => selectedPermissions[p] === true).length;
  };

  const totalSelected = Object.values(selectedPermissions).filter(Boolean).length;
  const totalPermissions = PERMISSION_CATEGORIES.reduce((sum, cat) => sum + cat.permissions.length, 0);

  return (
    <Card className={cn("border shadow-sm", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Permissions
          </div>
          <Badge variant="outline" className="font-normal">
            {totalSelected} / {totalPermissions} sélectionnées
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[60vh] overflow-y-auto">
        {PERMISSION_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category.key] || Shield;
          const isExpanded = expandedCategories.includes(category.key);
          const selectedCount = countSelectedInCategory(category.permissions);
          const allSelected = selectedCount === category.permissions.length;
          const noneSelected = selectedCount === 0;

          return (
            <Collapsible
              key={category.key}
              open={isExpanded}
              onOpenChange={() => toggleCategory(category.key)}
            >
              <div className={cn("rounded-lg border p-3", category.bgClass)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-4 h-4", category.colorClass)} />
                      <span className={cn("font-medium text-sm", category.colorClass)}>
                        {category.label}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {selectedCount}/{category.permissions.length}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {!disabled && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllInCategory(category.permissions);
                            }}
                            disabled={allSelected}
                          >
                            <CheckSquare className="w-3 h-3 mr-1" />
                            Tout
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              deselectAllInCategory(category.permissions);
                            }}
                            disabled={noneSelected}
                          >
                            <Square className="w-3 h-3 mr-1" />
                            Aucun
                          </Button>
                        </>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="mt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {category.permissions.map((perm) => (
                      <div
                        key={perm}
                        className="flex items-center gap-2 p-2 rounded-md bg-background/60 hover:bg-background transition-colors"
                      >
                        <Checkbox
                          id={perm}
                          checked={selectedPermissions[perm] === true}
                          onCheckedChange={() => togglePermission(perm)}
                          disabled={disabled}
                        />
                        <Label
                          htmlFor={perm}
                          className={cn(
                            "text-sm cursor-pointer flex-1",
                            disabled && "cursor-not-allowed opacity-60"
                          )}
                        >
                          {getPermissionLabel(perm)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
