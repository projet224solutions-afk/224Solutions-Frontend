/**
 * LISTE DES DEVIS - INTERFACE VENDEUR
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download, CheckCircle, XCircle, Clock, RefreshCw, Eye, Trash2, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVendorId } from '@/hooks/useVendorId';
import QuoteDetails from './QuoteDetails';
import QuoteEditDialog from './QuoteEditDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Quote {
  id: string;
  ref: string;
  vendor_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  total: number;
  status: string;
  valid_until: string;
  pdf_url: string | null;
  created_at: string;
  items: any[];
  subtotal: number;
  discount: number;
  tax: number;
  notes: string | null;
}

export default function QuotesList({ refresh }: { refresh?: number }) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { vendorId } = useVendorId();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);

  const loadQuotes = async () => {
    if (!vendorId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes((data as any[]) || []);

      // Si un devis est sélectionné, le mettre à jour avec les nouvelles données
      if (selectedQuote && data) {
        const updatedQuote = data.find((q: any) => q.id === selectedQuote.id);
        if (updatedQuote) {
          setSelectedQuote(updatedQuote as Quote);
        }
      }
    } catch (error: any) {
      console.error('Erreur chargement devis:', error);
      toast.error(t('quotesList.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, refresh]);

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { label: 'En attente', variant: 'secondary' as const, icon: Clock },
      accepted: { label: 'Accepté', variant: 'default' as const, icon: CheckCircle },
      rejected: { label: 'Refusé', variant: 'destructive' as const, icon: XCircle },
      expired: { label: 'Expiré', variant: 'outline' as const, icon: Clock }
    };

    const { label, variant, icon: Icon } = config[status as keyof typeof config];

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  const downloadPDF = async (pdfUrl: string, ref: string) => {
    try {
      // Tentative téléchargement "forcé" (peut échouer si CORS / bucket privé)
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${ref}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(t('quotesList.telechargementDemarre'));
    } catch (error) {
      console.error('Erreur téléchargement:', error);

      // Fallback fiable (évite CORS): ouvrir le PDF dans un nouvel onglet
      const opened = window.open(pdfUrl, '_blank');
      if (opened) {
        toast.success(t('quotesList.pdfOuvertDansUnNouvel'));
      } else {
        toast.error(t('quotesList.telechargementBloqueAutorisezLesPopups'));
      }
    }
  };

  const convertToInvoice = async (quoteId: string) => {
    if (!vendorId) return;

    try {
      const quote = quotes.find(q => q.id === quoteId);
      if (!quote) return;

      // Créer la facture
      const invoiceRef = quote.ref.replace('DEV-', 'FACT-');
      const { data: newInvoice, error } = await supabase
        .from('invoices')
        .insert({
          ref: invoiceRef,
          quote_id: quoteId,
          vendor_id: vendorId,
          client_name: quote.client_name,
          client_email: quote.client_email || null,
          client_phone: quote.client_phone || null,
          items: quote.items as any,
          subtotal: quote.subtotal,
          tax: quote.tax,
          discount: quote.discount,
          total: quote.total,
          status: 'pending',
          due_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0]
        })
        .select()
        .single();

      if (error) throw error;

      // Générer le PDF de la facture
      if (newInvoice) {
        const { backendFetch } = await import('@/services/backendApi');
        const pdfResp = await backendFetch<any>('/api/documents/invoice-pdf', {
          method: 'POST',
          body: { invoice_id: newInvoice.id, ref: invoiceRef }
        });

        if (!pdfResp.success) {
          console.error('Erreur génération PDF facture:', pdfResp.error);
          toast.error(t('quotesList.factureCreeeMaisPdfNon'));
        }
      }

      // Mettre à jour le statut du devis
      await supabase
        .from('quotes')
        .update({ status: 'accepted' })
        .eq('id', quoteId);

      toast.success(t('quotesList.devisConvertiEnFactureAvec'));
      setShowDetails(false);
      loadQuotes();
    } catch (error: any) {
      console.error('Erreur conversion:', error);
      toast.error(t('quotesList.erreurLorsDeLaConversion'));
    }
  };

  const deleteQuote = async (quoteId: string) => {
    try {
      const quote = quotes.find(q => q.id === quoteId);

      // Supprimer le PDF du storage si il existe
      if (quote?.pdf_url) {
        const fileName = quote.pdf_url.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('documents')
            .remove([`quotes/${vendorId}/${fileName}`]);
        }
      }

      // Supprimer le devis de la base de données
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (error) throw error;

      toast.success(t('quotesList.devisSupprimeAvecSucces'));
      setDeleteDialogOpen(false);
      setQuoteToDelete(null);
      loadQuotes();
    } catch (error: any) {
      console.error('Erreur suppression:', error);
      toast.error(t('quotesList.erreurLorsDeLaSuppression'));
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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Mes Devis</CardTitle>
            <Button onClick={loadQuotes} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('quotesList.aucunDevisCree')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {quotes.map((quote) => (
                <div key={quote.id} className="border rounded-lg p-4 hover:bg-muted/50 transition">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-primary">{quote.ref}</span>
                        {getStatusBadge(quote.status)}
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
                        {fc(quote.total || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Valide jusqu'au {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('fr-FR') : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedQuote(quote);
                        setShowDetails(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Voir détails
                    </Button>

                    {quote.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedQuote(quote);
                          setShowEditDialog(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Modifier
                      </Button>
                    )}

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

                    {quote.status === 'pending' && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => convertToInvoice(quote.id)}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Convertir en Facture
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setQuoteToDelete(quote.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </Button>
                      </>
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

      <QuoteDetails
        quote={selectedQuote}
        open={showDetails}
        onClose={() => {
          setShowDetails(false);
          setSelectedQuote(null);
        }}
        onConvert={() => selectedQuote && convertToInvoice(selectedQuote.id)}
        vendorId={vendorId || ''}
      />

      <QuoteEditDialog
        quote={selectedQuote}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={async () => {
          setShowEditDialog(false);
          // Recharger les devis
          await loadQuotes();

          // Si le dialog de détails était ouvert, recharger le devis sélectionné avec les données fraîches
          if (showDetails && selectedQuote) {
            const { data: updatedQuote } = await supabase
              .from('quotes')
              .select('*')
              .eq('id', selectedQuote.id)
              .single();

            if (updatedQuote) {
              setSelectedQuote(updatedQuote as Quote);
            }
          }
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('quotesList.confirmerLaSuppression')}</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce devis ? Cette action est irréversible et supprimera également le PDF associé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setQuoteToDelete(null)}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => quoteToDelete && deleteQuote(quoteToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
