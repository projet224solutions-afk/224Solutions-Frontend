/**
 * POSCartSection - Section panier du POS avec remises par article
 * Affiche les articles du panier avec possibilité d'ajouter des remises individuelles
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Percent,
  DollarSign,
  AlertTriangle,
  Edit2,
  ShoppingBag,
  ChevronRight,
  Euro,
} from 'lucide-react';
import { toast } from 'sonner';

export interface CartItemDiscount {
  type: 'percent' | 'amount' | null;
  value: number;
  discountAmount: number;
}

export interface POSCartItem {
  id: string;
  name: string;
  price: number; // Prix unitaire
  quantity: number;
  total: number;
  costPrice: number; // Prix d'achat
  saleType?: 'unit' | 'carton';
  units_per_carton?: number;
  displayQuantity?: string;
  discount: CartItemDiscount;
}

interface POSCartSectionProps {
  cart: POSCartItem[];
  onUpdateQuantity: (itemId: string, quantity: number, saleType?: 'unit' | 'carton') => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onUpdateDiscount: (itemId: string, discount: CartItemDiscount) => void;
  formatCurrency: (amount: number) => string;
  isMobile: boolean;
  // Totals
  subtotal: number;
  globalDiscountValue: number;
  tax: number;
  total: number;
  // Global discount controls
  discountMode: 'percent' | 'amount';
  discountPercent: number;
  discountAmount: number;
  onDiscountModeChange: (mode: 'percent' | 'amount') => void;
  onDiscountPercentChange: (value: number) => void;
  onDiscountAmountChange: (value: number) => void;
  totalBeforeDiscount: number;
  onAddToCart: (item: any) => void;
  onAddToCartByCarton: (item: any) => void;
}

export function POSCartSection({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onUpdateDiscount,
  formatCurrency,
  isMobile,
  subtotal,
  globalDiscountValue,
  tax,
  total,
  discountMode,
  discountPercent,
  discountAmount,
  onDiscountModeChange,
  onDiscountPercentChange,
  onDiscountAmountChange,
  totalBeforeDiscount,
  onAddToCart,
  onAddToCartByCarton,
}: POSCartSectionProps) {
  const { t } = useTranslation();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDiscountType, setEditDiscountType] = useState<'percent' | 'amount'>('percent');
  const [editDiscountValue, setEditDiscountValue] = useState<number>(0);

  const editingItem = cart.find(item => item.id === editingItemId);

  const openDiscountDialog = (item: POSCartItem) => {
    setEditingItemId(item.id);
    setEditDiscountType(item.discount.type || 'percent');
    setEditDiscountValue(item.discount.value || 0);
  };

  const applyDiscount = () => {
    if (!editingItem) return;

    let discountAmt = 0;
    const unitPrice = editingItem.price;

    if (editDiscountType === 'percent') {
      discountAmt = (unitPrice * editDiscountValue) / 100;
    } else {
      discountAmt = editDiscountValue;
    }

    const finalPrice = unitPrice - discountAmt;
    if (finalPrice < 0) {
      toast.error(t('pOSCartSection.laRemiseNePeutPas'));
      return;
    }

    onUpdateDiscount(editingItem.id, {
      type: editDiscountValue > 0 ? editDiscountType : null,
      value: editDiscountValue,
      discountAmount: discountAmt * editingItem.quantity,
    });

    setEditingItemId(null);
    toast.success(t('pOSCartSection.remiseAppliquee'));
  };

  const removeDiscount = () => {
    if (!editingItem) return;
    onUpdateDiscount(editingItem.id, {
      type: null,
      value: 0,
      discountAmount: 0,
    });
    setEditingItemId(null);
    toast.info(t('pOSCartSection.remiseSupprimee'));
  };

  // Calculate item financials
  const calculateItemFinancials = (item: POSCartItem) => {
    const unitPrice = item.price;
    const costPrice = item.costPrice || 0;

    let discountPerUnit = 0;
    if (item.discount.type === 'percent') {
      discountPerUnit = (unitPrice * item.discount.value) / 100;
    } else if (item.discount.type === 'amount') {
      discountPerUnit = item.discount.value;
    }

    const finalUnitPrice = unitPrice - discountPerUnit;
    const finalTotal = finalUnitPrice * item.quantity;
    const profitPerUnit = finalUnitPrice - costPrice;
    const totalProfit = profitPerUnit * item.quantity;
    const isLoss = finalUnitPrice < costPrice;

    return {
      finalUnitPrice,
      finalTotal,
      discountPerUnit,
      totalDiscountAmount: discountPerUnit * item.quantity,
      profitPerUnit,
      totalProfit,
      isLoss,
    };
  };

  // Calculate total item discounts
  const totalItemDiscounts = cart.reduce((sum, item) => {
    const { totalDiscountAmount } = calculateItemFinancials(item);
    return sum + totalDiscountAmount;
  }, 0);

  return (
    <>
      <Card className="shadow-xl border-0 bg-card overflow-hidden flex flex-col max-w-full md:flex-1 md:max-h-full">
        {/* Header */}
        <div className="p-1.5 sm:p-2 bg-primary/15 border-b border-primary/20 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-md bg-primary/20">
                <ShoppingCart className="h-4 w-4 text-primary" />
              </div>
              <Badge
                variant="secondary"
                className="bg-primary text-primary-foreground font-bold px-1.5 text-[11px] tabular-nums"
              >
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs sm:text-sm font-black text-primary tabular-nums">
                {formatCurrency(subtotal)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearCart}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Cart Items */}
        <div className="overflow-auto p-1.5 sm:p-2 max-h-[180px] md:flex-1 md:max-h-none md:min-h-0">
          <ScrollArea className="h-full">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <ShoppingBag className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-muted-foreground font-medium text-sm">Panier vide</p>
                <p className="text-xs text-muted-foreground/80">{t('pOSCartSection.ajoutezDesProduits')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {cart.map(item => {
                  const financials = calculateItemFinancials(item);

                  return (
                    <div
                      key={`${item.id}-${item.saleType || 'unit'}`}
                      className={`flex items-center gap-1.5 p-1.5 sm:p-2 bg-background/80 rounded-lg border ${
                        financials.isLoss ? 'border-destructive bg-destructive/5' : 'border-border/30'
                      }`}
                    >
                      {/* Loss warning */}
                      {financials.isLoss && (
                        <div className="absolute -top-1 -right-1">
                          <Badge variant="destructive" className="gap-0.5 text-[9px] px-1">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            PERTE
                          </Badge>
                        </div>
                      )}

                      {/* Name + Price */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[11px] sm:text-xs truncate">
                          {item.saleType === 'carton' && '📦 '}
                          {item.name}
                        </p>
                        <div className="flex items-center gap-1">
                          <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                            {formatCurrency(item.price)}
                          </p>
                          {/* Item discount badge */}
                          {item.discount.type && item.discount.value > 0 && (
                            <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3 gap-0.5">
                              {item.discount.type === 'percent' ? (
                                <>-{item.discount.value}%</>
                              ) : (
                                <>-{formatCurrency(item.discount.value)}</>
                              )}
                            </Badge>
                          )}
                        </div>
                        {/* Profit/Loss indicator */}
                        <p className={`text-[8px] ${financials.isLoss ? 'text-destructive' : 'text-[#ff4000]'}`}>
                          {financials.isLoss
                            ? `Perte: ${formatCurrency(Math.abs(financials.totalProfit))}`
                            : `Profit: +${formatCurrency(financials.totalProfit)}`
                          }
                        </p>
                      </div>

                      {/* Quantity controls */}
                      <div className="flex items-center bg-muted/40 rounded-md">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const decrementBy = item.saleType === 'carton' && item.units_per_carton
                              ? item.units_per_carton
                              : 1;
                            onUpdateQuantity(item.id, item.quantity - decrementBy, item.saleType);
                          }}
                          className="h-6 w-6 p-0 hover:bg-destructive/20"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="font-mono font-bold text-xs w-5 text-center">
                          {item.saleType === 'carton' && item.units_per_carton
                            ? Math.floor(item.quantity / item.units_per_carton)
                            : item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (item.saleType === 'carton') {
                              onAddToCartByCarton(item);
                            } else {
                              onAddToCart(item);
                            }
                          }}
                          className="h-6 w-6 p-0 hover:bg-primary/20"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Total + Actions */}
                      <div className="flex items-center gap-0.5">
                        <div className="text-right">
                          {financials.totalDiscountAmount > 0 && (
                            <span className="text-[8px] line-through text-muted-foreground block">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          )}
                          <span className="font-bold text-primary text-[10px] sm:text-xs">
                            {formatCurrency(financials.finalTotal)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDiscountDialog(item)}
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
                          title="Appliquer remise"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveItem(item.id)}
                          className="text-muted-foreground hover:text-destructive h-5 w-5 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Payment section */}
        {cart.length > 0 && (
          <div className="border-t border-primary/20 bg-muted/20 flex-shrink-0 p-2 sm:p-3 space-y-2">
            {/* Global discount - Collapsible */}
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <div className="flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-bold">Remise globale</span>
                  {(globalDiscountValue > 0 || totalItemDiscounts > 0) && (
                    <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                      -{formatCurrency(globalDiscountValue + totalItemDiscounts)}
                    </Badge>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>

              <div className="mt-2 space-y-2 p-2 bg-muted/20 rounded-lg">
                <div className="grid grid-cols-2 gap-1">
                  <Button
                    variant={discountMode === 'percent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      onDiscountModeChange('percent');
                      onDiscountAmountChange(0);
                    }}
                    className="h-7 text-[10px]"
                  >
                    <Percent className="h-3 w-3 mr-1" />%
                  </Button>
                  <Button
                    variant={discountMode === 'amount' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      onDiscountModeChange('amount');
                      onDiscountPercentChange(0);
                    }}
                    className="h-7 text-[10px]"
                  >
                    <Euro className="h-3 w-3 mr-1" />GNF
                  </Button>
                </div>

                <Input
                  type="number"
                  value={discountMode === 'percent' ? (discountPercent || '') : (discountAmount || '')}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (discountMode === 'percent') {
                      onDiscountPercentChange(Math.min(100, Math.max(0, val)));
                    } else {
                      onDiscountAmountChange(Math.min(val, totalBeforeDiscount));
                    }
                  }}
                  className="h-8 text-sm font-bold text-center"
                  placeholder={discountMode === 'percent' ? 'Ex: 10%' : 'Ex: 5000'}
                />

                {/* Show item discounts summary */}
                {totalItemDiscounts > 0 && (
                  <div className="text-[10px] text-muted-foreground bg-muted/50 p-1.5 rounded">
                    Remises articles: -{formatCurrency(totalItemDiscounts)}
                  </div>
                )}
              </div>
            </details>

            {/* Total and Tax */}
            <div className="space-y-1.5 py-1.5 border-y border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  TVA: {formatCurrency(tax)}
                </span>
                {(globalDiscountValue > 0 || totalItemDiscounts > 0) && (
                  <span className="text-[10px] text-muted-foreground line-through">
                    {formatCurrency(totalBeforeDiscount)}
                  </span>
                )}
              </div>

              {totalItemDiscounts > 0 && (
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#ff4000]">
                  <span>Remises articles</span>
                  <span>-{formatCurrency(totalItemDiscounts)}</span>
                </div>
              )}

              {globalDiscountValue > 0 && (
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#ff4000]">
                  <span>Remise globale</span>
                  <span>-{formatCurrency(globalDiscountValue)}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-foreground">{t('pOSCartSection.totalAPayer')}</span>
                <div className="text-right">
                  <span className="text-lg sm:text-xl font-black text-primary">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Discount Dialog */}
      <Dialog open={!!editingItemId} onOpenChange={(open) => !open && setEditingItemId(null)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Remise sur {editingItem?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('pOSCartSection.typeDeRemise')}</label>
              <Select
                value={editDiscountType}
                onValueChange={(v: 'percent' | 'amount') => setEditDiscountType(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Pourcentage (%)</SelectItem>
                  <SelectItem value="amount">{t('pOSCartSection.montantFixeGnf')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                {editDiscountType === 'percent' ? 'Pourcentage' : 'Montant'}
              </label>
              <Input
                type="number"
                min={0}
                max={editDiscountType === 'percent' ? 100 : editingItem?.price}
                value={editDiscountValue}
                onChange={(e) => setEditDiscountValue(parseFloat(e.target.value) || 0)}
              />
            </div>

            {/* Preview */}
            {editDiscountValue > 0 && editingItem && (
              <Card className="bg-muted/50">
                <CardContent className="p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Prix original:</span>
                    <span>{formatCurrency(editingItem.price)}</span>
                  </div>
                  <div className="flex justify-between text-destructive">
                    <span>Remise:</span>
                    <span>
                      -
                      {editDiscountType === 'percent'
                        ? formatCurrency((editingItem.price * editDiscountValue) / 100)
                        : formatCurrency(editDiscountValue)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Prix final:</span>
                    <span>
                      {formatCurrency(
                        editDiscountType === 'percent'
                          ? editingItem.price - (editingItem.price * editDiscountValue) / 100
                          : editingItem.price - editDiscountValue
                      )}
                    </span>
                  </div>

                  {/* Loss alert */}
                  {(() => {
                    const finalPrice =
                      editDiscountType === 'percent'
                        ? editingItem.price - (editingItem.price * editDiscountValue) / 100
                        : editingItem.price - editDiscountValue;
                    if (finalPrice < (editingItem.costPrice || 0)) {
                      return (
                        <div className="flex items-center gap-2 mt-2 p-2 bg-destructive/10 rounded text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs">
                            Attention: Prix inférieur au coût d'achat (
                            {formatCurrency(editingItem.costPrice || 0)})
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
            {editingItem?.discount.type && (
              <Button variant="destructive" onClick={removeDiscount}>
                Supprimer
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditingItemId(null)}>
              Annuler
            </Button>
            <Button onClick={applyDiscount}>Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
