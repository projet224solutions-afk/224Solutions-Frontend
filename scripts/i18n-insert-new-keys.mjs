#!/usr/bin/env node
/**
 * Insère les nouvelles clés (FR + EN) de scripts/.i18n-new-keys.json dans
 * src/i18n/translations.ts, en tête des blocs `fr:` et `en:`.
 * Additif (saute les clés déjà présentes), valide le parse final, fait un .bak.
 */
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve(process.cwd(), 'src/i18n/translations.ts');
const KEYS = path.resolve(process.cwd(), 'scripts/.i18n-new-keys.json');

function parseTranslations(text) {
  const start = text.indexOf('{', text.indexOf('translations'));
  const endMarker = text.indexOf('export const supportedLanguages');
  const body = text.slice(start, text.lastIndexOf('}', endMarker) + 1);
   
  return eval('(' + body + ')');
}

const FR_ONLY = process.argv.includes('--fr-only'); // n'insère que FR (EN sera traduit par translate --all)
const pairs = JSON.parse(fs.readFileSync(KEYS, 'utf8'));
const text = fs.readFileSync(FILE, 'utf8');
const obj = parseTranslations(text);
const frKeysBefore = Object.keys(obj.fr).length;

const lines = text.split(/\r?\n/);
const blockStart = {};
lines.forEach((l, i) => { const m = l.match(/^ {2}([A-Za-z][\w-]*): \{\s*$/); if (m && blockStart[m[1]] == null) blockStart[m[1]] = i; });

function buildLines(langIdx, lang) {
  const out = [];
  for (const [k, vals] of Object.entries(pairs)) {
    if (k in obj[lang]) continue; // déjà présent
    out.push(`    ${JSON.stringify(k)}: ${JSON.stringify(vals[langIdx])},`);
  }
  return out;
}

const inserts = [];
const targets = FR_ONLY ? [['fr', 0]] : [['fr', 0], ['en', 1]];
for (const [lang, idx] of targets) {
  const at = blockStart[lang];
  if (at == null) { console.error(`Bloc ${lang} introuvable`); process.exit(1); }
  const newLines = buildLines(idx, lang);
  if (newLines.length) inserts.push({ at: at + 1, newLines, lang });
  console.log(`[${lang}] +${newLines.length} clés`);
}

inserts.sort((a, b) => b.at - a.at);
for (const ins of inserts) lines.splice(ins.at, 0, ...ins.newLines);
const newText = lines.join('\n');

try {
  const test = parseTranslations(newText);
  if (Object.keys(test.fr).length < frKeysBefore) throw new Error('FR a rétréci');
} catch (e) { console.error('❌ Validation parse échouée, fichier NON modifié:', e.message); process.exit(1); }

fs.copyFileSync(FILE, FILE + '.bak2');
fs.writeFileSync(FILE, newText);
console.log(`✅ Inséré. FR ${frKeysBefore} → ${Object.keys(parseTranslations(newText).fr).length}. Sauvegarde: translations.ts.bak2`);
