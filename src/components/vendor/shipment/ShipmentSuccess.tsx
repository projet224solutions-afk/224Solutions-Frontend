/**
 * ÉCRAN DE CONFIRMATION D'EXPÉDITION
 * Affiche le numéro de suivi et les détails après création
 */

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Package, User, MapPin, Clock, Edit, Plus, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ShipmentSuccessProps {
  shipmentId: string;
  trackingNumber: string;
  onNewShipment: () => void;
  onEdit?: () => void;
}

interface ShipmentDetails {
  id: string;
  tracking_number: string;
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  weight: number;
  pieces_count: number;
  item_type?: string;
  package_description?: string;
  cash_on_delivery: boolean;
  cod_amount?: number;
  insurance: boolean;
  insurance_amount?: number;
  return_option: boolean;
  status: string;
  created_at: string;
}

export function ShipmentSuccess({ shipmentId, trackingNumber, onNewShipment, onEdit }: ShipmentSuccessProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const [shipment, setShipment] = useState<ShipmentDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShipmentDetails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  const loadShipmentDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', shipmentId)
        .single();

      if (error) throw error;
      setShipment(data as any);
    } catch (error) {
      console.error('Error loading shipment:', error);
      toast.error(t('shipmentSuccess.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const copyTrackingNumber = () => {
    navigator.clipboard.writeText(trackingNumber);
    toast.success(t('shipmentSuccess.numeroDeSuiviCopie'));
  };

  if (loading || !shipment) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Animation de succès */}
      <Card className="bg-[#ff4000]/5 border-orange-200">
        <CardContent className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
            <CheckCircle className="h-10 w-10 text-[#ff4000] animate-in zoom-in duration-300" />
          </div>
          <h2 className="text-2xl font-bold text-[#ff4000] mb-2">下单成功 !</h2>
          <p className="text-[#ff4000] mb-6">{t('shipmentSuccess.commandeDExpeditionCreeeAvec')}</p>

          {/* Numéro de suivi */}
          <div className="bg-white rounded-lg p-4 mb-4 border-2 border-orange-300">
            <p className="text-sm text-muted-foreground mb-1">{t('shipmentSuccess.numeroDeSuivi')}</p>
            <div className="flex items-center justify-center gap-2">
              <p className="text-2xl font-bold text-[#ff4000] tracking-wider">{trackingNumber}</p>
              <Button
                variant="ghost"
                size="icon"
                onClick={copyTrackingNumber}
                className="h-8 w-8"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Date et heure */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{format(new Date(shipment.created_at), 'dd/MM/yyyy à HH:mm')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Détails de l'expédition */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-orange-600" />
            Détails de l'expédition
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Expéditeur */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
              <User className="h-4 w-4" />
              <span>{t('shipmentSuccess.expediteur')}</span>
            </div>
            <div className="ml-6 space-y-1">
              <p className="font-medium">{shipment.sender_name}</p>
              <p className="text-sm text-muted-foreground">{shipment.sender_phone}</p>
              <p className="text-sm text-muted-foreground">{shipment.sender_address}</p>
            </div>
          </div>

          {/* Destinataire */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-[#ff4000]">
              <MapPin className="h-4 w-4" />
              <span>Destinataire</span>
            </div>
            <div className="ml-6 space-y-1">
              <p className="font-medium">{shipment.receiver_name}</p>
              <p className="text-sm text-muted-foreground">{shipment.receiver_phone}</p>
              <p className="text-sm text-muted-foreground">{shipment.receiver_address}</p>
            </div>
          </div>

          {/* Détails du colis */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
              <Package className="h-4 w-4" />
              <span>{t('shipmentSuccess.informationsDuColis')}</span>
            </div>
            <div className="ml-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Poids</p>
                <p className="font-medium">{shipment.weight} kg</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('shipmentSuccess.nombreDePieces')}</p>
                <p className="font-medium">{shipment.pieces_count}</p>
              </div>
              {shipment.item_type && (
                <div>
                  <p className="text-sm text-muted-foreground">Type d'article</p>
                  <p className="font-medium">{shipment.item_type}</p>
                </div>
              )}
            </div>
            {shipment.package_description && (
              <div className="ml-6 mt-2">
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-sm">{shipment.package_description}</p>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-2">
            {shipment.cash_on_delivery && (
              <Badge variant="secondary" className="bg-orange-100 text-[#ff4000]">
                Contre-remboursement: {fc(shipment.cod_amount || 0)}
              </Badge>
            )}
            {shipment.insurance && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Assuré: {fc(shipment.insurance_amount || 0)}
              </Badge>
            )}
            {shipment.return_option && (
              <Badge variant="secondary" className="bg-blue-100 text-[#04439e]">
                Option de retour
              </Badge>
            )}
          </div>

          {/* Statut */}
          <div className="flex items-center gap-2">
            <Badge className="bg-orange-100 text-[#ff4000]">
              Commande créée
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        {onEdit && (
          <Button
            variant="outline"
            onClick={onEdit}
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Modifier la commande
          </Button>
        )}
        <Button
          onClick={onNewShipment}
          className="bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-600/40 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Créer un nouvel envoi
        </Button>
      </div>
    </div>
  );
}
