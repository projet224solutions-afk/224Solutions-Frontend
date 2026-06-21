/**
 * 2e passe — Aplatissement générique des dégradés décoratifs restants.
 * 224Solutions-Frontend
 *
 * Principe : `bg-gradient-to-{dir} from-{X} [via-{…}] to-{Y}` → `bg-{X}`
 *   → supprime la TRANSITION (le problème) en gardant la teinte de départ en SOLIDE.
 *   → préserve la sémantique (bleu=info, vert=succès, rouge=erreur…).
 *   → les textes en dégradé (`bg-clip-text text-transparent`) restent lisibles
 *      (le bg-clip-text clippe désormais une couleur solide).
 *
 * GARDÉ INTACT (légitime) :
 *   - overlays photo  : `to-transparent`, `from-black/…`
 *   - fades de scroll : `from-background to-transparent`
 *   - shimmer         : `from-transparent via-white/… to-transparent`
 *
 * Exécution : node scripts/fix-gradients-pass2.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

// Fichiers à NE PAS toucher (décor légitime / déjà traités manuellement / CSS global)
const EXCLUDE_FILES = [
  'HorizontalScrollRow.tsx', 'ProductImageCarousel.tsx', 'ProfessionalServiceCard.tsx',
  'WebRTCAudioCall.tsx', 'BottomNavigation.tsx', 'MobileBottomNav.tsx', 'dialog.tsx',
  'AgentLayoutProfessional.tsx', 'AgentLayout.tsx', 'AgentHeader.tsx', 'DriverLayout.tsx',
  'IOSInstallGuide.tsx', 'SingleTransportTicket.tsx', 'index.css', 'MediaAutoCarousel.tsx',
];

// Capture : bg-gradient-to-{dir} from-{X} [via-{…}] [to-{Y}]
// X / Y = couleur Tailwind (famille-shade /opacité), token sémantique, ou hex arbitraire.
const TOKEN = String.raw`(?:\[[^\]]+\]|[a-z]+(?:-[0-9]+)?(?:\/[0-9]+)?)`;
const GRAD = new RegExp(
  String.raw`bg-gradient-to-[a-z]+ from-(${TOKEN})(?: via-${TOKEN})?(?: to-(${TOKEN}))?`,
  'g'
);

function flatten(content) {
  let n = 0;
  const out = content.replace(GRAD, (match, from, to) => {
    // Garder les overlays/fades/shimmer
    if (from === 'transparent' || from === 'background' || from.startsWith('black')) return match;
    if (to === 'transparent') return match;
    n++;
    return `bg-${from}`;
  });
  return { out, n };
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
console.log('🔍 2e passe — aplatissement des dégradés décoratifs...\n');
const files = getAllFiles('src');
let totalFiles = 0, totalRepl = 0;
const report = [];
for (const file of files) {
  if (EXCLUDE_FILES.includes(basename(file))) continue;
  const content = readFileSync(file, 'utf-8');
  const { out, n } = flatten(content);
  if (n > 0 && out !== content) {
    writeFileSync(file, out, 'utf-8');
    totalFiles++; totalRepl += n;
    report.push(`✅ ${rel(file)} (${n})`);
    console.log(`  ✓ ${rel(file)} — ${n} dégradé(s) aplati(s)`);
  }
}
console.log(`\n✅ ${totalRepl} dégradés aplatis dans ${totalFiles} fichiers`);
writeFileSync('AUDIT_GRADIENTS_PASS2.md', `# 2e passe — flattening\n\nDégradés aplatis : ${totalRepl} dans ${totalFiles} fichiers\n\n${report.join('\n')}\n`);
console.log('📝 Rapport : AUDIT_GRADIENTS_PASS2.md');
