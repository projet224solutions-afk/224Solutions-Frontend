# ✅ Checklist de déploiement — session 2026-06-14

Couvre tout ce qui a été produit cette session (2FA admin, téléchargement digital sécurisé,
dropshipping Shopify-like, sécurité bureau). **Priorité absolue = bureau** (la révocation RPC
est déjà en prod → le dashboard bureau est cassé tant que backend+front ne sont pas déployés).

---

## 🔴 0. URGENT — Rétablir le bureau (révocation déjà appliquée en prod)

L'accès anon aux RPC bureau est **déjà révoqué en base**. Le dashboard bureau (stats / ajout
véhicule) **ne fonctionnera plus** tant que ces 2 déploiements ne sont pas faits :

- [ ] **Backend déployé** avec les routes `/api/v2/bureau/*`
- [ ] **Frontend déployé** avec `useBureauAuth` / `useBureauRealtimeStats` / `SyndicateVehicleManagement` / `lib/bureauApi`

---

## 1. Variables d'environnement à vérifier AVANT déploiement

### Backend (projet Vercel backend)
- [ ] **`JWT_SECRET`** ≥ 32 caractères — **CRITIQUE** : sans lui, `/api/v2/bureau/auth/verify-otp`
      (signature du JWT bureau) **échoue**. Vérifier qu'il est défini en prod.
- [ ] `MFA_ENCRYPTION_KEY` (≥32) — pour la 2FA admin (sinon repli sur CCP_ENCRYPTION_KEY/JWT_SECRET).
- [ ] `ADMIN_MFA_ENFORCED=false` pour l'instant (passer à `true` APRÈS enrôlement des admins).
- [ ] (Optionnel) clés fournisseurs dropship `ALIEXPRESS_*` / `ALIBABA_*` / `ONE688_*` /
      `PRIVATE_SUPPLIER_*` — absentes = mode mock (OK), à poser le jour du dropshipping réel.
- [ ] (Optionnel) `DROPSHIP_SYNC_INTERVAL_MS` (défaut 30 min) + `RUN_BACKGROUND_JOBS=true` sur le worker.

### Frontend
- [ ] `VITE_BACKEND_URL` (ou équivalent) pointe bien vers le backend prod (les hooks bureau,
      dropship, digital appellent le backend).

---

## 2. Migrations SQL — état

Déjà appliquées en SQL Editor cette session :
- [x] `20260614120000_admin_step_up_mfa.sql` (2FA admin)
- [x] `20260614130000_drop_legacy_clientside_2fa.sql` (nettoyage ancien 2FA)
- [x] `20260614140000_dropship_publish_bridge.sql` (dropship P1)
- [x] `20260614150000_dropship_auto_fulfillment.sql` (dropship P2)
- [x] `20260614160000_dropship_placement_columns.sql` (dropship P3)
- [x] `20260614170000_bureau_revoke_anon_rpc.sql` (insuffisante — voir 180000)
- [x] `20260614180000_bureau_revoke_public_rpc.sql` (**vraie fermeture**, vérifiée anon bloqué)

> Aucune migration en attente. (Dropship P4/P5 = sans migration.)

---

## 3. Déploiement

### Backend (à déployer EN PREMIER)
- [ ] `cd backend && npx vercel deploy --prod` (ou via l'intégration Git du projet backend)
- [ ] Vérifier `GET /healthz` répond 200 en prod.

### Frontend (ensuite)
- [ ] `npm run deploy:vercel` (scanne les secrets → build → `vercel deploy --prod`)
- [ ] (Le scan secrets bloque si une clé fuit dans le bundle.)

---

## 4. Vérifications POST-déploiement

### Bureau (le plus urgent)
- [ ] Login bureau (OTP) → le dashboard s'affiche, **stats non vides**.
- [ ] Ajout d'un véhicule depuis un bureau → succès.
- [ ] (Sécurité, déjà vérifié en base) un appel anon aux RPC bureau = `permission denied`.

### 2FA admin
- [ ] Centre Sécurité PDG → onglet MFA → « Configurer la 2FA » → QR scannable → activation OK.
- [ ] Une opération financière sensible (escrow release / AML) → demande le code 2FA (si admin enrôlé).

### Téléchargement digital
- [ ] Bouton « Télécharger » (vendeur digital) → ouvre un lien **signé** (le bucket est déjà privé).
- [ ] Une URL publique de livrable → 400 (déjà vérifié).

### Dropshipping
- [ ] Importer un produit dropship → « Publier sur le marketplace » → le produit devient achetable.
- [ ] (Mock) « Commander chez le fournisseur » → statut passe à `ordered_from_supplier`.

---

## 5. Actions OPS standing (hors déploiement, à ne pas oublier)

- [ ] 🔴 **Roter les clés Supabase** (anon + service_role) committées dans l'historique git
      (faille connue, cf audit scalabilité).
- [ ] Enrôler les admins en 2FA puis passer `ADMIN_MFA_ENFORCED=true`.
- [ ] (Plus tard) Poser les clés API fournisseur pour activer le dropshipping réel.

---

## 6. Rollback rapide (si problème bureau en prod)

Si le déploiement bureau pose problème et qu'il faut rétablir l'ancien comportement
temporairement (NON recommandé — réouvre la faille), on peut re-`GRANT EXECUTE … TO PUBLIC`
sur les 3 RPC. **À éviter** : préférer corriger le déploiement.
