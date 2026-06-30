#!/usr/bin/env node
/**
 * i18n-translate.mjs — Complète le dictionnaire src/i18n/translations.ts
 * Traduit les clés FR manquantes vers chaque langue cible via OpenAI (clé backend/.env).
 * Sûr : additif (n'ajoute que les clés manquantes), resumable (cache), valide le parse final.
 *
 * Usage:
 *   node scripts/i18n-translate.mjs --langs en              # 1 langue
 *   node scripts/i18n-translate.mjs --langs en,ar,es --limit 30   # test (30 clés max/langue)
 *   node scripts/i18n-translate.mjs --all                   # toutes les langues, toutes les clés
 *   node scripts/i18n-translate.mjs --all --dry             # traduit + cache, mais N'ÉCRIT PAS le fichier
 */
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve(process.cwd(), 'src/i18n/translations.ts');
const CACHE = path.resolve(process.cwd(), 'scripts/.i18n-cache.json');
const MODEL = 'gpt-4o-mini';
const BATCH = 40;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DRY = flag('--dry');
const LIMIT = opt('--limit') ? Number(opt('--limit')) : Infinity;

const LANG_NAMES = {
  en: 'English', es: 'Spanish', pt: 'Portuguese (Brazil)', ar: 'Arabic', zh: 'Chinese (Simplified)',
  ru: 'Russian', de: 'German', it: 'Italian', ja: 'Japanese', ko: 'Korean', hi: 'Hindi',
  tr: 'Turkish', nl: 'Dutch', pl: 'Polish', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
  sw: 'Swahili', uk: 'Ukrainian', he: 'Hebrew', fa: 'Persian (Farsi)', bn: 'Bengali',
  wo: 'Wolof', ff: 'Pulaar/Fulani', su: 'Susu (Soussou, Guinea)',
};

function loadKey() {
  const env = fs.readFileSync(path.resolve(process.cwd(), 'backend/.env'), 'utf8');
  const m = env.match(/OPENAI_API_KEY=(.*)/);
  if (!m) throw new Error('OPENAI_API_KEY absente de backend/.env');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function parseTranslations(text) {
  const start = text.indexOf('{', text.indexOf('translations'));
  const endMarker = text.indexOf('export const supportedLanguages');
  const body = text.slice(start, text.lastIndexOf('}', endMarker) + 1);
   
  return eval('(' + body + ')');
}

async function translateBatch(key, lang, entries) {
  const langName = LANG_NAMES[lang] || lang;
  const payload = Object.fromEntries(entries);
  const sys = `You are a professional UI localizer for a fintech/e-commerce mobile app (brand: 224Solutions, Guinea/West Africa). Translate UI strings from French to ${langName}. Rules: keep it natural and concise (UI button/label tone); PRESERVE placeholders exactly ({x}, {{x}}, %s, :var, <b>..</b>), numbers, and the brand name "224Solutions"; do NOT translate keys; return ONLY a JSON object mapping each input key to its translated string.`;
  const user = `Translate the VALUES of this JSON to ${langName}. Return a JSON object with the SAME keys.\n${JSON.stringify(payload)}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL, temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function main() {
  const key = loadKey();
  const text = fs.readFileSync(FILE, 'utf8');
  const obj = parseTranslations(text);
  const fr = obj.fr;
  const frKeys = Object.keys(fr);

  const allLangs = Object.keys(obj).filter((l) => l !== 'fr');
  const target = flag('--all') ? allLangs : (opt('--langs') ? opt('--langs').split(',') : []);
  if (!target.length) { console.error('Préciser --langs xx,yy ou --all'); process.exit(1); }

  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const additions = {}; // lang -> {key: value}

  for (const lang of target) {
    if (!obj[lang]) { console.warn(`Langue ${lang} absente du dico, ignorée`); continue; }
    cache[lang] = cache[lang] || {};
    const missing = frKeys.filter((k) => !(k in obj[lang]) && !(k in cache[lang])).slice(0, LIMIT);
    const fromCache = frKeys.filter((k) => !(k in obj[lang]) && (k in cache[lang]));
    console.log(`\n[${lang}] ${LANG_NAMES[lang] || lang}: manquantes=${frKeys.filter(k=>!(k in obj[lang])).length}, à traduire maintenant=${missing.length}, déjà en cache=${fromCache.length}`);

    for (let i = 0; i < missing.length; i += BATCH) {
      const slice = missing.slice(i, i + BATCH);
      const entries = slice.map((k) => [k, fr[k]]);
      try {
        const out = await translateBatch(key, lang, entries);
        for (const k of slice) if (out[k]) cache[lang][k] = String(out[k]);
        process.stdout.write(`  ${Math.min(i + BATCH, missing.length)}/${missing.length}\r`);
        fs.writeFileSync(CACHE, JSON.stringify(cache)); // resumable
      } catch (e) {
        console.error(`\n  Lot ${i} échoué: ${e.message}`);
      }
    }
    // Rassembler ce qui est en cache et manquant dans le fichier
    additions[lang] = {};
    for (const k of frKeys) if (!(k in obj[lang]) && cache[lang][k]) additions[lang][k] = cache[lang][k];
    console.log(`\n  prêt à insérer: ${Object.keys(additions[lang]).length} clés`);
  }

  if (DRY) { console.log('\n--dry: aucune écriture du fichier.'); return; }

  // ── Insertion sûre par bloc de langue ──
  const lines = text.split(/\r?\n/);
  const blockStart = {}; // lang -> index de la ligne "  code: {"
  lines.forEach((l, i) => { const m = l.match(/^ {2}([A-Za-z][\w-]*): \{\s*$/); if (m) blockStart[m[1]] = i; });

  const inserts = [];
  for (const lang of Object.keys(additions)) {
    const idx = blockStart[lang];
    if (idx == null) { console.warn(`Bloc ${lang} introuvable, ignoré`); continue; }
    const newLines = Object.entries(additions[lang]).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    if (newLines.length) inserts.push({ at: idx + 1, newLines });
  }
  // appliquer du bas vers le haut
  inserts.sort((a, b) => b.at - a.at);
  for (const ins of inserts) lines.splice(ins.at, 0, ...ins.newLines);
  const newText = lines.join('\n');

  // Valider le parse avant d'écrire
  try { const test = parseTranslations(newText); if (Object.keys(test.fr).length !== frKeys.length) throw new Error('FR altéré'); }
  catch (e) { console.error('❌ Validation échouée, fichier NON modifié:', e.message); process.exit(1); }

  fs.copyFileSync(FILE, FILE + '.bak');
  fs.writeFileSync(FILE, newText);
  console.log(`\n✅ translations.ts mis à jour (${inserts.reduce((n, i) => n + i.newLines.length, 0)} clés ajoutées). Sauvegarde: translations.ts.bak`);
}

main().catch((e) => { console.error(e); process.exit(1); });
