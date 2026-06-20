/**
 * Moteur de calcul de devis ARTISAN (partagé par les 4 métiers).
 * - Configs par métier (types de verre/métal/bois, prix unitaires par défaut — l'artisan
 *   ajuste). - Calculs temps réel (m², poids, total HT/TTC).
 * Les composants Module (phases 1-4) consomment ces configs pour leurs formulaires.
 */

export type ArtisanService = 'vitrerie' | 'menuiserie' | 'plomberie' | 'soudure';

export interface QuoteItem {
  label: string;
  qty: number;
  unit_price_material: number;
  unit_price_labor: number;
}

export interface QuoteTotals {
  total_ht: number;
  tax: number;
  total_ttc: number;
}

/** Total d'un devis à partir de lignes + options (frais déplacement, urgence %, etc.). */
export function computeQuoteTotals(
  items: QuoteItem[],
  taxRate = 18,
  options: { travelFee?: number; urgencySurchargePct?: number } = {},
): QuoteTotals {
  const base = items.reduce((s, it) => s + (Number(it.qty) || 0) * ((Number(it.unit_price_material) || 0) + (Number(it.unit_price_labor) || 0)), 0);
  const withTravel = base + (options.travelFee || 0);
  const withUrgency = withTravel * (1 + (options.urgencySurchargePct || 0) / 100);
  const total_ht = Math.round(withUrgency);
  const tax = Math.round(total_ht * taxRate / 100);
  return { total_ht, tax, total_ttc: total_ht + tax };
}

// ── VITRERIE : prix au m² par type de verre (GNF, défauts ajustables) ────────
export const GLASS_TYPES: { code: string; label: string; pricePerM2: number }[] = [
  { code: 'simple_4', label: 'Simple vitrage (4mm)', pricePerM2: 25000 },
  { code: 'double', label: 'Double vitrage (4/16/4)', pricePerM2: 45000 },
  { code: 'triple', label: 'Triple vitrage', pricePerM2: 65000 },
  { code: 'trempe', label: 'Verre trempé (sécurit)', pricePerM2: 60000 },
  { code: 'feuillete', label: 'Verre feuilleté sécurit', pricePerM2: 70000 },
  { code: 'antireflet', label: 'Verre antireflet', pricePerM2: 55000 },
  { code: 'miroir', label: 'Miroir standard', pricePerM2: 40000 },
  { code: 'miroir_teinte', label: 'Miroir teinté', pricePerM2: 50000 },
];

/** Surface en m² depuis hauteur×largeur en cm. */
export function glassAreaM2(heightCm: number, widthCm: number): number {
  return Math.max(0, (Number(heightCm) || 0) * (Number(widthCm) || 0)) / 10_000;
}

/** Prix d'une vitre : surface × prix/m² + façonnage + pose. */
export function computeGlassPrice(
  heightCm: number, widthCm: number, glassCode: string,
  opts: { withInstall?: boolean; withJoints?: boolean; travelFee?: number; urgency?: boolean } = {},
): QuoteTotals & { areaM2: number } {
  const area = glassAreaM2(heightCm, widthCm);
  const type = GLASS_TYPES.find((g) => g.code === glassCode) ?? GLASS_TYPES[0];
  const material = area * type.pricePerM2;
  const facon = material * 0.1; // façonnage ~10%
  const install = opts.withInstall ? Math.max(15000, area * 15000) : 0;
  const joints = opts.withJoints ? area * 5000 : 0;
  const items: QuoteItem[] = [{ label: `${type.label} ${area.toFixed(2)} m²`, qty: 1, unit_price_material: Math.round(material + facon + joints), unit_price_labor: Math.round(install) }];
  return { areaM2: area, ...computeQuoteTotals(items, 18, { travelFee: opts.travelFee, urgencySurchargePct: opts.urgency ? 30 : 0 }) };
}

// ── SOUDURE : métaux (prix au kg) + densité (kg/m³) pour estimer le poids ─────
export const METAL_TYPES: { code: string; label: string; pricePerKg: number; density: number }[] = [
  { code: 'acier', label: 'Acier brut', pricePerKg: 6000, density: 7850 },
  { code: 'inox', label: 'Acier inox', pricePerKg: 18000, density: 8000 },
  { code: 'alu', label: 'Aluminium', pricePerKg: 12000, density: 2700 },
  { code: 'fonte', label: 'Fonte', pricePerKg: 7000, density: 7200 },
  { code: 'galva', label: 'Acier galvanisé', pricePerKg: 8000, density: 7850 },
];

/** Poids (kg) d'une pièce métallique : volume (h×l×e en mm) × densité. */
export function metalWeightKg(heightMm: number, widthMm: number, thicknessMm: number, density: number): number {
  const volM3 = ((Number(heightMm) || 0) * (Number(widthMm) || 0) * (Number(thicknessMm) || 0)) / 1e9;
  return volM3 * density;
}

// ── PLOMBERIE : catalogue de prestations courantes (défauts ajustables) ──────
export const PLUMBING_CATALOG: { code: string; label: string; price: number }[] = [
  { code: 'main_oeuvre_h', label: "Main d'œuvre (heure)", price: 15000 },
  { code: 'joint', label: 'Joint torique', price: 2000 },
  { code: 'robinet', label: 'Robinet mitigeur', price: 35000 },
  { code: 'siphon', label: 'Siphon', price: 8000 },
  { code: 'flexible', label: 'Flexible', price: 5000 },
  { code: 'thermostat', label: 'Thermostat chauffe-eau', price: 25000 },
  { code: 'debouchage', label: 'Débouchage canalisation', price: 20000 },
];

// ── MENUISERIE : essences de bois + traitements (multiplicateur indicatif) ───
export const WOOD_TYPES: { code: string; label: string }[] = [
  { code: 'chene', label: 'Chêne massif' }, { code: 'hetre', label: 'Hêtre' },
  { code: 'pin', label: 'Pin' }, { code: 'mdf', label: 'MDF' },
  { code: 'contreplaque', label: 'Contreplaqué' }, { code: 'iroko', label: 'Iroko' },
];
export const WOOD_FINISHES: { code: string; label: string }[] = [
  { code: 'brut', label: 'Brut' }, { code: 'lasure', label: 'Lasure' },
  { code: 'vernis', label: 'Vernis' }, { code: 'peinture', label: 'Peinture' },
];

/** Surcharge d'urgence par niveau (cf. spec). */
export const URGENCY_SURCHARGE: Record<string, number> = { normal: 0, urgent: 20, immediate: 50 };

// ── VITRERIE : type d'intervention (signature Smart Glazier) ─────────────────
export const GLASS_INTERVENTION_TYPES: { code: string; label: string }[] = [
  { code: 'remplacement', label: 'Remplacement vitre cassée' },
  { code: 'pose_fenetre', label: 'Pose nouvelle fenêtre' },
  { code: 'douche', label: 'Cabine de douche' },
  { code: 'cloison', label: 'Cloison vitrée' },
  { code: 'miroir', label: 'Miroir' },
  { code: 'baie', label: 'Baie vitrée' },
  { code: 'autre', label: 'Autre' },
];

// ── MENUISERIE : phases de chantier (signature Tradify) ──────────────────────
export const CARPENTRY_PHASES: { code: string; label: string }[] = [
  { code: 'pose1', label: '1ère pose (fourniture & bâti)' },
  { code: 'pose2', label: '2ème pose (finition & ajustement)' },
];

// ── SOUDURE : calculateur de cordon (signature QuoteIQ) ──────────────────────
// Procédés : vitesse de soudage (cm/min) + consommable par mètre + besoin de gaz.
export const WELD_PROCESSES: {
  code: 'mig' | 'tig' | 'arc'; label: string; speedCmPerMin: number;
  consumablePerM: number; consumablePricePerUnit: number; consumableUnit: string; needsGas: boolean;
}[] = [
  { code: 'mig', label: 'MIG/MAG (fil fourré)', speedCmPerMin: 30, consumablePerM: 0.12, consumablePricePerUnit: 45000, consumableUnit: 'kg fil', needsGas: true },
  { code: 'tig', label: 'TIG (métal d\'apport)', speedCmPerMin: 12, consumablePerM: 0.06, consumablePricePerUnit: 90000, consumableUnit: 'kg apport', needsGas: true },
  { code: 'arc', label: 'Arc (électrode enrobée)', speedCmPerMin: 18, consumablePerM: 2.4, consumablePricePerUnit: 1500, consumableUnit: 'électrodes', needsGas: false },
];
export const WELD_GAS_PRICE_PER_MIN = 200;   // GNF/min de gaz de protection (MIG/TIG)
export const WELD_LABOR_PER_HOUR = 60000;    // GNF/h de main d'œuvre soudeur

/** Nombre de passes recommandé selon l'épaisseur (mm). */
export function weldPassesForThickness(thicknessMm: number): number {
  const t = Number(thicknessMm) || 0;
  if (t <= 3) return 1;
  if (t <= 6) return 2;
  if (t <= 10) return 3;
  return 4;
}

export interface WeldingEstimate {
  items: QuoteItem[]; totals: QuoteTotals;
  passes: number; effectiveLengthM: number; timeMin: number;
  consumableQty: number; consumableUnit: string; gasCost: number;
}

/** Estimation complète d'un cordon de soudure : consommable + gaz + temps + main d'œuvre. */
export function computeWeldingQuote(p: {
  process: 'mig' | 'tig' | 'arc'; cordLengthM: number; thicknessMm: number;
  passes?: number; baseMaterialCost?: number; laborPerHour?: number;
}): WeldingEstimate {
  const proc = WELD_PROCESSES.find((x) => x.code === p.process) ?? WELD_PROCESSES[0];
  const passes = Math.max(1, p.passes ?? weldPassesForThickness(p.thicknessMm));
  const effectiveLengthM = Math.max(0, Number(p.cordLengthM) || 0) * passes;
  const timeMin = proc.speedCmPerMin > 0 ? (effectiveLengthM * 100) / proc.speedCmPerMin : 0;
  const consumableQty = effectiveLengthM * proc.consumablePerM;
  const consumableCost = consumableQty * proc.consumablePricePerUnit;
  const gasCost = proc.needsGas ? timeMin * WELD_GAS_PRICE_PER_MIN : 0;
  const labor = (timeMin / 60) * (p.laborPerHour ?? WELD_LABOR_PER_HOUR);

  const items: QuoteItem[] = [];
  if ((p.baseMaterialCost ?? 0) > 0) items.push({ label: 'Matière (métal de base)', qty: 1, unit_price_material: Math.round(p.baseMaterialCost!), unit_price_labor: 0 });
  items.push({ label: `${proc.label} — ${consumableQty.toFixed(2)} ${proc.consumableUnit} (${effectiveLengthM.toFixed(1)} m, ${passes} passe(s))`, qty: 1, unit_price_material: Math.round(consumableCost), unit_price_labor: 0 });
  if (gasCost > 0) items.push({ label: `Gaz de protection (${Math.round(timeMin)} min)`, qty: 1, unit_price_material: Math.round(gasCost), unit_price_labor: 0 });
  items.push({ label: `Main d'œuvre soudeur (${Math.round(timeMin)} min)`, qty: 1, unit_price_material: 0, unit_price_labor: Math.round(labor) });

  return { items, totals: computeQuoteTotals(items, 18), passes, effectiveLengthM, timeMin, consumableQty, consumableUnit: proc.consumableUnit, gasCost };
}
