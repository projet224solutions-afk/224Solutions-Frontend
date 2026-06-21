import React, { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Calculator,
  Trash2,
  CheckSquare,
  Package
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface QuantityKeypadPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProduct: Product | null;
  onConfirm: (product: Product, quantity: number) => void;
  currency: string;
}

export function QuantityKeypadPopup({
  open,
  onOpenChange,
  selectedProduct,
  onConfirm,
  currency
}: QuantityKeypadPopupProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState('');

  const handleInput = (input: string) => {
    if (input === 'clear') {
      setQuantity('');
      return;
    }

    if (input === 'enter') {
      if (quantity && selectedProduct) {
        const qty = parseInt(quantity, 10);
        if (qty > 0 && qty <= selectedProduct.stock) {
          onConfirm(selectedProduct, qty);
          setQuantity('');
          onOpenChange(false);
        }
      }
      return;
    }

    // Empêcher les décimales pour les quantités
    if (input === '.') return;

    setQuantity(prev => prev + input);
  };

  const quantityNum = parseInt(quantity, 10) || 0;
  const totalPrice = selectedProduct ? quantityNum * selectedProduct.price : 0;
  const isValidQuantity = selectedProduct && quantityNum > 0 && quantityNum <= selectedProduct.stock;

  // Reset quantity when dialog opens
  React.useEffect(() => {
    if (open) {
      setQuantity('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header stylisé */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
                <Calculator className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{t('quantityKeypadPopup.quantite')}</h3>
                <p className="text-xs text-muted-foreground">{t('quantityKeypadPopup.saisirLeNombreDArticles')}</p>
              </div>
            </div>
            <div className="h-2.5 w-2.5 rounded-full bg-[#ff4000] animate-pulse shadow-lg shadow-[#ff4000]/50" />
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Info produit sélectionné */}
          {selectedProduct && (
            <div className="bg-primary/10 rounded-xl p-3 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm line-clamp-1">{selectedProduct.name}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Prix unitaire: {selectedProduct.price.toLocaleString()} {currency}</span>
                <span>Stock: {selectedProduct.stock}</span>
              </div>
            </div>
          )}

          {/* Affichage quantité */}
          <div className="space-y-2">
            <Input
              type="text"
              value={quantity || ''}
              readOnly
              placeholder="0"
              className="text-center text-3xl font-mono font-bold h-16 bg-background border-2 border-primary/30 focus:border-primary"
            />

            {/* Total calculé */}
            {quantityNum > 0 && (
              <div className={`text-sm font-medium px-3 py-2 rounded-lg text-center ${
                isValidQuantity
                  ? 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]'
                  : 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]'
              }`}>
                {isValidQuantity ? (
                  <>Total: {totalPrice.toLocaleString()} {currency}</>
                ) : (
                  <>Stock insuffisant (max: {selectedProduct?.stock})</>
                )}
              </div>
            )}
          </div>

          {/* Grille numérique */}
          <div className="grid grid-cols-3 gap-2">
            {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((num) => (
              <Button
                key={num}
                variant="outline"
                onClick={() => handleInput(num)}
                className="h-14 text-xl font-bold bg-background/80 hover:bg-primary/10 hover:border-primary/50 hover:scale-105 active:scale-95 transition-all duration-150 shadow-sm hover:shadow-md"
              >
                {num}
              </Button>
            ))}
          </div>

          {/* Ligne 0, 00, raccourcis */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={() => handleInput('0')}
              className="h-14 text-xl font-bold bg-background/80 hover:bg-primary/10 hover:border-primary/50 hover:scale-105 active:scale-95 transition-all duration-150 shadow-sm"
            >
              0
            </Button>
            <Button
              variant="outline"
              onClick={() => setQuantity('10')}
              className="h-14 text-lg font-bold bg-background/80 hover:bg-primary/10 hover:border-primary/50 hover:scale-105 active:scale-95 transition-all duration-150 shadow-sm"
            >
              10
            </Button>
            <Button
              variant="outline"
              onClick={() => setQuantity('50')}
              className="h-14 text-lg font-bold bg-background/80 hover:bg-primary/10 hover:border-primary/50 hover:scale-105 active:scale-95 transition-all duration-150 shadow-sm"
            >
              50
            </Button>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => handleInput('clear')}
              className="h-12 font-semibold border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive transition-all"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Effacer
            </Button>
            <Button
              onClick={() => handleInput('enter')}
              disabled={!isValidQuantity}
              className="h-12 font-semibold bg-[#ff4000] text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
