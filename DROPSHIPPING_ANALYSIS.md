# Analyse Dropshipping — comparaison avec Shopify (2026-06-14)

## Méthode
Lecture du code réel : `useDropshipping`, `useConnectors`, `src/services/connectors/*`
(AliExpress, Alibaba, 1688, PrivateSupplier), `useChinaDropshipping`, tables
`dropship_*`, et le flux de commande (`orders.routes.ts`, webhooks).

---

## 1. Comment fonctionne le dropshipping façon Shopify (Oberlo / DSers / AutoDS)

1. **Import** d'un produit fournisseur (AliExpress…) → devient **immédiatement un produit
   de la boutique** (prix de vente = coût × marge), visible et **achetable**.
2. **Sync auto** (planifiée) du **prix** et du **stock** fournisseur → on ne vend jamais
   un article en rupture ou à perte.
3. Le client achète au **prix de détail** ; la commande est encaissée.
4. **Fulfillment AUTOMATIQUE** : à la commande payée, le système **passe la commande chez le
   fournisseur** (paie le prix de gros, adresse = client) — **côté serveur**.
5. Le fournisseur expédie ; le **numéro de suivi est rapatrié automatiquement** et poussé au
   client. Statuts synchronisés.
6. **Profit = détail − gros − frais**, réconcilié automatiquement.

**Le cœur de Shopify = automatisation bout-en-bout + exécution SERVEUR.**

---

## 2. Ce qui existe déjà ici (points forts)

- **Cadre de connecteurs sérieux** : `BaseConnector` + AliExpress / Alibaba / 1688 / fournisseur
  privé, avec **vraies URLs d'API + `fetch` réels** et OAuth. Repli **mock** automatique quand
  les credentials manquent (utile en dev).
- **Import produit** par URL/ID (`importFromUrl`, détection de plateforme).
- **Tables** complètes : `dropship_suppliers/products/orders/settings/sync_logs`,
  `china_product_imports`.
- **Calcul de marge/profit** présent ; sous-système **Chine** (logistique, coûts).

---

## 3. Écarts CRITIQUES vs Shopify (pourquoi ça ne fonctionne PAS encore comme Shopify)

| # | Écart | État actuel | Shopify |
|---|-------|-------------|---------|
| 1 | **Produit importé non vendable** | `saveProduct` écrit dans `dropship_products` (`is_published:false`) **sans créer de ligne dans le catalogue `products`** → le client ne peut pas l'acheter | Import → produit boutique achetable immédiatement |
| 2 | **Pas de fulfillment automatique** | À l'achat payé, **rien** ne crée/passe la commande fournisseur. `createSupplierOrder` est **100% manuel** (panneau) | Commande payée → commande fournisseur **auto-placée** |
| 3 | **Exécution côté FRONTEND** | Les connecteurs tournent dans le **navigateur** → clés API fournisseur **exposées**, placement de commande non atomique/insécurisé | Fulfillment **serveur** |
| 4 | **Sync prix/stock manuelle** | `syncPrices`/`syncAvailability` existent mais **aucun job planifié** | Sync **auto** récurrente (anti-survente / anti-perte) |
| 5 | **Suivi non rapatrié** | `getTracking` existe mais **non câblé** pour mettre à jour la commande client | Tracking **auto-synchronisé** vers le client |
| 6 | **Profit non réconcilié** wallet/escrow | `profit_amount` stocké mais **hors** système wallet/escrow atomique de la plateforme | Profit encaissé proprement |
| 7 | **`syncProduct` du noyau = SIMULATION** | `useDropshipping.syncProduct` = `setTimeout` factice (« à connecter ») | — |

**Verdict** : architecture prometteuse mais le système est aujourd'hui un **registre
dropshipping MANUEL** avec un framework de connecteurs **capable de mock**. Les fonctions qui
*définissent* Shopify (publication auto en boutique, fulfillment auto à l'achat, exécution
serveur, sync planifiée, suivi rapatrié) sont **absentes ou simulées**.

---

## 4. Plan d'implémentation (par phases, backend-first, atomique)

> Règle projet : **tout en backend Node.js**, atomique/idempotent. Les connecteurs doivent
> migrer côté serveur (les clés fournisseur ne doivent JAMAIS être au navigateur).

- **Phase 1 — Bridge « importé → vendable »** ✅ **FAIT (2026-06-14)** : RPC atomiques
  `publish_dropship_product` / `unpublish_dropship_product` (migration `20260614140000`) créent/MAJ
  un produit `products` (section `dropshipping`, prix=selling_price, images, stock) lié via
  `dropship_products.published_product_id` ; contrôle de propriété serveur ; `resolve_vendor_id`
  gère vendor_id=vendors.id OU user_id. Route `POST /api/v2/dropship/:id/publish|unpublish`.
  Bouton « Publier/Retirer du marketplace » dans `DropshipProducts`. Idempotent (re-publier = MAJ).
  INSERT products validé live. **Le produit importé devient ACHETABLE.**
- **Phase 2 — Fulfillment AUTO serveur** ✅ **FAIT (2026-06-14)** : RPC atomique
  `fulfill_dropship_for_order` (migration `20260614150000`) crée la `dropship_orders` (statut
  `pending`) pour chaque produit dropship d'une commande **payée** (calcul supplier/customer
  total + profit, adresse client). **2 triggers défensifs** : sur `orders` (paiement
  asynchrone/webhook) ET sur `order_items` (paiement synchrone `create_order_core` — avec
  court-circuit si non-dropship). Idempotent (1 commande fournisseur par couple), **ne casse
  jamais la commande client** (exceptions capturées). Endpoint relance admin
  `POST /api/v2/dropship/order/:id/fulfill`. **Le placement RÉEL chez le fournisseur = Phase 3**
  (connecteurs backend + credentials) ; ici la commande fournisseur est créée, prête à transmettre.
- **Phase 3 — Connecteurs côté serveur** ✅ **FAIT (2026-06-14)** : placement de commande
  fournisseur déplacé **côté backend** (`backend/src/services/dropship/supplierConnectors.ts`
  + `placementService.ts`) — clés API fournisseur en **env serveur** (jamais au navigateur).
  Endpoint `POST /api/v2/dropship/order/:id/place` (vendeur/admin) : appel **réel** si
  credentials présents, sinon **mock** (`placement_is_mock`), idempotent ; met le statut à
  `ordered_from_supplier`. Colonnes ajoutées (`supplier_order_id/reference/placed_at/
  placement_error/placement_is_mock`, migration `20260614160000`). Bouton « Commander chez le
  fournisseur » dans `DropshipOrders`. ⚠️ L'**import** produit reste frontend pour l'instant
  (moins sensible) ; à migrer aussi si besoin. Activation réelle = poser les clés `*_API_KEY`.
- **Phase 4 — Sync planifiée** ✅ **FAIT (2026-06-14)** : planificateur worker
  (`dropshipSync.service.ts`, intervalle 30 min, **verrou Redis** anti-doublon) +
  `syncService.syncAllDropshipProducts()` : rafraîchit coût/stock fournisseur → MAJ
  `dropship_products` + produit miroir ; **dépublie auto les RUPTURES** (anti-survente) ;
  **alerte `system_alerts`** (module `dropshipping`) si rupture ou **coût > prix de vente**
  (perte), dédupliquées. Endpoint manuel `POST /api/v2/dropship/sync` (admin). En **mock**
  (pas de clés) = no-op (aucune fausse donnée). Aucune migration (colonnes existantes).
- **Phase 5 — Suivi rapatrié** ✅ **FAIT (2026-06-14)** : `trackingService.ts` récupère le
  n° de suivi fournisseur (connecteur serveur) → MAJ `dropship_orders` (tracking_number +
  statut shipped/delivered) + écrit le suivi dans `orders.metadata` (commande client) +
  **notifie l'acheteur** (expédié / livré). Branché dans le planificateur (toutes les 30 min)
  + endpoint manuel `POST /api/v2/dropship/order/:id/tracking/sync` + bouton « Synchroniser
  le suivi ». Mock = no-op. Aucune migration.

---

## ✅ BILAN : système dropshipping désormais aligné sur Shopify (côté code)
Les 5 phases sont implémentées (backend, atomique). Le flux complet fonctionne :
import → **publication boutique** → achat client → **commande fournisseur auto** →
**placement serveur** → **sync prix/stock + anti-survente** → **suivi rapatrié + notif**.
**Seule dépendance restante = les CLÉS API fournisseur** (AliExpress/CJ/1688) : sans elles,
tout tourne en **mock** ; le jour où tu les poses (`*_API_KEY`), le réel s'active sans
changer le code. Import produit = encore frontend (à migrer backend si souhaité, moins sensible).

⚠️ **Dépendance externe** : le placement RÉEL de commande chez un fournisseur exige des
**comptes + clés API fournisseur** (AliExpress/CJ/1688…) que seul toi peux fournir. Sans elles,
tout fonctionne en mode **mock/manuel** (la logique est là, l'appel réel est branché le jour où
les clés existent).

---

## 5. Autres types de produits du vendeur numérique (état rapide)

Catégories `digital_products` : `dropshipping`, `voyage`, `logiciel`, `formation`, `livre`,
`custom`, `ai` + mode `direct` | `affiliate` (+ `physique_affilie`).
- **Livrables téléchargeables** (logiciel/formation/livre/ai/custom) : ✅ **sécurisés** ce jour
  (bucket privé + endpoint signé gaté par l'achat — voir BUSINESS_AUDIT).
- **Mode `affiliate`** (voyage, physique_affilié) : redirige via `affiliate_url` (pas de
  livraison) — cohérent.
- **`dropshipping`** : objet de ce document — **à compléter** (phases ci-dessus).
