/**
 * flatten-bureau.mjs — retire les fonds de carrés d'icône / teintes neutres de l'interface bureau.
 * PRÉSERVE : animate-, backdrop-blur/sticky (navs), et badges sémantiques (vert/rouge/emerald).
 * Exécution : node scripts/flatten-bureau.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const TOKENS = [
  'bg-blue-50', 'bg-orange-50', 'bg-blue-100', 'bg-orange-100',
  'bg-primary/10', 'bg-primary/5',
  'bg-muted/30', 'bg-muted/50', 'bg-muted',
  'bg-\\[#ff4000\\]/10', 'bg-\\[#ff4000\\]/5',
  'bg-\\[#04439e\\]/10', 'bg-\\[#04439e\\]/5',
];

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e); const s = statSync(f);
    if (s.isDirectory()) walk(f, out);
    else if (extname(e) === '.tsx') out.push(f);
  }
  return out;
}

let total = 0;
for (const file of walk('src/components/bureau')) {
  const lines = readFileSync(file, 'utf-8').split('\n');
  let changed = 0;
  const out = lines.map((line) => {
    if (/animate-|backdrop-blur|sticky|fixed|green-|red-|emerald-/.test(line)) return line;
    let l = line;
    for (const t of TOKENS) l = l.replace(new RegExp(' ' + t + "(?=[ \"'`])", 'g'), '');
    if (l !== line) changed++;
    return l;
  });
  if (changed > 0) { writeFileSync(file, out.join('\n'), 'utf-8'); total += changed; console.log(`  ✓ ${file.replace(/\\/g, '/').replace('src/', '')} (${changed})`); }
}
console.log(`\n✅ ${total} lignes aplaties (bureau)`);
