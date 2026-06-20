// Service de tarification pour 224Solutions
// Version simplifiée avec tarifs prédéfinis

export interface PriceCalculation {
  distance: number;
  duration: number;
  basePrice: number;
  totalPrice: number;
  currency: string;
}

class PricingService {
  // Tarifs de base
  private readonly BASE_PRICE = 500;
  private readonly PRICE_PER_KM = 150;
  private readonly CURRENCY = 'GNF';

  // Calculer le prix d'une course
  calculatePrice(distance: number, duration: number = 0): PriceCalculation {
    const basePrice = this.BASE_PRICE;
    const distancePrice = Math.round(distance * this.PRICE_PER_KM);
    const totalPrice = basePrice + distancePrice;

    return {
      distance,
      duration,
      basePrice,
      totalPrice,
      currency: this.CURRENCY
    };
  }

  // Formater un prix pour l'affichage
  formatPrice(amount: number): string {
    return `${amount.toLocaleString()} ${this.CURRENCY}`;
  }

  // Compare prices (stub pour compatibilité)
  async comparePrices(_input: unknown): Promise<unknown[]> {
    return [];
  }
}

export const pricingService = new PricingService();

// Fonction utilitaire pour les infos de véhicule
export const getVehicleTypeInfo = (vehicleType: string) => {
  const vehicleInfo = {
    moto_economique: {
      name: 'Moto Économique',
      description: 'Solution économique pour vos déplacements',
      icon: '🏍️',
      features: ['Prix abordable', 'Conducteur expérimenté', 'Casque fourni']
    },
    moto_rapide: {
      name: 'Moto Rapide',
      description: 'Déplacement rapide et efficace',
      icon: '🏍️',
      features: ['Trajet optimisé', 'Conducteur expert', 'Équipement de sécurité']
    },
    moto_premium: {
      name: 'Moto Premium',
      description: 'Service haut de gamme avec confort maximal',
      icon: '🏍️',
      features: ['Moto récente', 'Conducteur VIP', 'Équipement premium', 'Service prioritaire']
    }
  };

  return vehicleInfo[vehicleType as keyof typeof vehicleInfo] || vehicleInfo.moto_economique;
};
