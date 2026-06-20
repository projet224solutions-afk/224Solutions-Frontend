import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from "@/hooks/useTranslation";
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { AVAILABLE_PERMISSIONS, PermissionKey } from '@/hooks/useAgentPermissions';
import { PERMISSION_CATEGORIES } from '@/constants/agentPermissionCategories';

interface AgentPermissionsSectionProps {
  permissions: Record<string, boolean>;
  onPermissionChange: (key: string, value: boolean) => void;
  loading?: boolean;
}

const CATEGORY_TITLES: Record<string, string> = {
  finance: '💰 Finance',
  gestion: '📋 Gestion',
  services_pro: '🏪 Services Professionnels',
  operations: '⚙️ Opérations',
  systeme: '🔧 Système',
  intelligence: '🧠 Intelligence',
  special: '🎯 Spécial',
};

export function AgentPermissionsSection({
  permissions,
  onPermissionChange,
  loading
}: AgentPermissionsSectionProps) {
  const { t } = useTranslation();
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['💰 Finance', '📋 Gestion']));

  const toggleCategory = (category: string) => {
    const newOpen = new Set(openCategories);
    if (newOpen.has(category)) {
      newOpen.delete(category);
    } else {
      newOpen.add(category);
    }
    setOpenCategories(newOpen);
  };

  const permissionCategories = PERMISSION_CATEGORIES.map((category) => ({
    title: CATEGORY_TITLES[category.key] || category.label,
    keys: category.permissions,
  }));

  const getActiveCategoryCount = (keys: PermissionKey[]) => {
    return keys.filter(key => permissions[key] === true).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-base font-semibold">{t('agentPermissionsSection.permissionsAvancees')}</Label>
      <p className="text-xs text-muted-foreground mb-3">
        Gérez les accès aux différentes fonctionnalités du système
      </p>
      <ScrollArea className="h-[350px] pr-4">
        <div className="space-y-2 pb-2">
          {permissionCategories.map(({ title: category, keys }) => {
            const activeCount = getActiveCategoryCount(keys);

            return (
              <Collapsible
                key={category}
                open={openCategories.has(category)}
                onOpenChange={() => toggleCategory(category)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <span className="font-medium text-sm">{category}</span>
                  <div className="flex items-center gap-2">
                    {activeCount > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {activeCount}/{keys.length}
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform ${openCategories.has(category) ? 'rotate-180' : ''}`} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1.5 pl-3 pt-2 pb-1 border-l-2 border-muted ml-2">
                    {keys.map((key) => (
                      <div key={key} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`perm-${key}`}
                          checked={permissions[key] || false}
                          onCheckedChange={(checked) => onPermissionChange(key, checked === true)}
                        />
                        <label
                          htmlFor={`perm-${key}`}
                          className="text-xs font-normal cursor-pointer flex-1 leading-tight"
                        >
                          {AVAILABLE_PERMISSIONS[key]}
                        </label>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
