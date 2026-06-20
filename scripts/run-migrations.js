#!/usr/bin/env node
/**
 * Script de migration Supabase via Management API
 * 
 * Prérequis : définir la variable d'environnement SUPABASE_ACCESS_TOKEN
 * (Personal Access Token depuis https://app.supabase.com/account/tokens)
 * 
 * Usage :
 *   $env:SUPABASE_ACCESS_TOKEN = "sbp_xxxxxxxxxxxx"
 *   node scripts/run-migrations.js
 * 
 * Ou pour une migration spécifique :
 *   node scripts/run-migrations.js supabase/migrations/20260330_ma_migration.sql
 */

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_REF = 'uakkxaibujzxdiqzpnpr';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const APPLIED_CACHE = path.join(__dirname, '..', 'supabase', '.applied-migrations.json');

if (!ACCESS_TOKEN) {
  console.error('\n❌ Variable SUPABASE_ACCESS_TOKEN non définie.');
  console.error('\nDéfinis-la avec :');
  console.error('  $env:SUPABASE_ACCESS_TOKEN = "sbp_ton_personal_access_token"');
  console.error('\nObtiens un Personal Access Token sur :');
  console.error('  https://app.supabase.com/account/tokens\n');
  process.exit(1);
}

/**
 * Exécute une requête SQL via l'API Management Supabase
 */
function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: JSON.parse(data) });
        } else {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = { message: data }; }
          reject(new Error(`HTTP ${res.statusCode}: ${parsed.message || data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Charge la liste des migrations déjà appliquées (cache local)
 */
function loadAppliedMigrations() {
  if (fs.existsSync(APPLIED_CACHE)) {
    try {
      return new Set(JSON.parse(fs.readFileSync(APPLIED_CACHE, 'utf8')));
    } catch {
      return new Set();
    }
  }
  return new Set();
}

/**
 * Sauvegarde la liste des migrations appliquées
 */
function saveAppliedMigrations(applied) {
  fs.writeFileSync(APPLIED_CACHE, JSON.stringify([...applied], null, 2), 'utf8');
}

async function main() {
  const specificFile = process.argv[2];

  // Mode : fichier spécifique
  if (specificFile) {
    const filePath = path.isAbsolute(specificFile)
      ? specificFile
      : path.join(process.cwd(), specificFile);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Fichier introuvable : ${filePath}`);
      process.exit(1);
    }

    console.log(`\n🔄 Application de la migration : ${path.basename(filePath)}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await executeSQL(sql);
      console.log(`✅ Migration appliquée avec succès !`);
    } catch (err) {
      console.error(`❌ Erreur : ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // Mode : toutes les migrations en attente
  const applied = loadAppliedMigrations();

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && !f.endsWith('.DISABLED'))
    .sort();

  const pending = files.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('\n✅ Aucune migration en attente — base de données à jour.\n');
    return;
  }

  console.log(`\n📋 ${pending.length} migration(s) en attente :\n`);
  pending.forEach(f => console.log(`   - ${f}`));
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  for (const file of pending) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    process.stdout.write(`⏳ ${file} ... `);
    try {
      await executeSQL(sql);
      applied.add(file);
      saveAppliedMigrations(applied);
      console.log('✅');
      successCount++;
    } catch (err) {
      console.log(`❌ ERREUR`);
      console.error(`   └─ ${err.message}\n`);
      errorCount++;
      // Continue avec les suivantes
    }
  }

  console.log(`\n📊 Résumé : ${successCount} réussies, ${errorCount} erreur(s)\n`);
  if (errorCount > 0) process.exit(1);
}

main().catch(err => {
  console.error('Erreur fatale:', err.message);
  process.exit(1);
});
