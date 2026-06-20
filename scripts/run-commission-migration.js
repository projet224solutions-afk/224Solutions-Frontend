/**
 * Script pour exécuter la migration du système de commission
 * Utilise l'API SQL de Supabase Management
 * 
 * Usage: node scripts/run-commission-migration.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lire le fichier SQL
const sqlPath = path.join(__dirname, '../supabase/migrations/20260129190000_fix_agent_commission_unified.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('📋 Migration SQL chargée');
console.log('═'.repeat(60));
console.log('\n⚠️  Pour exécuter cette migration, vous devez:');
console.log('\n1. Ouvrir le Dashboard Supabase:');
console.log('   https://supabase.com/dashboard/project/uakkxaibujzxdiqzpnpr/sql/new');
console.log('\n2. Copier et coller le SQL ci-dessous dans l\'éditeur SQL');
console.log('\n3. Cliquer sur "Run" pour exécuter\n');
console.log('═'.repeat(60));
console.log('\n--- DÉBUT DU SQL À COPIER ---\n');
console.log(sql);
console.log('\n--- FIN DU SQL À COPIER ---\n');
console.log('═'.repeat(60));
console.log('\n✅ Une fois exécuté, le système de commission sera unifié!');
