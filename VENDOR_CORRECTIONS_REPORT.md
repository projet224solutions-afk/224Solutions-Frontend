# CORRECTIONS INTERFACE VENDEUR PHYSIQUE
Date : 2026-06-24

> Chaque correction a été appliquée **après lecture du fichier réel** et **vérification des
> hypothèses du prompt**. 3 corrections ont dû être adaptées car le prompt s'appuyait sur des
> éléments inexistants (FK absente, lib non installée, filtre PostgREST non supporté).

## Critiques

### C1 — OfflineSyncPanel : badges ✅
- `getStatusColor()` : défaut = vert `#16a34a` (au lieu d'orange) ; en cours=bleu, hors-ligne=gris, erreurs=rouge, en attente=amber.
- `getStatusBadgeColor()` : synced=vert, pending=amber, failed=rouge (3 couleurs distinctes).
- Compteurs (principaux + par-type) : couleurs distinctes par état.

### C2 — VendorRatingsPanel : N+1 → **batch** (⚠️ adapté) ✅
- Le prompt proposait un JOIN `profiles!customer_id(...)` — **impossible** : il n'existe AUCUNE
  FK `vendor_ratings.customer_id → profiles` (vérifié dans les types générés ; seules `order_id` et
  `vendor_id` ont des FK). L'embed aurait **cassé** le chargement des avis.
- Adapté : **1 requête batch** `profiles.in('id', customerIds)` au lieu de N requêtes.
  → 50 avis = 2 requêtes (au lieu de 51), objectif atteint, sans casse.

### C3 — POSSystem : 5 `Math.random()` → `uid8()` ✅
- Helper `uid8()` = `crypto.randomUUID()` (8 hexa). 5 occurrences remplacées (offline_credit, POS-MM, POS-CB, offline_, pos-).

### C4 — `window.prompt/confirm` → AlertDialog ✅
- **VendorReturnsManager** : dialog rejet (motif) + dialog confirmation réception.
  ⚠️ Endpoint backend RÉEL conservé (`PATCH /api/returns/:id` body `{action, vendor_response}`) —
  le refactor du prompt l'aurait changé et cassé l'API.
- **MultiWarehouseManagement** : dialog expédition transfert + dialog suppression entrepôt.
- **AgentManagement** : dialog suppression agent.
- 0 `window.*` restant.

## Élevés

### C5 — VendorAnalytics : KPI étendus (⚠️ version sûre) ✅
- Le filtre `.filter('stock_quantity','lte','low_stock_threshold')` du prompt est **cassé**
  (PostgREST ne compare pas 2 colonnes → littéral). Adapté en **filtrage JS**.
- Ajouté (hook + dashboard) : **CA du mois (30j)**, **panier moyen**, **nb commandes mois**,
  **taux de paiement** (renommé), **alerte stock bas** (KPI Produits actifs).
- CA du mois dérivé de `monthData` existant (orders payées + POS) → précis, sans requête en trop.
- Dashboard : 3 → **5 KPI**, grille `grid-cols-2 sm:grid-cols-3`.
- Scopé hors `monthGrowth`/`paymentMix` (calendrier + requêtes additionnelles) — à faire si besoin.

### C6 — DebtsList : alertes dettes échues ✅
- `isOverdue()` : statut `in_progress` (⚠️ pas `pending` comme le prompt) + `due_date < now`.
- Badge « Xj de retard » par dette + bannière rouge en haut (mobile + desktop).

### C7 — POSSystem : alerte remise excessive ✅
- `isHighDiscount` (> 50% ou > 500 000 GNF) → encart amber dans le récap panier.

### C8 — VendorReportsManager : export **CSV** (⚠️ adapté) ✅
- `xlsx`/SheetJS **n'est pas installé** (et `reportData` n'a pas de `.items`). Le code du prompt
  aurait cassé le build et produit des lignes vides.
- Adapté : export **CSV** (s'ouvre nativement dans Excel), BOM UTF-8, séparateur `;`, du **vrai résumé**
  (`reportData` + `topProducts`). Aucune dépendance ajoutée (bundle déjà ~17 Mo).

### C9 — POSReceipt : QR code ✅
- QR via `api.qrserver.com` (externe, sans lib) → `224solutions.com/commande/{orderNumber}`.
- Placé DANS `receiptRef` (écran + impression + PDF), `crossOrigin` pour la capture html2canvas.

## Vérifications
- `npx tsc --noEmit` : **0 erreur**.
- Greps : C1/C2/C3/C4/C5/C6/C7/C8/C9 conformes (0 `window.*`, 0 `Math.random`, etc.).
- `npm run build` : voir ci-dessous.
