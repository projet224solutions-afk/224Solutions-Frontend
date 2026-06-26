/**
 * 🏗️ Export PDF professionnel BTP
 * - exportProjectReportPdf : rapport chantier (lots + réserves + intervenants)
 * - exportMeetingPdf       : compte-rendu de réunion OPC
 * Style aligné sur PdgDocumentation (jsPDF, unit 'pt', A4).
 */

import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import type { ConstructionProject } from '@/hooks/useConstruction';
import {
  TRADE_LABELS,
  RESERVE_PRIORITY_LABELS,
  RESERVE_STATUS_LABELS,
  INTERVENANT_ROLE_LABELS,
  type ConstructionLot,
  type ConstructionReserve,
  type ConstructionIntervenant,
  type ConstructionMeeting,
  type TradeType,
  type ReservePriority,
  type ReserveStatus,
  type IntervenantRole,
} from '@/hooks/useConstructionExtended';

const BLUE: [number, number, number] = [4, 67, 158];
const ORANGE: [number, number, number] = [255, 64, 0];
const MARGIN = 48;

const fmtMoney = (n: number) =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(n || 0))} GNF`;
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

/** En-tête de page (bandeau bleu) + pied numéroté. Renvoie le y de départ du contenu. */
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

/** Saut de page si on dépasse le bas. */
function ensureSpace(doc: jsPDF, y: number, needed: number, title: string, subtitle: string): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 48) {
    doc.addPage();
    return header(doc, title, subtitle);
  }
  return y;
}

function keyVal(doc: jsPDF, y: number, label: string, value: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(label, MARGIN, y);
  doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(value || '—', doc.internal.pageSize.getWidth() - MARGIN * 2 - 130);
  doc.text(lines, MARGIN + 130, y);
  return y + Math.max(16, lines.length * 13);
}

// ════════════════════════════════════════════════════════════════
// RAPPORT CHANTIER COMPLET
// ════════════════════════════════════════════════════════════════

export async function exportProjectReportPdf(
  project: ConstructionProject,
  money?: (n: number) => string,
): Promise<void> {
  // Formateur devise : utilise celui de l'app (<Money>, taux BCRG) si fourni, sinon GNF brut.
  const m = money || fmtMoney;
  const [{ data: lotsData }, { data: reservesData }, { data: intervData }] = await Promise.all([
    (supabase as any).from('construction_lots').select('*').eq('project_id', project.id).order('trade_type'),
    (supabase as any).from('construction_reserves').select('*').eq('project_id', project.id).order('reserve_number'),
    (supabase as any).from('construction_intervenants').select('*').eq('project_id', project.id).order('role'),
  ]);
  const lots = (lotsData as unknown as ConstructionLot[]) ?? [];
  const reserves = (reservesData as unknown as ConstructionReserve[]) ?? [];
  const intervenants = (intervData as unknown as ConstructionIntervenant[]) ?? [];

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const title = 'Rapport de chantier';
  const subtitle = project.name;
  let y = header(doc, title, subtitle);

  // Synthèse projet
  y = sectionTitle(doc, y, 'Synthèse du projet');
  y = keyVal(doc, y, 'Client', project.client_name || '—');
  y = keyVal(doc, y, 'Localisation', project.location || '—');
  y = keyVal(doc, y, 'Statut', String(project.status).replace('_', ' '));
  y = keyVal(doc, y, 'Avancement', `${project.progress_percent}%`);
  y = keyVal(doc, y, 'Budget contractuel', m(project.budget));
  y = keyVal(doc, y, 'Dépensé', m(project.spent));
  y = keyVal(doc, y, 'Échéance', fmtDate(project.deadline));
  y += 12;

  // Corps d'état
  y = ensureSpace(doc, y, 60, title, subtitle);
  y = sectionTitle(doc, y, `Corps d'état (${lots.length})`);
  if (lots.length === 0) {
    doc.setFontSize(10); doc.text('Aucun corps d\'état.', MARGIN, y); y += 18;
  } else {
    for (const lot of lots) {
      y = ensureSpace(doc, y, 34, title, subtitle);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(`${lot.name} — ${TRADE_LABELS[lot.trade_type as TradeType] || lot.trade_type}`, MARGIN, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90);
      const meta = [
        lot.company_name ? `Entreprise : ${lot.company_name}` : null,
        `Budget : ${m(lot.budget_amount)}`,
        `Dépensé : ${m(lot.spent_amount)}`,
        `Avancement : ${lot.progress_percent}%`,
      ].filter(Boolean).join('   ·   ');
      doc.text(meta, MARGIN, y + 13);
      doc.setTextColor(30, 30, 30);
      y += 30;
    }
  }
  y += 8;

  // Réserves (punch list)
  y = ensureSpace(doc, y, 60, title, subtitle);
  y = sectionTitle(doc, y, `Réserves / Punch list (${reserves.length})`);
  if (reserves.length === 0) {
    doc.setFontSize(10); doc.text('Aucune réserve.', MARGIN, y); y += 18;
  } else {
    for (const r of reserves) {
      y = ensureSpace(doc, y, 38, title, subtitle);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(`#${String(r.reserve_number).padStart(3, '0')}  ${r.title}`, MARGIN, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90);
      const meta = [
        `Priorité : ${RESERVE_PRIORITY_LABELS[r.priority as ReservePriority]?.label || r.priority}`,
        `Statut : ${RESERVE_STATUS_LABELS[r.status as ReserveStatus]?.label || r.status}`,
        r.assigned_to ? `Assignée : ${r.assigned_to}` : null,
        r.due_date ? `Échéance : ${fmtDate(r.due_date)}` : null,
      ].filter(Boolean).join('   ·   ');
      doc.text(meta, MARGIN, y + 13);
      if (r.location_note) doc.text(`Localisation : ${r.location_note}`, MARGIN, y + 25);
      doc.setTextColor(30, 30, 30);
      y += r.location_note ? 40 : 30;
    }
  }
  y += 8;

  // Intervenants
  y = ensureSpace(doc, y, 60, title, subtitle);
  y = sectionTitle(doc, y, `Intervenants (${intervenants.length})`);
  if (intervenants.length === 0) {
    doc.setFontSize(10); doc.text('Aucun intervenant.', MARGIN, y); y += 18;
  } else {
    for (const it of intervenants) {
      y = ensureSpace(doc, y, 28, title, subtitle);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(`${INTERVENANT_ROLE_LABELS[it.role as IntervenantRole] || it.role} — ${it.name}`, MARGIN, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90);
      const meta = [it.company, it.phone, it.email].filter(Boolean).join('   ·   ');
      if (meta) doc.text(meta, MARGIN, y + 13);
      doc.setTextColor(30, 30, 30);
      y += meta ? 28 : 18;
    }
  }

  footer(doc);
  doc.save(`rapport-chantier-${project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`);
}

// ════════════════════════════════════════════════════════════════
// COMPTE-RENDU DE RÉUNION OPC
// ════════════════════════════════════════════════════════════════

export function exportMeetingPdf(project: ConstructionProject, m: ConstructionMeeting): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const title = `Compte-rendu de réunion N°${m.meeting_number}`;
  const subtitle = `${project.name} — ${fmtDate(m.meeting_date)}`;
  let y = header(doc, title, subtitle);

  // Infos générales
  y = sectionTitle(doc, y, 'Informations');
  y = keyVal(doc, y, 'Date', fmtDate(m.meeting_date));
  y = keyVal(doc, y, 'Lieu', m.location || '—');
  if (m.weather) y = keyVal(doc, y, 'Météo', m.weather);
  y = keyVal(doc, y, 'Statut', m.validated_at ? 'Validé (verrouillé)' : 'Brouillon');
  y += 10;

  // Présents
  y = ensureSpace(doc, y, 50, title, subtitle);
  y = sectionTitle(doc, y, `Participants (${m.attendees?.length || 0})`);
  if (!m.attendees || m.attendees.length === 0) {
    doc.setFontSize(10); doc.text('Aucun participant renseigné.', MARGIN, y); y += 18;
  } else {
    for (const a of m.attendees) {
      y = ensureSpace(doc, y, 16, title, subtitle);
      doc.setFontSize(10);
      const status = a.present ? '☑ Présent' : a.excuse ? '⊘ Excusé' : '☐ Absent';
      doc.text(`${status}   ${a.name}${a.role ? ` (${a.role})` : ''}${a.company ? ` — ${a.company}` : ''}`, MARGIN, y);
      y += 15;
    }
  }
  y += 8;

  // Observations
  if (m.general_observations) {
    y = ensureSpace(doc, y, 50, title, subtitle);
    y = sectionTitle(doc, y, 'Observations générales');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const lines = doc.splitTextToSize(m.general_observations, doc.internal.pageSize.getWidth() - MARGIN * 2);
    for (const ln of lines) {
      y = ensureSpace(doc, y, 14, title, subtitle);
      doc.text(ln, MARGIN, y); y += 13;
    }
    y += 10;
  }

  // Décisions
  y = ensureSpace(doc, y, 50, title, subtitle);
  y = sectionTitle(doc, y, `Décisions (${m.decisions?.length || 0})`);
  if (!m.decisions || m.decisions.length === 0) {
    doc.setFontSize(10); doc.text('Aucune décision.', MARGIN, y); y += 18;
  } else {
    m.decisions.forEach((d, i) => {
      y = ensureSpace(doc, y, 26, title, subtitle);
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(`${i + 1}. ${d.text}`, doc.internal.pageSize.getWidth() - MARGIN * 2);
      doc.text(lines, MARGIN, y); y += lines.length * 13;
      const meta = [d.responsible ? `Responsable : ${d.responsible}` : null, d.deadline ? `Échéance : ${fmtDate(d.deadline)}` : null].filter(Boolean).join('   ·   ');
      if (meta) { doc.setFontSize(9); doc.setTextColor(90, 90, 90); doc.text(meta, MARGIN + 14, y); doc.setTextColor(30, 30, 30); y += 14; }
      y += 4;
    });
  }
  y += 6;

  // Actions à suivre
  y = ensureSpace(doc, y, 50, title, subtitle);
  y = sectionTitle(doc, y, `Actions à suivre (${m.action_items?.length || 0})`);
  if (!m.action_items || m.action_items.length === 0) {
    doc.setFontSize(10); doc.text('Aucune action.', MARGIN, y); y += 18;
  } else {
    for (const a of m.action_items) {
      y = ensureSpace(doc, y, 22, title, subtitle);
      doc.setFontSize(10);
      const box = a.status === 'done' ? '☑' : '☐';
      const lines = doc.splitTextToSize(`${box} ${a.text}`, doc.internal.pageSize.getWidth() - MARGIN * 2);
      doc.text(lines, MARGIN, y); y += lines.length * 13;
      const meta = [a.responsible ? `Assignée : ${a.responsible}` : null, a.deadline ? `Échéance : ${fmtDate(a.deadline)}` : null].filter(Boolean).join('   ·   ');
      if (meta) { doc.setFontSize(9); doc.setTextColor(90, 90, 90); doc.text(meta, MARGIN + 14, y); doc.setTextColor(30, 30, 30); y += 14; }
      y += 4;
    }
  }

  // Prochaine réunion
  if (m.next_meeting_date) {
    y += 6;
    y = ensureSpace(doc, y, 40, title, subtitle);
    y = sectionTitle(doc, y, 'Prochaine réunion');
    y = keyVal(doc, y, 'Date', fmtDate(m.next_meeting_date));
    if (m.next_meeting_location) y = keyVal(doc, y, 'Lieu', m.next_meeting_location);
  }

  footer(doc);
  doc.save(`cr-reunion-${m.meeting_number}-${project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`);
}
