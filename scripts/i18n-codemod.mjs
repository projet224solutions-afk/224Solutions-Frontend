#!/usr/bin/env node
/**
 * i18n-codemod.mjs — Externalise automatiquement le texte FR en dur vers t().
 * Réutilise la détection de i18n-scan-hardcoded.mjs. CONSERVATEUR :
 *  - ne traite un fichier QUE s'il a un seul point d'entrée composant clair
 *    (sinon il le saute et le liste dans skipped[] pour traitement manuel) ;
 *  - injecte import + `const { t } = useTranslation();` si absent ;
 *  - remplace jsx / placeholder|title|aria-label|label|alt / toast|alert ;
 *  - écrit les clés FR dans scripts/.i18n-new-keys.json (key -> [fr, fr] ; EN rempli plus tard).
 *
 * Usage:
 *   node scripts/i18n-codemod.mjs --dir src/components/wallet [--dry] [--max-files N]
 *   node scripts/i18n-codemod.mjs --file src/components/wallet/Foo.tsx [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';

const ACCENT = /[éèêëàâäùûüçîïôœÉÈÊËÀÂÄÙÛÜÇÎÏÔŒ]/;
const FR_WORDS = /\b(le|la|les|un|une|des|du|de|et|ou|pour|avec|sans|sur|dans|vous|votre|vos|nous|notre|ajouter|supprimer|modifier|enregistrer|rechercher|boutique|commande|commandes|paiement|paiements|livraison|vendeur|client|produit|produits|service|services|gérer|gestion|nouveau|nouvelle|tous|toutes|aucun|aucune|valider|annuler|fermer|retour|suivant|précédent|connexion|inscription|profil|paramètres|tableau|bord|montant|solde|portefeuille)\b/i;

const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DRY = args.includes('--dry');
const DIR = opt('--dir');
const FILE = opt('--file');
const MAXF = opt('--max-files') ? Number(opt('--max-files')) : Infinity;
const KEYS = path.resolve(process.cwd(), 'scripts/.i18n-new-keys.json');

function looksFrench(str) {
  const s = str.trim();
  if (s.length < 2) return false;
  if (/^[\d\s\W]+$/.test(s)) return false;
  if (/^[a-z][a-zA-Z0-9.]*$/.test(s)) return false;
  if (/[<>/{}=]/.test(s)) return false;
  if (/(https?:|service-icons|linear-gradient|rgba?\()/.test(s)) return false;
  return ACCENT.test(s) || FR_WORDS.test(s);
}

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules/.test(p)) walk(p, acc); }
    else if (e.name.endsWith('.tsx') && !p.includes(`${path.sep}ui${path.sep}`)) acc.push(p);
  }
  return acc;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function camel(s) { return s.replace(/\.tsx$/, '').replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^(.)/, (m) => m.toLowerCase()); }
function slug(text) {
  const words = text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 5);
  let s = words.map((w, i) => i === 0 ? w : w[0].toUpperCase() + w.slice(1)).join('');
  if (!s) s = 'txt';
  if (/^\d/.test(s)) s = 't' + s;
  return s.slice(0, 40);
}

/** Trouve la ligne où injecter le hook (après l'ouverture du corps composant). Renvoie {line, indent} ou null. */
function findComponentBody(lines) {
  // candidats: export default function X( ... ) {  |  export function X(  |  const X = (...) => {  |  const X: ... = (...) => {
  const patterns = [
    /^(\s*)export\s+default\s+function\s+[A-Z]\w*\s*\(/,
    /^(\s*)export\s+function\s+[A-Z]\w*\s*\(/,
    /^(\s*)(?:export\s+)?const\s+[A-Z]\w*(?::[^=]+)?\s*=\s*\(?[^)]*\)?\s*(?::[^=]+)?=>\s*\{?\s*$/,
    /^(\s*)function\s+[A-Z]\w*\s*\(/,
  ];
  const matches = [];
  lines.forEach((l, i) => { for (const re of patterns) if (re.test(l)) { matches.push(i); break; } });
  if (matches.length !== 1) return null; // 0 ou >1 composant => ambigu => skip
  // trouver la ligne qui OUVRE LE CORPS : fermeture des params `)` (+ type retour
  // éventuel) puis `{` en fin de ligne — gère `) {`, `): T {`, `) => {`.
  // NE PAS matcher le `({` d'une destructuration de props.
  for (let i = matches[0]; i < Math.min(matches[0] + 25, lines.length); i++) {
    if (/\)\s*(?::[^{]*)?(?:=>\s*)?\{\s*$/.test(lines[i])) {
      const indent = (lines[i + 1] && lines[i + 1].match(/^\s*/)[0]) || '  ';
      return { line: i + 1, indent };
    }
  }
  return null;
}

function processFile(file, keys) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  let src = fs.readFileSync(file, 'utf8');
  if (!/return\s*\(|=>\s*</.test(src)) return { rel, status: 'skip-no-jsx' };

  const ns = camel(path.basename(file));
  let lines = src.split(/\r?\n/);
  const usedSlugs = new Set();
  let count = 0;

  const mkKey = (text) => {
    let base = `${ns}.${slug(text)}`;
    let k = base, n = 2;
    while (usedSlugs.has(k) && keys[k] && keys[k][0] !== text) { k = `${base}${n++}`; }
    usedSlugs.add(k);
    keys[k] = [text, text];
    return k;
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(line) || /console\.(log|warn|error|info)/.test(line)) continue;

    // 1) JSX text >Texte<
    line = line.replace(/>(\s*)([^<>{}\n][^<>{}\n]*?)(\s*)</g, (full, a, txt, b) => {
      if (!looksFrench(txt)) return full;
      const k = mkKey(txt.trim()); count++;
      return `>${a}{t('${k}')}${b}<`;
    });

    // 2) Attributs JSX visibles — PAS d'espace avant `=` (sinon = défaut de prop /
    //    assignation JS), et pas précédé de `.`/mot (sinon `document.title=`).
    line = line.replace(/(?<![.\w-])(placeholder|title|aria-label|label|alt)=["“]([^"”]+)["”]/g, (full, attr, txt) => {
      if (!looksFrench(txt)) return full;
      const k = mkKey(txt.trim()); count++;
      return `${attr}={t('${k}')}`;
    });

    // 3) toast/alert('...') — gère les apostrophes/quotes échappées dans la chaîne
    line = line.replace(/(toast(?:\.\w+)?|alert|confirm)\s*\(\s*(["'])((?:\\.|(?!\2).)*?)\2/g, (full, fn, q, raw) => {
      const txt = raw.replace(/\\(['"\\])/g, '$1'); // déséchapper pour la valeur stockée
      if (!looksFrench(txt)) return full;
      const k = mkKey(txt.trim()); count++;
      return `${fn}(t('${k}')`;
    });

    lines[i] = line;
  }

  if (count === 0) return { rel, status: 'nothing' };

  // Injection hook + import (si absent)
  const hasHook = /const\s*\{\s*t\s*[,}]/.test(src) || /\bconst\s*\{\s*t\s*\}\s*=\s*useTranslation/.test(src);
  if (!hasHook) {
    const body = findComponentBody(lines);
    if (!body) return { rel, status: 'skip-ambiguous-component', count };
    lines.splice(body.line, 0, `${body.indent}const { t } = useTranslation();`);
  }
  let out = lines.join('\n');
  if (!/from ['"]@\/hooks\/useTranslation['"]/.test(out)) {
    // insérer l'import TOUT EN HAUT (évite de tomber au milieu d'un import
    // multi-ligne `import {\n ... \n} from '...'`, même si c'est le 1er import)
    out = `import { useTranslation } from "@/hooks/useTranslation";\n` + out;
  }

  if (!DRY) fs.writeFileSync(file, out);
  return { rel, status: 'done', count };
}

const files = FILE ? [path.resolve(process.cwd(), FILE)] : walk(path.resolve(process.cwd(), DIR), []);
const keys = fs.existsSync(KEYS) ? JSON.parse(fs.readFileSync(KEYS, 'utf8')) : {};
const results = { done: [], skipped: [], nothing: [] };
let processed = 0;
for (const f of files) {
  if (processed >= MAXF) break;
  const r = processFile(f, keys);
  if (r.status === 'done') { results.done.push(`${r.rel} (+${r.count})`); processed++; }
  else if (r.status === 'nothing' || r.status === 'skip-no-jsx') results.nothing.push(r.rel);
  else results.skipped.push(`${r.rel} [${r.status}${r.count ? ' ' + r.count : ''}]`);
}
if (!DRY) fs.writeFileSync(KEYS, JSON.stringify(keys, null, 2));

console.log(`\n=== CODEMOD ${DRY ? '(DRY)' : ''} ===`);
console.log(`Traités: ${results.done.length} | Sautés (manuel): ${results.skipped.length} | Rien: ${results.nothing.length}`);
console.log(`Clés totales accumulées: ${Object.keys(keys).length}`);
if (results.done.length) { console.log('\n-- TRAITÉS --'); results.done.forEach(x => console.log('  ✓', x)); }
if (results.skipped.length) { console.log('\n-- SAUTÉS (à faire main) --'); results.skipped.forEach(x => console.log('  ⚠', x)); }
