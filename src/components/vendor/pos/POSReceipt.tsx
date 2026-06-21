import React, { useRef } from 'react';
import { escapeHtml } from '@/lib/security/inputSanitizer';
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Printer,
  Check,
  Store,
  Calendar,
  CreditCard,
  Banknote,
  Smartphone,
  X
} from 'lucide-react';
// Lazy-loaded to keep out of main bundle
const loadPdfLibs = () => Promise.all([
  import('html2canvas').then(m => m.default),
  import('jspdf').then(m => m.default),
]);
import { toast } from 'sonner';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  saleType?: 'unit' | 'carton';
  displayQuantity?: string;
  discount?: {
    type: 'percent' | 'amount' | null;
    value: number;
    discountAmount?: number;
  };
}

interface POSReceiptProps {
  open: boolean;
  onClose: () => void;
  orderData: {
    orderNumber: string;
    items: CartItem[];
    subtotal: number;
    tax: number;
    taxRate: number;
    taxEnabled: boolean;
    discount: number;
    discountMode?: 'percent' | 'amount';
    discountPercent?: number;
    totalBeforeDiscount?: number;
    total: number;
    paymentMethod: 'cash' | 'card' | 'mobile';
    receivedAmount: number;
    change: number;
    currency: string;
    companyName: string;
    logoUrl?: string;
    receiptFooter?: string;
  };
}

export function POSReceipt({ open, onClose, orderData }: POSReceiptProps) {
  const { t } = useTranslation();
  const receiptRef = useRef<HTMLDivElement>(null);

  const hasDiscount = orderData.discount > 0;
  const totalBeforeDiscount = orderData.totalBeforeDiscount ?? (orderData.subtotal + orderData.tax);
  const discountLabel = orderData.discountMode === 'percent' && (orderData.discountPercent || 0) > 0
    ? `Remise (${orderData.discountPercent}%)`
    : 'Remise';

  const getItemPricing = (item: CartItem) => {
    const discountType = item.discount?.type;
    const discountValue = Number(item.discount?.value || 0);

    let discountPerUnit = 0;
    if (discountType === 'percent') {
      discountPerUnit = (item.price * discountValue) / 100;
    } else if (discountType === 'amount') {
      discountPerUnit = discountValue;
    }

    const finalUnitPrice = Math.max(0, item.price - discountPerUnit);
    const finalTotal = discountPerUnit > 0 ? finalUnitPrice * item.quantity : item.total;

    return {
      hasItemDiscount: discountPerUnit > 0,
      finalUnitPrice,
      finalTotal,
    };
  };

  const downloadReceipt = async () => {
    if (!receiptRef.current) return;

    try {
      const [html2canvas, jsPDF] = await loadPdfLibs();
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, canvas.height * 80 / canvas.width + 20],
      });

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 5, 5, 70, (canvas.height * 70) / canvas.width);
      pdf.save(`recu-${orderData.orderNumber}.pdf`);

      toast.success(t('pOSReceipt.recuTelechargeAvecSucces'));
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      toast.error(t('pOSReceipt.erreurLorsDuTelechargement'));
    }
  };

  const printReceipt = () => {
    if (!receiptRef.current) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Reçu - ${escapeHtml(orderData.orderNumber)}</title>
            <style>
              body { font-family: 'Courier New', monospace; font-size: 14px; padding: 10px; max-width: 320px; margin: 0 auto; }
              .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
              .item { display: flex; justify-content: space-between; margin: 5px 0; }
              .total { border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; font-weight: bold; }
              .footer { text-align: center; border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; font-size: 10px; }
            </style>
          </head>
          <body>
            ${receiptRef.current.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getPaymentIcon = () => {
    switch (orderData.paymentMethod) {
      case 'cash': return <Banknote className="h-4 w-4" />;
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'mobile': return <Smartphone className="h-4 w-4" />;
    }
  };

  const getPaymentLabel = () => {
    switch (orderData.paymentMethod) {
      case 'cash': return 'Espèces';
      case 'card': return 'Carte bancaire';
      case 'mobile': return 'Paiement mobile';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 mx-2">
        {/* Header avec actions */}
        <div className="sticky top-0 z-10 bg-[#ff4000] text-white p-3 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">{t('pOSReceipt.paiementReussi')}</h2>
                <p className="text-xs text-white/80">#{orderData.orderNumber}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20 h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Reçu imprimable */}
        <div className="p-3">
          <div
            ref={receiptRef}
            className="bg-white border-2 border-dashed border-border rounded-lg p-3 font-mono text-sm"
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            {/* En-tête reçu */}
            <div className="text-center border-b border-dashed border-muted-foreground/30 pb-3 mb-3">
              <div className="w-12 h-12 bg-[#ff4000] rounded-xl mx-auto mb-2 flex items-center justify-center overflow-hidden shadow-md">
                {orderData.logoUrl ? (
                  <img loading="lazy" src={orderData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Store className="h-6 w-6 text-white" />
                )}
              </div>
              <h3 className="text-lg font-bold text-foreground">{orderData.companyName}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t('pOSReceipt.recuDeCaisse')}</p>
              <div className="flex items-center justify-center gap-1 mt-1 text-[10px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{new Date().toLocaleString('fr-FR')}</span>
              </div>
            </div>

            {/* Numéro de commande */}
            <div className="bg-orange-50 rounded-lg p-2 mb-3 text-center border border-orange-100">
              <p className="text-xs text-muted-foreground">{t('pOSReceipt.nCommande')}</p>
              <p className="text-lg font-bold text-[#ff4000]">#{orderData.orderNumber}</p>
            </div>

            {/* Articles */}
            <div className="space-y-1 mb-3">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Articles</p>
              {orderData.items.map((item) => {
                const pricing = getItemPricing(item);

                return (
                  <div key={`${item.id}-${item.saleType || 'unit'}`} className="flex justify-between items-start py-1">
                    <div className="flex-1">
                      <p className="font-semibold text-foreground text-sm">
                        {item.saleType === 'carton' && '📦 '}
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.saleType === 'carton' && item.displayQuantity
                          ? item.displayQuantity
                          : `${item.quantity} unité(s)`
                        } × {pricing.hasItemDiscount ? pricing.finalUnitPrice.toLocaleString() : item.price.toLocaleString()} {orderData.currency}
                      </p>
                      {pricing.hasItemDiscount && (
                        <p className="text-[10px] text-[#ff4000] font-medium">
                          Remise appliquée sur l'article
                        </p>
                      )}
                      {item.saleType === 'carton' && (
                        <p className="text-[10px] text-[#ff4000] font-medium">Vente par carton</p>
                      )}
                    </div>
                    <div className="text-right">
                      {pricing.hasItemDiscount && (
                        <p className="text-[10px] line-through text-muted-foreground">
                          {item.total.toLocaleString()} {orderData.currency}
                        </p>
                      )}
                      <p className="font-bold text-foreground text-sm">
                        {pricing.finalTotal.toLocaleString()} {orderData.currency}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator className="my-3" />

            {/* Totaux */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sous-total</span>
                <span className="font-medium">{orderData.subtotal.toLocaleString()} {orderData.currency}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  TVA ({orderData.taxEnabled ? `${(orderData.taxRate * 100).toFixed(1)}%` : 'désactivée'})
                </span>
                <span className="font-medium">{orderData.tax.toLocaleString()} {orderData.currency}</span>
              </div>
              {hasDiscount && (
                <div className="flex justify-between text-sm text-[#ff4000] font-medium">
                  <span>{discountLabel}</span>
                  <span>-{orderData.discount.toLocaleString()} {orderData.currency}</span>
                </div>
              )}

              <div className="flex justify-between items-start pt-2 border-t-2 border-foreground">
                <div>
                  <span className="text-xl font-bold">TOTAL</span>
                  {hasDiscount && totalBeforeDiscount > orderData.total && (
                    <p className="text-[10px] text-muted-foreground line-through">
                      {totalBeforeDiscount.toLocaleString()} {orderData.currency}
                    </p>
                  )}
                </div>
                <span className="text-xl font-bold text-[#ff4000]">
                  {orderData.total.toLocaleString()} {orderData.currency}
                </span>
              </div>
            </div>

            <Separator className="my-3" />

            {/* Mode de paiement */}
            <div className="bg-muted/20 rounded-lg p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getPaymentIcon()}
                  <span className="font-medium text-sm">{getPaymentLabel()}</span>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-[#e53900] text-xs border border-orange-200">
                  Payé
                </Badge>
              </div>

              {orderData.paymentMethod === 'cash' && orderData.receivedAmount > 0 && (
                <div className="mt-2 pt-2 border-t border-muted-foreground/20 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('pOSReceipt.recu')}</span>
                    <span>{orderData.receivedAmount.toLocaleString()} {orderData.currency}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-[#ff4000]">
                    <span>Rendu</span>
                    <span>{orderData.change.toLocaleString()} {orderData.currency}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Pied de page */}
            <div className="text-center mt-4 pt-3 border-t border-dashed border-muted-foreground/30">
              <p className="text-xs text-muted-foreground">
                {orderData.receiptFooter || 'Merci pour votre achat!'}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Powered by 224Solutions
              </p>
            </div>
          </div>

          {/* Actions téléchargement/impression - Optimisé mobile */}
          <div className="grid grid-cols-2 gap-2 mt-3 pb-2">
            <Button
              variant="outline"
              onClick={printReceipt}
              className="h-10 text-sm shadow-md"
            >
              <Printer className="h-4 w-4 mr-1" />
              Imprimer
            </Button>
            <Button
              onClick={downloadReceipt}
              className="h-10 text-sm bg-[#ff4000] shadow-md"
            >
              <Download className="h-4 w-4 mr-1" />
              PDF
            </Button>
          </div>

          {/* Bouton fermer */}
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full mt-1 text-muted-foreground text-sm h-9"
          >
            Nouvelle vente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
