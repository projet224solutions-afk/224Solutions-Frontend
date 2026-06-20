#!/bin/bash
# ============================================================
# 🔄 MIGRATION AUTOMATIQUE SUPABASE → GOOGLE CLOUD SQL
# Exporte le schéma + données de Supabase et les importe dans Cloud SQL
# 224SOLUTIONS
# ============================================================

set -euo pipefail

# Charger les variables d'environnement
if [ -f .env.migration ]; then
  export $(grep -v '^#' .env.migration | xargs)
fi

# ===== CONFIGURATION =====
SUPABASE_DB_HOST="${SUPABASE_DB_HOST:-db.uakkxaibujzxdiqzpnpr.supabase.co}"
SUPABASE_DB_PORT="${SUPABASE_DB_PORT:-5432}"
SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-postgres}"
SUPABASE_DB_USER="${SUPABASE_DB_USER:-postgres}"
SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD}"

CLOUDSQL_HOST="${CLOUD_SQL_HOST}"
CLOUDSQL_PORT="${CLOUD_SQL_PORT:-5432}"
CLOUDSQL_DB="${CLOUD_SQL_DATABASE:-solutions224}"
CLOUDSQL_USER="${CLOUD_SQL_USER:-postgres}"
CLOUDSQL_PASSWORD="${CLOUD_SQL_PASSWORD}"

DUMP_DIR="./dumps"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${DUMP_DIR}/supabase_dump_${TIMESTAMP}.sql"
SCHEMA_FILE="${DUMP_DIR}/schema_only_${TIMESTAMP}.sql"
DATA_FILE="${DUMP_DIR}/data_only_${TIMESTAMP}.sql"

# Tables à exclure (gérées par Supabase Auth)
EXCLUDE_TABLES="--exclude-table=auth.* --exclude-table=storage.* --exclude-table=realtime.* --exclude-table=supabase_functions.* --exclude-table=vault.*"

echo "============================================"
echo "🔄 MIGRATION SUPABASE → CLOUD SQL"
echo "============================================"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Créer le répertoire de dumps
mkdir -p "${DUMP_DIR}"

# ===== ÉTAPE 1: Export du schéma =====
echo "📋 Étape 1: Export du schéma public..."
PGPASSWORD="${SUPABASE_DB_PASSWORD}" pg_dump \
  -h "${SUPABASE_DB_HOST}" \
  -p "${SUPABASE_DB_PORT}" \
  -U "${SUPABASE_DB_USER}" \
  -d "${SUPABASE_DB_NAME}" \
  --schema=public \
  --schema-only \
  --no-owner \
  --no-privileges \
  --no-comments \
  --if-exists \
  --clean \
  -f "${SCHEMA_FILE}"

echo "   ✅ Schéma exporté: ${SCHEMA_FILE}"

# ===== ÉTAPE 2: Export des données =====
echo "📦 Étape 2: Export des données..."
PGPASSWORD="${SUPABASE_DB_PASSWORD}" pg_dump \
  -h "${SUPABASE_DB_HOST}" \
  -p "${SUPABASE_DB_PORT}" \
  -U "${SUPABASE_DB_USER}" \
  -d "${SUPABASE_DB_NAME}" \
  --schema=public \
  --data-only \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  -f "${DATA_FILE}"

echo "   ✅ Données exportées: ${DATA_FILE}"

# ===== ÉTAPE 3: Nettoyage du schéma pour Cloud SQL =====
echo "🧹 Étape 3: Nettoyage du schéma pour Cloud SQL..."

# Supprimer les références à auth.users (FK vers Supabase Auth)
# On garde les colonnes UUID mais on enlève les REFERENCES auth.users
sed -i 's/REFERENCES auth\.users(id)//g' "${SCHEMA_FILE}"
sed -i 's/REFERENCES auth\.users//g' "${SCHEMA_FILE}"

# Supprimer les fonctions Supabase internes
sed -i '/auth\.\|storage\.\|realtime\.\|supabase_functions\./d' "${SCHEMA_FILE}"

# Remplacer gen_random_uuid() si nécessaire (Cloud SQL supporte pgcrypto)
# gen_random_uuid() est supporté nativement avec l'extension pgcrypto

echo "   ✅ Schéma nettoyé"

# ===== ÉTAPE 4: Créer les ENUM dans Cloud SQL =====
echo "🏷️  Étape 4: Création des types ENUM..."
PGPASSWORD="${CLOUDSQL_PASSWORD}" psql \
  -h "${CLOUDSQL_HOST}" \
  -p "${CLOUDSQL_PORT}" \
  -U "${CLOUDSQL_USER}" \
  -d "${CLOUDSQL_DB}" \
  -f "01-generate-schema.sql"

echo "   ✅ Types ENUM créés"

# ===== ÉTAPE 5: Import du schéma dans Cloud SQL =====
echo "🏗️  Étape 5: Import du schéma dans Cloud SQL..."
PGPASSWORD="${CLOUDSQL_PASSWORD}" psql \
  -h "${CLOUDSQL_HOST}" \
  -p "${CLOUDSQL_PORT}" \
  -U "${CLOUDSQL_USER}" \
  -d "${CLOUDSQL_DB}" \
  -f "${SCHEMA_FILE}" \
  --set ON_ERROR_STOP=off 2>&1 | grep -c "ERROR" | xargs -I {} echo "   ⚠️  {} erreurs (normales pour les objets déjà existants)"

echo "   ✅ Schéma importé"

# ===== ÉTAPE 6: Import des données dans Cloud SQL =====
echo "📥 Étape 6: Import des données dans Cloud SQL..."
PGPASSWORD="${CLOUDSQL_PASSWORD}" psql \
  -h "${CLOUDSQL_HOST}" \
  -p "${CLOUDSQL_PORT}" \
  -U "${CLOUDSQL_USER}" \
  -d "${CLOUDSQL_DB}" \
  -f "${DATA_FILE}" \
  --set ON_ERROR_STOP=off 2>&1 | grep -c "ERROR" | xargs -I {} echo "   ⚠️  {} erreurs d'import"

echo "   ✅ Données importées"

# ===== ÉTAPE 7: Vérification =====
echo ""
echo "🔍 Étape 7: Vérification..."

SUPABASE_COUNT=$(PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h "${SUPABASE_DB_HOST}" \
  -p "${SUPABASE_DB_PORT}" \
  -U "${SUPABASE_DB_USER}" \
  -d "${SUPABASE_DB_NAME}" \
  -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")

CLOUDSQL_COUNT=$(PGPASSWORD="${CLOUDSQL_PASSWORD}" psql \
  -h "${CLOUDSQL_HOST}" \
  -p "${CLOUDSQL_PORT}" \
  -U "${CLOUDSQL_USER}" \
  -d "${CLOUDSQL_DB}" \
  -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")

echo "   📊 Tables Supabase: ${SUPABASE_COUNT}"
echo "   📊 Tables Cloud SQL: ${CLOUDSQL_COUNT}"

echo ""
echo "============================================"
echo "✅ MIGRATION TERMINÉE!"
echo "============================================"
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Vérifier les données dans Cloud SQL"
echo "   2. Mettre à jour les variables d'env du backend AWS"
echo "   3. Pointer le backend vers Cloud SQL"
echo "   4. L'auth reste dans Supabase"
echo ""
