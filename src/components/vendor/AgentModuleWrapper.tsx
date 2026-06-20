import React from 'react';
import { useAgent } from '@/contexts/AgentContext';

/**
 * Wrapper pour les modules vendeur utilisés par les agents
 * Injecte le vendor_id de l'agent dans le contexte pour que les composants
 * chargent les données du vendeur associé
 */
interface AgentModuleWrapperProps {
  children: React.ReactNode;
  permission?: string;
  fallback?: React.ReactNode;
}

export const AgentModuleWrapper: React.FC<AgentModuleWrapperProps> = ({
  children,
  permission,
  fallback = (
    <div className="p-6 text-center text-muted-foreground">
      Vous n'avez pas la permission d'accéder à ce module
    </div>
  ),
}) => {
  const { hasPermission, vendorId } = useAgent();

  // Vérifier la permission si spécifiée
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // Injecter le vendorId dans un contexte local si nécessaire
  // Les composants enfants devront utiliser ce vendorId pour charger les données
  return (
    <div data-vendor-id={vendorId} className="agent-module-wrapper h-full">
      {children}
    </div>
  );
};
