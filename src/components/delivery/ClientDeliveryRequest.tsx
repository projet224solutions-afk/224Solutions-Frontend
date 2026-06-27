/**
 * FORMULAIRE DE COMMANDE DE LIVRAISON - CÔTÉ CLIENT
 * Saisie ID vendeur → récupération auto des infos → calcul prix → confirmation
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Package,
  Loader2,
  Store,
  CheckCircle2,
  CreditCard,
  Banknote,
  Scale,
  AlertTriangle,
  Navigation,
  Phone
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface VendorInfo {
  id: string;
  business_name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
}

interface PriceEstimate {
  distanceToVendor: number;
  distanceVendorToClient: number;
  totalDistance: number;
  durationToVendor: number;
  durationVendorToClient: number;
  totalDuration: number;
  estimatedPrice: number;
}

interface ClientDeliveryRequestProps {
  onDeliveryCreated?: (deliveryId: string) => void;
}

export function ClientDeliveryRequest({ onDeliveryCreated }: ClientDeliveryRequestProps) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [step, setStep] = useState<'vendor' | 'details' | 'confirm'>('vendor');

  // Vendor lookup
  const [vendorId, setVendorId] = useState('');
  const [vendorInfo, setVendorInfo] = useState<VendorInfo | null>(null);
  const [loadingVendor, setLoadingVendor] = useState(false);

  // Client address
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [clientCoords, setClientCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingClient, setLocatingClient] = useState(false);

  // Package details
  const [packageType, _setPackageType] = useState('standard');
  const [packageSize, setPackageSize] = useState('small');
  const [packageWeight, setPackageWeight] = useState('light');
  const [isFragile, setIsFragile] = useState(false);
  const [packageDescription, setPackageDescription] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'prepaid' | 'cod'>('prepaid');

  // Price estimate
  const [priceEstimate, setPriceEstimate] = useState<PriceEstimate | null>(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);

  // Submit
  const [submitting, setSubmitting] = useState(false);

  // Recherche vendeur par ID
  const lookupVendor = async () => {
    if (!vendorId.trim()) {
      toast.error(t('clientDeliveryRequest.veuillezSaisirLIdDu'));
      return;
    }

    setLoadingVendor(true);
    try {
      // Recherche par ID exact ou par code vendeur
      const { data, error } = await supabase
        .from('vendors')
        .select('id, business_name, address, phone')
        .or(`id.eq.${vendorId},vendor_code.eq.${vendorId.toUpperCase()}`)
        .single();

      if (error || !data) {
        toast.error(t('clientDeliveryRequest.vendeurIntrouvableVerifiezLId'));
        return;
      }

      // Use default coordinates for Guinea (Conakry)
      const vendorData = data as any;
      setVendorInfo({
        id: vendorData.id,
        business_name: vendorData.business_name || 'Vendeur',
        address: vendorData.address || 'Adresse non renseignée',
        phone: vendorData.phone || '',
        latitude: 9.6412,
        longitude: -13.5784
      });

      toast.success(t('clientDeliveryRequest.vendeurTrouve'));
      setStep('details');
    } catch (error) {
      console.error('Error looking up vendor:', error);
      toast.error(t('clientDeliveryRequest.erreurLorsDeLaRecherche'));
    } finally {
      setLoadingVendor(false);
    }
  };

  // Géolocalisation client
  const locateClient = async () => {
    setLocatingClient(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000
        });
      });

      setClientCoords({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });

      // Reverse geocoding pour obtenir l'adresse
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      const response = await fetch(`${SUPABASE_URL}/functions/v1/geocode-address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          type: 'reverse'
        })
      });

      const data = await response.json();
      if (data.results?.[0]?.formatted_address) {
        setDeliveryAddress(data.results[0].formatted_address);
      }

      toast.success(t('clientDeliveryRequest.positionGpsDetectee'));
    } catch (error) {
      console.error('Geolocation error:', error);
      toast.error(t('clientDeliveryRequest.impossibleDeDetecterVotrePosition'));
    } finally {
      setLocatingClient(false);
    }
  };

  // Calculer le prix estimé
  const calculatePrice = async () => {
    if (!vendorInfo || !clientCoords) {
      toast.error(t('clientDeliveryRequest.informationsManquantesPourLeCalcul'));
      return;
    }

    setCalculatingPrice(true);
    try {
      // Position fictive du livreur (sera calculée au moment de l'assignation)
      const driverLocation = { lat: vendorInfo.latitude, lng: vendorInfo.longitude };

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

      const response = await fetch(`${SUPABASE_URL}/functions/v1/calculate-delivery-distances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          driverLocation,
          vendorLocation: { lat: vendorInfo.latitude, lng: vendorInfo.longitude },
          clientLocation: clientCoords
        })
      });

      const data = await response.json();

      // Ajustement prix selon le type de colis
      let priceMultiplier = 1;
      if (packageSize === 'medium') priceMultiplier = 1.2;
      if (packageSize === 'large') priceMultiplier = 1.5;
      if (packageWeight === 'medium') priceMultiplier *= 1.1;
      if (packageWeight === 'heavy') priceMultiplier *= 1.3;
      if (isFragile) priceMultiplier *= 1.2;

      setPriceEstimate({
        distanceToVendor: data.distanceToVendor || 0,
        distanceVendorToClient: data.distanceVendorToClient || 0,
        totalDistance: data.totalDistance || 0,
        durationToVendor: data.durationToVendor || 0,
        durationVendorToClient: data.durationVendorToClient || 0,
        totalDuration: data.totalDuration || 0,
        estimatedPrice: Math.round((data.estimatedEarnings || 10000) * priceMultiplier)
      });

      setStep('confirm');
    } catch (error) {
      console.error('Error calculating price:', error);
      toast.error(t('clientDeliveryRequest.erreurLorsDuCalculDu'));
    } finally {
      setCalculatingPrice(false);
    }
  };

  // Soumettre la commande
  const submitOrder = async () => {
    if (!vendorInfo || !clientCoords || !priceEstimate || !user) {
      toast.error(t('clientDeliveryRequest.informationsIncompletes'));
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .insert({
          customer_id: user.id,
          customer_name: (profile as any)?.full_name || 'Client',
          customer_phone: profile?.phone || '',
          vendor_id: vendorInfo.id,
          vendor_name: vendorInfo.business_name,
          vendor_phone: vendorInfo.phone,
          vendor_location: { lat: vendorInfo.latitude, lng: vendorInfo.longitude },
          pickup_address: vendorInfo.address,
          pickup_latitude: vendorInfo.latitude,
          pickup_longitude: vendorInfo.longitude,
          delivery_address: deliveryAddress,
          delivery_latitude: clientCoords.lat,
          delivery_longitude: clientCoords.lng,
          package_type: packageType,
          package_description: `${packageSize} - ${packageWeight}${isFragile ? ' - FRAGILE' : ''}\n${packageDescription}`,
          driver_notes: specialInstructions,
          payment_method: paymentMethod,
          distance_to_vendor: priceEstimate.distanceToVendor,
          distance_vendor_to_client: priceEstimate.distanceVendorToClient,
          total_distance: priceEstimate.totalDistance,
          estimated_time_minutes: priceEstimate.totalDuration,
          delivery_fee: priceEstimate.estimatedPrice,
          status: 'pending'
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast.success(t('clientDeliveryRequest.commandeCreeeUnLivreurSera'));
      onDeliveryCreated?.(data.id);
    } catch (error) {
      console.error('Error creating delivery:', error);
      toast.error(t('clientDeliveryRequest.erreurLorsDeLaCreation'));
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = useFormatCurrency();

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Étape 1: Recherche vendeur */}
      {step === 'vendor' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-orange-600" />
              Identifier le vendeur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('clientDeliveryRequest.idOuCodeDuVendeur')}</Label>
              <Input
                placeholder={t('clientDeliveryRequest.exVnd0001OuIdComplet')}
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookupVendor()}
              />
              <p className="text-xs text-muted-foreground">
                Demandez l'ID au vendeur avant de commander
              </p>
            </div>

            <Button
              className="w-full"
              onClick={lookupVendor}
              disabled={loadingVendor || !vendorId.trim()}
            >
              {loadingVendor ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recherche...
                </>
              ) : (
                <>
                  <Store className="h-4 w-4 mr-2" />
                  Rechercher le vendeur
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Étape 2: Détails livraison */}
      {step === 'details' && vendorInfo && (
        <div className="space-y-4">
          {/* Vendeur confirmé */}
          <Card className="border-[#ff4000]">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-[#ff4000]" />
                <div>
                  <p className="font-semibold">{vendorInfo.business_name}</p>
                  <p className="text-sm text-muted-foreground">{vendorInfo.address}</p>
                  {vendorInfo.phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {vendorInfo.phone}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Adresse de livraison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#ff4000]" />
                Adresse de livraison
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder={t('clientDeliveryRequest.votreAdresseDeLivraison')}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={locateClient}
                  disabled={locatingClient}
                >
                  {locatingClient ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Navigation className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {clientCoords && (
                <p className="text-xs text-[#ff4000] flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Position GPS enregistrée
                </p>
              )}
            </CardContent>
          </Card>

          {/* Détails du colis */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-600" />
                Détails du colis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Taille</Label>
                  <Select value={packageSize} onValueChange={setPackageSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Petit (enveloppe)</SelectItem>
                      <SelectItem value="medium">Moyen (sac)</SelectItem>
                      <SelectItem value="large">Grand (carton)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Poids</Label>
                  <Select value={packageWeight} onValueChange={setPackageWeight}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">&lt; 2 kg</SelectItem>
                      <SelectItem value="medium">2-5 kg</SelectItem>
                      <SelectItem value="heavy">&gt; 5 kg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="fragile"
                  checked={isFragile}
                  onChange={(e) => setIsFragile(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="fragile" className="flex items-center gap-1 cursor-pointer">
                  <AlertTriangle className="h-4 w-4 text-[#ff4000]" />
                  Colis fragile
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Description (optionnel)</Label>
                <Textarea
                  placeholder={t('clientDeliveryRequest.decrivezLeContenu')}
                  value={packageDescription}
                  onChange={(e) => setPackageDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Mode de paiement */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                Mode de paiement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'prepaid' | 'cod')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="prepaid" id="prepaid" />
                  <Label htmlFor="prepaid" className="flex items-center gap-2 cursor-pointer">
                    <CreditCard className="h-4 w-4 text-[#ff4000]" />
                    Prépayé (paiement maintenant)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cod" id="cod" />
                  <Label htmlFor="cod" className="flex items-center gap-2 cursor-pointer">
                    <Banknote className="h-4 w-4 text-[#ff4000]" />
                    Paiement à la livraison (COD)
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Instructions spéciales */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('clientDeliveryRequest.instructionsSpeciales')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder={t('clientDeliveryRequest.instructionsPourLeLivreur')}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={2}
              />
            </CardContent>
          </Card>

          {/* Bouton calculer */}
          <Button
            className="w-full"
            size="lg"
            onClick={calculatePrice}
            disabled={!clientCoords || !deliveryAddress || calculatingPrice}
          >
            {calculatingPrice ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Calcul en cours...
              </>
            ) : (
              <>
                <Scale className="h-5 w-5 mr-2" />
                Calculer le prix
              </>
            )}
          </Button>
        </div>
      )}

      {/* Étape 3: Confirmation */}
      {step === 'confirm' && vendorInfo && priceEstimate && (
        <div className="space-y-4">
          <Card className="border-2 border-[#ff4000] bg-[#ff4000]/5">
            <CardHeader>
              <CardTitle className="text-center">{t('clientDeliveryRequest.recapitulatifDeLaCommande')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Trajet */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-orange-600" />
                  <span className="font-medium">{vendorInfo.business_name}</span>
                </div>
                <div className="ml-6 border-l-2 border-dashed border-muted-foreground/30 pl-4 py-2">
                  <p className="text-sm text-muted-foreground">
                    {priceEstimate.distanceVendorToClient} km • ~{priceEstimate.durationVendorToClient} min
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#ff4000]" />
                  <span className="font-medium">{deliveryAddress}</span>
                </div>
              </div>

              {/* Distances */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 bg-white/80 rounded-lg">
                  <p className="text-xs text-muted-foreground">Distance totale</p>
                  <p className="font-bold">{priceEstimate.totalDistance} km</p>
                </div>
                <div className="p-2 bg-white/80 rounded-lg">
                  <p className="text-xs text-muted-foreground">{t('clientDeliveryRequest.tempsEstime')}</p>
                  <p className="font-bold">{priceEstimate.totalDuration} min</p>
                </div>
              </div>

              {/* Paiement */}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <span className="text-muted-foreground">{t('clientDeliveryRequest.modeDePaiement')}</span>
                <Badge variant={paymentMethod === 'cod' ? 'secondary' : 'default'}>
                  {paymentMethod === 'cod' ? 'À la livraison' : 'Prépayé'}
                </Badge>
              </div>

              {/* Prix total */}
              <div className="p-4 bg-[#ff4000] rounded-lg text-white text-center">
                <p className="text-sm opacity-90">Prix total</p>
                <p className="text-3xl font-bold">{formatCurrency(priceEstimate.estimatedPrice)}</p>
              </div>

              {/* Boutons */}
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setStep('details')}>
                  Modifier
                </Button>
                <Button
                  onClick={submitOrder}
                  disabled={submitting}
                  className="bg-[#ff4000]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    'Confirmer'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
