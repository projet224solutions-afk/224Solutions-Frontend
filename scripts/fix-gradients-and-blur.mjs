/**
 * Script de nettoyage automatique — Dégradés & Backdrop-blur
 * 224Solutions-Frontend
 *
 * Exécution : node scripts/fix-gradients-and-blur.mjs
 *
 * NB (compat Windows) : les comparaisons de nom de fichier utilisent path.basename
 * et l'affichage normalise les séparateurs en '/', sinon EXCLUDE_FILES ne
 * fonctionnerait pas sous Windows (path.join produit des '\').
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

// ── RÈGLES DE REMPLACEMENT ────────────────────────────────────────────────────
const RULES = [
  // RÈGLE 1 : Dégradés identiques orange-orange → couleur solide
  { from: /bg-gradient-to-[a-z]+ from-\[#ff4000\] to-\[#ff4000\]/g, to: 'bg-[#ff4000]', description: 'Gradient ff4000→ff4000 → solide' },
  { from: /hover:from-\[#ff4000\] hover:to-\[#ff4000\]/g, to: 'hover:bg-[#ce3d11]', description: 'Hover gradient ff4000→ff4000 → hover solide' },

  // RÈGLE 2 : Dégradés orange-500 (hors-charte) → orange 224
  { from: /bg-gradient-to-[a-z]+ from-orange-500 via-\[#ff4000\] to-\[#ff4000\]/g, to: 'bg-[#ff4000]', description: 'Gradient orange-500 via ff4000 → solide ff4000' },
  { from: /bg-gradient-to-[a-z]+ from-orange-500 to-\[#ff4000\]/g, to: 'bg-[#ff4000]', description: 'Gradient orange-500→ff4000 → solide ff4000' },
  { from: /bg-gradient-to-[a-z]+ from-\[#ff4000\] to-orange-500/g, to: 'bg-[#ff4000]', description: 'Gradient ff4000→orange-500 → solide ff4000' },

  // RÈGLE 3 : Dégradés identiques bleu-bleu → couleur solide
  { from: /bg-gradient-to-[a-z]+ from-\[#04439e\] to-\[#04439e\]/g, to: 'bg-[#04439e]', description: 'Gradient 04439e→04439e → solide' },
  { from: /bg-gradient-to-[a-z]+ from-blue-50 to-blue-50/g, to: 'bg-[#04439e]/5', description: 'Gradient blue-50→blue-50 → fond bleu pâle' },
  { from: /bg-gradient-to-[a-z]+ from-orange-50 to-orange-50/g, to: 'bg-[#ff4000]/5', description: 'Gradient orange-50→orange-50 → fond orange pâle' },

  // RÈGLE 4 : Dégradé bleu-vers-orange sur boutons CTA → solide
  { from: /bg-gradient-to-[a-z]+ from-\[#04439e\] to-\[#ff4000\]/g, to: 'bg-[#ff4000]', description: 'Gradient bleu→orange sur CTA → orange solide' },
  { from: /bg-gradient-to-[a-z]+ from-\[#ff4000\] to-\[#04439e\]/g, to: 'bg-[#04439e]', description: 'Gradient orange→bleu → bleu solide' },
  { from: /hover:from-\[#04439e\] hover:to-\[#ff4000\]/g, to: 'hover:bg-[#ce3d11]', description: 'Hover gradient bleu→orange → hover orange foncé' },

  // RÈGLE 5 : from-primary to-secondary → bleu solide
  { from: /bg-gradient-to-[a-z]+ from-primary to-secondary/g, to: 'bg-[#04439e]', description: 'Gradient primary→secondary → bleu solide' },
  { from: /bg-gradient-to-[a-z]+ from-primary\/[0-9]+ to-primary\/[0-9]+/g, to: 'bg-primary/10', description: 'Gradient primary/X→primary/Y → fond primaire pâle' },

  // RÈGLE 6 : Dégradés inline hors-charte dans style={}
  { from: /background:\s*'linear-gradient\(135deg,\s*hsl\(25 98% 55%\),\s*hsl\(15 100% 50%\)\)'/g, to: "background: '#ff4000'", description: 'Background gradient inline → #ff4000' },
  { from: /background:\s*`linear-gradient\(135deg,\s*hsl\(25 98% 55%\),\s*hsl\(15 100% 50%\)\)`/g, to: 'background: `#ff4000`', description: 'Background gradient template literal → #ff4000' },
  { from: /linear-gradient\(135deg,\s*hsl\(25 98% 55%\),\s*hsl\(15 100% 50%\)\)/g, to: '#ff4000', description: 'Gradient inline hsl(25→15) → #ff4000 solide' },

  // RÈGLE 1bis/4bis : Dégradés 3-arrêts (via-) identiques ou de marque → solide
  { from: /hover:from-\[#ff4000\] hover:via-\[#ff4000\] hover:to-\[#ff4000\]/g, to: 'hover:bg-[#ce3d11]', description: 'Hover gradient 3-stop ff4000 → hover solide' },
  { from: /bg-gradient-to-[a-z]+ from-\[#ff4000\] via-\[#ff4000\] to-\[#ff4000\]/g, to: 'bg-[#ff4000]', description: 'Gradient 3-stop ff4000 → solide' },
  { from: /bg-gradient-to-[a-z]+ from-\[#04439e\] via-\[#04439e\] to-\[#04439e\]/g, to: 'bg-[#04439e]', description: 'Gradient 3-stop 04439e → solide' },
  { from: /bg-gradient-to-[a-z]+ from-\[#ff4000\] via-\[#ff4000\] to-\[#04439e\]/g, to: 'bg-[#ff4000]', description: 'Gradient 3-stop orange-dominant → orange solide' },
  { from: /bg-gradient-to-[a-z]+ from-\[#04439e\] via-\[#04439e\] to-\[#ff4000\]/g, to: 'bg-[#04439e]', description: 'Gradient 3-stop bleu-dominant → bleu solide' },

  // RÈGLE 7 : Backdrop-blur sur cartes et contenus → fond opaque
  { from: /\bborder-border\/40 bg-card\/50 backdrop-blur-sm\b/g, to: 'border-border bg-card', description: 'Agent card 50% + blur → opaque' },
  { from: /\bbg-card\/50 backdrop-blur-sm\b/g, to: 'bg-card', description: 'Card 50% + blur → card opaque' },
  { from: /\bbg-card\/50 backdrop-blur-md\b/g, to: 'bg-card', description: 'Card 50% + blur-md → card opaque' },
  { from: /\bbg-white\/20 rounded-xl backdrop-blur-sm\b/g, to: 'bg-white/20 rounded-xl', description: 'Supprime blur sur fond blanc 20%' },
  { from: /\bbg-white\/10 rounded-xl backdrop-blur-sm\b/g, to: 'bg-white/10 rounded-xl', description: 'Supprime blur sur fond blanc 10%' },
  { from: /\bbg-background\/80 backdrop-blur-sm\b/g, to: 'bg-background', description: 'Background 80% + blur → opaque' },
];

// ── FICHIERS EXCLUS (dégradés/blur légitimes — corrections manuelles Phase 2) ──
const EXCLUDE_FILES = [
  'HorizontalScrollRow.tsx',
  'ProductImageCarousel.tsx',
  'ProfessionalServiceCard.tsx',
  'WebRTCAudioCall.tsx',
  'BottomNavigation.tsx',
  'MobileBottomNav.tsx',
  'dialog.tsx',
  'AgentLayoutProfessional.tsx',
  'AgentLayout.tsx',
  'AgentHeader.tsx',
  'DriverLayout.tsx',
  'IOSInstallGuide.tsx',
  'SingleTransportTicket.tsx',
  'index.css',
  'MediaAutoCarousel.tsx',
];

// ── MOTEURS ───────────────────────────────────────────────────────────────────
function getAllFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory() && !['node_modules', 'dist', '.git'].includes(entry)) {
      getAllFiles(full, files);
    } else if (['.tsx', '.ts', '.css'].includes(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

const rel = (p) => p.replace(/\\/g, '/').replace(/^src\//, '');

function processFile(filePath) {
  const fileName = basename(filePath); // compat Windows
  if (EXCLUDE_FILES.includes(fileName)) return { skipped: true };

  let content = readFileSync(filePath, 'utf-8');
  const original = content;
  const applied = [];

  for (const rule of RULES) {
    const before = content;
    content = content.replace(rule.from, rule.to);
    if (content !== before) applied.push(rule.description);
  }

  if (content !== original) {
    writeFileSync(filePath, content, 'utf-8');
    return { changed: true, applied };
  }
  return { changed: false };
}

// ── EXÉCUTION ─────────────────────────────────────────────────────────────────
console.log('🔍 Analyse des fichiers src/...\n');
const files = getAllFiles('src');
let totalChanged = 0;
const report = [];

for (const file of files) {
  const result = processFile(file);
  if (result.skipped) {
    report.push(`⏭  IGNORÉ   ${rel(file)}`);
  } else if (result.changed) {
    totalChanged++;
    result.applied.forEach((desc) => console.log(`  ✓ ${rel(file)} — ${desc}`));
    report.push(`✅ MODIFIÉ  ${rel(file)} (${result.applied.length} corrections)`);
  }
}

console.log(`\n✅ ${totalChanged} fichiers modifiés sur ${files.length} analysés`);
console.log('\n📋 Fichiers ignorés (corrections manuelles requises) :');
EXCLUDE_FILES.forEach((f) => console.log(`   - ${f}`));

writeFileSync('AUDIT_GRADIENTS_SCRIPT.md', `# Script fix-gradients — Rapport\n\nFichiers modifiés : ${totalChanged}/${files.length}\n\n${report.join('\n')}\n`);
console.log('\n📝 Rapport écrit dans AUDIT_GRADIENTS_SCRIPT.md');
