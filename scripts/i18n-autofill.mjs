/**
 * i18n-autofill — complète les clés MANQUANTES des langues faibles dans src/i18n/translations.ts
 * en traduisant depuis le français via l'API Anthropic (Claude).
 *
 * Phases :
 *   (défaut)  traduit les clés manquantes → cache scripts/.i18n-cache/<lang>.json (résumable)
 *   --apply   injecte les caches dans translations.ts (une passe, 1 insertion par langue)
 *
 * Garde-fous : préserve placeholders ({x},{{x}},%s,:var,<tag>), marques/termes techniques,
 * emojis, URLs ; ne traduit JAMAIS les clés ; saute les valeurs sans lettre (copie telle quelle).
 *
 * Env : ANTHROPIC_API_KEY (lue depuis backend/.env), MODEL (déf. claude-haiku-4-5-20251001),
 *       LANGS (csv pour restreindre), BATCH (déf. 40), CONCURRENCY (déf. 4).
 */
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = process.cwd();
const TR_PATH = path.join(ROOT, 'src/i18n/translations.ts');
const CACHE_DIR = path.join(ROOT, 'scripts/.i18n-cache');
const MODEL = process.env.MODEL || 'claude-haiku-4-5-20251001';
const BATCH = +(process.env.BATCH || 40);
const CONCURRENCY = +(process.env.CONCURRENCY || 4);

const LANG_NAMES = {
  en: 'English', es: 'Spanish', pt: 'Portuguese', ar: 'Arabic', zh: 'Simplified Chinese',
  ru: 'Russian', de: 'German', it: 'Italian', ja: 'Japanese', ko: 'Korean', hi: 'Hindi',
  tr: 'Turkish', nl: 'Dutch', pl: 'Polish', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
  sw: 'Swahili', uk: 'Ukrainian', he: 'Hebrew', fa: 'Persian (Farsi)', bn: 'Bengali',
  wo: 'Wolof', ff: 'Fula (Fulfulde)', su: 'Sundanese',
};

// ---- Chargement clé API depuis backend/.env (sans dotenv) ----
function loadKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  for (const f of ['backend/.env', '../backend/.env', '.env', 'backend/.env.local', '.env.local']) {
    try {
      const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const m = txt.match(/^ANTHROPIC_API_KEY=(.*)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch { /* skip */ }
  }
  throw new Error('ANTHROPIC_API_KEY introuvable');
}

// ---- Parse translations.ts en blocs langue ----
function readBlocks() {
  const src = fs.readFileSync(TR_PATH, 'utf8');
  const re = /^ {2}([a-z]{2,3}): \{$/gm;
  let m; const idxs = [];
  while ((m = re.exec(src))) idxs.push({ lang: m[1], pos: m.index });
  const blocks = {};
  for (let i = 0; i < idxs.length; i++) {
    const end = i + 1 < idxs.length ? idxs[i + 1].pos : src.length;
    blocks[idxs[i].lang] = src.slice(idxs[i].pos, end);
  }
  return { src, blocks };
}
function parseKeys(block) {
  const re = /"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)"/g;
  const o = {}; let mm;
  while ((mm = re.exec(block))) {
    try { o[JSON.parse('"' + mm[1] + '"')] = JSON.parse('"' + mm[2] + '"'); } catch { /* skip */ }
  }
  return o;
}
const hasLetter = (s) => /[A-Za-zÀ-ÿͰ-῿぀-퟿]/.test(s);

function loadCache(lang) {
  try { return JSON.parse(fs.readFileSync(path.join(CACHE_DIR, lang + '.json'), 'utf8')); } catch { return {}; }
}
function saveCache(lang, obj) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, lang + '.json'), JSON.stringify(obj, null, 0));
}

const client = new Anthropic({ apiKey: loadKey() });

async function translateBatch(langName, entries) {
  const obj = {}; for (const [k, v] of entries) obj[k] = v;
  const sys = `You are a professional UI localizer. Translate the JSON string VALUES from French to ${langName}. ` +
    `Rules: keep the JSON KEYS unchanged; preserve placeholders ({x}, {{x}}, %s, :var, <tag>...</tag>), URLs, emojis, ` +
    `numbers, and brand/technical names (Stripe, AWS, GitHub, Twilio, Firebase, Mapbox, Redis, Supabase, service_role, ` +
    `RLS, PEM, JSON, SID, API, PDF, KYC, OTP, QR, PDG, 224Guard, etc.) exactly as-is. Keep trailing punctuation/colons. ` +
    `Return ONLY a valid minified JSON object, no markdown, no commentary.`;
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 8000, system: sys,
    messages: [{ role: 'user', content: JSON.stringify(obj) }],
  });
  let txt = (msg.content.find((c) => c.type === 'text')?.text || '').trim();
  txt = txt.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = txt.indexOf('{'), endp = txt.lastIndexOf('}');
  if (start >= 0 && endp > start) txt = txt.slice(start, endp + 1);
  return JSON.parse(txt);
}

async function runPool(tasks, worker) {
  let i = 0, done = 0;
  async function next() {
    while (i < tasks.length) {
      const cur = i++;
      try { await worker(tasks[cur], cur); } catch (e) { console.error('  batch err:', e.message); }
      done++;
      if (done % 10 === 0 || done === tasks.length) process.stdout.write(`\r    lots: ${done}/${tasks.length}   `);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, next));
  process.stdout.write('\n');
}

async function translatePhase() {
  const { blocks } = readBlocks();
  const fr = parseKeys(blocks.fr);
  const frKeys = Object.keys(fr);
  const only = (process.env.LANGS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const targets = Object.keys(blocks).filter((l) => l !== 'fr')
    .filter((l) => !only.length || only.includes(l));

  for (const lang of targets) {
    const have = parseKeys(blocks[lang]);
    const cache = loadCache(lang);
    // clés manquantes (absentes du bloc ET pas déjà en cache)
    let missing = frKeys.filter((k) => have[k] === undefined && cache[k] === undefined);
    // valeurs sans lettre = copie directe (gratuit)
    const copyable = missing.filter((k) => !hasLetter(fr[k]));
    for (const k of copyable) cache[k] = fr[k];
    missing = missing.filter((k) => hasLetter(fr[k]));
    if (!missing.length) { saveCache(lang, cache); console.log(`${lang} (${LANG_NAMES[lang] || lang}) : déjà complet (${Object.keys(cache).length} en cache)`); continue; }
    console.log(`${lang} (${LANG_NAMES[lang] || lang}) : ${missing.length} à traduire (+${copyable.length} copies)`);
    const batches = [];
    for (let i = 0; i < missing.length; i += BATCH) batches.push(missing.slice(i, i + BATCH));
    let saveTick = 0;
    await runPool(batches, async (keys) => {
      const out = await translateBatch(LANG_NAMES[lang] || lang, keys.map((k) => [k, fr[k]]));
      for (const k of keys) if (typeof out[k] === 'string') cache[k] = out[k];
      if (++saveTick % 5 === 0) saveCache(lang, cache);
    });
    saveCache(lang, cache);
    console.log(`  ✓ ${lang} : ${Object.keys(cache).length} clés en cache`);
  }
  console.log('\nPhase traduction terminée. Lance `node scripts/i18n-autofill.mjs --apply` pour injecter.');
}

function applyPhase() {
  let { src, blocks } = readBlocks();
  const fr = parseKeys(blocks.fr);
  const only = (process.env.LANGS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const targets = Object.keys(blocks).filter((l) => l !== 'fr').filter((l) => !only.length || only.includes(l));
  let totalIns = 0;
  for (const lang of targets) {
    const cache = loadCache(lang);
    const have = parseKeys(blocks[lang]);
    const toIns = Object.keys(cache).filter((k) => have[k] === undefined && fr[k] !== undefined);
    if (!toIns.length) continue;
    const lines = toIns.map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(cache[k])},`).join('\n');
    const anchor = `  ${lang}: {\n`;
    const at = src.indexOf(anchor);
    if (at < 0) { console.error(`  ancre introuvable pour ${lang}`); continue; }
    src = src.slice(0, at + anchor.length) + lines + '\n' + src.slice(at + anchor.length);
    totalIns += toIns.length;
    console.log(`${lang} : +${toIns.length} clés injectées`);
    // re-parse blocks offsets after mutation
    ({ blocks } = (() => { const b = {}; const re = /^ {2}([a-z]{2,3}): \{$/gm; let m; const idxs = []; while ((m = re.exec(src))) idxs.push({ lang: m[1], pos: m.index }); for (let i = 0; i < idxs.length; i++) { const e = i + 1 < idxs.length ? idxs[i + 1].pos : src.length; b[idxs[i].lang] = src.slice(idxs[i].pos, e); } return { blocks: b }; })());
  }
  fs.writeFileSync(TR_PATH, src);
  console.log(`\nApplied. Total inséré : ${totalIns} clés.`);
}

if (process.argv.includes('--apply')) applyPhase();
else translatePhase().catch((e) => { console.error(e); process.exit(1); });
