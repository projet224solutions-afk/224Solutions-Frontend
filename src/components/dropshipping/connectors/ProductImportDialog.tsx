/**
 * PRODUCT IMPORT DIALOG
 * Dialog pour importer des produits depuis les connecteurs dropshipping
 *
 * @module ProductImportDialog
 * @version 1.0.0
 * @author 224Solutions
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  Link2,
  Search,
  AlertTriangle,
  Package,
  DollarSign,
  BarChart,
  Check,
  ExternalLink,
  Image as ImageIcon,
  Truck
} from 'lucide-react';
import { useConnectors } from '@/hooks/useConnectors';
import type { ConnectorType, ProductImportResult } from '@/services/connectors';
import { formatCurrency } from '@/lib/utils';

// ==================== INTERFACES ====================

interface ProductImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  onProductImported?: (product: ProductImportResult) => void;
}

interface PriceConfig {
  marginPercent: number;
  fixedMargin: number;
  roundToNearest: number;
}

// ==================== HELPER FUNCTIONS ====================

function detectConnectorFromUrl(url: string): ConnectorType | null {
  const lowercaseUrl = url.toLowerCase();

  if (lowercaseUrl.includes('aliexpress.com') || lowercaseUrl.includes('ae.') || lowercaseUrl.includes('a.aliexpress')) {
    return 'ALIEXPRESS';
  }
  if (lowercaseUrl.includes('1688.com')) {
    return '1688';
  }
  if (lowercaseUrl.includes('alibaba.com')) {
    return 'ALIBABA';
  }

  return null;
}

function calculateSellingPrice(cost: number, config: PriceConfig): number {
  let price = cost * (1 + config.marginPercent / 100);
  price += config.fixedMargin;

  if (config.roundToNearest > 0) {
    price = Math.ceil(price / config.roundToNearest) * config.roundToNearest;
  }

  return Math.round(price * 100) / 100;
}

// ==================== MAIN COMPONENT ====================

export function ProductImportDialog({
  open,
  onOpenChange,
  vendorId,
  onProductImported
}: ProductImportDialogProps) {
  const { t } = useTranslation();
  const {
    importing,
    activeConnectors,
    importFromUrl,
    importFromId,
    saveProduct
  } = useConnectors(vendorId);

  const [step, setStep] = useState<'input' | 'preview' | 'configure'>('input');
  const [importUrl, setImportUrl] = useState('');
  const [importId, setImportId] = useState('');
  const [selectedConnector, setSelectedConnector] = useState<ConnectorType | null>(null);
  const [importedProduct, setImportedProduct] = useState<ProductImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Configuration prix de vente
  const [priceConfig, setPriceConfig] = useState<PriceConfig>({
    marginPercent: 30,
    fixedMargin: 0,
    roundToNearest: 1000
  });

  // Options produit
  const [productOptions, setProductOptions] = useState({
    publishImmediately: true,
    syncPrices: true,
    syncStock: true
  });

  // Helper pour accéder aux données normalisées
  const productData = importedProduct?.normalizedProduct;
  const productCost = productData?.priceUsd || 0;
  const productCurrency = productData?.priceCurrency || 'USD';
  const productImages = productData?.images || [];
  const productTitle = productData?.title || '';
  const productMoq = productData?.moq || 1;
  const productShippingTime = productData?.estimatedDeliveryDays
    ? `${productData.estimatedDeliveryDays.min}-${productData.estimatedDeliveryDays.max} jours`
    : null;
  const productVariants = productData?.variants || [];
  const productSourceUrl = productData?.sourceUrl || '';

  // Reset à l'ouverture
  useEffect(() => {
    if (open) {
      setStep('input');
      setImportUrl('');
      setImportId('');
      setImportedProduct(null);
      setError(null);
    }
  }, [open]);

  // Détecter le connecteur depuis l'URL
  useEffect(() => {
    if (importUrl) {
      const detected = detectConnectorFromUrl(importUrl);
      if (detected && activeConnectors.includes(detected)) {
        setSelectedConnector(detected);
      }
    }
  }, [importUrl, activeConnectors]);

  // Import via URL
  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) {
      setError('Veuillez entrer une URL');
      return;
    }

    setError(null);
    const result = await importFromUrl(importUrl);

    if (result) {
      setImportedProduct(result);
      setStep('preview');
    } else {
      setError('Impossible d\'importer ce produit. Vérifiez l\'URL et réessayez.');
    }
  };

  // Import via ID
  const handleImportFromId = async () => {
    if (!selectedConnector) {
      setError('Veuillez sélectionner un connecteur');
      return;
    }
    if (!importId.trim()) {
      setError('Veuillez entrer l\'ID du produit');
      return;
    }

    setError(null);
    const result = await importFromId(importId, selectedConnector);

    if (result) {
      setImportedProduct(result);
      setStep('preview');
    } else {
      setError('Produit non trouvé. Vérifiez l\'ID et réessayez.');
    }
  };

  // Enregistrer le produit
  const handleSaveProduct = async () => {
    if (!importedProduct) return;

    const _sellingPrice = calculateSellingPrice(productCost, priceConfig);

    const savedProduct = await saveProduct(importedProduct, {
      autoPublish: productOptions.publishImmediately,
      marginPercent: priceConfig.marginPercent
    });

    if (savedProduct) {
      onProductImported?.(importedProduct);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Importer un produit
          </DialogTitle>
          <DialogDescription>
            {step === 'input' && 'Entrez l\'URL ou l\'ID du produit à importer'}
            {step === 'preview' && 'Vérifiez les informations du produit'}
            {step === 'configure' && 'Configurez le prix de vente'}
          </DialogDescription>
        </DialogHeader>

        {/* ÉTAPE 1: Saisie URL/ID */}
        {step === 'input' && (
          <div className="space-y-6 py-4">
            <Tabs defaultValue="url" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url">Par URL</TabsTrigger>
                <TabsTrigger value="id">Par ID</TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="productUrl">{t('productImportDialog.urlDuProduit')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="productUrl"
                      placeholder="https://aliexpress.com/item/..."
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleImportFromUrl}
                      disabled={importing || !importUrl.trim()}
                    >
                      {importing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Copiez-collez l'URL du produit depuis AliExpress, Alibaba ou 1688
                  </p>
                </div>

                {selectedConnector && (
                  <Alert>
                    <Check className="w-4 h-4" />
                    <AlertDescription>
                      Connecteur détecté: <strong>{selectedConnector}</strong>
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="id" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="connector">{t('productImportDialog.selectionnerLeConnecteur')}</Label>
                  <Select
                    value={selectedConnector || ''}
                    onValueChange={(value) => setSelectedConnector(value as ConnectorType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('productImportDialog.choisirUnConnecteur')} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeConnectors.map(connector => (
                        <SelectItem key={connector} value={connector}>
                          {connector}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productId">{t('productImportDialog.idDuProduit')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="productId"
                      placeholder="1234567890"
                      value={importId}
                      onChange={(e) => setImportId(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleImportFromId}
                      disabled={importing || !selectedConnector || !importId.trim()}
                    >
                      {importing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {activeConnectors.length === 0 && (
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  Aucun connecteur actif. Veuillez d'abord activer un connecteur dans les paramètres.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* ÉTAPE 2: Prévisualisation */}
        {step === 'preview' && importedProduct && productData && (
          <div className="space-y-4 py-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex gap-4">
                  {/* Image */}
                  <div className="w-32 h-32 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    {productImages[0] ? (
                      <img
                        src={productImages[0]}
                        alt={productTitle}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold line-clamp-2">{productTitle}</h3>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        <DollarSign className="w-3 h-3 mr-1" />
                        Coût: {formatCurrency(productCost, productCurrency)}
                      </Badge>

                      {productMoq > 1 && (
                        <Badge variant="secondary">
                          MOQ: {productMoq} unités
                        </Badge>
                      )}

                      {productShippingTime && (
                        <Badge variant="outline">
                          <Truck className="w-3 h-3 mr-1" />
                          {productShippingTime}
                        </Badge>
                      )}
                    </div>

                    {productVariants.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {productVariants.length} variante(s) disponible(s)
                      </p>
                    )}

                    <a
                      href={productSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1"
                    >
                      Voir sur le site <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Images supplémentaires */}
            {productImages.length > 1 && (
              <div>
                <Label className="text-sm">Images ({productImages.length})</Label>
                <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                  {productImages.slice(0, 6).map((img, i) => (
                    <div key={i} className="w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {productImages.length > 6 && (
                    <div className="w-16 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        +{productImages.length - 6}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('input')}>
                Retour
              </Button>
              <Button className="flex-1" onClick={() => setStep('configure')}>
                Continuer
              </Button>
            </div>
          </div>
        )}

        {/* ÉTAPE 3: Configuration prix */}
        {step === 'configure' && importedProduct && (
          <div className="space-y-6 py-4">
            {/* Calculateur de marge */}
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Prix d'achat</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(productCost, productCurrency)}
                    </p>
                  </div>
                  <BarChart className="w-8 h-8 text-muted-foreground" />
                  <div className="text-right">
                    <p className="text-sm font-medium">{t('productImportDialog.prixDeVente')}</p>
                    <p className="text-2xl font-bold text-[#ff4000]">
                      {formatCurrency(calculateSellingPrice(productCost, priceConfig), 'GNF')}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  {/* Marge en % */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Marge (%)</Label>
                      <span className="text-sm font-medium">{priceConfig.marginPercent}%</span>
                    </div>
                    <Slider
                      value={[priceConfig.marginPercent]}
                      onValueChange={([value]) => setPriceConfig(prev => ({ ...prev, marginPercent: value }))}
                      min={10}
                      max={200}
                      step={5}
                    />
                  </div>

                  {/* Marge fixe */}
                  <div className="space-y-2">
                    <Label htmlFor="fixedMargin">Marge fixe (GNF)</Label>
                    <Input
                      id="fixedMargin"
                      type="number"
                      value={priceConfig.fixedMargin}
                      onChange={(e) => setPriceConfig(prev => ({
                        ...prev,
                        fixedMargin: parseInt(e.target.value) || 0
                      }))}
                    />
                  </div>

                  {/* Arrondi */}
                  <div className="space-y-2">
                    <Label htmlFor="roundTo">{t('productImportDialog.arrondirAuMultipleDe')}</Label>
                    <Select
                      value={String(priceConfig.roundToNearest)}
                      onValueChange={(value) => setPriceConfig(prev => ({
                        ...prev,
                        roundToNearest: parseInt(value)
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Pas d'arrondi</SelectItem>
                        <SelectItem value="100">100 GNF</SelectItem>
                        <SelectItem value="500">500 GNF</SelectItem>
                        <SelectItem value="1000">1 000 GNF</SelectItem>
                        <SelectItem value="5000">5 000 GNF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Profit estimé */}
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <p className="text-sm text-[#ff4000]">
                    Profit estimé par vente:{' '}
                    <strong>
                      {formatCurrency(
                        calculateSellingPrice(productCost, priceConfig) - productCost,
                        'GNF'
                      )}
                    </strong>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="publish">{t('productImportDialog.publierImmediatement')}</Label>
                <Switch
                  id="publish"
                  checked={productOptions.publishImmediately}
                  onCheckedChange={(checked) => setProductOptions(prev => ({
                    ...prev,
                    publishImmediately: checked
                  }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="syncPrices">{t('productImportDialog.synchroniserLesPrixAutomatiquement')}</Label>
                <Switch
                  id="syncPrices"
                  checked={productOptions.syncPrices}
                  onCheckedChange={(checked) => setProductOptions(prev => ({
                    ...prev,
                    syncPrices: checked
                  }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="syncStock">{t('productImportDialog.synchroniserLeStockAutomatiquement')}</Label>
                <Switch
                  id="syncStock"
                  checked={productOptions.syncStock}
                  onCheckedChange={(checked) => setProductOptions(prev => ({
                    ...prev,
                    syncStock: checked
                  }))}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('preview')}>
                Retour
              </Button>
              <Button
                onClick={handleSaveProduct}
                disabled={importing}
                className="bg-[#ff4000] hover:bg-[#ff4000]"
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enregistrement...</>
                ) : (
                  <><Check className="w-4 h-4 mr-2" /> {t('productImportDialog.importerLeProduit')}</>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ProductImportDialog;
