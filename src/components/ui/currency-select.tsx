/**
 * Composant de sélection de devise réutilisable
 * Avec toutes les devises mondiales, triées par popularité
 * 224SOLUTIONS
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getSortedCurrencies, getCurrencyByCode, type Currency } from '@/data/currencies';
import { useMemo } from 'react';

interface CurrencySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showFlag?: boolean;
  showName?: boolean;
}

export function CurrencySelect({
  value,
  onValueChange,
  placeholder = 'Devise',
  className,
  disabled = false,
  showFlag = true,
  showName = false,
}: CurrencySelectProps) {
  const currencies = useMemo(() => getSortedCurrencies(), []);
  const selectedCurrency = getCurrencyByCode(value);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedCurrency && (
            <span className="flex items-center gap-1.5">
              {showFlag && selectedCurrency.flag && (
                <span className="text-base">{selectedCurrency.flag}</span>
              )}
              <span>{selectedCurrency.code}</span>
              {showName && (
                <span className="text-muted-foreground text-xs">
                  ({selectedCurrency.name})
                </span>
              )}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <ScrollArea className="h-[300px]">
          {currencies.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              <span className="flex items-center gap-2">
                {showFlag && currency.flag && (
                  <span className="text-base">{currency.flag}</span>
                )}
                <span className="font-medium">{currency.code}</span>
                <span className="text-muted-foreground text-xs truncate max-w-[150px]">
                  {currency.name}
                </span>
              </span>
            </SelectItem>
          ))}
        </ScrollArea>
      </SelectContent>
    </Select>
  );
}

export default CurrencySelect;
