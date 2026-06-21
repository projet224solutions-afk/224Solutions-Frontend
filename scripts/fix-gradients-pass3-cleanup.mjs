/**
 * 3e passe (corrective) — retire les "stops" de dégradé ORPHELINS laissés par la passe 2.
 * 224Solutions-Frontend
 *
 * Contexte : la passe 2 a aplati `bg-gradient-to-X from-Y to-Z` → `bg-Y`, mais a laissé
 * des tokens orphelins `to-…`, `via-…`, et surtout les variantes `dark:from-…`,
 * `dark:to-…`, `hover:from-…` qui n'étaient pas collées au gradient de base.
 *
 * Règle SÛRE, ligne par ligne :
 *   - Toute ligne contenant ENCORE `bg-gradient-to-` est un dégradé LÉGITIME conservé
 *     (overlay photo / fade / shimmer) → on n'y touche PAS.
 *   - Sinon, on retire les tokens `(variant:)*(from|via|to)-COULEUR` orphelins,
 *     SAUF les couleurs transparent/black/white/background/current/inherit (overlays/fades).
 *
 * Exécution : node scripts/fix-gradients-pass3-cleanup.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

const EXCLUDE_FILES = [
  'HorizontalScrollRow.tsx', 'ProductImageCarousel.tsx', 'ProfessionalServiceCard.tsx',
  'WebRTCAudioCall.tsx', 'BottomNavigation.tsx', 'MobileBottomNav.tsx', 'dialog.tsx',
  'AgentLayoutProfessional.tsx', 'AgentLayout.tsx', 'AgentHeader.tsx', 'DriverLayout.tsx',
  'IOSInstallGuide.tsx', 'SingleTransportTicket.tsx', 'index.css', 'MediaAutoCarousel.tsx',
];

// Couleur de stop "réelle" Tailwind (hex arbitraire, famille-shade, ou token sémantique), + opacité éventuelle.
const COLOR = String.raw`(?:\[[^\]\s]+\]|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|primary|secondary|muted|accent|card|foreground|destructive|popover|border|input|ring)(?:\/\d{1,3})?`;
// Préfixes de variantes éventuels (dark:, hover:, md:, data-[...]:, etc.)
const VARIANT = String.raw`(?:[a-z0-9-]+:|data-\[[^\]]+\]:|aria-[a-z]+:)*`;
// Un stop orphelin = (variantes)(from|via|to)-COULEUR, précédé d'un espace.
const ORPHAN = new RegExp(String.raw`\s${VARIANT}(?:from|via|to)-${COLOR}`, 'g');

function cleanupLine(line) {
  if (line.includes('bg-gradient-to-')) return line; // dégradé légitime conservé → intact
  if (!/(?:from|via|to)-/.test(line)) return line;
  let out = line.replace(ORPHAN, '');
  // Normalise les espaces multiples créés à l'intérieur des className (sans toucher l'indentation de début de ligne)
  out = out.replace(/(\S)  +(\S)/g, '$1 $2');
  return out;
}

function getAllFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory() && !['node_modules', 'dist', '.git'].includes(entry)) getAllFiles(full, files);
    else if (['.tsx', '.ts'].includes(extname(entry))) files.push(full);
  }
  return files;
}

const rel = (p) => p.replace(/\\/g, '/').replace(/^src\//, '');
console.log('🧹 3e passe — nettoyage des stops orphelins...\n');
const files = getAllFiles('src');
let totalFiles = 0, totalLines = 0;
const report = [];
for (const file of files) {
  if (EXCLUDE_FILES.includes(basename(file))) continue;
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  let changed = 0;
  const newLines = lines.map((l) => {
    const c = cleanupLine(l);
    if (c !== l) changed++;
    return c;
  });
  if (changed > 0) {
    writeFileSync(file, newLines.join('\n'), 'utf-8');
    totalFiles++; totalLines += changed;
    report.push(`✅ ${rel(file)} (${changed} ligne(s))`);
    console.log(`  ✓ ${rel(file)} — ${changed} ligne(s) nettoyée(s)`);
  }
}
console.log(`\n✅ ${totalLines} lignes nettoyées dans ${totalFiles} fichiers`);
writeFileSync('AUDIT_GRADIENTS_PASS3.md', `# 3e passe — nettoyage stops orphelins\n\nLignes nettoyées : ${totalLines} dans ${totalFiles} fichiers\n\n${report.join('\n')}\n`);
console.log('📝 Rapport : AUDIT_GRADIENTS_PASS3.md');
