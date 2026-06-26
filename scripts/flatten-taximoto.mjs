/**
 * flatten-taximoto.mjs — retire les teintes de fond au repos de l'interface taxi-moto (driver).
 * PRÉSERVE : lignes avec animate-ping/animate-pulse (anneaux), états data-[state=active], hover:, borders.
 * Exécution : node scripts/flatten-taximoto.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const TOKENS = [
  'bg-\\[#ff4000\\]/5', 'bg-\\[#ff4000\\]/10', 'bg-\\[#ff4000\\]/20',
  'bg-\\[#04439e\\]/5', 'bg-\\[#04439e\\]/10', 'bg-\\[#04439e\\]/20',
  'bg-orange-500/10', 'bg-orange-500/20',
  'bg-muted/30', 'bg-muted/50', 'bg-muted/60',
];

const FILES = ['src/components/taxi-moto/DriverDashboard.tsx'];
function walk(dir, out = []) {
  try {
    for (const e of readdirSync(dir)) {
      const f = join(dir, e); const s = statSync(f);
      if (s.isDirectory()) walk(f, out);
      else if (extname(e) === '.tsx') out.push(f);
    }
  } catch { /* ignore */ }
  return out;
}
FILES.push(...walk('src/components/taxi-moto/driver'));

let total = 0;
for (const file of FILES) {
  const lines = readFileSync(file, 'utf-8').split('\n');
  let changed = 0;
  const out = lines.map((line) => {
    // Préserver animations (anneaux pulsants) — ne pas toucher
    if (/animate-(ping|pulse)/.test(line)) return line;
    let l = line;
    for (const t of TOKENS) {
      // " <token>" suivi d'un séparateur de classe ; ne matche pas data-[state=...]:bg / hover:bg (préfixés)
      l = l.replace(new RegExp(' ' + t + "(?=[ \"'`])", 'g'), '');
    }
    if (l !== line) changed++;
    return l;
  });
  if (changed > 0) {
    writeFileSync(file, out.join('\n'), 'utf-8');
    total += changed;
    console.log(`  ✓ ${file.replace(/\\/g, '/').replace('src/', '')} (${changed} lignes)`);
  }
}
console.log(`\n✅ ${total} lignes aplaties (taxi-moto)`);
