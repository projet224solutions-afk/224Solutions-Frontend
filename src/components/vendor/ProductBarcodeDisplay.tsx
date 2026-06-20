/**
 * ProductBarcodeDisplay - Affichage du code-barres scannable pour les produits
 * Utilise react-barcode pour générer des codes-barres EAN-13 ou CODE128
 */

import { useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import Barcode from 'react-barcode';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/Money';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, Printer, Copy, Barcode as BarcodeIcon } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ProductBarcodeDisplayProps {
  barcode: string;
  productName: string;
  sku?: string;
  price?: number;
  showActions?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function ProductBarcodeDisplay({
  barcode,
  productName,
  sku,
  price,
  showActions = true,
  size = 'medium'
}: ProductBarcodeDisplayProps) {
  const { t } = useTranslation();
  const barcodeRef = useRef<HTMLDivElement>(null);

  // Déterminer le format du code-barres
  const getBarcodeFormat = (code: string): 'EAN13' | 'CODE128' | 'EAN8' => {
    if (/^\d{13}$/.test(code)) return 'EAN13';
    if (/^\d{8}$/.test(code)) return 'EAN8';
    return 'CODE128'; // Fallback pour les codes alphanumériques
  };

  // Dimensions selon la taille
  const dimensions = {
    small: { width: 1.2, height: 40, fontSize: 10 },
    medium: { width: 1.8, height: 60, fontSize: 12 },
    large: { width: 2.5, height: 80, fontSize: 14 }
  };

  const { width, height, fontSize } = dimensions[size];
  const format = getBarcodeFormat(barcode);

  // Copier le code-barres
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(barcode);
      toast.success(t('productBarcodeDisplay.codeBarresCopie'));
    } catch (_error) {
      toast.error(t('productBarcodeDisplay.erreurLorsDeLaCopie'));
    }
  };

  // Télécharger comme image PNG
  const handleDownloadPNG = async () => {
    if (!barcodeRef.current) return;

    try {
      const canvas = await html2canvas(barcodeRef.current, {
        backgroundColor: '#ffffff',
        scale: 3 // Haute résolution pour une meilleure qualité de scan
      });

      const link = document.createElement('a');
      link.download = `barcode-${barcode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.success(t('productBarcodeDisplay.codeBarresTelechargeEnPng'));
    } catch (_error) {
      toast.error(t('productBarcodeDisplay.erreurLorsDuTelechargement'));
    }
  };

  // Télécharger comme PDF (pour impression)
  const handleDownloadPDF = async () => {
    if (!barcodeRef.current) return;

    try {
      const canvas = await html2canvas(barcodeRef.current, {
        backgroundColor: '#ffffff',
        scale: 4
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [50, 30] // Format étiquette standard
      });

      // Centrer l'image sur l'étiquette
      const imgWidth = 45;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 2.5, (30 - imgHeight) / 2, imgWidth, imgHeight);

      pdf.save(`barcode-${barcode}.pdf`);

      toast.success(t('productBarcodeDisplay.codeBarresTelechargeEnPdf'));
    } catch (_error) {
      toast.error(t('productBarcodeDisplay.erreurLorsDuTelechargement'));
    }
  };

  // Impression directe
  const handlePrint = async () => {
    if (!barcodeRef.current) return;

    try {
      const canvas = await html2canvas(barcodeRef.current, {
        backgroundColor: '#ffffff',
        scale: 4
      });

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error(t('productBarcodeDisplay.popupBloqueeAutorisezLesPopups'));
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Code-barres - ${barcode}</title>
            <style>
              body {
                margin: 0;
                padding: 10mm;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
              }
              img { max-width: 100%; height: auto; }
              @media print {
                body { padding: 0; }
                img { width: 50mm; height: auto; }
              }
            </style>
          </head>
          <body>
            <img src="${canvas.toDataURL('image/png')}" />
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() { window.close(); }
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();

    } catch (_error) {
      toast.error(t('productBarcodeDisplay.erreurLorsDeL'));
    }
  };

  if (!barcode) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <BarcodeIcon className="h-4 w-4" />
        <span>{t('productBarcodeDisplay.aucunCodeBarres')}</span>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div
          className="cursor-pointer hover:opacity-80 transition-opacity bg-white p-2 rounded-lg border inline-block"
          title={t('productBarcodeDisplay.cliquerPourAgrandirEtImprimer')}
        >
          <div ref={barcodeRef} className="bg-white p-2">
            <Barcode
              value={barcode}
              format={format}
              width={width}
              height={height}
              fontSize={fontSize}
              margin={5}
              background="#ffffff"
              lineColor="#000000"
              displayValue={true}
            />
          </div>
        </div>
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarcodeIcon className="h-5 w-5" />
            Code-barres produit
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Infos produit */}
          <div className="text-center space-y-1">
            <p className="font-semibold">{productName}</p>
            {sku && <p className="text-sm text-muted-foreground">SKU: {sku}</p>}
            {price && (
              <p className="text-lg font-bold text-primary">
                <Money amount={price} from="GNF" />
              </p>
            )}
          </div>

          {/* Code-barres agrandi */}
          <div className="flex justify-center bg-white p-4 rounded-lg border">
            <div ref={barcodeRef} className="bg-white p-3">
              <Barcode
                value={barcode}
                format={format}
                width={2.5}
                height={80}
                fontSize={16}
                margin={10}
                background="#ffffff"
                lineColor="#000000"
                displayValue={true}
              />
            </div>
          </div>

          {/* Format détecté */}
          <p className="text-center text-xs text-muted-foreground">
            Format: {format} • {barcode.length} caractères
          </p>

          {/* Actions */}
          {showActions && (
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-2" />
                Copier
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPNG}>
                <Download className="h-4 w-4 mr-2" />
                PNG
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="default" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
            </div>
          )}

          {/* Note */}
          <p className="text-xs text-center text-muted-foreground">
            ✅ Ce code-barres est compatible avec les scanners professionnels (EAN-13/CODE128)
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProductBarcodeDisplay;
