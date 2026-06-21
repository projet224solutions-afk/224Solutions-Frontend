import { useTranslation } from "@/hooks/useTranslation";
import React from 'react';
import { useAgentPermissions } from '@/hooks/usePDGAgentPermissions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface PermissionGuardProps {
  requiredPermission: string | string[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Composant pour protéger l'accès aux fonctionnalités PDG basé sur les permissions déliquées
 * Vérifie si l'utilisateur (agent) a la permission requise
 */
export function PermissionGuard({
  requiredPermission,
  requireAll = false,
  children,
  fallback
}: PermissionGuardProps) {
  const { t } = useTranslation();
  const { hasPermission, hasAllPermissions, hasAnyPermission, loading } = useAgentPermissions();

  if (loading) {
    return <div className="p-4 text-gray-500">{t('permissionGuard.verificationDesPermissions')}</div>;
  }

  const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
  const hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);

  if (!hasAccess) {
    return (
      fallback || (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('permissionGuard.accesRefuse')}</AlertTitle>
          <AlertDescription>
            Vous n'avez pas la permission d'accéder à cette fonctionnalité.
            {permissions.length === 1 && (
              <div className="mt-2 text-sm">Permission requise: <code className="bg-orange-50 px-2 py-1">{permissions[0]}</code></div>
            )}
            Veuillez contacter le PDG pour demander l'accès.
          </AlertDescription>
        </Alert>
      )
    );
  }

  return <>{children}</>;
}

/**
 * Hook pour vérifier les permissions dans les composants
 * Utilisation: const canDoX = useHasPermission('manage_users');
 */
export function useHasPermission(permissionKey: string | string[]): boolean {
  const { hasPermission, hasAnyPermission } = useAgentPermissions();

  if (Array.isArray(permissionKey)) {
    return hasAnyPermission(permissionKey);
  }

  return hasPermission(permissionKey);
}

/**
 * Composant wrapper pour les boutons/sections protégées
 */
interface ProtectedActionProps {
  permission: string | string[];
  children: React.ReactElement;
  fallback?: React.ReactElement;
  showWarning?: boolean;
}

export function ProtectedAction({
  permission,
  children,
  fallback,
  showWarning = false
}: ProtectedActionProps) {
  const { t } = useTranslation();
  const hasAccess = useHasPermission(permission);

  if (!hasAccess) {
    return fallback || (
      <div title={t('permissionGuard.vousNAvezPasAcces')}>
        {React.cloneElement(children, { disabled: true, opacity: 0.5 } as any)}
        {showWarning && (
          <p className="text-xs text-[#ff4000] mt-1">Permission requise</p>
        )}
      </div>
    );
  }

  return children;
}
