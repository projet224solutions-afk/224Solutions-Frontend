import jsPDF from 'jspdf';
import type { ShareholderRevenue } from '@/types/shareholder';

// ─── Palette ──────────────────────────────────────────────────────────────────
type RGB = [number, number, number];

const C: Record<string, RGB> = {
  navy:      [15,   23,  42],
  blue:      [37,   99, 235],
  blueDark:  [30,   64, 175],
  blueLight: [219, 234, 254],
  bluePale:  [239, 246, 255],
  green:     [22,  163,  74],
  greenBg:   [240, 253, 244],
  gray900:   [17,   24,  39],
  gray700:   [55,   65,  81],
  gray500:   [107, 114, 128],
  gray300:   [209, 213, 219],
  gray100:   [243, 244, 246],
  slate400:  [148, 163, 184],
  white:     [255, 255, 255],
};

// ─── Chargement image en base64 (pour jsPDF addImage) ────────────────────────
async function loadImageBase64(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────
function fmtNum(n: number | string | undefined): string {
  const val = Math.round(Number(n ?? 0));
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function fmt(n: number | string | undefined, cur: string): string {
  return `${fmtNum(n)} ${cur}`;
}

function dateStr(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Labels sans caractères Unicode problématiques ────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  seller:          'Vendeur (physique / hybride)',
  digital_vendor:  'Vendeur numerique',
  taxi:            'Taxi-moto',
  delivery_driver: 'Livreur',
  service:         'Service professionnel',
};

const SCOPE_LABELS: Record<string, string> = {
  global:  'Mondial',
  country: 'Par pays',
};

const STATUS_LABELS: Record<string, string> = {
  pending:        'En attente',
  approved:       'Approuve',
  sent_to_wallet: 'Credite au wallet',
};

// ─── Export principal ─────────────────────────────────────────────────────────
export async function downloadShareholderReceiptPdf(
  revenue: ShareholderRevenue,
  shareholderName: string,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W  = 210;
  const PL = 18;
  const PR = 18;
  const CW = W - PL - PR;

  const cur       = revenue.currency ?? 'GNF';
  const share     = Number(revenue.shareholder_amount ?? 0);
  const refCode   = revenue.id.slice(0, 8).toUpperCase();
  const paidCount = revenue.paid_subscriptions_count ?? 0;
  const freeCount = revenue.free_subscriptions_count ?? 0;
  const totalSubs = paidCount + freeCount;
  const pct       = Number(revenue.percentage);

  // Chargement du logo (PNG avec fond blanc)
  const logoBase64 = await loadImageBase64('/logo-224solutions.png');

  // ════════════════════════════════════════════════════════════════════════════
  // 1. EN-TÊTE (0–54 mm)
  // ════════════════════════════════════════════════════════════════════════════

  // Fond marine plein
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, W, 52, 'F');

  // Barre accent bleue gauche
  doc.setFillColor(...C.blue);
  doc.rect(0, 0, 5, 52, 'F');

  // Logo 224 Solutions (PNG fond blanc dans carré arrondi)
  doc.setFillColor(...C.white);
  doc.roundedRect(PL + 2, 8, 28, 28, 3, 3, 'F');
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', PL + 3, 9, 26, 26);
  } else {
    // Fallback texte si le logo ne charge pas
    doc.setTextColor(...C.blue);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('224', PL + 16, 20, { align: 'center' });
    doc.setFontSize(7.5);
    doc.text('SOL.', PL + 16, 27, { align: 'center' });
  }

  // Nom société
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('224 Solutions', PL + 36, 23);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.slate400);
  doc.text('Plateforme de services numeriques — Guinee Conakry', PL + 36, 31);

  // Date émission
  const genDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  doc.setFontSize(7.5);
  doc.setTextColor(...C.slate400);
  doc.text('Emis le ' + genDate, W - PR, 19, { align: 'right' });

  // Badge référence
  doc.setFillColor(...C.blueDark);
  doc.roundedRect(W - PR - 46, 26, 46, 11, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.white);
  doc.text('REF. ' + refCode, W - PR - 23, 33, { align: 'center' });

  // Barre accent dorée
  doc.setFillColor(250, 204, 21);
  doc.rect(0, 52, W, 2.5, 'F');

  // ════════════════════════════════════════════════════════════════════════════
  // 2. TITRE DU DOCUMENT (Y = 66)
  // ════════════════════════════════════════════════════════════════════════════
  const titleY = 66;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.navy);
  const docTitle = "ATTESTATION DE REVENUS D'ACTIONNAIRE";
  doc.text(docTitle, W / 2, titleY, { align: 'center' });

  // Traits décoratifs flanquant le titre
  const tw = doc.getTextWidth(docTitle);
  doc.setDrawColor(...C.blue);
  doc.setLineWidth(1);
  doc.line(PL, titleY + 3, W / 2 - tw / 2 - 3, titleY + 3);
  doc.line(W / 2 + tw / 2 + 3, titleY + 3, W - PR, titleY + 3);

  // ════════════════════════════════════════════════════════════════════════════
  // 3. CARTE BÉNÉFICIAIRE (Y = 80, h = 68 mm)
  // ════════════════════════════════════════════════════════════════════════════
  const cardY = 80;
  const cardH = 68;

  doc.setFillColor(...C.bluePale);
  doc.setDrawColor(...C.blueLight);
  doc.setLineWidth(0.4);
  doc.roundedRect(PL, cardY, CW, cardH, 3, 3, 'FD');

  // Barre gauche bleue
  doc.setFillColor(...C.blue);
  doc.rect(PL, cardY, 4, cardH, 'F');

  // Étiquette section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.blue);
  doc.text('BENEFICIAIRE', PL + 10, cardY + 9);

  // Séparateur
  doc.setDrawColor(...C.blueLight);
  doc.setLineWidth(0.3);
  doc.line(PL + 10, cardY + 12, W - PR - 5, cardY + 12);

  // Champs identité — 2 colonnes
  const fY  = cardY + 20;
  const c1x = PL + 10;
  const c2x = PL + CW / 2;

  infoField(doc, 'Nom complet',   shareholderName,                                          c1x, fY,      C);
  infoField(doc, 'Categorie',     CATEGORY_LABELS[revenue.category] ?? revenue.category,     c1x, fY + 16, C);
  infoField(doc, 'Portee',        SCOPE_LABELS[revenue.action_scope] ?? revenue.action_scope, c1x, fY + 32, C);

  infoField(doc, 'Pays',          revenue.country ?? 'Tous pays', c2x, fY,      C);
  infoField(doc, 'Participation', pct + '%',                      c2x, fY + 16, C);

  const periodStr = 'Du ' + dateStr(revenue.period_start) + ' au ' + dateStr(revenue.period_end);
  infoField(doc, 'Periode', periodStr, c2x, fY + 32, C);

  // ════════════════════════════════════════════════════════════════════════════
  // 4. BLOC REVENU (Y = 156, h = 76 mm)
  //    Contenu visible par l'actionnaire uniquement — pas de détails internes
  // ════════════════════════════════════════════════════════════════════════════
  const revY = cardY + cardH + 8;  // 156
  const revH = 76;

  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.gray300);
  doc.setLineWidth(0.4);
  doc.roundedRect(PL, revY, CW, revH, 3, 3, 'FD');

  // En-tête interne (fond gris + barre bleue)
  doc.setFillColor(...C.gray100);
  doc.rect(PL, revY, CW, 10, 'F');
  doc.setFillColor(...C.blue);
  doc.rect(PL, revY, 4, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.gray700);
  doc.text('REVENU DE PARTICIPATION', PL + 7, revY + 6.8);

  // Résumé activité (fond gris doux)
  //   statsY = revY + 16 = 172
  //   statsH = 22 mm
  const statsY = revY + 16;
  doc.setFillColor(...C.gray100);
  doc.roundedRect(PL + 5, statsY, CW - 10, 22, 2, 2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.gray500);
  doc.text('Abonnements :', PL + 10, statsY + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.gray900);
  doc.text(
    `${totalSubs}   (${paidCount} payant(s)  +  ${freeCount} offert(s))`,
    PL + 10 + doc.getTextWidth('Abonnements :') + 3,
    statsY + 8,
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.gray500);
  doc.text('Taux de participation :', PL + 10, statsY + 17);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.blue);
  doc.text(
    pct + '% du revenu net',
    PL + 10 + doc.getTextWidth('Taux de participation :') + 3,
    statsY + 17,
  );

  // Grand montant — rectangle marine
  //   amtY = statsY + 22 + 6 = 200
  //   amtH = 32 mm  →  amtY + amtH = 232 = revY + revH ✓
  const amtY = statsY + 28;
  doc.setFillColor(...C.navy);
  doc.roundedRect(PL + 5, amtY, CW - 10, 32, 3, 3, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.slate400);
  doc.text("MONTANT DU A L'ACTIONNAIRE", W / 2, amtY + 10, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...C.white);
  doc.text(fmt(share, cur), W / 2, amtY + 25, { align: 'center' });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. STATUT DU PAIEMENT (Y = 242, h = 13 mm)
  // ════════════════════════════════════════════════════════════════════════════
  const statusY  = revY + revH + 10;  // 242
  const statusH  = 13;
  const statusLabel = STATUS_LABELS[revenue.payment_status] ?? (revenue.payment_status ?? 'N/A');
  const isWallet   = revenue.payment_status === 'sent_to_wallet';
  const isApproved = revenue.payment_status === 'approved';

  const statusBg:  RGB = isWallet ? C.greenBg  : isApproved ? C.bluePale : C.gray100;
  const statusBdr: RGB = isWallet ? C.green    : isApproved ? C.blue     : C.gray300;
  const statusCol: RGB = isWallet ? C.green    : isApproved ? C.blue     : C.gray500;

  doc.setFillColor(...statusBg);
  doc.setDrawColor(...statusBdr);
  doc.setLineWidth(0.5);
  doc.roundedRect(PL, statusY, CW, statusH, 2, 2, 'FD');

  doc.setFillColor(...statusCol);
  doc.circle(PL + 7, statusY + statusH / 2, 2.5, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.gray700);
  doc.text('Statut du paiement :', PL + 13, statusY + 8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...statusCol);
  doc.text(
    statusLabel,
    PL + 13 + doc.getTextWidth('Statut du paiement :') + 2,
    statusY + 8.5,
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 6. MENTION LÉGALE (Y = 263, h = 15 mm)
  // ════════════════════════════════════════════════════════════════════════════
  const disclaimerY = statusY + statusH + 8;  // 263
  doc.setFillColor(...C.gray100);
  doc.roundedRect(PL, disclaimerY, CW, 15, 2, 2, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...C.gray500);
  doc.text(
    'Ce document est genere automatiquement et fourni a titre informatif uniquement.',
    PL + 4, disclaimerY + 6,
  );
  doc.text(
    'Il ne constitue pas une facture au sens legal du terme.',
    PL + 4, disclaimerY + 11,
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 7. PIED DE PAGE (Y = 278)
  // ════════════════════════════════════════════════════════════════════════════
  const footerY = 278;

  // Barre marine
  doc.setFillColor(...C.navy);
  doc.rect(0, footerY, W, 1.5, 'F');

  // Fond gris très clair
  doc.setFillColor(248, 250, 252);
  doc.rect(0, footerY + 1.5, W, 297 - footerY - 1.5, 'F');

  // Colonne gauche : société
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.gray900);
  doc.text('224 Solutions', PL, footerY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.gray500);
  doc.text('Plateforme de services numeriques — Guinee Conakry', PL, footerY + 13);
  doc.text('support@224solutions.com', PL, footerY + 18);

  // Colonne droite : identifiant
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.gray500);
  doc.text('Identifiant :', W - PR, footerY + 8, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.gray700);
  doc.text(revenue.id, W - PR, footerY + 13, { align: 'right' });

  // Pagination centrée
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.gray500);
  doc.text('Page 1 / 1', W / 2, footerY + 21, { align: 'center' });

  // ════════════════════════════════════════════════════════════════════════════
  // TÉLÉCHARGEMENT
  // ════════════════════════════════════════════════════════════════════════════
  const safeName = shareholderName.replace(/\s+/g, '_').toLowerCase();
  const period   = revenue.period_start.slice(0, 7);
  doc.save(`attestation_${safeName}_${period}.pdf`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function infoField(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  C: Record<string, RGB>,
) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.gray500);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.gray900);
  // Tronquer si le texte dépasse la demi-largeur de la carte
  doc.text(value, x, y + 5.5);
}
