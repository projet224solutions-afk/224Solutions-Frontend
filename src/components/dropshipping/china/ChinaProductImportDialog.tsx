/**
 * CHINA PRODUCT IMPORT DIALOG
 * Dialog pour importer un produit depuis Alibaba, AliExpress ou 1688
 * Extension du module dropshipping existant
 *
 * @module ChinaProductImportDialog
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Globe,
  Link,
  Loader2,
  Package,
  Truck,
  Clock,
  AlertTriangle,
  CheckCircle,
  Image,
  Tags,
  Calculator,
  ArrowRight,
  Info,
  ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  ChinaPlatformType,
  ChinaProductImport,
  ChinaCostBreakdown
} from '@/types/china-dropshipping';
import { CHINA_PLATFORMS } from '@/types/china-dropshipping';

// ==================== INTERFACES ====================

interface ChinaProductImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (url: string, platform: ChinaPlatformType) => Promise<ChinaProductImport | null>;
  onConvert: (importId: string, margin: number) => Promise<string | null>;
  onCalculateCosts: (productId: string, quantity: number) => Promise<ChinaCostBreakdown | null>;
}

interface ImportStep {
  step: 'url' | 'preview' | 'pricing' | 'confirm';
}

// ==================== COMPOSANT PRINCIPAL ====================

export function ChinaProductImportDialog({
  open,
  onOpenChange,
  onImport,
  onConvert,
  onCalculateCosts
}: ChinaProductImportDialogProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  // États
  const [currentStep, setCurrentStep] = useState<ImportStep['step']>('url');
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<ChinaPlatformType | null>(null);
  const [importedProduct, setImportedProduct] = useState<ChinaProductImport | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<ChinaCostBreakdown | null>(null);
  const [margin, setMargin] = useState(30);
  const [quantity, setQuantity] = useState(1);
  const [showOrigin, setShowOrigin] = useState(true);
  const [urlError, setUrlError] = useState('');

  // ==================== HANDLERS ====================

  const detectPlatform = useCallback((inputUrl: string): ChinaPlatformType | null => {
    const lowerUrl = inputUrl.toLowerCase();
    if (lowerUrl.includes('alibaba.com')) return 'ALIBABA';
    if (lowerUrl.includes('aliexpress.com') || lowerUrl.includes('aliexpress.ru')) return 'ALIEXPRESS';
    if (lowerUrl.includes('1688.com')) return '1688';
    return null;
  }, []);

  const handleUrlChange = useCallback((value: string) => {
    setUrl(value);
    setUrlError('');
    const detected = detectPlatform(value);
    setPlatform(detected);
  }, [detectPlatform]);

  const handleStartImport = useCallback(async () => {
    if (!url) {
      setUrlError('Veuillez entrer une URL');
      return;
    }
    if (!platform) {
      setUrlError('URL non reconnue. Utilisez Alibaba, AliExpress ou 1688');
      return;
    }

    try {
      setLoading(true);
      const result = await onImport(url, platform);

      if (result) {
        setImportedProduct(result);
        setCurrentStep('preview');

        // Calculer les coûts automatiquement
        const costs = await onCalculateCosts(result.id, quantity);
        if (costs) {
          setCostBreakdown(costs);
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'import');
    } finally {
      setLoading(false);
    }
  }, [url, platform, onImport, onCalculateCosts, quantity]);

  const handleRecalculateCosts = useCallback(async () => {
    if (!importedProduct) return;

    setLoading(true);
    try {
      const costs = await onCalculateCosts(importedProduct.id, quantity);
      if (costs) {
        setCostBreakdown({
          ...costs,
          vendor_margin_percent: margin,
          vendor_margin_amount: costs.total_cost_local * (margin / 100),
          final_selling_price: costs.total_cost_local * (1 + margin / 100),
          estimated_profit: costs.total_cost_local * (margin / 100),
          estimated_profit_percent: margin
        });
      }
    } finally {
      setLoading(false);
    }
  }, [importedProduct, quantity, margin, onCalculateCosts]);

  const handleConfirmImport = useCallback(async () => {
    if (!importedProduct) return;

    try {
      setLoading(true);
      const productId = await onConvert(importedProduct.id, margin);

      if (productId) {
        toast.success(t('chinaProductImportDialog.produitAjouteAVotreCatalogue'));
        handleReset();
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la conversion');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importedProduct, margin, onConvert, onOpenChange]);

  const handleReset = useCallback(() => {
    setCurrentStep('url');
    setUrl('');
    setPlatform(null);
    setImportedProduct(null);
    setCostBreakdown(null);
    setMargin(30);
    setQuantity(1);
    setUrlError('');
  }, []);

  // ==================== RENDER STEP URL ====================

  const renderStepUrl = () => (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Collez le lien d'un produit depuis <strong>Alibaba</strong>, <strong>AliExpress</strong> ou <strong>1688</strong>
          pour l'importer automatiquement dans votre catalogue.
        </AlertDescription>
      </Alert>

      {/* Sélection plateforme visuelle */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {(Object.entries(CHINA_PLATFORMS) as [ChinaPlatformType, typeof CHINA_PLATFORMS[ChinaPlatformType]][])
          .filter(([key]) => key !== 'PRIVATE')
          .map(([key, info]) => (
            <Card
              key={key}
              className={`cursor-pointer transition-all hover:shadow-md ${
                platform === key ? 'ring-2 ring-primary border-primary' : ''
              }`}
              onClick={() => {
                setPlatform(key);
                if (!url) {
                  setUrl(`https://www.${info.url.replace('https://', '')}/product/...`);
                }
              }}
            >
              <CardContent className="pt-4 text-center">
                <div className="text-4xl mb-2">{info.logo}</div>
                <p className="font-medium">{info.name}</p>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Input URL */}
      <div className="space-y-2">
        <Label htmlFor="product-url">{t('chinaProductImportDialog.urlDuProduit')}</Label>
        <div className="relative">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="product-url"
            type="url"
            placeholder="https://www.aliexpress.com/item/..."
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            className={`pl-10 ${urlError ? 'border-[#ff4000]' : ''}`}
          />
        </div>
        {urlError && (
          <p className="text-sm text-[#ff4000]">{urlError}</p>
        )}
        {platform && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-orange-50 text-[#ff4000] border-orange-200">
              <CheckCircle className="w-3 h-3 mr-1" />
              {CHINA_PLATFORMS[platform].name} détecté
            </Badge>
          </div>
        )}
      </div>

      {/* Bouton import */}
      <Button
        onClick={handleStartImport}
        disabled={!url || !platform || loading}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Import en cours...
          </>
        ) : (
          <>
            <Globe className="w-4 h-4 mr-2" />
            Importer le produit
          </>
        )}
      </Button>
    </div>
  );

  // ==================== RENDER STEP PREVIEW ====================

  const renderStepPreview = () => {
    if (!importedProduct) return null;

    return (
      <div className="space-y-6">
        {/* Aperçu produit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Images */}
          <div className="space-y-4">
            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
              {importedProduct.images?.[0] ? (
                <img
                  src={importedProduct.images[0]}
                  alt={importedProduct.original_title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="w-16 h-16 text-muted-foreground" />
                </div>
              )}
            </div>

            {importedProduct.images && importedProduct.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {importedProduct.images.slice(1, 5).map((img, i) => (
                  <div key={i} className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {importedProduct.images.length > 5 && (
                  <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium">+{importedProduct.images.length - 5}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Infos produit */}
          <div className="space-y-4">
            <div>
              <Badge variant="outline" className="mb-2">
                {platform && CHINA_PLATFORMS[platform].name}
              </Badge>
              <h3 className="font-semibold text-lg">
                {importedProduct.translated_title || importedProduct.original_title}
              </h3>
            </div>

            <Separator />

            {/* Prix fournisseur */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Prix fournisseur (CNY)</p>
                <p className="text-xl font-bold text-orange-600">
                  ¥{importedProduct.supplier_price_cny?.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Prix fournisseur (USD)</p>
                <p className="text-xl font-bold">
                  ${importedProduct.supplier_price_usd?.toFixed(2)}
                </p>
              </div>
            </div>

            {/* MOQ et délais */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">MOQ</p>
                  <p className="font-medium">{importedProduct.moq} unités</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Production</p>
                  <p className="font-medium">{importedProduct.production_time_days}j</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">{t('chinaProductImportDialog.livraison')}</p>
                  <p className="font-medium">{importedProduct.shipping_time_days}j</p>
                </div>
              </div>
            </div>

            {/* Variantes */}
            {importedProduct.variants && importedProduct.variants.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Tags className="w-4 h-4" />
                  Variantes disponibles
                </p>
                <div className="flex flex-wrap gap-2">
                  {importedProduct.variants.map((v, i) => (
                    <Badge key={i} variant="secondary">
                      {v.name}: {v.values?.join(', ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleReset}>
            Annuler
          </Button>
          <Button onClick={() => setCurrentStep('pricing')}>
            Continuer
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  // ==================== RENDER STEP PRICING ====================

  const renderStepPricing = () => {
    if (!importedProduct || !costBreakdown) return null;

    return (
      <div className="space-y-6">
        <Tabs defaultValue="costs">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="costs">{t('chinaProductImportDialog.calculDesCouts')}</TabsTrigger>
            <TabsTrigger value="margin">{t('chinaProductImportDialog.definirLaMarge')}</TabsTrigger>
          </TabsList>

          <TabsContent value="costs" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  Décomposition des coûts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Quantité */}
                <div className="flex items-center justify-between">
                  <Label>{t('chinaProductImportDialog.quantiteSimulee')}</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      -
                    </Button>
                    <span className="w-12 text-center font-medium">{quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      +
                    </Button>
                    <Button size="sm" onClick={handleRecalculateCosts} disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Recalculer'}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Détails coûts */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prix fournisseur</span>
                    <span>${costBreakdown.supplier_price_usd?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('chinaProductImportDialog.livraisonChineInterne')}</span>
                    <span>${(costBreakdown.domestic_shipping_cny / 7.2)?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Manutention</span>
                    <span>${(costBreakdown.handling_fee_cny / 7.2)?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transport international ({costBreakdown.transport_method})</span>
                    <span>${costBreakdown.international_shipping_usd?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Douane estimée ({costBreakdown.estimated_customs_duty_percent}%)</span>
                    <span>${costBreakdown.estimated_customs_duty_amount?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frais plateforme</span>
                    <span>${costBreakdown.platform_fee?.toFixed(2)}</span>
                  </div>

                  <Separator />

                  <div className="flex justify-between font-medium">
                    <span>{t('chinaProductImportDialog.coutTotalUsd')}</span>
                    <span>${costBreakdown.total_cost_usd?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Coût total {costBreakdown.local_currency}</span>
                    <span>{costBreakdown.total_cost_local?.toLocaleString()} {costBreakdown.local_currency}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Les frais de douane sont estimés. Le montant réel peut varier selon le pays de destination et la catégorie du produit.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="margin" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('chinaProductImportDialog.margeBeneficiaire')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>{t('chinaProductImportDialog.margeSouhaitee')}</Label>
                    <span className="text-2xl font-bold text-primary">{margin}%</span>
                  </div>
                  <Slider
                    value={[margin]}
                    onValueChange={([value]) => setMargin(value)}
                    min={10}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>10%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('chinaProductImportDialog.coutDeRevient')}</span>
                    <span>{fc(costBreakdown?.total_cost_local || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Marge ({margin}%)</span>
                    <span className="text-[#ff4000]">
                      +{fc((costBreakdown?.total_cost_local || 0) * (margin / 100))}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>{t('chinaProductImportDialog.prixDeVente')}</span>
                    <span className="text-primary">
                      {fc((costBreakdown?.total_cost_local || 0) * (1 + margin / 100))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Afficher l'origine</Label>
                    <p className="text-sm text-muted-foreground">
                      Indiquer aux clients que le produit vient de Chine
                    </p>
                  </div>
                  <Switch checked={showOrigin} onCheckedChange={setShowOrigin} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setCurrentStep('preview')}>
            Retour
          </Button>
          <Button onClick={() => setCurrentStep('confirm')}>
            Confirmer le prix
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  // ==================== RENDER STEP CONFIRM ====================

  const renderStepConfirm = () => {
    if (!importedProduct || !costBreakdown) return null;

    const finalPrice = costBreakdown.total_cost_local * (1 + margin / 100);

    return (
      <div className="space-y-6">
        <Alert className="bg-orange-50 border-orange-200">
          <CheckCircle className="h-4 w-4 text-[#ff4000]" />
          <AlertDescription className="text-[#ff4000]">
            Votre produit est prêt à être ajouté à votre catalogue !
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {importedProduct.images?.[0] ? (
                  <img
                    src={importedProduct.images[0]}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-medium line-clamp-2">
                  {importedProduct.translated_title || importedProduct.original_title}
                </h3>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Coût: <span className="text-foreground font-medium">
                      ${costBreakdown.total_cost_usd?.toFixed(2)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Marge: <span className="text-[#ff4000] font-medium">{margin}%</span>
                  </span>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {fc(finalPrice || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Récapitulatif */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Source</span>
            <span>{platform && CHINA_PLATFORMS[platform].name}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('chinaProductImportDialog.delaiDeLivraisonEstime')}</span>
            <span>{(importedProduct.production_time_days || 0) + (importedProduct.shipping_time_days || 0)} jours</span>
          </div>
          <div className="flex justify-between">
            <span>{t('chinaProductImportDialog.profitEstimeParUnite')}</span>
            <span className="text-[#ff4000] font-medium">
              {fc(finalPrice - costBreakdown.total_cost_local)}
            </span>
          </div>
        </div>

        {/* Actions finales */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setCurrentStep('pricing')}>
            Modifier le prix
          </Button>
          <Button onClick={handleConfirmImport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Ajout en cours...
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4 mr-2" />
                Ajouter au catalogue
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  // ==================== RENDER PRINCIPAL ====================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Import Produit Chine
          </DialogTitle>
          <DialogDescription>
            {currentStep === 'url' && 'Importez un produit depuis Alibaba, AliExpress ou 1688'}
            {currentStep === 'preview' && 'Vérifiez les informations du produit'}
            {currentStep === 'pricing' && 'Configurez vos prix et marges'}
            {currentStep === 'confirm' && 'Confirmez l\'ajout au catalogue'}
          </DialogDescription>
        </DialogHeader>

        {/* Indicateur de progression */}
        <div className="flex items-center justify-center gap-2 py-2">
          {['url', 'preview', 'pricing', 'confirm'].map((step, index) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === step
                  ? 'bg-primary text-primary-foreground'
                  : index < ['url', 'preview', 'pricing', 'confirm'].indexOf(currentStep)
                    ? 'bg-[#ff4000] text-white'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {index + 1}
              </div>
              {index < 3 && (
                <div className={`w-8 h-0.5 mx-1 ${
                  index < ['url', 'preview', 'pricing', 'confirm'].indexOf(currentStep)
                    ? 'bg-[#ff4000]'
                    : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>

        <ScrollArea className="max-h-[60vh] pr-4">
          {currentStep === 'url' && renderStepUrl()}
          {currentStep === 'preview' && renderStepPreview()}
          {currentStep === 'pricing' && renderStepPricing()}
          {currentStep === 'confirm' && renderStepConfirm()}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default ChinaProductImportDialog;
