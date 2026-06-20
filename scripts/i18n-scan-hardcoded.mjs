#!/usr/bin/env node
/**
 * i18n-scan-hardcoded.mjs
 * Scanne src/**.tsx (hors primitives ui/) à la recherche de TEXTE FRANÇAIS CODÉ EN DUR
 * qui ne passe pas par t(). Sert à piloter l'externalisation (W1) et de garde-fou.
 *
 * Usage:
 *   node scripts/i18n-scan-hardcoded.mjs            # rapport résumé
 *   node scripts/i18n-scan-hardcoded.mjs --json     # sortie JSON détaillée
 *   node scripts/i18n-scan-hardcoded.mjs --file src/pg/Home.tsx   # détail d'un fichier
 *   node scripts/i18n-scan-hardcoded.mjs --max 0    # exit 1 si > N occurrences (garde-fou CI)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const ACCENT = /[éèêëàâäùûüçîïôœÉÈÊËÀÂÄÙÛÜÇÎÏÔŒ]/;
// Mots français fréquents SANS accent (pour attraper "Ajouter", "Boutique", "Rechercher"…)
const FR_WORDS = /\b(le|la|les|un|une|des|du|de|et|ou|pour|avec|sans|sur|dans|vous|votre|vos|nous|notre|ajouter|supprimer|modifier|enregistrer|rechercher|boutique|commande|commandes|paiement|paiements|livraison|vendeur|client|produit|produits|service|services|gérer|gestion|nouveau|nouvelle|tous|toutes|aucun|aucune|valider|annuler|fermer|retour|suivant|précédent|connexion|inscription|profil|paramètres|tableau|bord|montant|solde|portefeuille)\b/i;

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const fileArg = (() => { const i = args.indexOf('--file'); return i >= 0 ? args[i + 1] : null; })();
const maxArg = (() => { const i = args.indexOf('--max'); return i >= 0 ? Number(args[i + 1]) : null; })();

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules/.test(p)) walk(p, acc); }
    else if (e.name.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

// Détecte si une chaîne ressemble à du texte FR humain (et pas du code/classe/clé)
function looksFrench(str) {
  const s = str.trim();
  if (s.length < 2) return false;
  if (/^[\d\s\W]+$/.test(s)) return false;                 // que ponctuation/chiffres
  if (/^[a-z][a-zA-Z0-9.]*$/.test(s)) return false;        // identifiant/clé i18n
  if (/[<>/{}=]/.test(s)) return false;                    // bouts de JSX/JS
  if (/(https?:|service-icons|linear-gradient|rgba?\()/.test(s)) return false;
  return ACCENT.test(s) || FR_WORDS.test(s);
}

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, idx) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;            // commentaires
    if (/console\.(log|warn|error|info)/.test(line)) return; // logs dev
    // 1) Texte JSX entre balises : >Texte ici<
    let m;
    const jsx = />\s*([^<>{}\n][^<>{}\n]*?)\s*</g;
    while ((m = jsx.exec(line))) { if (looksFrench(m[1])) hits.push({ line: idx + 1, kind: 'jsx', text: m[1].trim() }); }
    // 2) Attributs visibles : placeholder/title/aria-label/label/alt="..."
    const attr = /(placeholder|title|aria-label|label|alt)\s*=\s*["“]([^"”]+)["”]/g;
    while ((m = attr.exec(line))) { if (looksFrench(m[2])) hits.push({ line: idx + 1, kind: m[1], text: m[2].trim() }); }
    // 3) toast/alert('...') textes
    const call = /(toast(?:\.\w+)?|alert|confirm)\s*\(\s*["'`]([^"'`]{3,})["'`]/g;
    while ((m = call.exec(line))) { if (looksFrench(m[2])) hits.push({ line: idx + 1, kind: 'call', text: m[2].trim() }); }
  });
  return hits;
}

const files = fileArg ? [path.resolve(process.cwd(), fileArg)] : walk(ROOT, []);
const report = [];
let total = 0;
for (const f of files) {
  if (f.includes(`${path.sep}ui${path.sep}`)) continue;     // primitives shadcn = pas de texte métier
  const hits = scanFile(f);
  if (hits.length) { report.push({ file: path.relative(process.cwd(), f).replace(/\\/g, '/'), count: hits.length, hits }); total += hits.length; }
}
report.sort((a, b) => b.count - a.count);

if (fileArg) {
  const r = report[0];
  if (!r) { console.log('Aucune chaîne FR en dur détectée dans', fileArg); }
  else { console.log(`${r.file} — ${r.count} chaînes FR en dur:`); r.hits.forEach(h => console.log(`  L${h.line} [${h.kind}] ${h.text}`)); }
} else if (asJson) {
  console.log(JSON.stringify({ total, files: report.length, report }, null, 2));
} else {
  console.log(`Fichiers avec texte FR en dur : ${report.length}`);
  console.log(`Occurrences totales (approx)  : ${total}\n`);
  console.log('Top 30 fichiers :');
  report.slice(0, 30).forEach(r => console.log(`  ${String(r.count).padStart(4)}  ${r.file}`));
}

if (maxArg !== null && total > maxArg) {
  console.error(`\n❌ Garde-fou i18n: ${total} chaînes FR en dur > seuil ${maxArg}`);
  process.exit(1);
}
