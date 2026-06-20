import { ReactNode } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { usePermissionGuard } from '@/hooks/usePermissionGuard';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PermissionGuardProps {
  requiredPermission: string;
  children: ReactNode;
  redirectTo?: string;
  fallback?: ReactNode;
}

/**
 * Composant pour protéger une route ou une section avec une permission
 * Usage:
 * <PermissionGuard requiredPermission="manage_vendors">
 *   <VendorManagement />
 * </PermissionGuard>
 */
export function PermissionGuard({
  requiredPermission,
  children,
  redirectTo = '/pdg',
  fallback
}: PermissionGuardProps) {
  const { t } = useTranslation();
  const { hasAccess, loading } = usePermissionGuard(requiredPermission, redirectTo);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">{t('permissionGuard.accesRefuse')}</h2>
            <p className="text-muted-foreground">
              Vous n'avez pas la permission nécessaire pour accéder à cette section.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Permission requise: <code className="bg-muted px-2 py-1 rounded">{requiredPermission}</code>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
