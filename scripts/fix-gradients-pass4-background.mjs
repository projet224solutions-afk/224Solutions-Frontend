/**
 * 4e passe — aplatit les dégradés subtils `from-background … to-{X}` (X ≠ transparent) → `bg-background`.
 * (La passe 2 les avait épargnés via la garde "background" qui protège les fades `from-background to-transparent`.)
 * Les fades `… to-transparent` restent intacts. Fichiers EXCLUDE non touchés.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

const EXCLUDE_FILES = [
  'HorizontalScrollRow.tsx', 'ProductImageCarousel.tsx', 'ProfessionalServiceCard.tsx',
  'WebRTCAudioCall.tsx', 'BottomNavigation.tsx', 'MobileBottomNav.tsx', 'dialog.tsx',
  'AgentLayoutProfessional.tsx', 'AgentLayout.tsx', 'AgentHeader.tsx', 'DriverLayout.tsx',
  'IOSInstallGuide.tsx', 'SingleTransportTicket.tsx', 'index.css', 'MediaAutoCarousel.tsx',
];
const TOKEN = String.raw`(?:\[[^\]]+\]|[a-z]+(?:-[0-9]+)?(?:\/[0-9]+)?)`;
// from-background [via-X] to-Y  où Y n'est PAS transparent
const RE = new RegExp(String.raw`bg-gradient-to-[a-z]+ from-background(?: via-${TOKEN})?(?: to-(${TOKEN}))?`, 'g');

function getAllFiles(dir, files = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e); const s = statSync(f);
    if (s.isDirectory() && !['node_modules', 'dist', '.git'].includes(e)) getAllFiles(f, files);
    else if (['.tsx', '.ts'].includes(extname(e))) files.push(f);
  }
  return files;
}
const rel = (p) => p.replace(/\\/g, '/').replace(/^src\//, '');
let nf = 0, nr = 0;
for (const file of getAllFiles('src')) {
  if (EXCLUDE_FILES.includes(basename(file))) continue;
  const c = readFileSync(file, 'utf-8');
  let k = 0;
  const out = c.replace(RE, (m, to) => { if (to === 'transparent') return m; k++; return 'bg-background'; });
  if (k > 0 && out !== c) { writeFileSync(file, out, 'utf-8'); nf++; nr += k; console.log(`  ✓ ${rel(file)} (${k})`); }
}
console.log(`\n✅ ${nr} dégradés from-background aplatis dans ${nf} fichiers`);
