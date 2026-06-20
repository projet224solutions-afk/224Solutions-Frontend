/**
 * Historique des Lots de Tickets de Transport
 * Traçabilité complète des générations
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Eye, Trash2, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TransportTicketPreview from './TransportTicketPreview';

interface TicketConfig {
  syndicateName: string;
  commune: string;
  ticketType: string;
  amount: number;
  date: string;
  optionalMention: string;
  bureauStampUrl?: string;
}

interface TicketBatch {
  id: string;
  batch_number: string;
  bureau_id: string;
  ticket_config: TicketConfig;
  start_number: number;
  end_number: number;
  tickets_count: number;
  created_at: string;
}

export default function TransportTicketBatchHistory({ bureauId }: { bureauId: string }) {
  const { t } = useTranslation();
  const [batches, setBatches] = useState<TicketBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<TicketBatch | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);

  useEffect(() => {
    loadBatches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bureauId]);

  const loadBatches = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('transport_ticket_batches')
        .select('*')
        .eq('bureau_id', bureauId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBatches((data as TicketBatch[]) || []);
    } catch (error: any) {
      console.error('Erreur chargement historique:', error);
      toast.error(t('transportTicketBatchHistory.erreurLorsDuChargementDe'));
    } finally {
      setLoading(false);
    }
  };

  const handleViewBatch = (batch: TicketBatch) => {
    setSelectedBatch(batch);
    setShowPreview(true);
  };

  const handleDeleteBatch = async (batchId: string) => {
    setIsDeleting(true);
    setDeletingBatchId(batchId);

    try {
      const { error } = await (supabase as any)
        .from('transport_ticket_batches')
        .delete()
        .eq('id', batchId);

      if (error) throw error;

      setBatches(prev => prev.filter(b => b.id !== batchId));
      toast.success(t('transportTicketBatchHistory.lotSupprimeAvecSucces'));
    } catch (error: any) {
      console.error('Erreur suppression lot:', error);
      toast.error(t('transportTicketBatchHistory.erreurLorsDeLaSuppression'));
    } finally {
      setIsDeleting(false);
      setDeletingBatchId(null);
    }
  };

  const handleDeleteAllBatches = async () => {
    setIsDeleting(true);

    try {
      const { error } = await (supabase as any)
        .from('transport_ticket_batches')
        .delete()
        .eq('bureau_id', bureauId);

      if (error) throw error;

      setBatches([]);
      toast.success(t('transportTicketBatchHistory.toutLHistoriqueAEte'));
    } catch (error: any) {
      console.error('Erreur suppression historique:', error);
      toast.error(t('transportTicketBatchHistory.erreurLorsDeLaSuppression2'));
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = useFormatCurrency();

  const ticketTypeLabels: Record<string, string> = {
    stationnement: 'Stationnement',
    journalier: 'Journalier',
    hebdomadaire: 'Hebdomadaire',
    mensuel: 'Mensuel',
    cotisation: 'Cotisation',
    special: 'Spécial',
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff4000]" />
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">{t('transportTicketBatchHistory.aucunLotDeTicketsGenere')}</p>
        <p className="text-sm text-gray-400 mt-2">
          Utilisez le formulaire pour générer votre premier lot
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-sm text-[#ff4000]">
            <strong>{batches.length}</strong> lot(s) de tickets générés au total •
            <strong> {batches.reduce((acc, b) => acc + b.tickets_count, 0)}</strong> tickets
          </p>
        </div>

        {/* Bouton supprimer tout l'historique */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer tout l'historique
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('transportTicketBatchHistory.confirmerLaSuppression')}</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer tout l'historique des tickets ?
                Cette action est irréversible et supprimera <strong>{batches.length} lot(s)</strong> contenant
                <strong> {batches.reduce((acc, b) => acc + b.tickets_count, 0)} tickets</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('transportTicketBatchHistory.annuler')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAllBatches}
                className="bg-[#ff4000] hover:bg-[#ff4000]"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Supprimer tout'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N° Lot</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Commune</TableHead>
            <TableHead>{t('transportTicketBatchHistory.montant')}</TableHead>
            <TableHead>Tickets</TableHead>
            <TableHead>{t('transportTicketBatchHistory.dateCreation')}</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => (
            <TableRow key={batch.id}>
              <TableCell className="font-mono font-bold">
                {batch.batch_number}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {ticketTypeLabels[batch.ticket_config.ticketType] || batch.ticket_config.ticketType}
                </Badge>
              </TableCell>
              <TableCell>{batch.ticket_config.commune}</TableCell>
              <TableCell className="font-semibold">
                {formatAmount(batch.ticket_config.amount)}
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {batch.start_number} → {batch.end_number}
                </span>
                <Badge className="ml-2 bg-orange-100 text-[#ff4000]">
                  {batch.tickets_count}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-gray-500">
                {formatDate(batch.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewBatch(batch)}
                    className="border-orange-300 hover:bg-orange-50"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Voir
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-orange-300 hover:bg-orange-50 text-[#ff4000]"
                        disabled={isDeleting && deletingBatchId === batch.id}
                      >
                        {isDeleting && deletingBatchId === batch.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('transportTicketBatchHistory.supprimerCeLot')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          Voulez-vous supprimer le lot <strong>{batch.batch_number}</strong> ?
                          Cette action est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('transportTicketBatchHistory.annuler')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteBatch(batch.id)}
                          className="bg-[#ff4000] hover:bg-[#ff4000]"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Dialog de prévisualisation */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Lot {selectedBatch?.batch_number} - {selectedBatch?.ticket_config.commune}
            </DialogTitle>
          </DialogHeader>
          {selectedBatch && (
            <TransportTicketPreview
              config={selectedBatch.ticket_config}
              ticketNumbers={Array.from(
                { length: selectedBatch.tickets_count },
                (_, i) => selectedBatch.start_number + i
              )}
              batchId={selectedBatch.id}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
