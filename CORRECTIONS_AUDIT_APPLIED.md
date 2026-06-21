# CORRECTIONS AUDIT SÉCURITÉ — APPLIQUÉES
Date : 2026-06-21
Repo : 224Solutions-Frontend

## Résumé
| # | Fichier | Type | Statut |
|---|---------|------|--------|
| 1 | capacitor.config.ts | CRITIQUE | ✅ Appliqué |
| 2 | nginx/224solutions.conf | CRITIQUE | ✅ Créé |
| 3 | src/integrations/supabase/client.ts | ATTENTION | ✅ Appliqué |
| 4A | src/main.tsx | ATTENTION | ✅ Appliqué |
| 4B | src/hooks/useAuth.tsx | ATTENTION | ✅ Appliqué |
| 4C | src/services/HealthCheckService.ts | ATTENTION | ✅ Appliqué |
| 4D | vercel.json | ATTENTION | ✅ Appliqué |
| 4E | netlify.toml | ATTENTION | ✅ Appliqué |
| 5 | .env.example | ATTENTION | ✅ Appliqué |
| 6 | .npmrc | INFO | ✅ Appliqué |

## Détail des changements

### 1. capacitor.config.ts (CRITIQUE)
HTTP en clair désactivé pour les builds mobiles de production.
```diff
   server: {
     // URL du sandbox pour hot-reload en développement (commenter en production)
     // url: 'https://a00e0cf7-bf68-445f-848b-f2c774cf80ce.lovableproject.com?forceHideBadge=true',
-    cleartext: true
+    // ⚠️ PRODUCTION : cleartext désactivé — toutes les communications doivent être HTTPS.
+    // Pour le développement local uniquement, remettre temporairement à true.
+    cleartext: false,
   },
   android: {
-    // Permet les liens HTTP non sécurisés en dev
-    allowMixedContent: true,
+    // ⚠️ PRODUCTION : mixedContent désactivé — ne jamais servir de contenu HTTP
+    // dans une app HTTPS. Pour debug local uniquement, remettre temporairement à true.
+    allowMixedContent: false,
   },
```
Vérifié : `cleartext: false` (ligne 12), `allowMixedContent: false` (ligne 25).

### 2. nginx/224solutions.conf (CRITIQUE — nouveau fichier)
Config Nginx pour servir la SPA statique (`dist/`) sans PM2 ni proxy Node.
- Redirection HTTP → HTTPS + HSTS + headers sécurité (X-Frame-Options, nosniff, CSP frame-ancestors).
- **SPA routing** : `location / { try_files $uri $uri/ /index.html; }` (ligne 70) — évite les 404 au refresh.
- Cache long pour `/assets/` (hash Vite), cache 30j pour fichiers publics.
- Proxy `/s/` vers la Edge Function `short-link` (cohérent avec vercel.json + netlify.toml).
- Commentaire explicite : PAS de PM2 (frontend statique, pas un serveur Node).

### 3. src/integrations/supabase/client.ts (ATTENTION)
Suppression des fallbacks `NEXT_PUBLIC_VITE_*` (convention Next.js invalide en Vite).
```diff
-// Configuration Supabase - variables d'environnement Vercel avec fallback hardcodé
-// Une fois VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY configurés sur Vercel,
-// les fallbacks ne seront plus utilisés.
-const SUPABASE_URL = import.meta.env.NEXT_PUBLIC_VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || "";
-const SUPABASE_KEY = import.meta.env.NEXT_PUBLIC_VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";
+// Configuration Supabase — variables d'environnement Vite
+// Sur Vercel/Netlify/VPS : définir VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
+// dans les variables d'environnement de la plateforme de déploiement.
+// ⚠️ Utiliser UNIQUEMENT le préfixe VITE_ (standard Vite).
+//    Ne pas utiliser NEXT_PUBLIC_ (convention Next.js incompatible avec Vite).
+const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
+const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
```
Vérifié : 0 occurrence de `NEXT_PUBLIC_VITE_` ; le reste du fichier (createClient, etc.) inchangé.

### 4. Centralisation project ID Supabase (ATTENTION)

#### 4A — src/main.tsx (`warmUpConnections`)
```diff
 function warmUpConnections() {
   if (typeof document === 'undefined') return;
-  const supabaseRef = 'uakkxaibujzxdiqzpnpr';
+  // Extraire le project ID depuis la variable d'environnement VITE_SUPABASE_URL
+  // Format attendu : https://<project-id>.supabase.co
+  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
+  const supabaseRef = supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : '';
+  if (!supabaseRef) return; // Ne pas tenter de preconnect si l'URL n'est pas configurée
   const hosts = [
     `https://${supabaseRef}.supabase.co`,            // DB / REST / Auth / Storage
     `https://${supabaseRef}.functions.supabase.co`,  // Edge Functions
   ];
```

#### 4B — src/hooks/useAuth.tsx (bloc de déconnexion)
```diff
       localStorage.removeItem('supabase.auth.token');
-      localStorage.removeItem('sb-uakkxaibujzxdiqzpnpr-auth-token');
+      // Nettoyage token auth : utiliser la clé dynamique extraite de la session
+      // plutôt qu'un project ID hardcodé pour résister aux migrations Supabase.
+      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
+      const projectRef = supabaseUrl ? (() => { try { return new URL(supabaseUrl).hostname.split('.')[0]; } catch { return 'uakkxaibujzxdiqzpnpr'; } })() : 'uakkxaibujzxdiqzpnpr';
+      localStorage.removeItem(`sb-${projectRef}-auth-token`);
```
(Fallback hardcodé conservé en secours pour ne pas casser la déconnexion si l'URL est absente.)

#### 4C — src/services/HealthCheckService.ts (`checkEdgeFunctions`)
```diff
       const controller = new AbortController();
       const timeout = setTimeout(() => controller.abort(), 5000);

+      // URL construite depuis VITE_SUPABASE_URL pour éviter le project ID hardcodé
+      const _supabaseUrlEnv = import.meta.env.VITE_SUPABASE_URL || '';
+      const _supabaseRef = _supabaseUrlEnv
+        ? (() => { try { return new URL(_supabaseUrlEnv).hostname.split('.')[0]; } catch { return 'uakkxaibujzxdiqzpnpr'; } })()
+        : 'uakkxaibujzxdiqzpnpr';
+
       const response = await fetch(
-        `https://uakkxaibujzxdiqzpnpr.functions.supabase.co/health-check`,
+        `https://${_supabaseRef}.functions.supabase.co/health-check`,
```

#### 4D — vercel.json (note de maintenance, JSON sans commentaire natif)
```diff
 {
+  "_note_supabase_project": "Project ID supabase: uakkxaibujzxdiqzpnpr — à mettre à jour ici ET dans netlify.toml en cas de migration Supabase",
   "redirects": [
```
Valeur `destination` du rewrite `/s/` laissée inchangée (vercel.json ne supporte pas les variables d'env). JSON validé (parse OK).

#### 4E — netlify.toml (commentaire de maintenance avant la ligne `to`)
```diff
   from = "/s/*"
+  # ⚠️ MAINTENANCE : project ID Supabase hardcodé ici car netlify.toml ne supporte
+  # pas les variables d'env dans les redirects. À mettre à jour avec vercel.json
+  # et les fichiers src/ en cas de migration vers un nouveau projet Supabase.
   to = "https://uakkxaibujzxdiqzpnpr.supabase.co/functions/v1/short-link/:splat"
```

### 5. .env.example (ATTENTION)
JOMY_CLIENT_ID et JOMY_CLIENT_SECRET commentés et marqués « BACKEND UNIQUEMENT ».
```diff
-# JOMY (PAIEMENTS LOCAUX)
+# JOMY (PAIEMENTS LOCAUX) — BACKEND UNIQUEMENT
 # ==========================================
-JOMY_CLIENT_ID=votre_jomy_client_id
-JOMY_CLIENT_SECRET=votre_jomy_secret
+# ⚠️ IMPORTANT : Ces variables appartiennent au repo BACKEND (Node.js/Express).
+#    Ne pas les ajouter dans ce fichier .env frontend avec le préfixe VITE_
+#    car elles seraient exposées dans le bundle JavaScript côté client.
+#    Les définir UNIQUEMENT dans les variables d'environnement du backend.
+#
+# JOMY_CLIENT_ID=votre_jomy_client_id       ← backend repo seulement
+# JOMY_CLIENT_SECRET=votre_jomy_secret      ← backend repo seulement
```

### 6. .npmrc (INFO)
Commentaire explicatif ajouté sur la raison de `legacy-peer-deps` (la directive active est conservée en fin de fichier).

## Aucun fichier supprimé
## Aucun fichier renommé
## Aucune dépendance ajoutée ou supprimée

## Tests recommandés après application
1. `npm run build` → doit compiler sans erreur.
2. Vérifier que `VITE_SUPABASE_URL` est configuré dans l'environnement de déploiement
   (Vercel/Netlify/VPS) — désormais **requis** (plus de fallback hardcodé pour l'URL/clé).
3. Sur le build mobile : `capacitor.config.ts` → `cleartext=false` ne bloque que le HTTP
   en clair ; les appels HTTPS continuent normalement (comportement attendu).
4. `sudo nginx -t` → tester la configuration Nginx générée avant `reload`.

## Note technique
- Un diagnostic TypeScript préexistant subsiste dans `src/hooks/useAuth.tsx` (~ligne 295,
  insertion `driver`/`vehicle_type` typée `never`) — **sans rapport** avec les corrections
  ci-dessus (situé loin du bloc de déconnexion modifié à la ligne 917).
- En 4B/4C, le project ID hardcodé est conservé **uniquement comme fallback** de secours
  (dans le `catch` / si l'URL est absente) afin de ne jamais casser la déconnexion ou le
  health-check si la variable d'environnement n'est pas définie.
