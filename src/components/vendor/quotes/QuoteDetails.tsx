/**
 * DÉTAILS DU DEVIS - MODAL (Modernisé style Odoo)
 * Design professionnel avec support multilingue complet
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, FileText, CheckCircle, Clock, XCircle, Building2, Mail, Phone, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

interface QuoteDetailsProps {
  quote: {
    id: string;
    ref: string;
    vendor_id: string;
    client_name: string;
    client_email: string | null;
    client_phone: string | null;
    client_address: string | null;
    items: any[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    status: string;
    valid_until: string;
    pdf_url: string | null;
    notes: string | null;
    created_at: string;
  } | null;
  open: boolean;
  onClose: () => void;
  onConvert: () => void;
  vendorId: string;
}

export default function QuoteDetails({ quote, open, onClose, onConvert }: QuoteDetailsProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();

  if (!quote) return null;

  const getStatusConfig = (status: string) => {
    const config: Record<string, { label: string; variant: 'secondary' | 'default' | 'destructive' | 'outline'; icon: typeof Clock; className: string }> = {
      pending: { label: t('invoice.status.pending'), variant: 'secondary', icon: Clock, className: 'bg-orange-100 text-[#ff4000] border-orange-200 dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
      accepted: { label: t('invoice.status.accepted'), variant: 'default', icon: CheckCircle, className: 'bg-orange-100 text-[#ff4000] border-orange-200 dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
      rejected: { label: t('invoice.status.rejected'), variant: 'destructive', icon: XCircle, className: 'bg-orange-100 text-[#ff4000] border-orange-200 dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
      expired: { label: t('invoice.status.expired'), variant: 'outline', icon: Clock, className: 'bg-muted text-muted-foreground border-border' }
    };
    return config[status] || config.pending;
  };

  const statusConfig = getStatusConfig(quote.status);
  const StatusIcon = statusConfig.icon;

  const downloadPDF = async (pdfUrl: string, ref: string) => {
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${ref}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(t('invoice.downloadStarted'));
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      const opened = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      if (opened) {
        toast.success(t('invoice.pdfOpenedNewTab'));
      } else {
        toast.error(t('invoice.pdfBlockedPopup'));
      }
    }
  };

  const generatePDF = async () => {
    try {
      toast.info(t('invoice.generating'));

      const { data: freshQuote, error: fetchError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quote.id)
        .single();

      if (fetchError) throw fetchError;

      const { backendFetch } = await import('@/services/backendApi');
      const resp = await backendFetch<any>('/api/documents/quote-pdf', {
        method: 'POST',
        body: { quote_id: freshQuote.id, ref: freshQuote.ref }
      });

      if (!resp.success) throw new Error(resp.error || 'Erreur génération PDF');

      toast.success(t('invoice.pdfGenerated'));

      const pdf_url = resp.data?.pdf_url || (resp as any).pdf_url;
      if (pdf_url) {
        await downloadPDF(pdf_url, freshQuote.ref);
      }
    } catch (error: any) {
      console.error('Erreur génération PDF:', error);
      toast.error(t('invoice.errorGeneratingPDF'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header - Inspired by Odoo invoice style */}
        <div className="bg-primary/5 dark:bg-primary/10 px-6 py-4 border-b border-border/50">
          <DialogHeader className="space-y-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">
                    {t('invoice.quote')} {quote.ref}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('invoice.createdAt')} {new Date(quote.created_at).toLocaleDateString()} {t('invoice.at')} {new Date(quote.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <Badge className={`gap-1 text-xs px-3 py-1 border ${statusConfig.className}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {statusConfig.label}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          {/* Two-column: Client info + Payment info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client */}
            <div className="rounded-lg border border-border/60 p-4 bg-card">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {t('invoice.billedTo')}
              </h3>
              <div className="space-y-2">
                <p className="font-semibold text-sm">{quote.client_name}</p>
                {quote.client_email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3" />
                    {quote.client_email}
                  </div>
                )}
                {quote.client_phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    {quote.client_phone}
                  </div>
                )}
                {quote.client_address && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {quote.client_address}
                  </div>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="rounded-lg border border-border/60 p-4 bg-card">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {t('invoice.paymentInfo')}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('invoice.date')}:</span>
                  <span className="font-medium">{new Date(quote.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('invoice.validUntil')}:</span>
                  <span className="font-medium">{new Date(quote.valid_until).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('invoice.ref')}:</span>
                  <span className="font-mono font-medium text-primary">{quote.ref}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items table - Odoo style */}
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="bg-primary/5 dark:bg-primary/10 px-4 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {t('invoice.description')}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/50">
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('invoice.description')}</th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('invoice.quantity')}</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('invoice.unitPrice')}</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('invoice.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item: any, idx: number) => {
                    const qty = item.quantity ?? item.qty ?? 0;
                    const price = item.unit_price ?? item.price ?? 0;
                    const itemTotal = item.total ?? (qty * price);

                    return (
                      <tr key={idx} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium">{item.name || ''}</td>
                        <td className="text-center p-3 text-muted-foreground">{qty}</td>
                        <td className="text-right p-3 text-muted-foreground">{fc(price || 0)}</td>
                        <td className="text-right p-3 font-semibold">{fc(itemTotal || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals - Right aligned like Odoo */}
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t('invoice.subtotal')}:</span>
                <span className="font-medium">{fc(quote.subtotal || 0)}</span>
              </div>
              {(quote.discount || 0) > 0 && (
                <div className="flex justify-between py-1 text-[#ff4000]">
                  <span>{t('invoice.discount')}:</span>
                  <span>-{fc(quote.discount || 0)}</span>
                </div>
              )}
              {(quote.tax || 0) > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">{t('invoice.tax')}:</span>
                  <span>{fc(quote.tax || 0)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between py-2">
                <span className="font-bold text-base">{t('invoice.total')}:</span>
                <span className="font-bold text-xl text-primary">{fc(quote.total || 0)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="rounded-lg border border-border/60 p-4 bg-muted/20">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {t('invoice.notes')}
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          {/* Thank you note */}
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground italic">{t('invoice.thankYou')}</p>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" onClick={onClose} size="sm" className="gap-1.5">
              {t('invoice.close')}
            </Button>

            <Button variant="outline" onClick={generatePDF} size="sm" className="gap-1.5">
              <Download className="w-3.5 h-3.5" />
              {t('invoice.generatePDF')}
            </Button>

            {quote.pdf_url && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => downloadPDF(quote.pdf_url!, quote.ref)}
              >
                <Download className="w-3.5 h-3.5" />
                {t('invoice.downloadPDF')}
              </Button>
            )}

            {quote.status === 'pending' && (
              <Button onClick={onConvert} size="sm" className="gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                {t('invoice.convertToInvoice')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
