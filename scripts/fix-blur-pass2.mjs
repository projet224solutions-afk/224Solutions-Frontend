/**
 * fix-blur-pass2.mjs — Nettoyage backdrop-blur sur fonds clairs + correctifs double-opacité.
 * 224Solutions-Frontend
 *
 * NB (Windows) : comparaisons par path.basename + chemins normalisés (sinon EXCLUDE ne filtre pas
 * sous Windows car path.join produit des '\').
 *
 * Exécution : node scripts/fix-blur-pass2.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

// ── RÈGLES ────────────────────────────────────────────────────────────────────
const RULES = [
  // Correctif typo double-opacité AVEC blur (PDGFinance) — d'abord (plus spécifique)
  { from: /\bbg-blue-500\/5\/5 backdrop-blur-sm\b/g, to: 'bg-[#04439e]/5', d: 'typo bg-blue-500/5/5+blur → bg-[#04439e]/5' },

  // Cartes blanches avec opacité inutile + blur
  { from: /\bbg-white\/90 backdrop-blur-sm\b/g,  to: 'bg-white',  d: 'bg-white/90+blur → bg-white' },
  { from: /\bbg-white\/95 backdrop-blur-sm\b/g,  to: 'bg-white',  d: 'bg-white/95+blur → bg-white' },
  { from: /\bbg-white\/80 backdrop-blur-sm\b/g,  to: 'bg-white',  d: 'bg-white/80+blur → bg-white' },

  // Cartes bg-card avec opacité inutile + blur
  { from: /\bbg-card\/90 backdrop-blur-sm\b/g,   to: 'bg-card',   d: 'bg-card/90+blur → bg-card' },
  { from: /\bbg-card\/95 backdrop-blur-sm\b/g,   to: 'bg-card',   d: 'bg-card/95+blur → bg-card' },
  { from: /\bbg-card\/80 backdrop-blur-sm\b/g,   to: 'bg-card',   d: 'bg-card/80+blur → bg-card' },
  { from: /\bbg-card\/50 backdrop-blur\b/g,      to: 'bg-card',   d: 'bg-card/50+blur → bg-card' },
  { from: /\bbg-card\/30 backdrop-blur-xl\b/g,   to: 'bg-card',   d: 'bg-card/30+blur-xl → bg-card' },

  // Fonds orange pâle avec blur inutile
  { from: /\bbg-orange-500\/5 border border-orange-500\/20 backdrop-blur-sm\b/g,
    to:   'bg-[#ff4000]/5 border border-[#ff4000]/20',
    d:    'bg-orange-500/5 backdrop-blur → bg-[#ff4000]/5 solide' },

  // Correctifs double-opacité (artefacts bg-X/N/N de la passe gradients) → couleurs de marque solides
  { from: /\bbg-orange-500\/10\/10\b/g, to: 'bg-[#ff4000]/10', d: 'artefact bg-orange-500/10/10 → bg-[#ff4000]/10' },
  { from: /\bbg-orange-500\/5\/5\b/g,   to: 'bg-[#ff4000]/5',  d: 'artefact bg-orange-500/5/5 → bg-[#ff4000]/5' },
  { from: /\bbg-blue-500\/5\/5\b/g,     to: 'bg-[#04439e]/5',  d: 'artefact bg-blue-500/5/5 → bg-[#04439e]/5' },
];

// ── FICHIERS EXCLUS (backdrop-blur légitime sur fonds sombres / overlays) ─────
const EXCLUDE = [
  'EnhancedWalletCard.tsx', 'TaxiMotoBadge.tsx', 'MiniMap.tsx', 'DigitalProductDetail.tsx',
  'IOSInstallGuide.tsx', 'HealthModule.tsx', 'BureauStatsCards.tsx', 'AffiliateFlightPartnerCard.tsx',
  'Proximite.tsx', 'BadgeVerification.tsx', 'SimpleMapView.tsx', 'DestinationPreview.tsx',
  'RealEstateMapView.tsx', 'PurchaseInputKeypad.tsx', 'ServiceDetail.tsx', 'Custom224PaymentDemo.tsx',
  'MediaAutoCarousel.tsx', 'ProductImageCarousel.tsx', 'SystemLiveMonitor.tsx', 'dialog.tsx',
  'VendorDigitalProducts.tsx',
];

function getAllFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory() && !['node_modules', 'dist', '.git'].includes(entry)) getAllFiles(full, files);
    else if (['.tsx', '.ts', '.css'].includes(extname(entry))) files.push(full);
  }
  return files;
}

const rel = (p) => p.replace(/\\/g, '/').replace(/^src\//, '');
const files = getAllFiles('src');
let totalChanged = 0;
const report = [];

for (const file of files) {
  if (EXCLUDE.includes(basename(file))) { report.push(`⏭  IGNORÉ   ${rel(file)}`); continue; }
  let content = readFileSync(file, 'utf-8');
  const original = content;
  const applied = [];
  for (const rule of RULES) {
    const before = content;
    content = content.replace(rule.from, rule.to);
    if (content !== before) applied.push(rule.d);
  }
  if (content !== original) {
    writeFileSync(file, content, 'utf-8');
    totalChanged++;
    applied.forEach((d) => console.log(`  ✓ ${rel(file)} — ${d}`));
    report.push(`✅ MODIFIÉ  ${rel(file)} (${applied.length} corrections)`);
  }
}

console.log(`\n✅ ${totalChanged} fichiers modifiés`);
writeFileSync('AUDIT_BLUR_PASS2.md', `# Blur Pass2 — Rapport\n\nFichiers modifiés : ${totalChanged}\n\n${report.filter((r) => r.startsWith('✅')).join('\n')}\n`);
console.log('📝 AUDIT_BLUR_PASS2.md écrit');
