import fs from 'fs';

const tsc = fs.readFileSync('_tsc.txt', 'utf8');
const fileSymbols = new Map(); // file -> Set('_X')

for (const line of tsc.split('\n')) {
  const fm = line.match(/^(src\/[^(]+)\(\d+,\d+\): error (TS2724|TS2305|TS2339):/);
  if (!fm) continue;
  const [, file, code] = fm;
  let sym = null;
  if (code === 'TS2339') {
    const m = line.match(/Property '(_[A-Za-z0-9$]+)'/);
    if (m) sym = m[1];
  } else {
    const m = line.match(/(?:named|member) '(_[A-Za-z0-9$]+)'/);
    if (m) sym = m[1];
  }
  if (!sym) continue;
  if (!fileSymbols.has(file)) fileSymbols.set(file, new Set());
  fileSymbols.get(file).add(sym);
}

let filesChanged = 0, totalSyms = 0, totalRepl = 0;
const sample = [];
for (const [file, syms] of fileSymbols) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  const orig = content;
  for (const sym of syms) {
    const bare = sym.slice(1);
    const re = new RegExp('\\b' + sym + '\\b', 'g');
    const n = (content.match(re) || []).length;
    if (n > 0) { content = content.replace(re, bare); totalRepl += n; totalSyms++; }
  }
  if (content !== orig) {
    fs.writeFileSync(file, content);
    filesChanged++;
    if (sample.length < 8) sample.push(`${file}  [${[...syms].join(', ')}]`);
  }
}

console.log(`Fichiers modifiés : ${filesChanged}`);
console.log(`Symboles dé-préfixés : ${totalSyms} (occurrences remplacées : ${totalRepl})`);
console.log('Échantillon :');
for (const s of sample) console.log('  ' + s);
