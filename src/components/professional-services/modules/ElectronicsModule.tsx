/**
 * MODULE ÉLECTRONIQUE — réel.
 * Réutilise le moteur e-commerce (stats, commandes, top produits, campagnes — données réelles via
 * useServiceEcommerceStats + gestion produits/commandes sur /vendeur/*). Remplace l'ancien
 * formulaire fictif non persisté : une boutique électronique est une boutique e-commerce.
 */

import { EcommerceModule } from './EcommerceModule';

interface ElectronicsModuleProps {
  serviceId: string;
  businessName?: string;
}

export function ElectronicsModule({ serviceId, businessName }: ElectronicsModuleProps) {
  return <EcommerceModule serviceId={serviceId} businessName={businessName || 'Boutique Électronique'} />;
}

export default ElectronicsModule;
