import fs from 'fs';

const src = fs.readFileSync('src/i18n/translations.ts', 'utf8');

// Découpe en blocs langue ("  xx: {" ... jusqu'au prochain).
const langStart = /^ {2}([a-z]{2,3}): \{$/gm;
let m;
const idxs = [];
while ((m = langStart.exec(src))) idxs.push({ lang: m[1], pos: m.index });
const blocks = {};
for (let i = 0; i < idxs.length; i++) {
  const end = i + 1 < idxs.length ? idxs[i + 1].pos : src.length;
  blocks[idxs[i].lang] = src.slice(idxs[i].pos, end);
}

function parseKeys(block) {
  const re = /"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/g;
  const o = {};
  let mm;
  while ((mm = re.exec(block))) o[mm[1]] = mm[2];
  return o;
}

const fr = parseKeys(blocks.fr || '');
const frN = Object.keys(fr).length;
console.log(`Référence FR : ${frN} clés\n`);
console.log('lang | #clés | %vs_fr | recopiés_FR(non traduits)');
console.log('-----|-------|--------|--------------------------');
const rows = [];
for (const lang of Object.keys(blocks)) {
  const k = parseKeys(blocks[lang]);
  const n = Object.keys(k).length;
  if (lang === 'fr') { console.log(`fr   | ${String(n).padStart(5)} | (réf.) | —`); continue; }
  let same = 0, cmp = 0;
  for (const key in k) {
    if (fr[key] !== undefined) { cmp++; if (fr[key] === k[key]) same++; }
  }
  const pct = ((n / frN) * 100).toFixed(0);
  const samePct = cmp ? ((same / cmp) * 100).toFixed(0) : '0';
  rows.push({ lang, n, pct: +pct, same, cmp, samePct: +samePct });
  console.log(`${lang.padEnd(4)} | ${String(n).padStart(5)} | ${String(pct).padStart(5)}% | ${same}/${cmp} = ${samePct}% identiques au FR`);
}

const avgCov = (rows.reduce((s, r) => s + r.pct, 0) / rows.length).toFixed(0);
const avgUntr = (rows.reduce((s, r) => s + r.samePct, 0) / rows.length).toFixed(0);
console.log(`\nMoyenne (hors fr) : couverture ${avgCov}% des clés FR · ~${avgUntr}% des clés présentes sont encore = au texte FR`);
