import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUp,
  ArrowDown,
  Package,
  ShoppingCart,
  RotateCcw,
  Truck,
  AlertCircle
} from "lucide-react";
import { InventoryHistory as InventoryHistoryType } from "@/hooks/useInventoryService";

interface InventoryHistoryProps {
  history: InventoryHistoryType[];
}

export default function InventoryHistory({ history }: InventoryHistoryProps) {
  const { t } = useTranslation();
  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'sale': return <ShoppingCart className="w-4 h-4" />;
      case 'purchase': return <Package className="w-4 h-4" />;
      case 'return': return <RotateCcw className="w-4 h-4" />;
      case 'transfer': return <Truck className="w-4 h-4" />;
      case 'loss': return <AlertCircle className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'sale': return 'text-[#ff4000] bg-orange-50';
      case 'purchase': return 'text-[#ff4000] bg-orange-50';
      case 'return': return 'text-blue-600 bg-blue-50';
      case 'transfer': return 'text-[#04439e] bg-blue-50';
      case 'loss': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getMovementLabel = (type: string) => {
    switch (type) {
      case 'sale': return 'Vente';
      case 'purchase': return 'Achat';
      case 'return': return 'Retour';
      case 'transfer': return 'Transfert';
      case 'loss': return 'Perte';
      case 'adjustment': return 'Ajustement';
      default: return type;
    }
  };

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('inventoryHistory.aucunMouvementEnregistre')}</h3>
          <p className="text-muted-foreground">
            Les mouvements de stock apparaîtront ici
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('inventoryHistory.historiqueDesMouvements')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className={`p-2 rounded-full ${getMovementColor(item.movement_type)}`}>
                  {getMovementIcon(item.movement_type)}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={getMovementColor(item.movement_type)}>
                      {getMovementLabel(item.movement_type)}
                    </Badge>
                    {item.product && (
                      <span className="font-medium">{item.product.name}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      {item.previous_quantity} → {item.new_quantity} unités
                    </span>
                    {item.warehouse && (
                      <span className="flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {item.warehouse.name}
                      </span>
                    )}
                    {item.order && (
                      <span>Commande #{item.order.order_number}</span>
                    )}
                  </div>

                  {item.notes && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.notes}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(item.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {item.quantity_change > 0 ? (
                  <div className="flex items-center gap-1 text-[#ff4000]">
                    <ArrowUp className="w-4 h-4" />
                    <span className="font-semibold">+{item.quantity_change}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[#ff4000]">
                    <ArrowDown className="w-4 h-4" />
                    <span className="font-semibold">{item.quantity_change}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}