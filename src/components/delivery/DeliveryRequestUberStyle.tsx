/**
 * FORMULAIRE DE DEMANDE DE LIVRAISON - Style Uber
 * Interface moderne avec estimation de prix en temps réel
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { MapPin, Package, User, Phone, Navigation } from 'lucide-react';
import { PricingService, type PriceEstimate } from '@/services/pricing/PricingService';
import { PriceEstimatorCard } from './PriceEstimatorCard';
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface DeliveryRequestUberStyleProps {
  onDeliveryCreated: (deliveryId: string) => void;
}

export function DeliveryRequestUberStyle({ onDeliveryCreated }: DeliveryRequestUberStyleProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [step, setStep] = useState<'address' | 'confirm' | 'payment'>('address');
  const [_loading, setLoading] = useState(false);

  // Form data
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCoords, _setPickupCoords] = useState({ lat: 9.5, lng: -13.7 });
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCoords, _setDeliveryCoords] = useState({ lat: 9.52, lng: -13.68 });
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [packageDescription, setPackageDescription] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Price estimate
  const [priceEstimate, setPriceEstimate] = useState<PriceEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  // Calculer le prix dès que les coordonnées changent
  useEffect(() => {
    if (pickupCoords && deliveryCoords) {
      estimatePrice();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupCoords, deliveryCoords]);

  const estimatePrice = async () => {
    setEstimating(true);
    try {
      const estimate = await PricingService.estimateDeliveryPrice(
        pickupCoords.lat,
        pickupCoords.lng,
        deliveryCoords.lat,
        deliveryCoords.lng
      );
      setPriceEstimate(estimate);
    } catch (error) {
      console.error('Error estimating price:', error);
    } finally {
      setEstimating(false);
    }
  };

  const handlePaymentSuccess = async (transactionId: string) => {
    if (!user || !priceEstimate) return;

    setLoading(true);
    try {
      toast.success(t('deliveryRequestUberStyle.livraisonCreeeLesLivreursVont'));
      onDeliveryCreated(transactionId || 'temp-id');
    } catch (error) {
      console.error('Error creating delivery:', error);
      toast.error(t('deliveryRequestUberStyle.erreurLorsDeLaCreation'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Étape 1: Adresses */}
      {step === 'address' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-600" />
                Nouvelle livraison
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Adresse de retrait */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-orange-600" />
                  Adresse de retrait
                </Label>
                <Input
                  placeholder={t('deliveryRequestUberStyle.ouRecupererLeColis')}
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                />
              </div>

              {/* Adresse de livraison */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#ff4000]" />
                  Adresse de livraison
                </Label>
                <Input
                  placeholder={t('deliveryRequestUberStyle.ouLivrerLeColis')}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                />
              </div>

              {/* Informations client */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Nom du destinataire
                  </Label>
                  <Input
                    placeholder="Nom complet"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Téléphone
                  </Label>
                  <Input
                    placeholder="+224 XXX XX XX XX"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>{t('deliveryRequestUberStyle.descriptionDuColis')}</Label>
                <Input
                  placeholder={t('deliveryRequestUberStyle.exDocumentsVetementsNourriture')}
                  value={packageDescription}
                  onChange={(e) => setPackageDescription(e.target.value)}
                />
              </div>

              {/* Instructions spéciales */}
              <div className="space-y-2">
                <Label>{t('deliveryRequestUberStyle.instructionsSpecialesOptionnel')}</Label>
                <Textarea
                  placeholder={t('deliveryRequestUberStyle.instructionsPourLeLivreur')}
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => setStep('confirm')}
                disabled={!pickupAddress || !deliveryAddress || !customerName || !customerPhone}
                style={{
                  background: '#ff4000',
                  color: 'white'
                }}
              >
                <Navigation className="h-5 w-5 mr-2" />
                Voir le prix estimé
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Étape 2: Confirmation & Prix */}
      {step === 'confirm' && (
        <>
          {/* Estimation de prix */}
          <PriceEstimatorCard estimate={priceEstimate} loading={estimating} />

          {/* Résumé */}
          <Card>
            <CardHeader>
              <CardTitle>{t('deliveryRequestUberStyle.resumeDeLaCommande')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Retrait</p>
                  <p className="text-sm text-muted-foreground">{pickupAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-[#ff4000] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{t('deliveryRequestUberStyle.livraison')}</p>
                  <p className="text-sm text-muted-foreground">{deliveryAddress}</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="font-medium">Destinataire</p>
                <p className="text-sm text-muted-foreground">{customerName} - {customerPhone}</p>
              </div>
              {packageDescription && (
                <>
                  <Separator />
                  <div>
                    <p className="font-medium">Colis</p>
                    <p className="text-sm text-muted-foreground">{packageDescription}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('address')} className="flex-1">
              Modifier
            </Button>
            <Button
              onClick={() => setStep('payment')}
              className="flex-1"
              size="lg"
              style={{
                background: '#ff4000',
                color: 'white'
              }}
            >
              Continuer vers le paiement
            </Button>
          </div>
        </>
      )}

      {/* Étape 3: Paiement */}
      {step === 'payment' && priceEstimate && (
        <PaymentMethodSelector
          amount={priceEstimate.totalPrice}
          orderId={`delivery-${Date.now()}`}
          description="Paiement livraison"
          transactionType="delivery"
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentFailed={(error) => toast.error(error)}
          onCancel={() => setStep('confirm')}
        />
      )}
    </div>
  );
}
