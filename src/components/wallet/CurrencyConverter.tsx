/**
 * 💱 CONVERTISSEUR DE DEVISES
 * Conversion en temps réel avec taux du jour automatique
 * 224SOLUTIONS
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { CurrencySelect } from '@/components/ui/currency-select';
import { useFxRates } from '@/hooks/useFxRates';
import { formatCurrency } from '@/data/currencies';
import { useTranslation } from "@/hooks/useTranslation";

export function CurrencyConverter() {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [fromCurrency, setFromCurrency] = useState('GNF');
  const [toCurrency, setToCurrency] = useState('USD');
  const [result, setResult] = useState<number | null>(null);

  // Taux en temps réel via Edge Function
  const { rates, lastUpdated, loading, refresh } = useFxRates({
    base: fromCurrency,
    symbols: [toCurrency],
    refreshMinutes: 30,
  });

  const handleConvert = () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error(t('currencyConverter.montantInvalide'));
      return;
    }

    if (fromCurrency === toCurrency) {
      setResult(amountNum);
      return;
    }

    const rate = rates?.[toCurrency];
    if (typeof rate !== 'number' || rate <= 0) {
      toast.error(`Taux ${fromCurrency} → ${toCurrency} non disponible`);
      setResult(null);
      return;
    }

    const converted = amountNum * rate;
    setResult(converted);
    toast.success(t('currencyConverter.conversionEffectuee'));
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setResult(null);
  };

  const rate = rates?.[toCurrency];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Convertisseur de devises
          </span>
          <Button variant="ghost" size="icon" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* De */}
        <div className="space-y-2">
          <Label>{t('currencyConverter.montantAConvertir')}</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1"
            />
            <CurrencySelect
              value={fromCurrency}
              onValueChange={(v) => { setFromCurrency(v); setResult(null); }}
              className="w-32"
              showFlag
            />
          </div>
        </div>

        {/* Bouton inverser */}
        <div className="flex justify-center">
          <Button variant="ghost" size="icon" onClick={swapCurrencies} className="rounded-full">
            <ArrowRightLeft className="w-4 h-4" />
          </Button>
        </div>

        {/* Vers */}
        <div className="space-y-2">
          <Label>{t('currencyConverter.resultat')}</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={result !== null ? formatCurrency(result, toCurrency) : ''}
              readOnly
              placeholder="..."
              className="flex-1 font-bold text-lg"
            />
            <CurrencySelect
              value={toCurrency}
              onValueChange={(v) => { setToCurrency(v); setResult(null); }}
              className="w-32"
              showFlag
            />
          </div>
        </div>

        {/* Bouton convertir */}
        <Button onClick={handleConvert} disabled={!amount || loading} className="w-full gap-2">
          <ArrowRightLeft className="w-4 h-4" />
          Convertir
        </Button>

        {/* Info taux */}
        {typeof rate === 'number' && rate > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg text-sm text-center space-y-1">
            <p className="font-medium">
              1 {fromCurrency} = {rate.toFixed(6)} {toCurrency}
            </p>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground">
                Mis à jour: {lastUpdated.toLocaleString('fr-FR')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CurrencyConverter;
