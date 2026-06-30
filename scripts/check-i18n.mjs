// scripts/check-i18n.mjs — garde-fou de complétude i18n.
// (1) Toutes les langues ACTIVES (sélecteur supportedLanguages) ont les clés de fr.
// (2) Heuristique : alerte si du texte français semble codé en dur dans les .tsx.
// Usage : node scripts/check-i18n.mjs   (exit 1 si des clés manquent)
import { readFileSync, readdirSync } from 'fs';
import { execSync } from 'child_process';

const LOCALES = 'src/i18n/locales';

const keysOf = (file) => {
  const s = readFileSync(`${LOCALES}/${file}`, 'utf-8');
  return new Set([...s.matchAll(/"([a-zA-Z0-9_.]+)":/g)].map((x) => x[1]));
};

// Langues ACTIVES = celles du sélecteur (on ignore les fichiers de référence non listés, ex: su.ts).
const langsSrc = readFileSync('src/i18n/languages.ts', 'utf-8');
const activeCodes = new Set(
  langsSrc
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .flatMap((l) => [...l.matchAll(/code:\s*'([a-zA-Z-]+)'/g)].map((m) => m[1])),
);

const fr = keysOf('fr.ts');
let problems = 0;

const frArr = [...fr];
for (const file of readdirSync(LOCALES).filter((f) => f.endsWith('.ts'))) {
  const code = file.replace('.ts', '');
  if (code === 'fr' || !activeCodes.has(code)) continue; // ignore fr + langues non actives
  const k = keysOf(file); // ⚠️ une seule lecture/parse par fichier
  const missing = frArr.filter((key) => !k.has(key));
  if (missing.length) {
    console.error(`❌ ${code}: ${missing.length} clés manquantes (ex: ${missing.slice(0, 3).join(', ')})`);
    problems++;
  }
}

// Langues listées dans le sélecteur mais sans fichier locale → bloquant aussi.
for (const code of activeCodes) {
  try { readFileSync(`${LOCALES}/${code}.ts`); }
  catch { console.error(`❌ ${code}: langue active sans fichier ${code}.ts`); problems++; }
}

// (2) Heuristique texte en dur (alerte, ne bloque jamais ; ignorée si grep absent/lent
//     ou si --no-hardcoded est passé).
if (!process.argv.includes('--no-hardcoded')) {
  try {
    const hard = execSync(
      `grep -rnoE ">[A-ZÀ-Ÿ][a-zà-ÿ']+( [a-zà-ÿ']+){1,5}<" src/components src/pg --include="*.tsx" | grep -vE "console|import|\\{t\\(" | wc -l`,
      { encoding: 'utf-8', shell: '/bin/bash', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (parseInt(hard, 10) > 0) console.warn(`⚠️  ~${hard} textes potentiellement codés en dur (à extraire vers t())`);
  } catch { /* grep indispo/lent : heuristique ignorée, la complétude des clés reste vérifiée */ }
}

if (problems === 0) console.log(`✅ i18n : ${activeCodes.size} langues actives ont toutes les clés de référence (fr).`);
process.exit(problems > 0 ? 1 : 0);
