# 🔄 Migration Supabase → Google Cloud SQL

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│   Frontend      │     │    Supabase       │     │  Google Cloud  │
│   React/Vite    │────▶│  (Auth + RLS)     │────▶│   SQL (Data)   │
│                 │     │  Source de vérité  │     │  Via AWS ECS   │
│                 │     │  pour l'Auth       │     │                │
└─────────────────┘     └──────────────────┘     └────────────────┘
         │                       │                       ▲
         │                       │   Edge Function       │
         │                       │   sync-to-cloudsql    │
         │                       └───────────────────────┘
         │                                               │
         └───────────────────────────────────────────────┘
                        Backend AWS (ECS/Lambda)
                        Routes: /api/cloudsql/*
```

## Stratégie: Migration unique + bascule

1. **Auth reste dans Supabase** - Pas de migration de l'authentification
2. **Données métier** → Cloud SQL via migration pg_dump
3. **Sync continue** → Edge Function `sync-to-cloudsql` pour les nouvelles données
4. **Backend AWS** lit/écrit dans Cloud SQL

## Prérequis

- Instance Google Cloud SQL PostgreSQL 15+
- Accès `pg_dump` au Supabase DB (mot de passe DB dans les settings Supabase)
- Variables d'env configurées (voir `.env.migration.example`)

## Étapes de migration

### 1. Configurer les variables d'environnement

```bash
cp .env.migration.example .env.migration
# Remplir les valeurs
```

### 2. Créer les types ENUM dans Cloud SQL

```bash
psql -h <CLOUD_SQL_HOST> -U postgres -d solutions224 -f 01-generate-schema.sql
```

### 3. Créer la table users pour Cloud SQL

```bash
psql -h <CLOUD_SQL_HOST> -U postgres -d solutions224 -f 02-create-users-table.sql
```

### 4. Lancer la migration complète

```bash
chmod +x migrate.sh
./migrate.sh
```

### 5. Vérifier la migration

```sql
-- Dans Cloud SQL
SELECT count(*) FROM information_schema.tables WHERE table_schema='public';
-- Devrait afficher ~446 tables

SELECT count(*) FROM users;
-- Devrait correspondre au nombre d'utilisateurs Supabase
```

### 6. Configurer le backend AWS

Variables d'environnement requises:
```
CLOUD_SQL_HOST=<votre-instance>.cloudsql.com
CLOUD_SQL_PORT=5432
CLOUD_SQL_DATABASE=solutions224
CLOUD_SQL_USER=postgres
CLOUD_SQL_PASSWORD=<mot-de-passe>
CLOUD_SQL_SYNC_API_KEY=<clé-api-random>
```

### 7. Activer la sync continue

La Edge Function `sync-to-cloudsql` synchronise automatiquement:
- Nouveaux utilisateurs
- Commandes
- Transactions wallet
- Sync complète à la demande

## Tables critiques synchronisées

| Table Supabase | Table Cloud SQL | Sync |
|---|---|---|
| profiles | users | Temps réel |
| orders | orders | Temps réel |
| wallets | wallets_cloud | Temps réel |
| products | products_cloud | Périodique |
| vendors | vendors_cloud | Périodique |
| agents_management | agents_management_cloud | Périodique |

## Sécurité

- La clé `CLOUD_SQL_SYNC_API_KEY` protège les endpoints de sync
- SSL obligatoire en production
- Pas de données auth dans Cloud SQL (seulement les profils)
