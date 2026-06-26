/**
 * Calculateur de coûts Dropshipping Chine
 * Calcul automatique des coûts réels
 */

import { useState, useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calculator,
  DollarSign,
  Truck,
  Ship,
  Plane,
  Package,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { useDropshippingChina } from '@/hooks/useDropshippingChina';

export function ChinaCostCalculator() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { calculateFullCosts, settings } = useDropshippingChina();

  const [supplierPrice, setSupplierPrice] = useState('10');
  const [currency, setCurrency] = useState('USD');
  const [transportMethod, setTransportMethod] = useState('express');
  const [sellingPrice, setSellingPrice] = useState('150000');
  const [quantity, setQuantity] = useState('1');

  const costs = useMemo(() => {
    const price = parseFloat(supplierPrice) || 0;
    return calculateFullCosts(price, currency, transportMethod);
  }, [supplierPrice, currency, transportMethod, calculateFullCosts]);

  // Calculer marge
  const margin = useMemo(() => {
    const selling = parseFloat(sellingPrice) || 0;
    const qty = parseInt(quantity) || 1;
    const totalCostLocal = (costs.total_cost_usd || 0) * 8500 * qty; // Taux GNF approximatif
    const totalRevenue = selling * qty;
    const profit = totalRevenue - totalCostLocal;
    const marginPercent = totalRevenue > 0 ? (profit / totalRevenue * 100) : 0;

    return {
      profit,
      marginPercent,
      costPerUnit: totalCostLocal / qty,
      revenuePerUnit: selling
    };
  }, [costs, sellingPrice, quantity]);

  const transportOptions = [
    { value: 'express', label: 'Express (15-20j)', icon: Plane, description: 'DHL, FedEx, UPS' },
    { value: 'air', label: t('chinaCostCalculator.aerienStandard2030j'), icon: Plane, description: t('chinaCostCalculator.fretAerien') },
    { value: 'sea', label: 'Maritime (45-60j)', icon: Ship, description: t('chinaCostCalculator.economique') },
    { value: 'economy', label: 'Economy (25-40j)', icon: Truck, description: 'Mixte' }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculateur de Coûts Chine
          </CardTitle>
          <CardDescription>
            Estimez vos coûts réels et marges pour le dropshipping depuis la Chine
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Inputs */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Prix fournisseur</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={supplierPrice}
                  onChange={(e) => setSupplierPrice(e.target.value)}
                  className="flex-1"
                />
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('chinaCostCalculator.methodeDeTransport')}</Label>
              <Select value={transportMethod} onValueChange={setTransportMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {transportOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('chinaCostCalculator.prixDeVenteGnf')}</Label>
              <Input
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('chinaCostCalculator.quantite')}</Label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>

          {/* Détail des coûts */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('chinaCostCalculator.decompositionDesCouts')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    Prix fournisseur
                  </span>
                  <span className="font-medium">
                    {costs.supplier_price} {costs.supplier_currency}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Transport Chine interne
                  </span>
                  <span className="font-medium">${costs.china_domestic_shipping?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    Transport international
                  </span>
                  <span className="font-medium">${costs.international_shipping?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    Douanes estimées ({settings?.default_customs_estimate_percent || 15}%)
                  </span>
                  <span className="font-medium">${costs.estimated_customs?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-sm">
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                    Frais plateforme (3%)
                  </span>
                  <span className="font-medium">${costs.platform_fees?.toFixed(2)}</span>
                </div>

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{t('chinaCostCalculator.coutTotalUnitaire')}</span>
                    <span className="text-lg font-bold">${costs.total_cost_usd?.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ≈ {fc((costs.total_cost_usd || 0) * 8500)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Résultat marge */}
            <Card className={`${margin.marginPercent >= 20 ? 'bg-orange-50 dark:bg-[#ff4000] border-orange-200' : 'bg-orange-50 dark:bg-orange-950 border-orange-200'}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Analyse de Rentabilité
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-4">
                  <div className={`text-4xl font-bold ${margin.marginPercent >= 20 ? 'text-[#ff4000]' : 'text-orange-600'}`}>
                    {margin.marginPercent.toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground">Marge nette</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-xl font-semibold">
                      {fc(margin.profit)}
                    </p>
                    <p className="text-xs text-muted-foreground">Profit total</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold">
                      {fc(margin.profit / parseInt(quantity))}
                    </p>
                    <p className="text-xs text-muted-foreground">Profit/unité</p>
                  </div>
                </div>

                <div className="flex justify-center gap-2 pt-2">
                  {margin.marginPercent >= 30 && (
                    <Badge className="bg-[#ff4000]">Excellent</Badge>
                  )}
                  {margin.marginPercent >= 20 && margin.marginPercent < 30 && (
                    <Badge className="bg-[#ff4000]">Bon</Badge>
                  )}
                  {margin.marginPercent >= 10 && margin.marginPercent < 20 && (
                    <Badge className="bg-orange-500">Moyen</Badge>
                  )}
                  {margin.marginPercent < 10 && (
                    <Badge variant="destructive">Faible</Badge>
                  )}
                </div>

                {margin.marginPercent < 15 && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 text-center">
                    ⚠️ Marge inférieure à 15%. Envisagez d'augmenter le prix de vente.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Options transport */}
          <div>
            <Label className="mb-3 block">{t('chinaCostCalculator.optionsDeTransport')}</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {transportOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTransportMethod(opt.value)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    transportMethod === opt.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:border-muted-foreground/50'
                  }`}
                >
                  <opt.icon className="h-6 w-6 mb-2" />
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
