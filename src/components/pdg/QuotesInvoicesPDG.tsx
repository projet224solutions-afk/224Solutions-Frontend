/**
 * INTERFACE PDG - DEVIS & FACTURES
 * Permet au PDG de voir tous les devis et factures de tous les vendeurs
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, CheckCircle, XCircle, Clock, RefreshCw, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Quote {
  id: string;
  ref: string;
  vendor_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  total: number;
  status: string;
  valid_until: string;
  pdf_url: string | null;
  created_at: string;
  vendors?: {
    business_name: string;
  };
}

interface Invoice {
  id: string;
  ref: string;
  vendor_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  total: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  pdf_url: string | null;
  created_at: string;
  vendors?: {
    business_name: string;
  };
}

export default function QuotesInvoicesPDG() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(true);

  const loadQuotes = async () => {
    try {
      setLoadingQuotes(true);
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          vendors (business_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes(data as any || []);
    } catch (error: any) {
      console.error('Erreur chargement devis:', error);
      toast.error(t('quotesInvoicesPDG.erreurLorsDuChargementDes'));
    } finally {
      setLoadingQuotes(false);
    }
  };

  const loadInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          vendors (business_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data as any || []);
    } catch (error: any) {
      console.error('Erreur chargement factures:', error);
      toast.error(t('quotesInvoicesPDG.erreurLorsDuChargementDes2'));
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    loadQuotes();
    loadInvoices();
  }, []);

  const downloadPDF = async (pdfUrl: string, ref: string) => {
    try {
      // Récupérer le fichier via fetch pour contourner les bloqueurs
      const response = await fetch(pdfUrl);
      const blob = await response.blob();

      // Créer un lien de téléchargement temporaire
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${ref}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(t('quotesInvoicesPDG.telechargementDemarre'));
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      toast.error(t('quotesInvoicesPDG.erreurLorsDuTelechargement'));
    }
  };

  const getQuoteStatusBadge = (status: string) => {
    const config = {
      pending: { label: 'En attente', variant: 'secondary' as const, icon: Clock },
      accepted: { label: t('quotesInvoicesPDG.accepte'), variant: 'default' as const, icon: CheckCircle },
      rejected: { label: t('quotesInvoicesPDG.refuse'), variant: 'destructive' as const, icon: XCircle },
      expired: { label: t('quotesInvoicesPDG.expire'), variant: 'outline' as const, icon: Clock }
    };

    const { label, variant, icon: Icon } = config[status as keyof typeof config] || config.pending;

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  const getInvoiceStatusBadge = (status: string) => {
    const config = {
      pending: { label: 'En attente', variant: 'secondary' as const, icon: Clock },
      paid: { label: t('quotesInvoicesPDG.payee'), variant: 'default' as const, icon: CheckCircle },
      cancelled: { label: t('quotesInvoicesPDG.annulee'), variant: 'destructive' as const, icon: XCircle },
      overdue: { label: 'En retard', variant: 'destructive' as const, icon: Clock }
    };

    const { label, variant, icon: Icon } = config[status as keyof typeof config] || config.pending;

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Devis & Factures</h1>
        <p className="text-muted-foreground">{t('quotesInvoicesPDG.vueDEnsembleDeTous')}</p>
      </div>

      <Tabs defaultValue="quotes" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="quotes">
            <FileText className="w-4 h-4 mr-2" />
            Devis ({quotes.length})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <FileText className="w-4 h-4 mr-2" />
            Factures ({invoices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('quotesInvoicesPDG.tousLesDevis')}</CardTitle>
                <Button onClick={loadQuotes} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Actualiser
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingQuotes ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : quotes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('quotesInvoicesPDG.aucunDevisTrouve')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {quotes.map((quote) => (
                    <div key={quote.id} className="border rounded-lg p-4 hover:bg-muted/50 transition">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-mono font-bold text-primary">{quote.ref}</span>
                            {getQuoteStatusBadge(quote.status)}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Store className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{quote.vendors?.business_name || 'Vendeur inconnu'}</span>
                          </div>
                          <p className="font-semibold">{quote.client_name}</p>
                          {quote.client_email && (
                            <p className="text-sm text-muted-foreground">{quote.client_email}</p>
                          )}
                          {quote.client_phone && (
                            <p className="text-sm text-muted-foreground">{quote.client_phone}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {fc(quote.total)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Valide jusqu'au {new Date(quote.valid_until).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {quote.pdf_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadPDF(quote.pdf_url!, quote.ref)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Télécharger PDF
                          </Button>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground">
                          Créé le {new Date(quote.created_at).toLocaleDateString('fr-FR')} à{' '}
                          {new Date(quote.created_at).toLocaleTimeString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('quotesInvoicesPDG.toutesLesFactures')}</CardTitle>
                <Button onClick={loadInvoices} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Actualiser
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingInvoices ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t('quotesInvoicesPDG.aucuneFactureTrouvee')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="border rounded-lg p-4 hover:bg-muted/50 transition">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-mono font-bold text-primary">{invoice.ref}</span>
                            {getInvoiceStatusBadge(invoice.status)}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Store className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{invoice.vendors?.business_name || 'Vendeur inconnu'}</span>
                          </div>
                          <p className="font-semibold">{invoice.client_name}</p>
                          {invoice.client_email && (
                            <p className="text-sm text-muted-foreground">{invoice.client_email}</p>
                          )}
                          {invoice.client_phone && (
                            <p className="text-sm text-muted-foreground">{invoice.client_phone}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {fc(invoice.total)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Échéance: {new Date(invoice.due_date).toLocaleDateString('fr-FR')}
                          </p>
                          {invoice.paid_at && (
                            <p className="text-xs text-[#ff4000]">
                              Payée le {new Date(invoice.paid_at).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {invoice.pdf_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadPDF(invoice.pdf_url!, invoice.ref)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Télécharger PDF
                          </Button>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground">
                          Créée le {new Date(invoice.created_at).toLocaleDateString('fr-FR')} à{' '}
                          {new Date(invoice.created_at).toLocaleTimeString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
