#!/usr/bin/env node
/**
 * 🛡️ GARDE PRÉ-DÉPLOIEMENT — scan de secrets frontend
 *
 * Scanne le code source (src/) ET le build (dist/ s'il existe) à la recherche de
 * secrets DANGEREUX qui ne doivent JAMAIS être livrés côté client. Sort en code 1
 * si un secret est trouvé → bloque le déploiement.
 *
 * Usage :  node scripts/scan-frontend-secrets.mjs   (ou  npm run scan:secrets)
 * Ignore les valeurs PUBLIQUES légitimes (anon key role:anon, clés publishable, config Firebase).
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['src', 'dist'];
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.html', '.css', '.env']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel', 'coverage']);

const DANGEROUS = [
  { key: 'private_key', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/, label: 'Clé privée' },
  { key: 'stripe_secret', re: /\b(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{16,}/, label: 'Clé secrète Stripe' },
  { key: 'aws_access_key', re: /\bAKIA[0-9A-Z]{16}\b/, label: 'Clé AWS' },
  { key: 'gcp_service_account', re: /"type"\s*:\s*"service_account"/, label: 'Compte de service GCP' },
  { key: 'github_token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{36}\b|\bgithub_pat_[0-9A-Za-z_]{22,}\b/, label: 'Token GitHub' },
  { key: 'slack_token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/, label: 'Token Slack' },
  { key: 'generic_server_secret', re: /(?:SERVICE_ROLE_KEY|JWT_SECRET|SECRET_ACCESS_KEY|DB_PASSWORD|SUPABASE_SERVICE_ROLE)["'`]?\s*[:=]\s*["'`][^"'`\s]{12,}/, label: 'Secret serveur en dur' },
];

// Lignes à ignorer (faux positifs connus : noms de variables, docs, validateurs de sécurité).
const IGNORE_LINE = /import\.meta\.env|process\.env|\.example|sk_test_\.\.\.|placeholder|example|envValidator|récupérez votre clé/i;

function countServiceRoleJwt(text) {
  let n = 0;
  const re = /eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{8,}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    try {
      const p = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
      if (p?.role === 'service_role') n++;
    } catch { /* ignore */ }
  }
  return n;
}

const findings = [];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) { walk(full); continue; }
    if (!EXT.has(extname(name)) && extname(name) !== '') continue;
    let content;
    try { content = readFileSync(full, 'utf8'); } catch { continue; }

    const lines = content.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (IGNORE_LINE.test(line)) return;
      for (const d of DANGEROUS) {
        if (d.re.test(line)) findings.push({ file: full, line: i + 1, label: d.label, snippet: line.trim().slice(0, 120) });
      }
    });
    const sr = countServiceRoleJwt(content);
    if (sr > 0) findings.push({ file: full, line: '?', label: 'Clé service_role Supabase (JWT)', snippet: `${sr} occurrence(s)` });
  }
}

for (const root of ROOTS) {
  if (existsSync(root)) walk(root);
}

if (findings.length === 0) {
  console.log('✅ Scan secrets frontend : aucun secret dangereux détecté (src/ + dist/).');
  process.exit(0);
}

console.error(`\n❌ ${findings.length} SECRET(S) DANGEREUX DÉTECTÉ(S) — déploiement à BLOQUER :\n`);
for (const f of findings) {
  console.error(`  • [${f.label}] ${f.file}:${f.line}`);
  console.error(`      ${f.snippet}`);
}
console.error('\nRetire ces secrets du frontend, révoque/régénère-les côté fournisseur, et place-les dans le backend.\n');
process.exit(1);
