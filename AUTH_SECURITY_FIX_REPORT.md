# RAPPORT CORRECTIONS SÉCURITÉ AUTH
Date : 2026-06-23
Périmètre : `src/hooks/useAuth.tsx`, `src/utils/postAuthRoute.ts`, migrations Supabase

## Corrections appliquées

### CRITIQUE 1 — CVV / carte virtuelle côté serveur ✅
- Supprimé `Math.random()` côté client dans `useAuth.tsx` (bloc carte virtuelle).
- Appel via RPC `create_virtual_card_secure(p_user_id, p_holder_name)`.
- Migration `supabase/migrations/20260623000001_secure_virtual_card.sql`.
- **Durcissement ajouté (hors prompt)** : la fonction étant `SECURITY DEFINER`
  accordée à `authenticated`, j'ai ajouté un contrôle d'autorisation
  `p_user_id = auth.uid()` (ou admin/pdg/ceo). Sans lui, n'importe quel
  utilisateur authentifié aurait pu créer une carte **pour autrui**.
- `REVOKE FROM PUBLIC/anon` + `GRANT EXECUTE TO authenticated`. Idempotent.

### CRITIQUE 2 — Anti-élévation de rôle ✅ (approche corrigée)
- Migration `supabase/migrations/20260623000002_profiles_role_escalation_guard.sql`.
- **Déviation volontaire** : la policy proposée était **vulnérable**.
  - `profiles_update_admin` avec `WITH CHECK (true)` est combinée en **OR** avec
    la policy utilisateur → le `true` **annule** la protection : un client aurait
    pu se mettre `role='admin'`.
  - Une `WITH CHECK` ne voit que la nouvelle ligne → impossible de distinguer
    « garder son rôle » de « s'élever » → un `actionnaire`/admin légitime n'aurait
    plus pu modifier son propre profil.
- Solution retenue : **trigger `BEFORE UPDATE`** `prevent_role_self_escalation()`
  comparant `OLD.role`/`NEW.role` :
  - rôle inchangé → autorisé ;
  - backend `service_role` (`auth.uid()` NULL) → autorisé ;
  - appelant admin/pdg/ceo → autorisé ;
  - non-admin → `NEW.role ∈ {admin,pdg,ceo,actionnaire}` → **REFUSÉ** ;
  - non-admin → rôle non privilégié (ex. OAuth `client→vendeur`) → autorisé.
- Additif : les policies existantes ne sont pas touchées (aucun risque de lockout).

### CRITIQUE 3 — Routes prestataire ✅
Dans `PROTECTED_ROUTE_RULES` :
- `/dashboard/service` → `['prestataire', 'admin']`
- `/service-selection` → `['prestataire', 'admin']`
- `/client/dashboard`  → `['client', 'admin']`

### ÉLEVÉ 1 — TTL cache profil 30 minutes ✅
- Helpers `writeProfileCache` / `readProfileCache` (enveloppe `{ data, cachedAt }`,
  compat ancien format).
- Toutes les écritures du cache passent par `writeProfileCache`.
- **Nuance ajoutée** : le TTL purge le cache uniquement sur les chemins EN LIGNE
  (timeout). Les chemins **offline** et **erreur réseau** lisent avec
  `ignoreTtl: true` — sinon on déconnecterait un utilisateur hors-ligne de son
  propre profil (régression). Le repli minimal préfère aussi le cache réel périmé
  plutôt qu'un `client` deviné.

### ÉLEVÉ 2 — `await createVendorForOAuth` ✅
- 2 occurrences `void` → `await`. Les erreurs vendor ne sont plus silencieuses ;
  la ligne `vendors` existe avant la redirection vers `/vendeur`.

### ÉLEVÉ 3 — Flag `setup_done` (sessionStorage) ✅
- `ensureUserSetup` retourne tôt si `setup_done_<uid>` est positionné → évite 3
  SELECT Supabase par chargement. Flag posé quand le setup est confirmé complet
  (ou vient d'être complété). `sessionStorage` → re-vérifié au moins 1×/session.

### ÉLEVÉ 4 — Cas mort `vendeur_digital` ✅
- Ligne morte retirée de `resolvePostAuthRouteSync` (ce n'est pas un rôle
  `Profile` ; le digital est résolu via `vendors.business_type` côté async).

## Vérifications
- `npx tsc --noEmit` : **0 erreur** sur l'ensemble du projet.
- Greps de contrôle : conformes (voir prompt).

## ⚠️ À APPLIQUER MANUELLEMENT (déploiement)
Ce dépôt **frontend ne contient pas** de dossier `supabase/migrations` actif
(les migrations vivent côté Supabase/backend). J'ai créé les 2 fichiers SQL dans
`supabase/migrations/` mais **ils ne sont PAS encore appliqués**.

> **IMPORTANT** : tant que `create_virtual_card_secure` n'est pas appliquée en DB,
> la création de carte virtuelle échoue silencieusement (log d'erreur, non
> bloquant). Appliquer les migrations **avant** de déployer le frontend.

Application (sur demande explicite — non lancée automatiquement) :
```bash
supabase db push     # ou exécuter les 2 .sql via l'éditeur SQL Supabase
```
