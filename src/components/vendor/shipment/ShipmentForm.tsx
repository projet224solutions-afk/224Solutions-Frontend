/**
 * FORMULAIRE DE CRÉATION D'EXPÉDITION
 * Inspiré de JYM Express pour 224SOLUTIONS
 * Avec calcul automatique du prix par GPS
 * ET paiement escrow pour sécuriser les fonds du livreur
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Package, User, MapPin, ArrowRight, Calculator, Loader2, Route, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDeliveryPriceCalculation } from '@/hooks/useDeliveryPriceCalculation';
import { UniversalEscrowService } from '@/services/UniversalEscrowService';
import { useWallet } from '@/hooks/useWallet';

interface ShipmentFormProps {
  vendorId: string;
  onSuccess: (shipmentId: string, trackingNumber: string) => void;
  onCancel?: () => void;
}

export function ShipmentForm({ vendorId, onSuccess, onCancel }: ShipmentFormProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { wallet } = useWallet();
  const [formData, setFormData] = useState({
    // Expéditeur
    senderName: '',
    senderPhone: '',
    senderAddress: '',

    // Destinataire
    receiverName: '',
    receiverPhone: '',
    receiverAddress: '',

    // Colis
    weight: '',
    piecesCount: '1',
    itemType: '',
    packageDescription: '',

    // Options
    cashOnDelivery: false,
    codAmount: '',
    insurance: false,
    insuranceAmount: '',
    returnOption: false,

    // Méthode de paiement pour le livreur
    deliveryPaymentMethod: 'wallet' as 'wallet' | 'cash',
  });

  // Hook pour calcul de prix
  const { calculateDistance, calculating, priceResult, reset } = useDeliveryPriceCalculation(vendorId);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Réinitialiser le prix si adresse modifiée
    if (field === 'senderAddress' || field === 'receiverAddress') {
      reset();
    }
  };

  // Calculer le prix de livraison
  const handleCalculatePrice = async () => {
    if (!formData.senderAddress || !formData.receiverAddress) {
      toast.error(t('shipmentForm.veuillezRemplirLesAdressesAvant'));
      return;
    }
    await calculateDistance(formData.senderAddress, formData.receiverAddress);
  };

  // Formater le prix
  const formatCurrency = useFormatCurrency();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.senderName || !formData.senderPhone || !formData.senderAddress) {
      toast.error(t('shipmentForm.veuillezRemplirToutesLesInformations'));
      return;
    }

    if (!formData.receiverName || !formData.receiverPhone || !formData.receiverAddress) {
      toast.error(t('shipmentForm.veuillezRemplirToutesLesInformations2'));
      return;
    }

    if (!formData.weight || parseFloat(formData.weight) <= 0) {
      toast.error(t('shipmentForm.veuillezIndiquerUnPoidsValide'));
      return;
    }

    setLoading(true);
    try {
      // 1. Récupérer les infos du vendeur et l'utilisateur courant
      const { data: vendor } = await supabase
        .from('vendors')
        .select('business_name, phone, user_id')
        .eq('id', vendorId)
        .single();

      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

      // 2. Créer un customer temporaire si nécessaire ou utiliser le user courant
      let customerId = currentUserId;

      // Vérifier si un customer existe pour cet utilisateur
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (!existingCustomer) {
        // Créer un customer temporaire
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            user_id: currentUserId,
            addresses: [{
              address: formData.receiverAddress,
              name: formData.receiverName,
              phone: formData.receiverPhone
            }]
          })
          .select()
          .single();

        if (!customerError && newCustomer) {
          customerId = newCustomer.id;
        }
      } else {
        customerId = existingCustomer.id;
      }

      // 3. Générer un numéro de commande unique
      const orderNumber = `EXP-${Date.now().toString(36).toUpperCase()}`;
      const totalAmount = formData.cashOnDelivery ? parseFloat(formData.codAmount) || 0 : 0;

      // 4. Créer une commande pour lier la livraison
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          vendor_id: vendorId,
          customer_id: customerId!,
          order_number: orderNumber,
          status: 'confirmed',
          subtotal: totalAmount,
          total_amount: totalAmount,
          payment_status: formData.cashOnDelivery ? 'pending' : 'paid',
          shipping_address: {
            address: formData.receiverAddress,
            name: formData.receiverName,
            phone: formData.receiverPhone
          },
          notes: `Expédition: ${formData.packageDescription || formData.itemType || 'Colis'}`,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 5. Créer l'expédition dans la table shipments
      const { data: shipment, error: shipmentError } = await supabase
        .from('shipments')
        .insert({
          vendor_id: vendorId,
          sender_name: formData.senderName,
          sender_phone: formData.senderPhone,
          sender_address: formData.senderAddress,
          receiver_name: formData.receiverName,
          receiver_phone: formData.receiverPhone,
          receiver_address: formData.receiverAddress,
          weight: parseFloat(formData.weight),
          pieces_count: parseInt(formData.piecesCount) || 1,
          item_type: formData.itemType || null,
          package_description: formData.packageDescription || null,
          cash_on_delivery: formData.cashOnDelivery,
          cod_amount: formData.cashOnDelivery ? parseFloat(formData.codAmount) || 0 : 0,
          insurance: formData.insurance,
          insurance_amount: formData.insurance ? parseFloat(formData.insuranceAmount) || 0 : 0,
          return_option: formData.returnOption,
          status: 'created',
        } as any)
        .select()
        .single();

      if (shipmentError) throw shipmentError;

      // 6. Calculer le montant de la livraison
      const deliveryFee = priceResult?.totalPrice || 15000;

      // 7. Créer une livraison correspondante dans la table deliveries pour les livreurs
      console.log('📦 Création de la livraison pour les livreurs...');
      const { data: delivery, error: deliveryError } = await supabase
        .from('deliveries')
        .insert({
          order_id: order.id,
          vendor_id: vendorId,
          vendor_name: vendor?.business_name || formData.senderName,
          vendor_phone: vendor?.phone || formData.senderPhone,
          vendor_location: {
            address: formData.senderAddress,
            name: formData.senderName
          },
          pickup_address: {
            address: formData.senderAddress,
            name: formData.senderName,
            phone: formData.senderPhone
          },
          delivery_address: {
            address: formData.receiverAddress,
            name: formData.receiverName,
            phone: formData.receiverPhone
          },
          customer_name: formData.receiverName,
          customer_phone: formData.receiverPhone,
          package_description: formData.packageDescription || formData.itemType || `Colis ${parseFloat(formData.weight)} kg`,
          package_type: formData.itemType || 'colis',
          payment_method: formData.cashOnDelivery ? 'cod' : 'prepaid',
          driver_payment_method: formData.deliveryPaymentMethod || 'cash',
          price: formData.cashOnDelivery ? parseFloat(formData.codAmount) || 0 : 0,
          delivery_fee: deliveryFee,
          distance_km: priceResult?.distance || null,
          estimated_time_minutes: priceResult?.estimatedTime || null,
          status: 'pending',
        })
        .select()
        .single();

      if (deliveryError) {
        console.error('❌ Error creating delivery:', deliveryError);
        toast.error(t('shipmentForm.expeditionCreeeMaisErreurPour') + deliveryError.message);
      } else {
        console.log('✅ Livraison créée avec succès:', delivery?.id);
      }

      // 8. Si paiement par wallet, créer l'escrow pour bloquer les fonds
      if (formData.deliveryPaymentMethod === 'wallet' && delivery) {
        console.log('🔐 Création escrow pour livraison:', deliveryFee);

        // Vérifier le solde
        if ((wallet?.balance || 0) < deliveryFee) {
          toast.error(t('shipmentForm.soldeInsuffisantPourPayerLa'));
          // Supprimer la livraison créée
          await supabase.from('deliveries').delete().eq('id', delivery.id);
          setLoading(false);
          return;
        }

        // Créer l'escrow - les fonds sont bloqués jusqu'à confirmation du livreur
        const escrowResult = await UniversalEscrowService.createEscrow({
          buyer_id: vendor?.user_id || currentUserId!,
          seller_id: 'DELIVERY_DRIVER_PLACEHOLDER', // Sera mis à jour quand un livreur accepte
          order_id: order.id,
          amount: deliveryFee,
          currency: 'GNF',
          transaction_type: 'delivery',
          payment_provider: 'wallet',
          metadata: {
            delivery_id: delivery.id,
            vendor_id: vendorId,
            description: `Frais de livraison - ${formData.receiverName}`,
          },
          escrow_options: {
            require_photo: true,
            require_signature: true,
          }
        });

        if (!escrowResult.success) {
          console.error('❌ Escrow creation failed:', escrowResult.error);
          toast.error(t('shipmentForm.erreurLorsDuBlocageDes'));
          await supabase.from('deliveries').delete().eq('id', delivery.id);
          setLoading(false);
          return;
        }

        console.log('✅ Escrow créé:', escrowResult.escrow_id);
        toast.success(t('shipmentForm.fondsBloquesEnEscrowLiberes'));
      }

      toast.success(t('shipmentForm.expeditionCreeeAvecSucces'));
      onSuccess(shipment.id, shipment.tracking_number);
    } catch (error) {
      console.error('Error creating shipment:', error);
      toast.error(t('shipmentForm.erreurLorsDeLaCreation'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Expéditeur */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-orange-600" />
            Informations de l'expéditeur
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="senderName">Nom complet *</Label>
              <Input
                id="senderName"
                value={formData.senderName}
                onChange={(e) => handleInputChange('senderName', e.target.value)}
                placeholder={t('shipmentForm.nomDeLExpediteur')}
                required
              />
            </div>
            <div>
              <Label htmlFor="senderPhone">{t('shipmentForm.telephone')}</Label>
              <Input
                id="senderPhone"
                value={formData.senderPhone}
                onChange={(e) => handleInputChange('senderPhone', e.target.value)}
                placeholder="+224 XXX XXX XXX"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="senderAddress">{t('shipmentForm.adresseComplete')}</Label>
            <Textarea
              id="senderAddress"
              value={formData.senderAddress}
              onChange={(e) => handleInputChange('senderAddress', e.target.value)}
              placeholder={t('shipmentForm.adresseDeRetraitDuColis')}
              rows={2}
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Destinataire */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-[#ff4000]" />
            Informations du destinataire
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="receiverName">Nom complet *</Label>
              <Input
                id="receiverName"
                value={formData.receiverName}
                onChange={(e) => handleInputChange('receiverName', e.target.value)}
                placeholder={t('shipmentForm.nomDuDestinataire')}
                required
              />
            </div>
            <div>
              <Label htmlFor="receiverPhone">{t('shipmentForm.telephone')}</Label>
              <Input
                id="receiverPhone"
                value={formData.receiverPhone}
                onChange={(e) => handleInputChange('receiverPhone', e.target.value)}
                placeholder="+224 XXX XXX XXX"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="receiverAddress">{t('shipmentForm.adresseComplete')}</Label>
            <Textarea
              id="receiverAddress"
              value={formData.receiverAddress}
              onChange={(e) => handleInputChange('receiverAddress', e.target.value)}
              placeholder={t('shipmentForm.adresseDeLivraison')}
              rows={2}
              required
            />
          </div>

          {/* Bouton calcul prix */}
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCalculatePrice}
              disabled={calculating || !formData.senderAddress || !formData.receiverAddress}
              className="w-full"
            >
              {calculating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calcul en cours...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculer le prix de livraison
                </>
              )}
            </Button>
          </div>

          {/* Affichage du prix calculé */}
          {priceResult && (
            <div className="mt-4 p-4 bg-[#ff4000]/5 rounded-lg border border-orange-200 dark:border-[#ff4000]">
              <h4 className="font-semibold text-[#ff4000] dark:text-orange-300 mb-3 flex items-center gap-2">
                <Route className="h-4 w-4" />
                Estimation de livraison
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                <div className="p-2 bg-white/60 dark:bg-black/20 rounded">
                  <p className="text-xs text-muted-foreground">Distance</p>
                  <p className="font-bold text-[#ff4000] dark:text-[#ff4000]">{priceResult.distance} km</p>
                </div>
                <div className="p-2 bg-white/60 dark:bg-black/20 rounded">
                  <p className="text-xs text-muted-foreground">{t('shipmentForm.tempsEstime')}</p>
                  <p className="font-bold text-blue-700 dark:text-blue-400 flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    {priceResult.estimatedTime} min
                  </p>
                </div>
                <div className="p-2 bg-white/60 dark:bg-black/20 rounded">
                  <p className="text-xs text-muted-foreground">{t('shipmentForm.prixLivraison')}</p>
                  <p className="font-bold text-orange-600">{formatCurrency(priceResult.totalPrice)}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {formatCurrency(priceResult.basePrice)} (base) + {formatCurrency(priceResult.distancePrice)} ({priceResult.distance} km × prix/km)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Détails du colis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-blue-600" />
            Détails du colis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="weight">Poids (kg) *</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="0.1"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                placeholder="0.0"
                required
              />
            </div>
            <div>
              <Label htmlFor="piecesCount">{t('shipmentForm.nombreDePieces')}</Label>
              <Input
                id="piecesCount"
                type="number"
                min="1"
                value={formData.piecesCount}
                onChange={(e) => handleInputChange('piecesCount', e.target.value)}
                placeholder="1"
              />
            </div>
            <div>
              <Label htmlFor="itemType">Type d'article</Label>
              <Input
                id="itemType"
                value={formData.itemType}
                onChange={(e) => handleInputChange('itemType', e.target.value)}
                placeholder={t('shipmentForm.exVetements')}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="packageDescription">{t('shipmentForm.descriptionDuContenu')}</Label>
            <Textarea
              id="packageDescription"
              value={formData.packageDescription}
              onChange={(e) => handleInputChange('packageDescription', e.target.value)}
              placeholder={t('shipmentForm.descriptionDetailleeDuContenuDu')}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('shipmentForm.optionsDExpedition')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contre-remboursement */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="cashOnDelivery" className="font-medium">Contre-remboursement</Label>
              <p className="text-sm text-muted-foreground">{t('shipmentForm.leDestinatairePaieALa')}</p>
            </div>
            <Switch
              id="cashOnDelivery"
              checked={formData.cashOnDelivery}
              onCheckedChange={(checked) => handleInputChange('cashOnDelivery', checked)}
            />
          </div>

          {formData.cashOnDelivery && (
            <div className="ml-4">
              <Label htmlFor="codAmount">{t('shipmentForm.montantACollecterGnf')}</Label>
              <Input
                id="codAmount"
                type="number"
                min="0"
                value={formData.codAmount}
                onChange={(e) => handleInputChange('codAmount', e.target.value)}
                placeholder="0"
              />
            </div>
          )}

          {/* Assurance */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="insurance" className="font-medium">Assurance</Label>
              <p className="text-sm text-muted-foreground">{t('shipmentForm.protegezVotreEnvoiContreLes')}</p>
            </div>
            <Switch
              id="insurance"
              checked={formData.insurance}
              onCheckedChange={(checked) => handleInputChange('insurance', checked)}
            />
          </div>

          {formData.insurance && (
            <div className="ml-4">
              <Label htmlFor="insuranceAmount">{t('shipmentForm.valeurDeclareeGnf')}</Label>
              <Input
                id="insuranceAmount"
                type="number"
                min="0"
                value={formData.insuranceAmount}
                onChange={(e) => handleInputChange('insuranceAmount', e.target.value)}
                placeholder="0"
              />
            </div>
          )}

          {/* Option de retour */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="returnOption" className="font-medium">{t('shipmentForm.optionDeRetour')}</Label>
              <p className="text-sm text-muted-foreground">{t('shipmentForm.retourGratuitEnCasDe')}</p>
            </div>
            <Switch
              id="returnOption"
              checked={formData.returnOption}
              onCheckedChange={(checked) => handleInputChange('returnOption', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Boutons */}
      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
        )}
        <Button
          type="submit"
          disabled={loading}
          className="bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-600/40"
        >
          {loading ? 'Création...' : 'Créer l\'expédition'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
