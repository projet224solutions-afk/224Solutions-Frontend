/**
 * Import produits depuis plateformes chinoises
 * Alibaba, AliExpress, 1688
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Link2,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Package
} from 'lucide-react';
import { useDropshippingChina } from '@/hooks/useDropshippingChina';
import type { ChinaImport, ChinaPlatformType } from '@/types/dropshipping-china';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';

export function ChinaProductImport() {
  const { t } = useTranslation();
  const { imports, loading, importFromUrl, createProductFromImport } = useDropshippingChina();
  const [url, setUrl] = useState('');
  const [selectedImport, setSelectedImport] = useState<ChinaImport | null>(null);
  const [sellingPrice, setSellingPrice] = useState('');

  const handleImport = async () => {
    if (!url.trim()) return;
    await importFromUrl(url);
    setUrl('');
  };

  const handleCreateProduct = async () => {
    if (!selectedImport || !sellingPrice) return;
    const success = await createProductFromImport(selectedImport, parseFloat(sellingPrice));
    if (success) {
      setSelectedImport(null);
      setSellingPrice('');
    }
  };

  const getPlatformBadge = (platform: ChinaPlatformType) => {
    const colors: Record<ChinaPlatformType, string> = {
      ALIBABA: 'bg-orange-500 hover:bg-orange-600',
      ALIEXPRESS: 'bg-[#ff4000] hover:bg-[#ff4000]',
      '1688': 'bg-blue-600 hover:bg-blue-700',
      PRIVATE: 'bg-gray-500 hover:bg-gray-600'
    };
    return <Badge className={colors[platform]}>{platform}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-[#ff4000]"><CheckCircle2 className="h-3 w-3 mr-1" /> {t('chinaProductImport.termine')}</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> {t('chinaProductImport.echec')}</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> En cours</Badge>;
      default:
        return <Badge variant="outline">En attente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Zone d'import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Importer un Produit
          </CardTitle>
          <CardDescription>
            Collez l'URL d'un produit Alibaba, AliExpress ou 1688 pour l'importer automatiquement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="https://www.aliexpress.com/item/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-11"
              />
            </div>
            <Button
              onClick={handleImport}
              disabled={loading || !url.trim()}
              className="h-11"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Importer
            </Button>
          </div>

          <div className="flex gap-2 mt-4">
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              Alibaba
            </Badge>
            <Badge variant="outline" className="text-[#ff4000] border-orange-300">
              AliExpress
            </Badge>
            <Badge variant="outline" className="text-blue-600 border-blue-300">
              1688
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Historique imports */}
      <Card>
        <CardHeader>
          <CardTitle>{t('chinaProductImport.historiqueDesImports')}</CardTitle>
        </CardHeader>
        <CardContent>
          {imports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{t('chinaProductImport.aucunImportEffectue')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {imports.map((imp) => (
                <div
                  key={imp.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {getPlatformBadge(imp.platform_type)}
                    <div>
                      <p className="font-medium text-sm truncate max-w-[300px]">
                        {imp.extracted_data?.title || 'Import en cours...'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(imp.created_at).toLocaleString('fr-FR')}</span>
                        {imp.extracted_data?.price && (
                          <span>• {imp.extracted_data.price} {imp.extracted_data.currency}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(imp.import_status)}

                    {imp.import_status === 'completed' && !imp.product_id && (
                      <Button
                        size="sm"
                        onClick={() => setSelectedImport(imp)}
                      >
                        Créer produit
                      </Button>
                    )}

                    {imp.product_id && (
                      <Badge variant="outline" className="text-[#ff4000]">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Produit créé
                      </Badge>
                    )}

                    <a
                      href={imp.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog création produit */}
      <Dialog open={!!selectedImport} onOpenChange={() => setSelectedImport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('chinaProductImport.creerLeProduit')}</DialogTitle>
          </DialogHeader>

          {selectedImport && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{selectedImport.extracted_data?.title}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Prix fournisseur: {selectedImport.extracted_data?.price} {selectedImport.extracted_data?.currency}
                </p>
                {selectedImport.extracted_data?.moq && (
                  <p className="text-sm text-muted-foreground">
                    MOQ: {selectedImport.extracted_data.moq} unités
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="selling_price">{t('chinaProductImport.prixDeVenteGnf')}</Label>
                <Input
                  id="selling_price"
                  type="number"
                  placeholder="Ex: 150000"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Définissez votre prix de vente en Francs Guinéens
                </p>
              </div>

              {sellingPrice && selectedImport.extracted_data?.price && (
                <div className="p-3 bg-orange-50 dark:bg-[#ff4000] rounded-lg">
                  <p className="text-sm font-medium text-[#ff4000] dark:text-orange-300">
                    Marge estimée calculée automatiquement après création
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedImport(null)}>
              Annuler
            </Button>
            <Button onClick={handleCreateProduct} disabled={!sellingPrice || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Créer le produit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
