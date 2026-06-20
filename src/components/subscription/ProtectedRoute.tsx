import { ReactNode } from 'react';
import { FeatureGuard } from './FeatureGuard';
import { SubscriptionFeature } from '@/hooks/useSubscriptionFeatures';

interface ProtectedRouteProps {
  feature: SubscriptionFeature;
  children: ReactNode;
}

/**
 * Composant qui protège une route entière avec FeatureGuard
 * Affiche le contenu avec effet flou et bouton de mise à niveau si l'utilisateur n'a pas accès
 */
export function ProtectedRoute({ feature, children }: ProtectedRouteProps) {
  return (
    <FeatureGuard feature={feature} showUpgradePrompt={true}>
      {children}
    </FeatureGuard>
  );
}
