/**
 * LISTE DES FACTURES - INTERFACE VENDEUR (Modernisée style Odoo)
 * Design professionnel avec support multilingue complet
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FileText, Download, CheckCircle, XCircle, Clock, RefreshCw, Building2, Mail, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVendorId } from '@/hooks/useVendorId';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

interface Invoice {
  id: string;
  ref: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  total: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  pdf_url: string | null;
  created_at: string;
}

export default function InvoicesList() {
  const { vendorId } = useVendorId();
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInvoices = async () => {
    if (!vendorId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices((data as any[]) || []);
    } catch (error: any) {
      console.error('Erreur chargement factures:', error);
      toast.error(t('invoice.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const getStatusConfig = (status: string) => {
    const config: Record<string, { label: string; variant: 'secondary' | 'default' | 'destructive' | 'outline'; icon: typeof Clock; className: string }> = {
      pending: { label: t('invoice.status.pending'), variant: 'secondary', icon: Clock, className: 'bg-orange-100 text-[#ff4000] border-orange-200 dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
      paid: { label: t('invoice.status.paid'), variant: 'default', icon: CheckCircle, className: 'bg-orange-100 text-[#ff4000] border-orange-200 dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
      cancelled: { label: t('invoice.status.cancelled'), variant: 'destructive', icon: XCircle, className: 'bg-orange-100 text-[#ff4000] border-orange-200 dark:bg-[#ff4000]/30 dark:text-[#ff4000]' },
      overdue: { label: t('invoice.status.overdue'), variant: 'destructive', icon: Clock, className: 'bg-orange-100 text-[#ff4000] border-orange-200 dark:bg-[#ff4000]/30 dark:text-[#ff4000]' }
    };
    return config[status] || config.pending;
  };

  const markAsPaid = async (invoiceId: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

      if (error) throw error;

      toast.success(t('invoice.markedAsPaid'));
      loadInvoices();
    } catch (error: any) {
      console.error('Erreur:', error);
      toast.error(t('invoice.errorUpdate'));
    }
  };

  const handleDownloadOrGenerate = async (invoice: Invoice) => {
    if (!invoice.pdf_url) {
      try {
        const { backendFetch } = await import('@/services/backendApi');
        const resp = await backendFetch<any>('/api/documents/invoice-pdf', {
          method: 'POST',
          body: { invoice_id: invoice.id, ref: invoice.ref }
        });

        if (!resp.success) throw new Error(resp.error || 'Erreur génération PDF');
        toast.success(t('invoice.pdfGenerated'));
        loadInvoices();
      } catch (error: any) {
        console.error('Erreur génération PDF:', error);
        toast.error(t('invoice.errorGeneratingPDF'));
      }
      return;
    }

    try {
      const response = await fetch(invoice.pdf_url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.ref}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(t('invoice.downloadStarted'));
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      const opened = window.open(invoice.pdf_url, '_blank', 'noopener,noreferrer');
      if (opened) {
        toast.success(t('invoice.pdfOpenedNewTab'));
      } else {
        toast.error(t('invoice.pdfBlockedPopup'));
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-lg">{t('invoice.myInvoices')}</CardTitle>
          </div>
          <Button onClick={loadInvoices} variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            {t('invoice.refresh')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="text-sm">{t('invoice.noInvoices')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => {
              const statusConfig = getStatusConfig(invoice.status);
              const StatusIcon = statusConfig.icon;

              return (
                <div key={invoice.id} className="border border-border/60 rounded-xl overflow-hidden hover:border-border transition-colors bg-card">
                  {/* Header - Ref + Status */}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-primary">{invoice.ref}</span>
                      <Badge className={`gap-1 text-[11px] px-2 py-0.5 border ${statusConfig.className}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('invoice.createdAt')} {new Date(invoice.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      {/* Client info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <p className="font-semibold text-sm">{invoice.client_name}</p>
                        </div>
                        {invoice.client_email && (
                          <div className="flex items-center gap-2 ml-6">
                            <Mail className="w-3 h-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">{invoice.client_email}</p>
                          </div>
                        )}
                        {invoice.client_phone && (
                          <div className="flex items-center gap-2 ml-6">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">{invoice.client_phone}</p>
                          </div>
                        )}
                      </div>

                      {/* Totals */}
                      <div className="text-right space-y-1">
                        <p className="text-2xl font-bold text-primary">
                          {fc(invoice.total || 0)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {t('invoice.dueDate')}: {new Date(invoice.due_date).toLocaleDateString()}
                        </p>
                        {invoice.paid_at && (
                          <p className="text-[11px] text-[#ff4000] dark:text-[#ff4000] font-medium">
                            ✓ {t('invoice.paidOn')} {new Date(invoice.paid_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <Separator className="my-3" />

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => handleDownloadOrGenerate(invoice)}
                      >
                        <Download className="w-3.5 h-3.5" />
                        {invoice.pdf_url ? t('invoice.downloadPDF') : t('invoice.generatePDF')}
                      </Button>
                      {invoice.status === 'pending' && (
                        <Button
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => markAsPaid(invoice.id)}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {t('invoice.markAsPaid')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
