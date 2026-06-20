/**
 * Composant de saisie avec pavé numérique pour les achats
 * Optimisé pour mobile avec de grands boutons tactiles
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Calculator,
  Trash2,
  CheckSquare,
  Package,
  DollarSign,
  Hash
} from 'lucide-react';

interface PurchaseInputKeypadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'price' | 'quantity' | 'carton';
  productName: string;
  currentValue: number;
  currency?: string;
  unitsPerCarton?: number | null;
  onConfirm: (value: number) => void;
}

export function PurchaseInputKeypad({
  open,
  onOpenChange,
  mode,
  productName,
  currentValue,
  currency = 'GNF',
  unitsPerCarton,
  onConfirm
}: PurchaseInputKeypadProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');

  // Initialize with current value when opening
  useEffect(() => {
    if (open) {
      setInputValue(currentValue > 0 ? currentValue.toString() : '');
    }
  }, [open, currentValue]);

  const handleInput = (input: string) => {
    if (input === 'clear') {
      setInputValue('');
      return;
    }

    if (input === 'backspace') {
      setInputValue(prev => prev.slice(0, -1));
      return;
    }

    if (input === 'enter') {
      const numValue = mode === 'price'
        ? parseFloat(inputValue) || 0
        : parseInt(inputValue, 10) || 0;
      onConfirm(numValue);
      onOpenChange(false);
      return;
    }

    // Handle decimal point for price mode only
    if (input === '.') {
      if (mode !== 'price') return;
      if (inputValue.includes('.')) return;
    }

    setInputValue(prev => prev + input);
  };

  const numericValue = mode === 'price'
    ? parseFloat(inputValue) || 0
    : parseInt(inputValue, 10) || 0;

  const getModeConfig = () => {
    switch (mode) {
      case 'price':
        return {
          icon: DollarSign,
          title: t('purchaseKeypad.priceTitle'),
          subtitle: `${t('purchaseKeypad.priceSubtitle')} ${currency}`,
          color: '',
          bgColor: 'bg-[#ff4000]/10',
          borderColor: 'border-[#ff4000]/30',
          buttonColor: 'bg-[#ff4000] hover:bg-[#ff4000]',
          suffix: currency
        };
      case 'quantity':
        return {
          icon: Hash,
          title: t('purchaseKeypad.quantityTitle'),
          subtitle: t('purchaseKeypad.quantitySubtitle'),
          color: '',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
          buttonColor: 'bg-blue-600 hover:bg-blue-700',
          suffix: t('purchaseKeypad.unitsSuffix')
        };
      case 'carton':
        return {
          icon: Package,
          title: t('purchaseKeypad.cartonTitle'),
          subtitle: unitsPerCarton ? `${unitsPerCarton} ${t('purchaseKeypad.cartonSubtitlePer')}` : t('purchaseKeypad.cartonSubtitle'),
          color: '',
          bgColor: 'bg-[#04439e]/10',
          borderColor: 'border-[#04439e]/30',
          buttonColor: 'bg-[#04439e] hover:bg-[#04439e]',
          suffix: t('purchaseKeypad.cartonSuffix')
        };
    }
  };

  const config = getModeConfig();
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px] w-[95vw] p-0 overflow-hidden rounded-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`bg-gradient-to-r ${config.color} p-4`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shadow-lg backdrop-blur-sm">
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-lg">{config.title}</h3>
              <p className="text-white/80 text-xs truncate">{productName}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4 bg-background">
          {/* Display area */}
          <div className={`${config.bgColor} rounded-2xl p-4 border-2 ${config.borderColor}`}>
            <p className="text-xs text-muted-foreground mb-1">{config.subtitle}</p>
            <div className="flex items-baseline gap-2 justify-center">
              <span className="text-4xl font-bold tabular-nums tracking-tight">
                {inputValue || '0'}
              </span>
              <span className="text-lg font-medium text-muted-foreground">
                {config.suffix}
              </span>
            </div>
            {mode === 'carton' && unitsPerCarton && numericValue > 0 && (
              <p className="text-center text-sm text-muted-foreground mt-2">
                = {numericValue * unitsPerCarton} {t('purchaseKeypad.totalUnits')}
              </p>
            )}
          </div>

          {/* Numeric keypad - 4 columns for better mobile UX */}
          <div className="grid grid-cols-3 gap-2.5">
            {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((num) => (
              <Button
                key={num}
                variant="outline"
                onClick={() => handleInput(num)}
                className="h-16 md:h-14 text-2xl font-bold bg-card hover:bg-accent hover:scale-[1.02] active:scale-95 transition-all duration-150 shadow-sm rounded-xl border-2"
              >
                {num}
              </Button>
            ))}
          </div>

          {/* Bottom row: 0, 00/., backspace */}
          <div className="grid grid-cols-3 gap-2.5">
            <Button
              variant="outline"
              onClick={() => handleInput('0')}
              className="h-16 md:h-14 text-2xl font-bold bg-card hover:bg-accent hover:scale-[1.02] active:scale-95 transition-all duration-150 shadow-sm rounded-xl border-2"
            >
              0
            </Button>
            {mode === 'price' ? (
              <Button
                variant="outline"
                onClick={() => handleInput('.')}
                className="h-16 md:h-14 text-2xl font-bold bg-card hover:bg-accent hover:scale-[1.02] active:scale-95 transition-all duration-150 shadow-sm rounded-xl border-2"
              >
                •
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => handleInput('00')}
                className="h-16 md:h-14 text-xl font-bold bg-card hover:bg-accent hover:scale-[1.02] active:scale-95 transition-all duration-150 shadow-sm rounded-xl border-2"
              >
                00
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => handleInput('backspace')}
              className="h-16 md:h-14 text-lg font-bold bg-card hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive hover:scale-[1.02] active:scale-95 transition-all duration-150 shadow-sm rounded-xl border-2"
            >
              ⌫
            </Button>
          </div>

          {/* Quick values */}
          {mode === 'quantity' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[5, 10, 20, 50].map((qty) => (
                <Button
                  key={qty}
                  variant="secondary"
                  onClick={() => setInputValue(qty.toString())}
                  className="h-10 text-sm font-semibold rounded-xl"
                >
                  {qty}
                </Button>
              ))}
            </div>
          )}

          {mode === 'carton' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[1, 2, 5, 10].map((qty) => (
                <Button
                  key={qty}
                  variant="secondary"
                  onClick={() => setInputValue(qty.toString())}
                  className="h-10 text-sm font-semibold rounded-xl"
                >
                  {qty}
                </Button>
              ))}
            </div>
          )}

          {mode === 'price' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[1000, 5000, 10000, 50000].map((amount) => (
                <Button
                  key={amount}
                  variant="secondary"
                  onClick={() => setInputValue(amount.toString())}
                  className="h-10 text-xs font-semibold rounded-xl"
                >
                  {(amount / 1000)}K
                </Button>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => handleInput('clear')}
              className="h-14 md:h-12 font-semibold text-base border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive rounded-xl transition-all active:scale-95"
            >
              <Trash2 className="h-5 w-5 mr-2" />
              {t('purchaseKeypad.clear')}
            </Button>
            <Button
              onClick={() => handleInput('enter')}
              className={`h-14 md:h-12 font-semibold text-base ${config.buttonColor} text-white shadow-lg hover:shadow-xl rounded-xl transition-all active:scale-95`}
            >
              <CheckSquare className="h-5 w-5 mr-2" />
              {t('purchaseKeypad.confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
