/**
 * 🏠 Export PDF professionnel IMMOBILIER (jsPDF, unit 'pt', A4).
 * Style aligné sur constructionPdf.ts (bandeau bleu + filet orange + pied numéroté).
 * Documents générés CÔTÉ CLIENT à partir des données déjà chargées (pas de stockage).
 *   - generateRentReceipt  : quittance de loyer
 *   - generateVisitVoucher : bon de visite
 *   - generateMandate      : mandat de vente/location
 *   - generateInventoryPdf : état des lieux (entrée/sortie)
 *
 * ⚠️ Valeur pratique ; pour une valeur juridique pleine, faire valider les
 *    mentions par un juriste local.
 */

import jsPDF from 'jspdf';

const BLUE: [number, number, number] = [4, 67, 158];
const ORANGE: [number, number, number] = [255, 64, 0];
const MARGIN = 48;

const fmtMoney = (n: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n || 0))} GNF`;
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

function header(doc: jsPDF, title: string, subtitle: string): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, pageW, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(title, MARGIN, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(subtitle, MARGIN, 48);
  doc.setFillColor(...ORANGE);
  doc.rect(0, 64, pageW, 4, 'F');
  doc.setTextColor(30, 30, 30);
  return 92;
}

function footer(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('224Solutions — Document généré le ' + new Date().toLocaleDateString('fr-FR'), MARGIN, pageH - 24);
    doc.text(`Page ${i} / ${pages}`, pageW - MARGIN, pageH - 24, { align: 'right' });
  }
}

function sectionTitle(doc: jsPDF, y: number, text: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BLUE);
  doc.text(text, MARGIN, y);
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(1.5);
  doc.line(MARGIN, y + 4, MARGIN + 60, y + 4);
  doc.setTextColor(30, 30, 30);
  return y + 22;
}

/** Ligne « Libellé : valeur ». Renvoie le nouveau y. */
function row(doc: jsPDF, y: number, label: string, value: string): number {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(80, 80, 80);
  doc.text(label, MARGIN, y);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 20, 20);
  doc.text(value || '—', MARGIN + 130, y);
  return y + 20;
}

/** Paragraphe justifié multi-lignes. Renvoie le nouveau y. */
function paragraph(doc: jsPDF, y: number, text: string): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
  const lines = doc.splitTextToSize(text, pageW - MARGIN * 2);
  doc.text(lines, MARGIN, y);
  return y + lines.length * 14 + 6;
}

/** Deux zones de signature en bas de page. */
function signatures(doc: jsPDF, leftLabel: string, rightLabel: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const y = pageH - 110;
  doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + 180, y);
  doc.line(pageW - MARGIN - 180, y, pageW - MARGIN, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90);
  doc.text(leftLabel, MARGIN, y + 14);
  doc.text(rightLabel, pageW - MARGIN - 180, y + 14);
}

// ── QUITTANCE DE LOYER ──────────────────────────────────────────────────────
export function generateRentReceipt(params: {
  tenantName: string; propertyTitle: string; address?: string;
  period: string; amount: number; paidAt: string;
  landlordName?: string; receiptNumber: string;
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = header(doc, 'QUITTANCE DE LOYER', `Quittance n° ${params.receiptNumber}`);
  y = sectionTitle(doc, y, 'Détails');
  y = row(doc, y, 'Locataire', params.tenantName);
  if (params.landlordName) y = row(doc, y, 'Bailleur', params.landlordName);
  y = row(doc, y, 'Bien', params.propertyTitle);
  if (params.address) y = row(doc, y, 'Adresse', params.address);
  y = row(doc, y, 'Période', params.period);
  y = row(doc, y, 'Montant', fmtMoney(params.amount));
  y = row(doc, y, 'Payé le', fmtDate(params.paidAt));
  y += 10;
  y = paragraph(doc, y,
    `Je soussigné(e) ${params.landlordName || 'le bailleur'}, reconnais avoir reçu de ${params.tenantName} la somme de ${fmtMoney(params.amount)} au titre du loyer du bien « ${params.propertyTitle} » pour la période de ${params.period}.`);
  paragraph(doc, y,
    'Cette quittance annule tous les reçus antérieurs établis pour la même période et vaut preuve de paiement intégral du loyer correspondant.');
  signatures(doc, 'Signature du bailleur', 'Cachet / Date');
  footer(doc);
  doc.save(`quittance_${params.period.replace(/\s+/g, '_')}_${params.tenantName.replace(/\s+/g, '_')}.pdf`);
  return doc;
}

// ── BON DE VISITE ───────────────────────────────────────────────────────────
export function generateVisitVoucher(params: {
  clientName: string; propertyTitle: string; address?: string;
  visitDate: string; agentName?: string; reference: string;
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = header(doc, 'BON DE VISITE', `Réf. ${params.reference}`);
  y = sectionTitle(doc, y, 'Visite');
  y = row(doc, y, 'Client', params.clientName);
  y = row(doc, y, 'Bien visité', params.propertyTitle);
  if (params.address) y = row(doc, y, 'Adresse', params.address);
  y = row(doc, y, 'Date de visite', fmtDate(params.visitDate));
  if (params.agentName) y = row(doc, y, 'Agent', params.agentName);
  y += 10;
  y = paragraph(doc, y,
    `Le client ${params.clientName} reconnaît avoir visité le bien « ${params.propertyTitle} » le ${fmtDate(params.visitDate)}, accompagné de l'agent${params.agentName ? ` ${params.agentName}` : ''}.`);
  paragraph(doc, y,
    "Le client s'engage à ne pas traiter directement avec le propriétaire pour ce bien, ni à le faire visiter à un tiers, sans passer par l'agence, sous peine des dispositions usuelles en matière d'entremise immobilière.");
  signatures(doc, 'Signature du client', "Signature de l'agent");
  footer(doc);
  doc.save(`bon_visite_${params.reference}.pdf`);
  return doc;
}

// ── MANDAT ──────────────────────────────────────────────────────────────────
export function generateMandate(params: {
  mandantName: string; propertyTitle: string; mandateType: string;
  offerType?: 'vente' | 'location' | string; commissionRate?: number;
  startDate: string; endDate?: string; reference: string; agentName?: string;
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const kind = params.offerType === 'location' ? 'LOCATION' : 'VENTE';
  let y = header(doc, `MANDAT DE ${kind}`, `Mandat n° ${params.reference}`);
  y = sectionTitle(doc, y, 'Conditions du mandat');
  y = row(doc, y, 'Mandant', params.mandantName);
  if (params.agentName) y = row(doc, y, 'Mandataire (agent)', params.agentName);
  y = row(doc, y, 'Bien', params.propertyTitle);
  y = row(doc, y, 'Type de mandat', params.mandateType);
  if (params.commissionRate != null) y = row(doc, y, 'Commission', `${params.commissionRate} %`);
  y = row(doc, y, 'Début', fmtDate(params.startDate));
  y = row(doc, y, 'Fin', fmtDate(params.endDate));
  y += 10;
  y = paragraph(doc, y,
    `Le mandant ${params.mandantName} confie ${params.mandateType === 'exclusif' ? 'en EXCLUSIVITÉ ' : ''}au mandataire${params.agentName ? ` ${params.agentName}` : ''} la commercialisation du bien « ${params.propertyTitle} » en vue de sa ${kind.toLowerCase()}, dans les conditions et pour la durée indiquées ci-dessus.`);
  paragraph(doc, y,
    `En cas de réalisation, le mandataire percevra une commission${params.commissionRate != null ? ` de ${params.commissionRate} %` : ' convenue'}. Le présent mandat est régi par les usages en vigueur et les éventuelles dispositions légales applicables.`);
  signatures(doc, 'Signature du mandant', 'Signature du mandataire');
  footer(doc);
  doc.save(`mandat_${params.reference}.pdf`);
  return doc;
}

// ── ÉTAT DES LIEUX ──────────────────────────────────────────────────────────
const CONDITION_LABELS: Record<string, string> = { bon: 'Bon', moyen: 'Moyen', degrade: 'Dégradé' };
export function generateInventoryPdf(params: {
  kind: 'entree' | 'sortie'; propertyTitle: string; tenantName?: string;
  doneAt: string; rooms: { room: string; condition?: string; notes?: string }[];
  generalNotes?: string; reference?: string;
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageH = doc.internal.pageSize.getHeight();
  let y = header(doc, `ÉTAT DES LIEUX — ${params.kind === 'entree' ? 'ENTRÉE' : 'SORTIE'}`,
    params.reference ? `Réf. ${params.reference}` : params.propertyTitle);
  y = sectionTitle(doc, y, 'Général');
  y = row(doc, y, 'Bien', params.propertyTitle);
  if (params.tenantName) y = row(doc, y, 'Locataire', params.tenantName);
  y = row(doc, y, 'Date', fmtDate(params.doneAt));
  y += 6;
  y = sectionTitle(doc, y, 'Pièces');
  for (const r of params.rooms || []) {
    if (y > pageH - 140) { doc.addPage(); y = 60; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(20, 20, 20);
    doc.text(`• ${r.room || 'Pièce'}`, MARGIN, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(90, 90, 90);
    doc.text(`État : ${CONDITION_LABELS[r.condition || ''] || '—'}`, MARGIN + 200, y);
    y += 16;
    if (r.notes) y = paragraph(doc, y, `   ${r.notes}`);
  }
  if (params.generalNotes) { y += 6; y = sectionTitle(doc, y, 'Observations'); y = paragraph(doc, y, params.generalNotes); }
  signatures(doc, 'Signature du locataire', "Signature de l'agent");
  footer(doc);
  doc.save(`etat_des_lieux_${params.kind}_${(params.propertyTitle || 'bien').replace(/\s+/g, '_')}.pdf`);
  return doc;
}
