# 🚀 Runbook de déploiement — Devise unifiée + Transfert durci + Marketplace (commissions/escrow)

> ❗ CE FICHIER EST UN GUIDE À LIRE — ce n'est PAS du SQL. NE LE COLLE PAS dans le SQL Editor.
> Dans le SQL Editor de Supabase, on colle UNIQUEMENT le contenu des fichiers `.sql` (les migrations),
> un par un (voir Phase 1).
>
> ⚠️ À exécuter dans l'ordre. Rien ne doit être lancé sans le feu vert du PDG.
> Ordre global : **Migrations DB → Backend (Vercel) → Frontend (push main)**.
> Les migrations sont **rétro-compatibles** (le backend actuel continue de tourner après leur
> application), donc on les applique en premier sans coupure.

---

## 📦 Ce qui est inclus dans ce lot

**Migrations DB (5) — toutes en attente :**
| Fichier | Effet |
|---|---|
| `20260606170000_change_user_currency_atomic.sql` | Changement de devise PDG atomique (wallet+profil+boutique+agent). **Ne touche plus aux produits.** |
| `20260607120000_harden_atomic_wallet_transfer.sql` | Transfert wallet durci : verrou `FOR UPDATE`, garde solde, registre commission `platform_fx_commissions`, RPC FX avec `p_fee_amount`. |
| `20260607140000_create_order_core_buyer_commission.sql` | Commission ACHETEUR (purchase_fee_percent) prélevée + créditée PDG ; commission VENDEUR stockée sur l'escrow. |
| `20260607150000_refund_order_escrow.sql` | RPC `refund_order_escrow` : recrédite l'acheteur à l'annulation (atomique). |
| `20260607160000_fix_auto_release_escrows.sql` | Répare l'auto-release J+7 (status=held, crédit vendeur+plateforme). |

**Backend (Vercel, manuel)** — fichiers modifiés :
`wallet.v2.routes.ts` (commission FX masquée, limite convertie, description), `wallet.service.ts`
(idempotence atomique, `p_fee_amount`), `vendors.routes.ts` (changement devise ne réétiquette plus
les produits), `marketplacePricing.service.ts` (prix produit lu en DEVISE DU VENDEUR),
`orders.routes.ts` (commission acheteur + remboursement annulation + endpoint confirm-delivery).

**Frontend (auto-deploy depuis `main`)** — fichiers modifiés :
`CurrencyContext.tsx` (devise d'affichage = wallet), `ProductDetailModal.tsx` (prix en devise vendeur),
`ProductManagement.tsx` (prix vendeur affiché direct + libellés devise vendeur),
`InternationalTransferConfirmation.tsx` (commission invisible, taux net+commission),
`UniversalWalletTransactions.tsx` (devise réelle des paiements marketplace + montant reçu intl),
`MyPurchasesOrdersList.tsx` / `ClientOrdersList.tsx` / `orderBackendService.ts` (confirm-delivery via backend).

---

## Phase 0 — Pré-vol (déjà validé ✅)
- `cd backend && npx tsc --noEmit` → EXIT 0
- `npm run build` → EXIT 0

## Phase 1 — Migrations DB *(en PREMIER, rétro-compatibles)*

```powershell
# 1) Token Supabase (Personal Access Token)
$env:SUPABASE_ACCESS_TOKEN = "sbp_xxxxxxxxxxxx"

# 2) Appliquer les 3 migrations, une par une (CIBLÉ — jamais le mode "toutes")
node scripts/run-migrations.js supabase/migrations/20260606170000_change_user_currency_atomic.sql
node scripts/run-migrations.js supabase/migrations/20260607120000_harden_atomic_wallet_transfer.sql
node scripts/run-migrations.js supabase/migrations/20260607140000_create_order_core_buyer_commission.sql
node scripts/run-migrations.js supabase/migrations/20260607150000_refund_order_escrow.sql
node scripts/run-migrations.js supabase/migrations/20260607160000_fix_auto_release_escrows.sql
```

**Vérifications post-migration** (Dashboard Supabase → SQL Editor) :
```sql
-- a) RPC changement devise présent
SELECT proname FROM pg_proc WHERE proname = 'change_user_currency_atomic';
-- b) Durcissement transfert : table commission + RPC FX 13 args (cf. scripts/verify-transfer-hardening.sql)
SELECT to_regclass('public.platform_fx_commissions');
SELECT proname, pronargs FROM pg_proc WHERE proname='execute_atomic_wallet_transfer_fx';  -- attendu 13
-- c) Marketplace : create_order_core a bien les 16 args (commission), refund + auto-release présents
SELECT proname, pronargs FROM pg_proc WHERE proname='create_order_core';            -- attendu 16
SELECT proname FROM pg_proc WHERE proname IN ('refund_order_escrow','auto_release_escrows');
```

## Phase 2 — Backend *(Vercel, manuel)*
```powershell
cd backend
npx vercel deploy --prod
```
*(pas d'auto-deploy GitHub pour le backend — manuel)*

> ⚠️ La migration `20260607120000` doit être appliquée AVANT ce déploiement (le backend appelle
> le RPC FX avec `p_fee_amount`). L'ordre Phase 1 → Phase 2 le garantit.

## Phase 3 — Frontend *(auto-deploy depuis `main`)*
```powershell
git add -A
git commit -m "feat(devise): conversion unifiée (wallet) + prix GNF canonique + transfert durci"
# fusionner/pousser vers main → déclenche l'auto-deploy Vercel du frontend
```

## Phase 4 — Smoke tests
1. **Devise d'affichage** : un compte dont le wallet est en XOF/EUR → toute l'interface convertie.
2. **Produit (devise vendeur)** : un produit « 50 000 » d'un vendeur CFA → fiche produit ET paiement
   affichent **50 000 CFA** convertis dans la devise de l'acheteur (ex. ~74,76 € pour un acheteur EUR),
   identiques. Ouvrir la fiche produit + acheter au wallet.
3. **Commission acheteur** : débit acheteur = total produit converti **+ commission** (purchase_fee_percent) ;
   la commission arrive sur le wallet PDG. Annuler une commande wallet → l'acheteur est **recrédité**.
4. **Transfert international** : destinataire reçoit au taux net ; commission invisible ; commission
   tracée : `SELECT * FROM platform_fx_commissions ORDER BY created_at DESC LIMIT 5;`

## 🔙 Rollback
- **Backend** : `vercel rollback` (ou redeploy du commit précédent).
- **DB** : les fonctions sont en `CREATE OR REPLACE` → ré-appliquer l'ancienne version restaure.
  Le **prix (nombre) des produits n'est jamais modifié** par ce lot (modèle = prix en devise du
  vendeur, on touche seulement aux fonctions/colonnes devise), donc aucun risque sur les montants.

---

## ⚠️ Points de vigilance
- Ordre **migrations → backend** impératif (le backend appelle le RPC FX avec `p_fee_amount`).
- Ne JAMAIS lancer `node scripts/run-migrations.js` sans argument (pas de cache → rejouerait tout).
- Toutes les migrations sont idempotentes (`CREATE OR REPLACE`, `IF NOT EXISTS`, `DROP IF EXISTS`).
- ⚠️ Le `purchase_fee_percent` (commission acheteur) se règle dans `system_settings` côté PDG.
- Le script `scripts/cleanup-test-currency-data.sql` reste utile uniquement pour consolider
  d'éventuels **wallets en double** (1 ligne par devise) — voir sa PARTIE A2/B1bis.
