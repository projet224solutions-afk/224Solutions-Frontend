/**
 * CHINA LOGISTICS TRACKING COMPONENT
 * Suivi logistique multi-segments Chine → Client
 * Extension du module dropshipping existant
 *
 * @module ChinaLogisticsTracking
 * @version 1.0.0
 */

import { useState, useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';




import {
  Package,
  Truck,
  Plane,
  Ship,
  Train,
  CheckCircle,
  Clock,
  AlertTriangle,
  MapPin,
  Globe,
  Building2,
  Home,
  RefreshCw,
  Copy,
  Info,
  ShieldAlert
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import type {
  ChinaLogistics,
  ChinaSupplierOrder,
  ChinaOrderStatus,
  TransportMethod
} from '@/types/china-dropshipping';
import { TRANSPORT_METHODS } from '@/types/china-dropshipping';

// ==================== INTERFACES ====================

interface ChinaLogisticsTrackingProps {
  order: ChinaSupplierOrder;
  logistics?: ChinaLogistics;
  onRefreshTracking?: () => Promise<void>;
}

interface TrackingStep {
  key: ChinaOrderStatus;
  label: string;
  icon: React.ReactNode;
  description: string;
  segment: 'supplier' | 'china' | 'international' | 'customs' | 'lastmile';
}

// ==================== CONSTANTS ====================

const TRACKING_STEPS: TrackingStep[] = [
  {
    key: 'pending_supplier_confirm',
    label: 'En attente fournisseur',
    icon: <Clock className="w-4 h-4" />,
    description: "Commande envoyée au fournisseur",
    segment: 'supplier'
  },
  {
    key: 'supplier_confirmed',
    label: "Confirmé par fournisseur",
    icon: <CheckCircle className="w-4 h-4" />,
    description: "Le fournisseur a accepté la commande",
    segment: 'supplier'
  },
  {
    key: 'in_production',
    label: 'En production',
    icon: <Building2 className="w-4 h-4" />,
    description: 'Fabrication en cours',
    segment: 'supplier'
  },
  {
    key: 'quality_check',
    label: "Contrôle qualité",
    icon: <ShieldAlert className="w-4 h-4" />,
    description: "Vérification avant expédition",
    segment: 'supplier'
  },
  {
    key: 'ready_to_ship',
    label: "Prêt à expédier",
    icon: <Package className="w-4 h-4" />,
    description: "Produit emballé et prêt",
    segment: 'supplier'
  },
  {
    key: 'shipped_domestic_china',
    label: "Expédié en Chine",
    icon: <Truck className="w-4 h-4" />,
    description: "En route vers entrepôt de consolidation",
    segment: 'china'
  },
  {
    key: 'at_consolidation_warehouse',
    label: "Entrepôt de transit",
    icon: <Building2 className="w-4 h-4" />,
    description: "Arrivé à l'entrepôt de consolidation",
    segment: 'china'
  },
  {
    key: 'shipped_international',
    label: "Expédition internationale",
    icon: <Plane className="w-4 h-4" />,
    description: "En route vers le pays de destination",
    segment: 'international'
  },
  {
    key: 'customs_clearance',
    label: "Dédouanement",
    icon: <Globe className="w-4 h-4" />,
    description: "En cours de dédouanement",
    segment: 'customs'
  },
  {
    key: 'last_mile_delivery',
    label: "Livraison locale",
    icon: <Truck className="w-4 h-4" />,
    description: "En cours de livraison",
    segment: 'lastmile'
  },
  {
    key: 'delivered',
    label: "Livré",
    icon: <Home className="w-4 h-4" />,
    description: 'Colis remis au destinataire',
    segment: 'lastmile'
  }
];

const STATUS_COLORS: Record<string, string> = {
  pending_supplier_confirm: 'bg-[#ff4000]',
  supplier_confirmed: 'bg-blue-500',
  in_production: 'bg-[#04439e]',
  quality_check: 'bg-[#04439e]',
  ready_to_ship: 'bg-[#04439e]',
  shipped_domestic_china: 'bg-[#ff4000]',
  at_consolidation_warehouse: 'bg-[#ff4000]',
  shipped_international: 'bg-[#ff4000]',
  customs_clearance: 'bg-orange-500',
  last_mile_delivery: 'bg-[#ff4000]',
  delivered: 'bg-[#ff4000]',
  cancelled: 'bg-[#ff4000]',
  disputed: 'bg-[#ff4000]'
};

// ==================== HELPERS ====================

const getTransportIcon = (method?: TransportMethod) => {
  switch (method) {
    case 'EXPRESS':
    case 'AIR': return <Plane className="w-5 h-5" />;
    case 'SEA': return <Ship className="w-5 h-5" />;
    case 'RAIL': return <Train className="w-5 h-5" />;
    default: return <Truck className="w-5 h-5" />;
  }
};

const getStepIndex = (status: ChinaOrderStatus): number => {
  return TRACKING_STEPS.findIndex(s => s.key === status);
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return null;
  return format(new Date(dateStr), 'dd MMM yyyy HH:mm', { locale: fr });
};

// ==================== COMPOSANT PRINCIPAL ====================

export function ChinaLogisticsTracking({
  order,
  logistics,
  onRefreshTracking
}: ChinaLogisticsTrackingProps) {
  const { t } = useTranslation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calcul de la progression
  const currentStepIndex = getStepIndex(order.status);
  const progressPercent = Math.round(((currentStepIndex + 1) / TRACKING_STEPS.length) * 100);

  // Estimation livraison
  const estimatedDelivery = useMemo(() => {
    if (!logistics) return null;
    const totalDays = logistics.estimated_total_days;
    const createdDate = new Date(order.created_at);
    return addDays(createdDate, totalDays);
  }, [logistics, order.created_at]);

  const daysRemaining = useMemo(() => {
    if (!estimatedDelivery) return null;
    return differenceInDays(estimatedDelivery, new Date());
  }, [estimatedDelivery]);

  // Handlers
  const handleRefresh = async () => {
    if (!onRefreshTracking) return;
    setIsRefreshing(true);
    try {
      await onRefreshTracking();
      toast.success(t('chinaLogisticsTracking.trackingMisAJour'));
    } catch (_error) {
      toast.error(t('chinaLogisticsTracking.erreurLorsDeLaMise'));
    } finally {
      setIsRefreshing(false);
    }
  };

  const copyTrackingNumber = (number: string) => {
    navigator.clipboard.writeText(number);
    toast.success(t('chinaLogisticsTracking.numeroCopie'));
  };

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Header avec estimation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-500'}`}>
                {getTransportIcon(logistics?.transport_method)}
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  {TRACKING_STEPS.find(s => s.key === order.status)?.label || order.status}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Commande #{order.id.slice(0, 8)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {estimatedDelivery && daysRemaining !== null && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{t('chinaLogisticsTracking.livraisonEstimee')}</p>
                  <p className="font-semibold">
                    {format(estimatedDelivery, 'dd MMM yyyy', { locale: fr })}
                  </p>
                  <Badge variant={daysRemaining <= 3 ? 'default' : 'secondary'}>
                    {daysRemaining > 0 ? `${daysRemaining} jours restants` : 'Livraison imminente'}
                  </Badge>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
            </div>
          </div>

          {/* Barre de progression */}
          <div className="mt-6">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Progression</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Timeline détaillée */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('chinaLogisticsTracking.suiviDetaille')}</CardTitle>
          <CardDescription>
            Parcours de votre colis de la Chine jusqu'à destination
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {TRACKING_STEPS.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const historyItem = order.status_history?.find(h => h.status === step.key);

              return (
                <div key={step.key} className="flex gap-4 pb-6 last:pb-0">
                  {/* Ligne verticale */}
                  <div className="flex flex-col items-center">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      ${isCompleted
                        ? isCurrent
                          ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                          : 'bg-[#ff4000] text-white'
                        : 'bg-muted text-muted-foreground'
                      }
                    `}>
                      {isCompleted && !isCurrent ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    {index < TRACKING_STEPS.length - 1 && (
                      <div className={`w-0.5 flex-1 mt-2 ${
                        isCompleted ? 'bg-[#ff4000]' : 'bg-muted'
                      }`} />
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-medium ${
                        isCompleted ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {step.label}
                      </h4>
                      {isCurrent && (
                        <Badge variant="default" className="text-xs">
                          En cours
                        </Badge>
                      )}
                      {step.segment === 'customs' && logistics?.customs_status === 'held' && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Retenu
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                    {historyItem && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(historyItem.timestamp)}
                        {historyItem.note && ` - ${historyItem.note}`}
                      </p>
                    )}

                    {/* Informations de tracking par segment */}
                    {isCompleted && step.segment === 'china' && logistics?.tracking_domestic && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <Badge variant="outline">
                          {logistics.carrier_domestic || 'Transporteur Chine'}
                        </Badge>
                        <code className="bg-muted px-2 py-0.5 rounded text-xs">
                          {logistics.tracking_domestic}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyTrackingNumber(logistics.tracking_domestic!)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}

                    {isCompleted && step.segment === 'international' && logistics?.tracking_international && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <Badge variant="outline">
                          {logistics.carrier_international || 'International'}
                        </Badge>
                        <code className="bg-muted px-2 py-0.5 rounded text-xs">
                          {logistics.tracking_international}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyTrackingNumber(logistics.tracking_international!)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}

                    {isCompleted && step.segment === 'lastmile' && logistics?.tracking_last_mile && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <Badge variant="outline">
                          {logistics.carrier_last_mile || 'Livraison locale'}
                        </Badge>
                        <code className="bg-muted px-2 py-0.5 rounded text-xs">
                          {logistics.tracking_last_mile}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyTrackingNumber(logistics.tracking_last_mile!)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Détails logistiques */}
      {logistics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="w-4 h-4" />
              Détails logistiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Méthode de transport */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  {getTransportIcon(logistics.transport_method)}
                  Transport: {TRANSPORT_METHODS[logistics.transport_method]?.name || logistics.transport_method}
                </h4>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Production</p>
                    <p className="font-medium">{logistics.estimated_production_days} jours</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Chine interne</p>
                    <p className="font-medium">{logistics.estimated_domestic_days} jours</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">International</p>
                    <p className="font-medium">{logistics.estimated_international_days} jours</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Douane</p>
                    <p className="font-medium">{logistics.estimated_customs_days} jours</p>
                  </div>
                </div>
              </div>

              {/* Douane */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Informations douanières
                </h4>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Statut douane</span>
                    <Badge variant={
                      logistics.customs_status === 'cleared' ? 'default' :
                      logistics.customs_status === 'held' ? 'destructive' : 'secondary'
                    }>
                      {logistics.customs_status === 'cleared' ? 'Dédouané' :
                       logistics.customs_status === 'held' ? 'Retenu' :
                       logistics.customs_status === 'pending' ? 'En attente' : logistics.customs_status}
                    </Badge>
                  </div>

                  {logistics.customs_reference && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('chinaLogisticsTracking.reference')}</span>
                      <span className="font-mono">{logistics.customs_reference}</span>
                    </div>
                  )}

                  {logistics.customs_duty_amount && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('chinaLogisticsTracking.droitsDeDouane')}</span>
                      <span className="font-medium">
                        {logistics.customs_duty_amount} {logistics.customs_duty_currency}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Affichage client */}
            {logistics.show_origin_to_customer && (
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>{t('chinaLogisticsTracking.informationClient')}</strong> Délai estimé {logistics.customer_estimated_min_days}-{logistics.customer_estimated_max_days} jours ouvrables
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Adresse de livraison */}
      {order.shipping_address && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Adresse de livraison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <p className="font-medium">{order.shipping_address.recipient_name}</p>
              <p className="text-muted-foreground">{order.shipping_address.phone}</p>
              <p>{order.shipping_address.address_line1}</p>
              {order.shipping_address.address_line2 && (
                <p>{order.shipping_address.address_line2}</p>
              )}
              <p>
                {order.shipping_address.city}
                {order.shipping_address.state_province && `, ${order.shipping_address.state_province}`}
                {order.shipping_address.postal_code && ` ${order.shipping_address.postal_code}`}
              </p>
              <p className="font-medium">{order.shipping_address.country}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ChinaLogisticsTracking;
