# Exécution des Migrations Supabase

La création d'agent PDG ne fonctionne pas car la migration `type_agent` n'a pas été appliquée à la base de données.

## 3 Façons d'appliquer la migration:

### Option 1: Via Node.js Script (Recommandé - Local)

```bash
# Définir les variables d'environnement
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"

# Exécuter la migration
npm run migrate:type-agent
```

**Avantages:** 
- Pas besoin de backend en cours d'exécution
- Exécution immédiate depuis votre machine

---

### Option 2: Via API Backend (Recommandé - Production)

**D'abord, assurez-vous que le backend est en cours d'exécution:**

```bash
npm run dev:backend
```

**Puis, dans un autre terminal:**

```bash
# Vérifier le statut
npm run api:migrate-status

# Appliquer la migration
npm run api:migrate
```

**Ou avec curl manuellement:**

```bash
# Statut
curl http://localhost:3001/api/migrations/status

# Appliquer la migration
curl -X POST http://localhost:3001/api/migrations/apply-type-agent
```

**Avantages:**
- Centralisé dans l'API backend
- Peut être déclenché via interface d'administration
- Logs consolidés dans le backend

---

### Option 3: Manuelle dans Supabase Studio (Rapide)

1. Ouvrez [Supabase Studio](https://app.supabase.com)
2. Sélectionnez votre projet
3. Allez à **SQL Editor**
4. Créez une nouvelle requête
5. Collez le SQL ci-dessous:

```sql
-- Ajouter la colonne type_agent à agents_management
ALTER TABLE public.agents_management
ADD COLUMN IF NOT EXISTS type_agent TEXT DEFAULT 'principal';

-- Mettre à jour les agents existants
UPDATE public.agents_management
SET type_agent = 'principal'
WHERE type_agent IS NULL;

-- Recréer la contrainte CHECK
ALTER TABLE public.agents_management
DROP CONSTRAINT IF EXISTS agents_management_type_agent_check;

ALTER TABLE public.agents_management
ADD CONSTRAINT agents_management_type_agent_check
CHECK (type_agent IN ('principal', 'sous_agent', 'agent_regional', 'agent_local'));
```

6. Cliquez sur **Run** ou `Ctrl+Enter`
7. Attendez confirmation: "Success. No rows returned"

---

## Vérifier que c'est appliqué

Après l'une des 3 options ci-dessus, vérifiez:

```bash
# Option 1: Via API
npm run api:migrate-status

# Option 2: Via Supabase Studio
# Allez à Tables > agents_management
# Cherchez la colonne "type_agent" dans la liste des colonnes
```

## Après la migration

Une fois appliquée, **la création d'agent PDG devrait fonctionner normalement** ✅

Si toujours pas de succès:
1. Actualisez la page du navigateur (`Ctrl+F5`)
2. Vérifiez les erreurs dans la console du navigateur (F12)
3. Vérifiez les logs du backend: `npm run dev:backend`

---

## Configuration requise

**.env.local:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**.env (backend):**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```
