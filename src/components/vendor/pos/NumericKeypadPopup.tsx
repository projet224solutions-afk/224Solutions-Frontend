import React from 'react';
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

interface NumericKeypadPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  numericInput: string;
  onNumericInput: (input: string) => void;
  receivedAmount: number;
  total: number;
  change: number;
  currency: string;
  mode?: 'amount' | 'quantity';
  productName?: string;
  maxQuantity?: number;
}

export function NumericKeypadPopup({
  open,
  onOpenChange,
  numericInput,
  onNumericInput,
  receivedAmount,
  total,
  change,
  currency,
  mode = 'amount',
  productName,
  maxQuantity
}: NumericKeypadPopupProps) {
  const { t } = useTranslation();

  const handleInput = (input: string) => {
    // Empêcher les décimales pour les quantités
    if (mode === 'quantity' && input === '.') return;

    // Vérifier la quantité max
    if (mode === 'quantity' && input !== 'clear' && input !== 'enter' && maxQuantity) {
      const newValue = numericInput + input;
      const numValue = parseInt(newValue, 10);
      if (numValue > maxQuantity) {
        return;
      }
    }

    onNumericInput(input);
    if (input === 'enter') {
      onOpenChange(false);
    }
  };

  const isQuantityMode = mode === 'quantity';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header stylisé */}
        <div className={`bg-gradient-to-r ${isQuantityMode ? 'from-blue-500/10 via-blue-500/5' : 'from-primary/10 via-primary/5'} to-transparent p-4 border-b border-border/50`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-[#04439e] ${isQuantityMode ? '' : 'from-primary'} flex items-center justify-center shadow-lg`}>
                {isQuantityMode ? (
                  <Package className="h-5 w-5 text-white" />
                ) : (
                  <Calculator className="h-5 w-5 text-primary-foreground" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-foreground">
                  {isQuantityMode ? 'Saisir la quantité' : 'Pavé numérique'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isQuantityMode
                    ? (productName || 'Modifier la quantité')
                    : 'Saisie du montant'
                  }
                </p>
              </div>
            </div>
            <div className={`h-2.5 w-2.5 rounded-full ${isQuantityMode ? 'bg-blue-500' : 'bg-[#ff4000]'} animate-pulse shadow-lg`} />
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Affichage contexte */}
          <div className="space-y-2">
            {isQuantityMode ? (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">{t('numericKeypadPopup.quantiteActuelle')}</p>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                  {numericInput || '0'} unités
                  {maxQuantity && (
                    <span className="text-sm font-normal text-blue-500 ml-2">(max: {maxQuantity})</span>
                  )}
                </p>
              </div>
            ) : (
              <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">{t('numericKeypadPopup.montantAPayer')}</p>
                <p className="text-lg font-bold text-primary">{total.toLocaleString()} {currency}</p>
              </div>
            )}

            <Input
              type="text"
              value={numericInput || ''}
              readOnly
              placeholder="0"
              className={`text-right text-2xl font-mono font-bold h-14 bg-background border-2 ${isQuantityMode ? 'border-blue-300 focus:border-blue-500' : 'border-primary/30 focus:border-primary'}`}
            />

            {!isQuantityMode && receivedAmount > 0 && (
              <div className={`text-sm font-medium px-3 py-2 rounded-lg ${
                change >= 0
                  ? 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]'
                  : 'bg-orange-100 text-[#ff4000] dark:bg-[#ff4000]/30 dark:text-[#ff4000]'
              }`}>
                Rendu: {change.toLocaleString()} {currency}
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
                className={`h-14 text-xl font-bold bg-background/80 hover:scale-105 active:scale-95 transition-all duration-150 shadow-sm hover:shadow-md ${isQuantityMode ? 'hover:bg-blue-50 hover:border-blue-400' : 'hover:bg-primary/10 hover:border-primary/50'}`}
              >
                {num}
              </Button>
            ))}
          </div>

          {/* Ligne 0, 00, point/backspace */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={() => handleInput('0')}
              className={`h-14 text-xl font-bold bg-background/80 hover:scale-105 active:scale-95 transition-all duration-150 shadow-sm ${isQuantityMode ? 'hover:bg-blue-50 hover:border-blue-400' : 'hover:bg-primary/10 hover:border-primary/50'}`}
            >
              0
            </Button>
            <Button
              variant="outline"
              onClick={() => handleInput('00')}
              className={`h-14 text-xl font-bold bg-background/80 hover:scale-105 active:scale-95 transition-all duration-150 shadow-sm ${isQuantityMode ? 'hover:bg-blue-50 hover:border-blue-400' : 'hover:bg-primary/10 hover:border-primary/50'}`}
            >
              00
            </Button>
            {isQuantityMode ? (
              <Button
                variant="outline"
                onClick={() => handleInput('clear')}
                className="h-14 text-sm font-bold bg-background/80 hover:bg-orange-50 hover:border-[#ff4000] hover:scale-105 active:scale-95 transition-all duration-150 shadow-sm text-[#ff4000]"
              >
                C
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => handleInput('.')}
                className="h-14 text-2xl font-bold bg-background/80 hover:bg-primary/10 hover:border-primary/50 hover:scale-105 active:scale-95 transition-all duration-150 shadow-sm"
              >
                •
              </Button>
            )}
          </div>

          {/* Actions */}
          <div className={`grid ${isQuantityMode ? 'grid-cols-1' : 'grid-cols-2'} gap-3 pt-2`}>
            {!isQuantityMode && (
              <Button
                variant="outline"
                onClick={() => handleInput('clear')}
                className="h-12 font-semibold border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive transition-all"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Effacer
              </Button>
            )}
            <Button
              onClick={() => handleInput('enter')}
              className={`h-12 font-semibold shadow-lg hover:shadow-xl transition-all ${isQuantityMode ? 'bg-[#04439e]' : 'bg-[#04439e]'} text-white`}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              {isQuantityMode ? 'Confirmer quantité' : 'Valider'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
