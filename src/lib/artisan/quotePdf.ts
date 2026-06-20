/**
 * Génération du devis PDF artisan (jsPDF) — devis professionnel : en-tête, lignes,
 * totaux HT/TVA/TTC, garantie & CGV. Utilisé par les 4 métiers.
 */

import { jsPDF } from 'jspdf';
import type { QuoteItem } from './calculator';

export interface QuotePdfData {
  reference?: string;
  serviceLabel: string;       // ex. 'Vitrerie'
  artisanName?: string;
  clientName?: string;
  items: QuoteItem[];
  total_ht: number;
  tax: number;
  total_ttc: number;
  currency?: string;
  notes?: string;
  validUntil?: string;
  warranty?: string;
}

function money(n: number, cur: string): string {
  return `${Math.round(n).toLocaleString('fr-FR')} ${cur}`;
}

/** Construit le PDF et le télécharge (filename) ou renvoie le blob si download=false. */
export function generateQuotePdf(d: QuotePdfData, download = true): Blob {
  const cur = d.currency || 'GNF';
  const doc = new jsPDF();
  let y = 18;

  doc.setFontSize(18); doc.setTextColor('#ff4000'); doc.text('224SOLUTIONS', 14, y);
  doc.setTextColor('#111'); doc.setFontSize(13); doc.text(`Devis ${d.serviceLabel}`, 150, y);
  y += 8; doc.setFontSize(9); doc.setTextColor('#555');
  doc.text(`Réf : ${d.reference || '—'}`, 150, y);
  doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 14, y);
  y += 6;
  if (d.artisanName) { doc.text(`Artisan : ${d.artisanName}`, 14, y); y += 5; }
  if (d.clientName) { doc.text(`Client : ${d.clientName}`, 14, y); y += 5; }
  if (d.validUntil) { doc.text(`Valable jusqu'au : ${new Date(d.validUntil).toLocaleDateString('fr-FR')}`, 14, y); y += 5; }

  // En-tête tableau
  y += 4; doc.setTextColor('#111'); doc.setFontSize(10);
  doc.setFillColor(245, 245, 245); doc.rect(14, y - 4, 182, 7, 'F');
  doc.text('Désignation', 16, y); doc.text('Qté', 120, y); doc.text('PU', 140, y); doc.text('Total', 175, y);
  y += 8; doc.setFontSize(9);
  for (const it of d.items) {
    const lineTotal = (it.qty || 0) * ((it.unit_price_material || 0) + (it.unit_price_labor || 0));
    doc.text(String(it.label).slice(0, 60), 16, y);
    doc.text(String(it.qty), 120, y);
    doc.text(money((it.unit_price_material || 0) + (it.unit_price_labor || 0), cur).replace(` ${cur}`, ''), 140, y);
    doc.text(money(lineTotal, cur).replace(` ${cur}`, ''), 172, y);
    y += 6; if (y > 250) { doc.addPage(); y = 18; }
  }

  // Totaux
  y += 4; doc.setFontSize(10);
  doc.text(`Total HT : ${money(d.total_ht, cur)}`, 130, y); y += 6;
  doc.text(`TVA : ${money(d.tax, cur)}`, 130, y); y += 6;
  doc.setFontSize(12); doc.setTextColor('#ff4000');
  doc.text(`Total TTC : ${money(d.total_ttc, cur)}`, 130, y); y += 10;

  doc.setTextColor('#555'); doc.setFontSize(8);
  if (d.notes) { doc.text(`Notes : ${d.notes}`.slice(0, 120), 14, y); y += 6; }
  doc.text(d.warranty || 'Garantie : pièces et main d\'œuvre selon CGV 224Solutions.', 14, y); y += 5;
  doc.text('Acceptation du devis = engagement contractuel. Acompte possible à la commande.', 14, y);

  const blob = doc.output('blob');
  if (download) doc.save(`devis-${d.serviceLabel.toLowerCase()}-${d.reference || Date.now()}.pdf`);
  return blob;
}
