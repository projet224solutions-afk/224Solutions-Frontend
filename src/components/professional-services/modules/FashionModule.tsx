/**
 * MODULE MODE / VÊTEMENTS — réel.
 * Réutilise le moteur e-commerce (stats, commandes, top produits, campagnes — données réelles via
 * useServiceEcommerceStats + gestion produits/commandes sur /vendeur/*). Remplace l'ancien
 * formulaire fictif non persisté : une boutique mode est une boutique e-commerce à part entière.
 */

import { EcommerceModule } from './EcommerceModule';

interface FashionModuleProps {
  serviceId: string;
  businessName?: string;
}

export function FashionModule({ serviceId, businessName }: FashionModuleProps) {
  return <EcommerceModule serviceId={serviceId} businessName={businessName || 'Boutique Mode'} />;
}

export default FashionModule;
