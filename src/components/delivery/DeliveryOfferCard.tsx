/**
 * CARTE D'OFFRE DE LIVRAISON
 * Affiche tous les détails AVANT acceptation par le livreur
 * Adresse client cachée pour sécurité
 * Prix basé sur la configuration du vendeur
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Navigation,
  Clock,
  DollarSign,
  Package,
  Store,
  Phone,
  CreditCard,
  Truck,
  Check,
  X,
  Loader2,
  Route,
  Calculator
} from 'lucide-react';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

export interface DeliveryOffer {
  id: string;
  deliveryId: string;
  vendorName: string;
  vendorAddress: string;
  vendorPhone?: string;
  vendorLocation: { lat: number; lng: number };
  clientLocation: { lat: number; lng: number };
  distanceToVendor: number; // km
  distanceVendorToClient: number; // km
  totalDistance: number; // km
  estimatedEarnings: number; // GNF
  paymentMethod: 'prepaid' | 'cod';
  packageType: string;
  packageDescription?: string;
  estimatedTime: number; // minutes
  expiresAt: string;
  // Nouveaux champs pour le détail du prix
  basePrice?: number;
  pricePerKm?: number;
  distancePrice?: number;
}

interface DeliveryOfferCardProps {
  offer: DeliveryOffer;
  onAccept: (offerId: string) => Promise<void>;
  onRefuse: (offerId: string) => Promise<void>;
}

export function DeliveryOfferCard({ offer, onAccept, onRefuse }: DeliveryOfferCardProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<'accept' | 'refuse' | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(
    Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 1000))
  );

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = async () => {
    setLoading('accept');
    try {
      await onAccept(offer.id);
    } finally {
      setLoading(null);
    }
  };

  const handleRefuse = async () => {
    setLoading('refuse');
    try {
      await onRefuse(offer.id);
    } finally {
      setLoading(null);
    }
  };

  const formatCurrency = useFormatCurrency();

  // Calculer les gains du livreur (98.5% du prix total)
  const driverEarning = Math.round(offer.estimatedEarnings * 0.985);

  return (
    <Card className="border-2 border-orange-500 shadow-lg bg-[#ff4000]/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5 text-orange-600" />
            Nouvelle livraison disponible
          </CardTitle>
          <Badge
            variant={timeLeft > 30 ? "default" : "destructive"}
            className="animate-pulse"
          >
            <Clock className="h-3 w-3 mr-1" />
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Informations vendeur */}
        <div className="p-3 bg-white/80 dark:bg-background/80 rounded-lg border">
          <div className="flex items-start gap-3">
            <Store className="h-5 w-5 text-orange-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <p className="font-semibold text-orange-900 dark:text-orange-200">
                {offer.vendorName}
              </p>
              <p className="text-sm text-muted-foreground">
                {offer.vendorAddress}
              </p>
              {offer.vendorPhone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3" />
                  {offer.vendorPhone}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Distances */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="text-center p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <MapPin className="h-4 w-4 mx-auto text-orange-600 mb-1" />
            <p className="text-xs text-muted-foreground">{t('deliveryOfferCard.vousVendeur')}</p>
            <p className="font-bold text-orange-700 dark:text-orange-300">
              {offer.distanceToVendor.toFixed(1)} km
            </p>
          </div>
          <div className="text-center p-2 bg-orange-100 dark:bg-[#ff4000]/30 rounded-lg">
            <Navigation className="h-4 w-4 mx-auto text-[#ff4000] mb-1" />
            <p className="text-xs text-muted-foreground">{t('deliveryOfferCard.vendeurClient')}</p>
            <p className="font-bold text-[#ff4000] dark:text-orange-300">
              {offer.distanceVendorToClient.toFixed(1)} km
            </p>
          </div>
          <div className="text-center p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Route className="h-4 w-4 mx-auto text-blue-600 mb-1" />
            <p className="text-xs text-muted-foreground">Distance totale</p>
            <p className="font-bold text-blue-700 dark:text-blue-300">
              {offer.totalDistance.toFixed(1)} km
            </p>
          </div>
        </div>

        {/* Détail du prix - Configuration vendeur */}
        <div className="p-3 bg-[#ff4000]/5 rounded-lg border border-orange-200 dark:border-[#ff4000]">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="h-4 w-4 text-[#ff4000]" />
            <span className="text-sm font-medium text-[#ff4000] dark:text-orange-300">
              Tarification vendeur
            </span>
          </div>

          {offer.basePrice && offer.distancePrice ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('deliveryOfferCard.prixDeBase')}</span>
                <span className="font-medium">{formatCurrency(offer.basePrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Distance ({offer.distanceVendorToClient.toFixed(1)} km × {formatCurrency(offer.pricePerKm || 1000)}/km)
                </span>
                <span className="font-medium">{formatCurrency(offer.distancePrice)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-orange-200 dark:border-[#ff4000]">
                <span className="font-medium">{t('deliveryOfferCard.totalLivraison')}</span>
                <span className="font-bold text-[#ff4000] dark:text-[#ff4000]">{formatCurrency(offer.estimatedEarnings)}</span>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('deliveryOfferCard.prixCalculeParLeVendeur')}</p>
              <p className="font-bold text-xl text-[#ff4000] dark:text-[#ff4000]">{formatCurrency(offer.estimatedEarnings)}</p>
            </div>
          )}
        </div>

        {/* Vos gains */}
        <div className="flex items-center justify-between p-3 bg-[#ff4000] rounded-lg text-white">
          <div className="flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            <div>
              <p className="text-xs opacity-90">{t('deliveryOfferCard.vosGains985')}</p>
              <p className="font-bold text-xl">{formatCurrency(driverEarning)}</p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={offer.paymentMethod === 'cod'
              ? 'bg-orange-100 text-[#ff4000]'
              : 'bg-orange-100 text-[#ff4000]'
            }
          >
            <CreditCard className="h-3 w-3 mr-1" />
            {offer.paymentMethod === 'cod' ? 'Paiement à la livraison' : 'Prépayé'}
          </Badge>
        </div>

        {/* Détails colis */}
        <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
          <Package className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{offer.packageType}</p>
            {offer.packageDescription && (
              <p className="text-xs text-muted-foreground">{offer.packageDescription}</p>
            )}
          </div>
          <Badge variant="outline" className="ml-auto">
            <Clock className="h-3 w-3 mr-1" />
            ~{offer.estimatedTime} min
          </Badge>
        </div>

        {/* Note sécurité */}
        <p className="text-xs text-center text-muted-foreground italic">
          🔒 L'adresse du client sera révélée après acceptation
        </p>

        {/* Boutons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="border-orange-300 text-[#ff4000] hover:bg-orange-50"
            onClick={handleRefuse}
            disabled={loading !== null || timeLeft === 0}
          >
            {loading === 'refuse' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <X className="h-4 w-4 mr-2" />
                Refuser
              </>
            )}
          </Button>
          <Button
            className="bg-[#ff4000] hover:bg-[#ff4000] shadow-lg shadow-[#ff4000]/40"
            onClick={handleAccept}
            disabled={loading !== null || timeLeft === 0}
          >
            {loading === 'accept' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Accepter
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
