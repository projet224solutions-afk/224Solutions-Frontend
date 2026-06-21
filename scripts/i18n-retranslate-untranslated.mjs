#!/usr/bin/env node
/**
 * Re-traduit les clés restées EN FRANÇAIS (valeur identique au bloc fr) pour des
 * langues peu dotées (wo, su, ff par défaut). Utilise un modèle plus fort + prompt
 * strict. OVERWRITE en place (remplace la valeur existante de la clé dans le bloc).
 * Resumable via scripts/.i18n-retrans-cache.json. Valide le parse, fait un .bak3.
 *
 * Usage: node scripts/i18n-retranslate-untranslated.mjs --langs wo,su,ff [--model gpt-4o] [--limit N] [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve(process.cwd(), 'src/i18n/translations.ts');
const CACHE = path.resolve(process.cwd(), 'scripts/.i18n-retrans-cache.json');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const MODEL = opt('--model', 'gpt-4o');
const BATCH = 25;
const DRY = flag('--dry');
const LIMIT = opt('--limit') ? Number(opt('--limit')) : Infinity;
const LANGS = (opt('--langs', 'wo,su,ff')).split(',');

const LANG_NAMES = { wo: 'Wolof', su: 'Susu (Soussou, spoken in Guinea)', ff: 'Pulaar/Fulani (Fula)', sw: 'Swahili' };

function loadKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  // Cherche dans plusieurs emplacements (backend séparé désormais voisin : ../backend/.env)
  for (const f of ['backend/.env', '../backend/.env', '.env', '.env.local']) {
    try {
      const env = fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
      const m = env.match(/^OPENAI_API_KEY=(.*)$/m);
      if (m && m[1].trim()) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch { /* fichier suivant */ }
  }
  throw new Error('OPENAI_API_KEY introuvable (cherché: env, backend/.env, ../backend/.env, .env)');
}
function parseTranslations(text) {
  const start = text.indexOf('{', text.indexOf('translations'));
  const endMarker = text.indexOf('export const supportedLanguages');
  const body = text.slice(start, text.lastIndexOf('}', endMarker) + 1);
  return eval('(' + body + ')'); // eslint-disable-line no-eval
}

async function translateBatch(key, lang, entries) {
  const langName = LANG_NAMES[lang] || lang;
  const payload = Object.fromEntries(entries);
  const sys = `You are a NATIVE ${langName} translator for a fintech/e-commerce mobile app (brand: 224Solutions, Guinea/West Africa). You translate French UI strings into ${langName}.\nCRITICAL: You MUST translate into ${langName}. NEVER leave the text in French. If a term has no common ${langName} word, use the most natural everyday ${langName} expression or a localized form — do NOT copy the French. Keep placeholders ({x}, {{x}}, %s, <b>..</b>), numbers, currencies and the brand "224Solutions" unchanged. Keep it short (UI tone). Return ONLY a JSON object mapping each input key to its ${langName} translation.`;
  const user = `Translate the VALUES of this JSON into ${langName}. Same keys.\n${JSON.stringify(payload)}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, temperature: 0.3, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function main() {
  const key = loadKey();
  let text = fs.readFileSync(FILE, 'utf8');
  const obj = parseTranslations(text);
  const fr = obj.fr;
  const frKeys = Object.keys(fr);
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};

  // mots à NE PAS retoucher (préservés volontairement)
  const keep = (v) => /^[\s\d.,:/+\-%()]*$/.test(v) || /224Solutions/.test(v);

  const updates = {}; // lang -> {key:newVal}
  for (const lang of LANGS) {
    if (!obj[lang]) { console.warn(`Langue ${lang} absente`); continue; }
    cache[lang] = cache[lang] || {};
    const untranslated = frKeys.filter((k) => k in obj[lang] && String(obj[lang][k]).trim() === String(fr[k]).trim() && !keep(String(fr[k])));
    const todo = untranslated.filter((k) => !(k in cache[lang])).slice(0, LIMIT);
    console.log(`\n[${lang}] ${LANG_NAMES[lang] || lang}: restées en FR=${untranslated.length}, à retraduire=${todo.length}, en cache=${untranslated.length - todo.length}`);
    for (let i = 0; i < todo.length; i += BATCH) {
      const slice = todo.slice(i, i + BATCH);
      try {
        const out = await translateBatch(key, lang, slice.map((k) => [k, fr[k]]));
        for (const k of slice) if (out[k]) cache[lang][k] = String(out[k]);
        process.stdout.write(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}\r`);
        fs.writeFileSync(CACHE, JSON.stringify(cache));
      } catch (e) { console.error(`\n  Lot ${i} échoué: ${e.message}`); }
    }
    updates[lang] = {};
    for (const k of untranslated) if (cache[lang][k] && cache[lang][k].trim() !== String(fr[k]).trim()) updates[lang][k] = cache[lang][k];
    console.log(`\n  à appliquer: ${Object.keys(updates[lang]).length}`);
  }

  if (DRY) { console.log('\n--dry: pas d écriture'); return; }

  // Remplacement en place, ligne par ligne, dans le bloc de chaque langue
  let lines = text.split(/\r?\n/);
  const blockRange = {}; // lang -> [start,end]
  let cur = null, startIdx = -1;
  lines.forEach((l, i) => {
    const bm = l.match(/^ {2}([A-Za-z][\w-]*): \{\s*$/);
    if (bm) { if (cur) blockRange[cur] = [startIdx, i - 1]; cur = bm[1]; startIdx = i; }
  });
  if (cur) blockRange[cur] = [startIdx, lines.length - 1];

  let applied = 0;
  for (const lang of Object.keys(updates)) {
    const [bs, be] = blockRange[lang] || [];
    if (bs == null) { console.warn(`Bloc ${lang} introuvable`); continue; }
    for (const [k, v] of Object.entries(updates[lang])) {
      const keyJson = JSON.stringify(k);
      for (let i = bs + 1; i <= be; i++) {
        if (lines[i].trimStart().startsWith(keyJson + ':')) {
          const indent = lines[i].match(/^\s*/)[0];
          lines[i] = `${indent}${keyJson}: ${JSON.stringify(v)},`;
          applied++; break;
        }
      }
    }
  }
  const newText = lines.join('\n');
  try { const test = parseTranslations(newText); if (Object.keys(test.fr).length !== frKeys.length) throw new Error('FR altéré'); }
  catch (e) { console.error('❌ Validation échouée, NON écrit:', e.message); process.exit(1); }
  fs.copyFileSync(FILE, FILE + '.bak3');
  fs.writeFileSync(FILE, newText);
  console.log(`\n✅ ${applied} valeurs re-traduites appliquées. Sauvegarde: translations.ts.bak3`);
}
main().catch((e) => { console.error(e); process.exit(1); });
