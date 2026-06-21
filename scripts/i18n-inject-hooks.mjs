#!/usr/bin/env node
/**
 * i18n-inject-hooks.mjs — Injecte `const { t } = useTranslation();` au début du
 * corps de CHAQUE composant React d'un fichier (gère les signatures multilignes),
 * pour débloquer les fichiers multi-composants que i18n-codemod.mjs saute.
 *
 * Prudent :
 *  - ne cible que les fonctions/const PascalCase (convention composant React) ;
 *  - n'injecte PAS si le hook est déjà la 1re instruction du corps ;
 *  - n'ajoute pas l'import (le codemod le fait) — mais l'ajoute si --with-import.
 *  - --dry pour prévisualiser.
 *
 * Usage: node scripts/i18n-inject-hooks.mjs --file src/.../X.tsx [--dry]
 *
 * À enchaîner avec i18n-codemod.mjs --file (qui fera les remplacements t()).
 * ⚠️ Vérifier d'abord l'absence de pièges `.map(t=>)` (le `t` i18n serait masqué).
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const DRY = args.includes('--dry');
const FILE = opt('--file');
if (!FILE) { console.error('--file requis'); process.exit(1); }

const HOOK = 'const { t } = useTranslation();';
// Débuts de composant (PascalCase) : function / const fléché.
const COMP_RE = /^(\s*)(?:export\s+default\s+|export\s+)?(?:function\s+[A-Z]\w*\s*\(|const\s+[A-Z]\w*\b[^=]*=\s*(?:\([^)]*\)|[A-Za-z0-9_$]+|\()?\s*(?::[^=]+)?=?>?\s*)/;

const src = fs.readFileSync(FILE, 'utf8');
const lines = src.split(/\r?\n/);

// 1) repérer les lignes de début de composant
const starts = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/^\s*(?:export\s+default\s+|export\s+)?function\s+[A-Z]\w*\s*\(/.test(l)) starts.push(i);
  else if (/^\s*(?:export\s+)?const\s+[A-Z]\w*\b[^=]*=\s*(?:\(|[A-Za-z])/.test(l) && /=>/.test(lines.slice(i, i + 8).join('\n'))) starts.push(i);
}

// 2) pour chaque début, trouver l'ouverture du corps (équilibrage de parenthèses
//    sur la signature, puis le `{` qui suit), et insérer le hook si absent.
let inserted = 0;
const insertAt = []; // {lineIndex, indent}
for (const s of starts) {
  let depth = 0, started = false, bodyLine = -1;
  for (let i = s; i < Math.min(s + 40, lines.length); i++) {
    for (const ch of lines[i]) {
      if (ch === '(') { depth++; started = true; }
      else if (ch === ')') depth--;
    }
    if (started && depth === 0) {
      // la ligne où la signature se referme : chercher le `{` d'ouverture du corps
      if (/\{\s*$/.test(lines[i]) || /=>\s*\{\s*$/.test(lines[i]) || /\)\s*(?::[^{]*)?\{\s*$/.test(lines[i])) { bodyLine = i; }
      break;
    }
  }
  if (bodyLine < 0) continue;
  // déjà un hook juste après ?
  const next = lines[bodyLine + 1] || '';
  if (/const\s*\{\s*t\s*[,}].*useTranslation/.test(next) || /const\s*\{\s*t\s*\}\s*=\s*useTranslation/.test(next)) continue;
  const indent = (next.match(/^\s*/) || ['  '])[0] || '  ';
  insertAt.push({ line: bodyLine + 1, indent });
}

// insérer du bas vers le haut
insertAt.sort((a, b) => b.line - a.line);
for (const { line, indent } of insertAt) {
  lines.splice(line, 0, `${indent}${HOOK}`);
  inserted++;
}

let out = lines.join('\n');
if (args.includes('--with-import') && !/from ['"]@\/hooks\/useTranslation['"]/.test(out)) {
  out = `import { useTranslation } from "@/hooks/useTranslation";\n` + out;
}

console.log(`${FILE}: ${starts.length} composant(s) détecté(s), ${inserted} hook(s) à injecter${DRY ? ' (dry)' : ''}`);
if (!DRY) fs.writeFileSync(FILE, out);
