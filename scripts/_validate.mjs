import { transformSync } from 'esbuild';
import fs from 'fs'; import path from 'path';
const dir = process.argv[2] || 'src/components/vendor';
function walk(d, a) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, a); else if (e.name.endsWith('.tsx')) a.push(p); } return a; }
const files = walk(dir, []);
const broken = [];
for (const f of files) {
  try { transformSync(fs.readFileSync(f, 'utf8'), { loader: 'tsx', jsx: 'automatic' }); }
  catch (e) { const loc = e.errors?.[0]?.location; broken.push(`${f.split(path.sep).join('/')}:${loc?.line || '?'} :: ${(e.errors?.[0]?.text || e.message).slice(0, 90)}`); }
}
console.log('Fichiers cassés:', broken.length);
broken.forEach(b => console.log('  X', b));
