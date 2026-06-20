/**
 * Prévisualisation et Export PDF des Tickets de Transport
 * Design fidèle au modèle officiel guinéen (orientation PAYSAGE)
 * 30 tickets par page A4 avec grille 5x6
 */

import { useRef, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
const loadPdfLibs = () => Promise.all([
  import('html2canvas').then(m => m.default),
  import('jspdf').then(m => m.default),
]);
import SingleTransportTicket from './SingleTransportTicket';

interface TicketConfig {
  syndicateName: string;
  commune: string;
  ticketType: string;
  amount: number;
  date: string;
  optionalMention: string;
  bureauStampUrl?: string;
}

interface Props {
  config: TicketConfig;
  ticketNumbers: number[];
  batchId: string | null;
}

export default function TransportTicketPreview({ config, ticketNumbers, batchId }: Props) {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    window.print();
    setTimeout(() => setIsPrinting(false), 1000);
  };

  const handleExportPDF = async () => {
    if (!printRef.current) return;

    setIsExporting(true);
    toast.info(t('transportTicketPreview.generationDuPdfEnCours'));

    try {
      const element = printRef.current;

      // Configuration haute résolution
      const [html2canvas, jsPDF] = await loadPdfLibs();
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      // Créer le PDF en mode paysage A4
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Ajouter l'image avec marges
      const margin = 5;
      pdf.addImage(imgData, 'PNG', margin, margin, pdfWidth - (margin * 2), pdfHeight - (margin * 2));

      // Sauvegarder
      const fileName = `tickets-transport-${batchId?.slice(-8) || 'lot'}-${config.commune.toLowerCase()}.pdf`;
      pdf.save(fileName);

      toast.success(t('transportTicketPreview.pdfExporteAvecSucces'));
    } catch (error) {
      console.error('Erreur export PDF:', error);
      toast.error(t('transportTicketPreview.erreurLorsDeLExport'));
    } finally {
      setIsExporting(false);
    }
  };

  const ticketTypeLabels: Record<string, string> = {
    stationnement: 'Ticket de stationnement',
    journalier: 'Ticket journalier',
    hebdomadaire: 'Ticket hebdomadaire',
    mensuel: 'Ticket mensuel',
    cotisation: 'Ticket de cotisation',
    special: 'Ticket spécial',
  };

  return (
    <div className="space-y-4">
      {/* Boutons d'action */}
      <div className="flex justify-center gap-4 sticky top-0 bg-white py-4 z-10 border-b">
        <Button
          onClick={handlePrint}
          disabled={isPrinting}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isPrinting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Printer className="w-4 h-4 mr-2" />
          )}
          Imprimer
        </Button>
        <Button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="bg-[#ff4000] hover:bg-[#ff4000] text-white"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Exporter PDF
        </Button>
      </div>

      {/* Zone d'impression - Page A4 Paysage */}
      <div
        ref={printRef}
        className="bg-white mx-auto print-area"
        style={{
          width: '297mm',
          minHeight: '210mm',
          padding: '5mm',
          boxSizing: 'border-box',
        }}
      >
        {/* Grille de tickets PAYSAGE (5 colonnes x 6 lignes = 30 tickets) */}
        <div
          className="grid gap-[2mm]"
          style={{
            gridTemplateColumns: 'repeat(5, 1fr)', // 5 colonnes
            gridTemplateRows: 'repeat(6, 1fr)', // 6 lignes = 30 tickets par page
            width: '100%',
            height: '200mm',
          }}
        >
          {ticketNumbers.map((ticketNumber, _index) => (
            <SingleTransportTicket
              key={ticketNumber}
              ticketNumber={ticketNumber}
              config={config}
              ticketTypeLabel={ticketTypeLabels[config.ticketType] || config.ticketType}
            />
          ))}
        </div>
      </div>

      {/* Styles d'impression */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 5mm;
          }
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 297mm !important;
            height: 210mm !important;
          }
        }
      `}</style>
    </div>
  );
}
