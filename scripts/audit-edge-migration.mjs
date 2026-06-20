#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const root = process.cwd();
const supabaseFunctionsDir = path.join(root, 'supabase', 'functions');
const backendEdgeRoutesDir = path.join(root, 'backend', 'src', 'routes', 'edge-functions');
const reportMdPath = path.join(root, 'EDGE_FUNCTIONS_MIGRATION_REPORT.md');
const outputPath = path.join(root, 'docs', 'EDGE_MIGRATION_GAP_REPORT.md');
const decommissionedPath = path.join(root, 'scripts', 'config', 'decommissioned-edge-functions.json');

const strict = process.argv.includes('--strict');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function getSupabaseFunctionDirs() {
  if (!fs.existsSync(supabaseFunctionsDir)) return [];

  return fs
    .readdirSync(supabaseFunctionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== '_shared')
    .sort();
}

function getDecommissionedFunctions() {
  try {
    const data = JSON.parse(readFileSafe(decommissionedPath));
    if (!Array.isArray(data?.functions)) return new Set();
    return new Set(data.functions.map((fn) => normalizeName(String(fn))));
  } catch {
    return new Set();
  }
}

function getBackendEdgeRouteContents() {
  if (!fs.existsSync(backendEdgeRoutesDir)) return '';

  const files = fs
    .readdirSync(backendEdgeRoutesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ts$/i.test(entry.name))
    .map((entry) => path.join(backendEdgeRoutesDir, entry.name));

  return files.map((f) => readFileSafe(f)).join('\n\n').toLowerCase();
}

function parseFunctionNamesFromMigrationReport() {
  const content = readFileSafe(reportMdPath);
  if (!content) return [];

  const names = new Set();
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    // Capture only first table cell in lines like:
    // | `function-name` | `/path` | POST | ...
    const match = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (!match) continue;

    const fn = match[1].trim();
    if (fn) {
      names.add(fn);
    }
  }

  return Array.from(names).sort();
}

function normalizeName(name) {
  return name.toLowerCase().trim();
}

function buildCandidateTokens(name) {
  const n = normalizeName(name);
  return [
    n,
    n.replace(/-/g, '_'),
    n.replace(/-/g, ''),
    n.replace(/-/g, '/'),
  ];
}

function hasHeuristicMatch(name, backendContent) {
  const candidates = buildCandidateTokens(name);
  return candidates.some((token) => backendContent.includes(token));
}

function generateGapReport() {
  const supabaseDirs = getSupabaseFunctionDirs();
  const backendContent = getBackendEdgeRouteContents();
  const reportFunctions = parseFunctionNamesFromMigrationReport();
  const decommissioned = getDecommissionedFunctions();

  const sourceUniverseBase = reportFunctions.length > 0 ? reportFunctions : supabaseDirs;
  const sourceUniverse = sourceUniverseBase.filter((fn) => !decommissioned.has(normalizeName(fn)));

  const covered = [];
  const missing = [];

  for (const fnName of sourceUniverse) {
    if (hasHeuristicMatch(fnName, backendContent)) {
      covered.push(fnName);
    } else {
      missing.push(fnName);
    }
  }

  const now = new Date().toISOString();
  const lines = [
    '# EDGE Migration Gap Report',
    '',
    `Generated at: ${now}`,
    '',
    '## Summary',
    '',
    `- Source functions scanned: ${sourceUniverse.length}`,
    `- Heuristically covered in backend routes: ${covered.length}`,
    `- Potentially missing migrations: ${missing.length}`,
    '',
    '## Notes',
    '',
    '- This report is heuristic and may include false positives.',
    '- A function can be migrated under a renamed endpoint grouped by domain route.',
    '- Decommissioned functions are excluded from the parity check.',
    '- Use this list as migration backlog, then validate endpoint behavior manually.',
    '',
    '## Potentially Missing (Top 200)',
    '',
  ];

  if (missing.length === 0) {
    lines.push('No potential gaps detected by heuristic check.');
  } else {
    for (const item of missing.slice(0, 200)) {
      lines.push(`- ${item}`);
    }
  }

  lines.push('', '## Heuristically Covered (Top 200)', '');

  if (covered.length === 0) {
    lines.push('No covered functions detected.');
  } else {
    for (const item of covered.slice(0, 200)) {
      lines.push(`- ${item}`);
    }
  }

  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Wrote gap report to ${path.relative(root, outputPath)}`);
  console.log(`Scanned: ${sourceUniverse.length} | Covered: ${covered.length} | Missing: ${missing.length}`);

  if (strict && missing.length > 0) {
    console.error('Strict mode enabled: potential migration gaps detected.');
    process.exit(1);
  }
}

generateGapReport();
