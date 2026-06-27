/**
 * Panneau d'inventaire pharmacie — inspiré McKesson/Boots PMS
 * Alertes expiration, stock bas, ruptures
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Package, AlertTriangle, CheckCircle, XCircle,
  Plus, Eye, PackageX, ArrowUpRight, Pill
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ServiceHealthStats } from '@/hooks/useServiceHealthStats';

interface PharmacyInventoryPanelProps {
  stats: ServiceHealthStats;
}

export function PharmacyInventoryPanel({ stats }: PharmacyInventoryPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { stock } = stats;
  const inStock = stock.totalProducts - stock.outOfStockCount - stock.lowStockCount;
  const stockHealthPercent = stock.totalProducts > 0
    ? Math.round((inStock / stock.totalProducts) * 100)
    : 100;

  return (
    <div className="space-y-4">
      {/* Stock health overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Pill className="w-5 h-5 text-primary" />
              Santé de l'inventaire
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/vendeur/products')}>
              <Eye className="w-4 h-4 mr-1.5" />
              Voir tout
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Health bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">
                Score santé stock
              </span>
              <span className={`text-sm font-bold ${
                stockHealthPercent >= 80 ? 'text-[#ff4000]' :
                stockHealthPercent >= 50 ? 'text-orange-600' : 'text-[#ff4000]'
              }`}>
                {stockHealthPercent}%
              </span>
            </div>
            <Progress
              value={stockHealthPercent}
              className="h-2.5"
            />
          </div>

          {/* Category grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-[#ff4000]/30 border border-orange-200 dark:border-[#ff4000]">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-[#ff4000]" />
                <span className="text-xs font-medium text-[#ff4000] dark:text-[#ff4000]">En stock</span>
              </div>
              <div className="text-2xl font-bold text-[#ff4000] dark:text-orange-300">{inStock}</div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Total</span>
              </div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stock.totalProducts}</div>
            </div>

            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-medium text-orange-700 dark:text-orange-400">Stock bas</span>
              </div>
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{stock.lowStockCount}</div>
            </div>

            <div className="p-3 rounded-xl bg-orange-50 dark:bg-[#ff4000]/30 border border-orange-200 dark:border-[#ff4000]">
              <div className="flex items-center gap-2 mb-1">
                <PackageX className="w-4 h-4 text-[#ff4000]" />
                <span className="text-xs font-medium text-[#ff4000] dark:text-[#ff4000]">Rupture</span>
              </div>
              <div className="text-2xl font-bold text-[#ff4000] dark:text-orange-300">{stock.outOfStockCount}</div>
            </div>
          </div>

          {/* Alerts */}
          {(stock.lowStockCount > 0 || stock.outOfStockCount > 0) && (
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                ⚠ Alertes actives
              </h4>
              {stock.outOfStockCount > 0 && (
                <div className="flex items-center justify-between p-2.5 bg-orange-50 dark:bg-[#ff4000]/20 border border-orange-200 dark:border-[#ff4000] rounded-lg">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-[#ff4000]" />
                    <span className="text-sm font-medium text-[#ff4000] dark:text-[#ff4000]">
                      {stock.outOfStockCount} produit(s) en rupture de stock
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-[#ff4000]" onClick={() => navigate('/vendeur/products')}>
                    Voir <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              )}
              {stock.lowStockCount > 0 && (
                <div className="flex items-center justify-between p-2.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                      {stock.lowStockCount} produit(s) à réapprovisionner (≤5 unités)
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-orange-600" onClick={() => navigate('/vendeur/products')}>
                    Voir <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add product CTA */}
      <Card className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => navigate('/vendeur/products')}>
        <CardContent className="flex items-center justify-center gap-3 py-8">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Plus className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">{t('pharmacyInventoryPanel.ajouterUnMedicamentOuProduit')}</p>
            <p className="text-xs text-muted-foreground">{t('pharmacyInventoryPanel.referencerDansVotreInventaire')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
