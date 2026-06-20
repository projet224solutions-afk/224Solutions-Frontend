/**
 * CartItemWithDiscount - Composant panier avec remise par article
 * Permet d'appliquer des remises en montant ou pourcentage par article
 * Affiche une alerte si le prix final < coût d'achat
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Percent, DollarSign, Trash2, AlertTriangle, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

export interface CartItemDiscount {
  type: 'percent' | 'amount' | null;
  value: number;
  amount: number; // Montant de la remise calculé
}

export interface CartItemWithDiscountData {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number; // Prix original
  costPrice: number; // Prix d'achat
  total: number;
  discount: CartItemDiscount;
  finalUnitPrice: number;
  finalTotal: number;
  profitBeforeDiscount: number;
  profitAfterDiscount: number;
  isLoss: boolean;
}

interface CartItemWithDiscountProps {
  item: CartItemWithDiscountData;
  onUpdateDiscount: (itemId: string, discount: CartItemDiscount) => void;
  onRemove: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  formatCurrency: (amount: number) => string;
}

export function CartItemWithDiscount({
  item,
  onUpdateDiscount,
  onRemove,
  onUpdateQuantity,
  formatCurrency,
}: CartItemWithDiscountProps) {
  const { t } = useTranslation();
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>(
    item.discount.type || 'percent'
  );
  const [discountValue, setDiscountValue] = useState<number>(item.discount.value || 0);

  const handleApplyDiscount = () => {
    let discountAmount = 0;
    let finalPrice = item.unitPrice;

    if (discountType === 'percent') {
      discountAmount = (item.unitPrice * discountValue) / 100;
      finalPrice = item.unitPrice - discountAmount;
    } else {
      discountAmount = discountValue;
      finalPrice = item.unitPrice - discountValue;
    }

    if (finalPrice < 0) {
      toast.error(t('cartItemWithDiscount.laRemiseNePeutPas'));
      return;
    }

    onUpdateDiscount(item.id, {
      type: discountValue > 0 ? discountType : null,
      value: discountValue,
      amount: discountAmount,
    });

    setIsDiscountDialogOpen(false);
    toast.success(t('cartItemWithDiscount.remiseAppliquee'));
  };

  const handleRemoveDiscount = () => {
    onUpdateDiscount(item.id, {
      type: null,
      value: 0,
      amount: 0,
    });
    setDiscountValue(0);
    toast.info(t('cartItemWithDiscount.remiseSupprimee'));
  };

  return (
    <>
      <Card className={`relative ${item.isLoss ? 'border-destructive bg-destructive/5' : ''}`}>
        <CardContent className="p-3">
          {/* Alerte perte */}
          {item.isLoss && (
            <div className="absolute -top-2 -right-2">
              <Badge variant="destructive" className="gap-1 text-xs">
                <AlertTriangle className="h-3 w-3" />
                PERTE
              </Badge>
            </div>
          )}

          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{item.name}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>Qté: {item.quantity}</span>
                <span>×</span>
                <span>{formatCurrency(item.unitPrice)}</span>
              </div>

              {/* Affichage remise */}
              {item.discount.type && item.discount.value > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="secondary" className="text-xs gap-1">
                    {item.discount.type === 'percent' ? (
                      <>
                        <Percent className="h-3 w-3" />
                        -{item.discount.value}%
                      </>
                    ) : (
                      <>
                        <DollarSign className="h-3 w-3" />
                        -{formatCurrency(item.discount.value)}
                      </>
                    )}
                  </Badge>
                  <span className="text-xs text-muted-foreground line-through">
                    {formatCurrency(item.unitPrice)}
                  </span>
                  <span className="text-xs font-medium text-[#ff4000]">
                    {formatCurrency(item.finalUnitPrice)}
                  </span>
                </div>
              )}

              {/* Profit / Perte */}
              <div className="mt-1 text-xs">
                {item.isLoss ? (
                  <span className="text-destructive font-medium">
                    Perte: {formatCurrency(Math.abs(item.profitAfterDiscount))}
                  </span>
                ) : (
                  <span className="text-[#ff4000]">
                    Profit: +{formatCurrency(item.profitAfterDiscount)}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="font-bold text-sm">
                {item.discount.amount > 0 ? (
                  <>
                    <span className="line-through text-muted-foreground text-xs mr-1">
                      {formatCurrency(item.total)}
                    </span>
                    {formatCurrency(item.finalTotal)}
                  </>
                ) : (
                  formatCurrency(item.total)
                )}
              </p>

              <div className="flex items-center gap-1 mt-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsDiscountDialogOpen(true)}
                  title={t('cartItemWithDiscount.appliquerUneRemise')}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => onRemove(item.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog remise */}
      <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Remise sur {item.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t('cartItemWithDiscount.typeDeRemise')}</Label>
              <Select
                value={discountType}
                onValueChange={(v: 'percent' | 'amount') => setDiscountType(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Pourcentage (%)</SelectItem>
                  <SelectItem value="amount">{t('cartItemWithDiscount.montantFixeGnf')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>
                {discountType === 'percent' ? 'Pourcentage de remise' : 'Montant de remise'}
              </Label>
              <Input
                type="number"
                min={0}
                max={discountType === 'percent' ? 100 : item.unitPrice}
                value={discountValue}
                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
              />
            </div>

            {/* Prévisualisation */}
            {discountValue > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Prix original:</span>
                    <span>{formatCurrency(item.unitPrice)}</span>
                  </div>
                  <div className="flex justify-between text-destructive">
                    <span>Remise:</span>
                    <span>
                      -
                      {discountType === 'percent'
                        ? formatCurrency((item.unitPrice * discountValue) / 100)
                        : formatCurrency(discountValue)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Prix final:</span>
                    <span>
                      {formatCurrency(
                        discountType === 'percent'
                          ? item.unitPrice - (item.unitPrice * discountValue) / 100
                          : item.unitPrice - discountValue
                      )}
                    </span>
                  </div>

                  {/* Alerte perte */}
                  {(() => {
                    const finalPrice =
                      discountType === 'percent'
                        ? item.unitPrice - (item.unitPrice * discountValue) / 100
                        : item.unitPrice - discountValue;
                    if (finalPrice < item.costPrice) {
                      return (
                        <div className="flex items-center gap-2 mt-2 p-2 bg-destructive/10 rounded text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs">
                            Attention: Prix inférieur au coût d'achat (
                            {formatCurrency(item.costPrice)})
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            {item.discount.type && (
              <Button variant="destructive" onClick={handleRemoveDiscount}>
                Supprimer remise
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsDiscountDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleApplyDiscount}>Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Calcule les données d'un article avec remise
 */
export function calculateCartItemWithDiscount(
  id: string,
  name: string,
  quantity: number,
  unitPrice: number,
  costPrice: number,
  discount: CartItemDiscount
): CartItemWithDiscountData {
  const total = quantity * unitPrice;

  let discountAmount = 0;
  if (discount.type === 'percent') {
    discountAmount = (unitPrice * discount.value) / 100;
  } else if (discount.type === 'amount') {
    discountAmount = discount.value;
  }

  const finalUnitPrice = unitPrice - discountAmount;
  const finalTotal = quantity * finalUnitPrice;

  const profitBeforeDiscount = (unitPrice - costPrice) * quantity;
  const profitAfterDiscount = (finalUnitPrice - costPrice) * quantity;
  const isLoss = finalUnitPrice < costPrice;

  return {
    id,
    name,
    quantity,
    unitPrice,
    costPrice,
    total,
    discount: {
      ...discount,
      amount: discountAmount * quantity,
    },
    finalUnitPrice,
    finalTotal,
    profitBeforeDiscount,
    profitAfterDiscount,
    isLoss,
  };
}
