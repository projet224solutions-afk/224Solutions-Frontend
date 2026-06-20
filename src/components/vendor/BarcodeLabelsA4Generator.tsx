/**
 * BarcodeLabelsA4Generator - Génération professionnelle d'étiquettes A4
 * PDF prêt à imprimer avec codes-barres scannables
 */

import { useState, useCallback } from 'react';
import { escapeHtml } from '@/lib/security/inputSanitizer';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer, Download, Barcode as BarcodeIcon, Package, RefreshCw, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
// Lazy-loaded
const loadJsPDF = () => import('jspdf').then(m => m.default);

interface Product {
  id: string;
  name: string;
  price: number;
  sku?: string;
  barcode_value?: string;
  barcode_format?: string;
}

interface BarcodeLabelsA4GeneratorProps {
  vendorId: string;
  businessName?: string;
}

type GridLayout = '3x8' | '4x10' | '3x10';

const GRID_LAYOUTS: Record<GridLayout, { cols: number; rows: number; labelWidth: number; labelHeight: number }> = {
  '3x8': { cols: 3, rows: 8, labelWidth: 65, labelHeight: 35 },
  '4x10': { cols: 4, rows: 10, labelWidth: 48, labelHeight: 28 },
  '3x10': { cols: 3, rows: 10, labelWidth: 65, labelHeight: 28 },
};

// Encodage CODE128 simplifié pour génération de barres
const CODE128_PATTERNS: Record<string, string> = {
  '0': '11011001100', '1': '11001101100', '2': '11001100110', '3': '10010011000',
  '4': '10010001100', '5': '10001001100', '6': '10011001000', '7': '10011000100',
  '8': '10001100100', '9': '11001001000', 'A': '11001000100', 'B': '11000100100',
  'C': '10110011100', 'D': '10011011100', 'E': '10011001110', 'F': '10111001100',
  'G': '10011101100', 'H': '10011100110', 'I': '11001110010', 'J': '11001011100',
  'K': '11001001110', 'L': '11011100100', 'M': '11001110100', 'N': '11101101110',
  'O': '11101001100', 'P': '11100101100', 'Q': '11100100110', 'R': '11101100100',
  'S': '11100110100', 'T': '11100110010', 'U': '11011011000', 'V': '11011000110',
  'W': '11000110110', 'X': '10100011000', 'Y': '10001011000', 'Z': '10001000110',
  ' ': '11011001100', '-': '10010111000', '.': '10000101100',
  START: '11010000100', STOP: '1100011101011'
};

function encodeCode128(text: string): string {
  let encoded = CODE128_PATTERNS.START;
  for (const char of text.toUpperCase()) {
    encoded += CODE128_PATTERNS[char] || CODE128_PATTERNS['0'];
  }
  encoded += CODE128_PATTERNS.STOP;
  return encoded;
}

export function BarcodeLabelsA4Generator({ vendorId, businessName }: BarcodeLabelsA4GeneratorProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [gridLayout, setGridLayout] = useState<GridLayout>('3x8');
  const [showPrice, setShowPrice] = useState(true);
  const [showSku, setShowSku] = useState(false);
  const [showBusinessName, setShowBusinessName] = useState(false);
  const [quantityPerProduct, setQuantityPerProduct] = useState<Record<string, number>>({});

  // Charger uniquement les produits avec barcode_value IS NOT NULL
  const loadProductsWithBarcodes = useCallback(async () => {
    if (!vendorId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, sku, barcode_value, barcode_format')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .not('barcode_value', 'is', null)
        .order('name');

      if (error) throw error;

      const validProducts = (data || []).filter(p => p.barcode_value);
      setProducts(validProducts);

      // Initialiser les quantités à 1
      const initialQuantities: Record<string, number> = {};
      validProducts.forEach(p => {
        initialQuantities[p.id] = 1;
      });
      setQuantityPerProduct(initialQuantities);
      setSelectedProducts(new Set(validProducts.map(p => p.id)));

      if (validProducts.length === 0) {
        toast.info(t('barcodeLabelsA4Generator.aucunProduitAvecCodeBarres'), {
          description: 'Créez des produits pour générer des étiquettes'
        });
      } else {
        toast.success(`${validProducts.length} produit(s) avec code-barres détecté(s)`);
      }
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      toast.error(t('barcodeLabelsA4Generator.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const selectAll = () => setSelectedProducts(new Set(products.map(p => p.id)));
  const deselectAll = () => setSelectedProducts(new Set());

  // Calcul du total d'étiquettes
  const totalLabels = Array.from(selectedProducts).reduce((sum, productId) => {
    return sum + (quantityPerProduct[productId] || 1);
  }, 0);

  // Générer les étiquettes
  const getLabelsToGenerate = (): Product[] => {
    const labels: Product[] = [];
    Array.from(selectedProducts).forEach(productId => {
      const product = products.find(p => p.id === productId);
      if (product && product.barcode_value) {
        const qty = quantityPerProduct[productId] || 1;
        for (let i = 0; i < qty; i++) {
          labels.push(product);
        }
      }
    });
    return labels;
  };

  const drawBarcodeInPDF = (
    pdf: InstanceType<Awaited<ReturnType<typeof loadJsPDF>>>,
    barcodeValue: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    const encoded = encodeCode128(barcodeValue);
    const barWidth = width / encoded.length;

    pdf.setFillColor(0, 0, 0);

    let currentX = x;
    for (let i = 0; i < encoded.length; i++) {
      if (encoded[i] === '1') {
        pdf.rect(currentX, y, barWidth, height, 'F');
      }
      currentX += barWidth;
    }
  };

  // Générer le PDF A4 professionnel
  const generatePDF = async () => {
    const labels = getLabelsToGenerate();
    if (labels.length === 0) {
      toast.error(t('barcodeLabelsA4Generator.selectionnezAuMoinsUnProduit'));
      return;
    }

    setGenerating(true);
    toast.info(t('barcodeLabelsA4Generator.generationDuPdfEnCours'));

    try {
      const layout = GRID_LAYOUTS[gridLayout];
      const labelsPerPage = layout.cols * layout.rows;
      const totalPages = Math.ceil(labels.length / labelsPerPage);

      const jsPDF = await loadJsPDF();
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Dimensions A4 en mm
      const pageWidth = 210;
      const pageHeight = 297;
      const marginX = (pageWidth - (layout.cols * layout.labelWidth)) / 2;
      const marginY = (pageHeight - (layout.rows * layout.labelHeight)) / 2;

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        const startIdx = page * labelsPerPage;
        const pageLabels = labels.slice(startIdx, startIdx + labelsPerPage);

        for (let i = 0; i < pageLabels.length; i++) {
          const label = pageLabels[i];
          const col = i % layout.cols;
          const row = Math.floor(i / layout.cols);

          const x = marginX + col * layout.labelWidth;
          const y = marginY + row * layout.labelHeight;

          // Bordure fine pour découpe
          pdf.setDrawColor(180, 180, 180);
          pdf.setLineWidth(0.2);
          pdf.rect(x, y, layout.labelWidth, layout.labelHeight);

          // Fond blanc
          pdf.setFillColor(255, 255, 255);
          pdf.rect(x + 0.5, y + 0.5, layout.labelWidth - 1, layout.labelHeight - 1, 'F');

          // Nom du produit (centré, tronqué)
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          const maxNameLength = Math.floor(layout.labelWidth / 2.5);
          const productName = label.name.length > maxNameLength
            ? label.name.substring(0, maxNameLength - 2) + '...'
            : label.name;
          pdf.text(productName, x + layout.labelWidth / 2, y + 5, { align: 'center' });

          // Code-barres graphique
          const barcodeX = x + 3;
          const barcodeY = y + 7;
          const barcodeWidth = layout.labelWidth - 6;
          const barcodeHeight = layout.labelHeight - 18;

          drawBarcodeInPDF(pdf, label.barcode_value || '', barcodeX, barcodeY, barcodeWidth, barcodeHeight);

          // Valeur du code-barres (texte sous les barres)
          pdf.setFontSize(7);
          pdf.setFont('courier', 'normal');
          pdf.text(label.barcode_value || '', x + layout.labelWidth / 2, y + layout.labelHeight - 7, { align: 'center' });

          // Informations supplémentaires (prix, SKU, boutique)
          const infoParts: string[] = [];
          if (showPrice) {
            infoParts.push(fc(label.price));
          }
          if (showSku && label.sku) {
            infoParts.push(label.sku);
          }
          if (showBusinessName && businessName) {
            infoParts.push(businessName);
          }

          if (infoParts.length > 0) {
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'normal');
            pdf.text(infoParts.join(' • '), x + layout.labelWidth / 2, y + layout.labelHeight - 2, { align: 'center' });
          }
        }
      }

      // Télécharger le PDF
      const fileName = `etiquettes-codes-barres-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      toast.success(`PDF généré avec succès`, {
        description: `${labels.length} étiquette(s) sur ${totalPages} page(s)`
      });

    } catch (error) {
      console.error('Erreur génération PDF:', error);
      toast.error(t('barcodeLabelsA4Generator.erreurLorsDeLaGeneration'));
    } finally {
      setGenerating(false);
    }
  };

  // Impression directe via navigateur
  const printLabels = async () => {
    const labels = getLabelsToGenerate();
    if (labels.length === 0) {
      toast.error(t('barcodeLabelsA4Generator.selectionnezAuMoinsUnProduit'));
      return;
    }

    const layout = GRID_LAYOUTS[gridLayout];

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(t('barcodeLabelsA4Generator.popupBloqueeAutorisezLesPopups'));
      return;
    }

    const labelsHTML = labels.map((label, idx) => `
      <div class="label">
        <div class="name">${escapeHtml(label.name.length > 25 ? label.name.substring(0, 22) + '...' : label.name)}</div>
        <svg id="bc-${idx}"></svg>
        <div class="info">
          ${[
            showPrice ? escapeHtml(fc(label.price)) : '',
            showSku && label.sku ? escapeHtml(label.sku) : '',
            showBusinessName && businessName ? escapeHtml(businessName) : ''
          ].filter(Boolean).join(' • ')}
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>{t('barcodeLabelsA4Generator.etiquettesCodesBarres')}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
          <style>
            @page { size: A4; margin: 5mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 5mm; }
            .grid {
              display: grid;
              grid-template-columns: repeat(${layout.cols}, ${layout.labelWidth}mm);
              gap: 1mm;
              justify-content: center;
            }
            .label {
              width: ${layout.labelWidth}mm;
              height: ${layout.labelHeight}mm;
              border: 0.5px solid #ccc;
              padding: 2mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              page-break-inside: avoid;
              background: white;
            }
            .name {
              font-size: 8px;
              font-weight: bold;
              text-align: center;
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .info {
              font-size: 6px;
              text-align: center;
              color: #333;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="grid">${labelsHTML}</div>
          <script>
            ${labels.map((label, idx) => `
              try {
                JsBarcode("#bc-${idx}", "${label.barcode_value}", {
                  format: "CODE128",
                  width: 1.5,
                  height: ${layout.labelHeight > 30 ? 35 : 25},
                  fontSize: 9,
                  margin: 2,
                  displayValue: true
                });
              } catch(e) { console.error("Barcode error:", e); }
            `).join('\n')}

            window.onload = function() {
              setTimeout(function() { window.print(); }, 600);
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) loadProductsWithBarcodes();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto gap-1.5 border-primary/30 hover:border-primary hover:bg-primary/5 text-sm px-3">
          <BarcodeIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{t('barcodeLabelsA4Generator.etiquettes')}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileDown className="h-5 w-5 text-primary" />
            Génération d'étiquettes codes-barres A4
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les produits et générez un PDF prêt à imprimer et découper
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Options compactes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg border">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Format grille</Label>
              <Select value={gridLayout} onValueChange={(v) => setGridLayout(v as GridLayout)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3x8">3×8 (24/page)</SelectItem>
                  <SelectItem value="4x10">4×10 (40/page)</SelectItem>
                  <SelectItem value="3x10">3×10 (30/page)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Afficher</Label>
              <div className="flex flex-col gap-0.5">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox checked={showPrice} onCheckedChange={(c) => setShowPrice(!!c)} className="h-3.5 w-3.5" />
                  Prix
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox checked={showSku} onCheckedChange={(c) => setShowSku(!!c)} className="h-3.5 w-3.5" />
                  SKU
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox checked={showBusinessName} onCheckedChange={(c) => setShowBusinessName(!!c)} className="h-3.5 w-3.5" />
                  Boutique
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">{t('barcodeLabelsA4Generator.selection')}</Label>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={selectAll} disabled={products.length === 0} className="h-7 text-xs px-2">
                  Tout
                </Button>
                <Button size="sm" variant="outline" onClick={deselectAll} disabled={selectedProducts.size === 0} className="h-7 text-xs px-2">
                  Aucun
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">{t('barcodeLabelsA4Generator.resume')}</Label>
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{selectedProducts.size}</span> produit(s)
                </div>
                <div className="flex items-center gap-1.5">
                  <BarcodeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{totalLabels}</span> étiquette(s)
                </div>
              </div>
            </div>
          </div>

          {/* Liste des produits */}
          <ScrollArea className="flex-1 border rounded-lg">
            <div className="p-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Chargement...</span>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarcodeIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">{t('barcodeLabelsA4Generator.aucunProduitAvecCodeBarres2')}</p>
                  <p className="text-xs mt-1">{t('barcodeLabelsA4Generator.creezDesProduitsPourGenerer')}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {products.map(product => (
                    <div
                      key={product.id}
                      className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-all ${
                        selectedProducts.has(product.id)
                          ? 'bg-primary/10 border-primary/50'
                          : 'hover:bg-muted/50 border-transparent'
                      }`}
                      onClick={() => toggleProductSelection(product.id)}
                    >
                      <Checkbox
                        checked={selectedProducts.has(product.id)}
                        onCheckedChange={() => toggleProductSelection(product.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {fc(product.price)}
                          {product.sku && <span className="ml-2">• {product.sku}</span>}
                        </p>
                      </div>

                      <Badge variant="secondary" className="font-mono text-[10px] px-1.5">
                        {product.barcode_value}
                      </Badge>

                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={quantityPerProduct[product.id] || 1}
                        onChange={(e) => {
                          e.stopPropagation();
                          const val = Math.max(1, Math.min(100, parseInt(e.target.value) || 1));
                          setQuantityPerProduct(prev => ({ ...prev, [product.id]: val }));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-14 h-7 text-xs text-center"
                        title={t('barcodeLabelsA4Generator.quantiteDEtiquettes')}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={printLabels}
              disabled={generating || selectedProducts.size === 0}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimer
            </Button>

            <Button
              onClick={generatePDF}
              disabled={generating || selectedProducts.size === 0}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Télécharger PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
