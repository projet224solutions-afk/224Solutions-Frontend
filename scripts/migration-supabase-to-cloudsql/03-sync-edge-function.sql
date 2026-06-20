-- ============================================================
-- 🔄 WEBHOOK DE SYNC: Supabase Auth → Cloud SQL
-- Quand un utilisateur s'inscrit/se connecte dans Supabase,
-- ses données sont synchronisées vers Cloud SQL via Edge Function
-- ============================================================

-- Ce fichier documente la logique.
-- L'implémentation se fait via la Edge Function 'cognito-sync-session'
-- qui est appelée après chaque login Supabase.

-- Flow:
-- 1. Utilisateur se connecte via Supabase Auth
-- 2. Le frontend appelle la Edge Function 'cognito-sync-session'
-- 3. La Edge Function envoie les données au backend AWS
-- 4. Le backend AWS insère/met à jour dans Cloud SQL

-- Voir: supabase/functions/cognito-sync-session/index.ts
-- Voir: backend/src/services/cognitoSync.service.js
