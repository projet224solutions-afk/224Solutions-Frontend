/**
 * flatten-livreur.mjs — retire les fonds pâles (teintes/cartes/icônes) de l'interface livreur.
 * Garde bordures, textes, hover et data-[state] (actifs). Retire juste le token de fond + l'espace devant.
 * Exécution : node scripts/flatten-livreur.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// Tokens de fond à retirer (au repos). On NE touche pas aux hover:/data-[state]:/from-/via-/to-.
const TOKENS = [
  'bg-\\[#ff4000\\]/5',
  'bg-\\[#ff4000\\]/10',
  'bg-\\[#ff4000\\]/20',
  'bg-\\[#04439e\\]/5',
  'bg-\\[#04439e\\]/10',
  'bg-muted/30',
  'bg-muted/50',
  'bg-muted/60',
];

const FILES = ['src/pg/LivreurDashboard.tsx'];
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e); const s = statSync(f);
    if (s.isDirectory()) walk(f, out);
    else if (extname(e) === '.tsx') out.push(f);
  }
  return out;
}
FILES.push(...walk('src/components/driver'));

let total = 0;
for (const file of FILES) {
  let c = readFileSync(file, 'utf-8');
  const before = c;
  for (const t of TOKENS) {
    // retire " <token>" quand suivi d'un séparateur de classe (espace, guillemet, backtick)
    c = c.replace(new RegExp(' ' + t + "(?=[ \"'`])", 'g'), '');
    // cas en début de className : "<token> -> "
    c = c.replace(new RegExp('(className=["`]|cn\\(["`])' + t + ' ', 'g'), '$1');
  }
  if (c !== before) {
    writeFileSync(file, c, 'utf-8');
    const n = (before.match(/bg-\[#ff4000\]\/(5|10|20)|bg-\[#04439e\]\/(5|10)|bg-muted\/(30|50|60)/g) || []).length
            - (c.match(/bg-\[#ff4000\]\/(5|10|20)|bg-\[#04439e\]\/(5|10)|bg-muted\/(30|50|60)/g) || []).length;
    total += n;
    console.log(`  ✓ ${file.replace(/\\/g, '/').replace('src/', '')} (-${n})`);
  }
}
console.log(`\n✅ ${total} fonds retirés (livreur)`);
