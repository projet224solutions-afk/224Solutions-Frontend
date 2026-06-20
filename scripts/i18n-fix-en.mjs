/**
 * Chantier 3 — retraduit les clés du bloc `en` dont la valeur est restée IDENTIQUE au français.
 * Traduit FR→EN via API Anthropic, puis remplace EN PLACE dans le bloc en (clés déjà présentes).
 * Résumable via scripts/.i18n-cache/en-fix.json. `--apply` pour injecter sans retraduire.
 */
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = process.cwd();
const TR_PATH = path.join(ROOT, 'src/i18n/translations.ts');
const CACHE = path.join(ROOT, 'scripts/.i18n-cache/en-fix.json');
const MODEL = process.env.MODEL || 'claude-haiku-4-5-20251001';
const BATCH = +(process.env.BATCH || 30);
const CONCURRENCY = +(process.env.CONCURRENCY || 4);

function loadKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  for (const f of ['backend/.env', '.env']) {
    try { const m = fs.readFileSync(path.join(ROOT, f), 'utf8').match(/^ANTHROPIC_API_KEY=(.*)$/m); if (m) return m[1].trim().replace(/^["']|["']$/g, ''); } catch { /* */ }
  }
  throw new Error('ANTHROPIC_API_KEY introuvable');
}
function blockOffsets(src, lang) {
  const re = /^ {2}([a-z]{2,3}): \{$/gm; let m; const idxs = [];
  while ((m = re.exec(src))) idxs.push({ lang: m[1], pos: m.index });
  const i = idxs.findIndex((x) => x.lang === lang);
  const start = idxs[i].pos; const end = i + 1 < idxs.length ? idxs[i + 1].pos : src.length;
  return { start, end };
}
function parseKeys(block) {
  const re = /"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)"/g; const o = {}; let mm;
  while ((mm = re.exec(block))) { try { o[JSON.parse('"' + mm[1] + '"')] = JSON.parse('"' + mm[2] + '"'); } catch { /* */ } }
  return o;
}
const hasLetter = (s) => /[A-Za-zÀ-ÿ]/.test(s);
const loadCache = () => { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return {}; } };
const saveCache = (o) => { fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(o)); };

const client = new Anthropic({ apiKey: loadKey() });
async function translateBatch(entries) {
  const obj = {}; for (const [k, v] of entries) obj[k] = v;
  const sys = `You are a professional UI localizer. Translate the JSON string VALUES from French to English. ` +
    `Keep JSON KEYS unchanged; preserve placeholders ({x}, {{x}}, %s, :var, <tag>), URLs, emojis, numbers, and ` +
    `brand/technical names (Stripe, AWS, GitHub, Supabase, service_role, RLS, JSON, PDF, KYC, PDG, 224Guard...). ` +
    `Keep trailing punctuation/colons. Return ONLY minified JSON.`;
  const msg = await client.messages.create({ model: MODEL, max_tokens: 8000, system: sys, messages: [{ role: 'user', content: JSON.stringify(obj) }] });
  let t = (msg.content.find((c) => c.type === 'text')?.text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}'); if (s >= 0 && e > s) t = t.slice(s, e + 1);
  return JSON.parse(t);
}
async function pool(tasks, worker) {
  let i = 0, done = 0;
  const run = async () => { while (i < tasks.length) { const c = i++; try { await worker(tasks[c]); } catch (e) { console.error('  err:', e.message); } if (++done % 5 === 0 || done === tasks.length) process.stdout.write(`\r  lots: ${done}/${tasks.length}  `); } };
  await Promise.all(Array.from({ length: CONCURRENCY }, run)); process.stdout.write('\n');
}

function targets() {
  const src = fs.readFileSync(TR_PATH, 'utf8');
  const fr = parseKeys(src.slice(...Object.values(blockOffsets(src, 'fr'))));
  const enOff = blockOffsets(src, 'en');
  const en = parseKeys(src.slice(enOff.start, enOff.end));
  const keys = Object.keys(en).filter((k) => fr[k] !== undefined && en[k] === fr[k] && hasLetter(fr[k]));
  return { src, fr, en, enOff, keys };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { src, fr, en, enOff, keys } = targets();
  console.log(`Cibles (en = fr, avec lettres) : ${keys.length}`);
  const cache = loadCache();
  if (!apply) {
    const todo = keys.filter((k) => cache[k] === undefined);
    console.log(`À traduire : ${todo.length} (cache: ${Object.keys(cache).length})`);
    const batches = []; for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
    let tick = 0;
    await pool(batches, async (ks) => { const out = await translateBatch(ks.map((k) => [k, fr[k]])); for (const k of ks) if (typeof out[k] === 'string') cache[k] = out[k]; if (++tick % 5 === 0) saveCache(cache); });
    saveCache(cache); console.log(`Cache: ${Object.keys(cache).length}. Lance --apply pour injecter.`);
    return;
  }
  // apply : remplace en place dans le bloc en
  let slice = src.slice(enOff.start, enOff.end);
  let n = 0;
  for (const k of keys) {
    const val = cache[k]; if (typeof val !== 'string' || val === en[k]) continue;
    const oldTok = `${JSON.stringify(k)}: ${JSON.stringify(en[k])}`;
    const newTok = `${JSON.stringify(k)}: ${JSON.stringify(val)}`;
    const at = slice.indexOf(oldTok);
    if (at < 0) continue;
    slice = slice.slice(0, at) + newTok + slice.slice(at + oldTok.length);
    n++;
  }
  const out = src.slice(0, enOff.start) + slice + src.slice(enOff.end);
  fs.writeFileSync(TR_PATH, out);
  console.log('Remplacées en place dans en : ' + n);
}
main().catch((e) => { console.error(e); process.exit(1); });
