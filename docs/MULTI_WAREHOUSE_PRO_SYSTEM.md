# Système Multi-Entrepôts Professionnel — 224SOLUTIONS

## Objectif
Étendre le module existant de gestion multi-sites sans casser les workflows actuels, avec :

- séparation stricte **stock entrepôt** / **stock boutique**
- transferts multi-destinations **entrepôt / boutique / client**
- gestion **cartons + unités**
- liaison **produit entrepôt → produit boutique**
- reçus **PDF téléchargeables**
- audit log complet et rafraîchissement **Realtime**

---

## Fichiers principaux livrés

### Frontend
- `src/components/vendor/MultiWarehouseManagement.tsx`
- `src/components/vendor/TransferCreator.tsx`
- `src/components/vendor/TransferReception.tsx`
- `src/hooks/useMultiWarehouse.ts`
- `src/lib/inventory/multiWarehouseUtils.ts`
- `src/lib/inventory/multiWarehouseUtils.test.ts`

### Base de données / Supabase
- `supabase/migrations/20260409123000_multi_warehouse_professional_extension.sql`

---

## Architecture retenue
Le système existant est conservé et enrichi autour des tables déjà en place :

- `vendor_locations` → lieux logistiques / boutiques
- `location_stock` → stock physique par lieu
- `stock_transfers` → workflow des transferts
- `stock_transfer_items` → lignes de transfert
- `stock_losses` → pertes / manquants
- `location_stock_history` → historique stock

Ajouts professionnels :

- `warehouse_shop_product_links` → mapping entre produit entrepôt et produit boutique
- `warehouse_audit_logs` → audit trail métier détaillé
- colonnes cartons/unités dans `location_stock` et `stock_transfer_items`
- colonnes `destination_type`, `destination_client_info`, `receipt_url`, `approval_status`, `idempotency_key`

---

## Formule de calcul stock

```text
qty_total_units = (quantity_cartons_closed × units_per_carton) + quantity_units_loose
```

Le champ legacy `quantity` reste synchronisé automatiquement pour préserver la compatibilité avec les anciens écrans.

---

## Workflow supporté

### 1. Vers un autre entrepôt
- création du transfert
- expédition
- confirmation de réception
- ajustement du stock source et destination

### 2. Vers une boutique / POS
- vérification du mapping produit boutique
- transfert en **unités visibles côté vente**
- stock boutique alimenté uniquement par transfert validé

### 3. Vers un client
- sortie logistique définitive
- génération de reçu PDF
- traçabilité complète

---

## Sécurité & robustesse
- contrôle anti-stock négatif
- idempotency key sur les transferts
- audit log automatique
- conservation des tables et workflows existants
- fallback rétrocompatible vers `create_stock_transfer` si le RPC avancé n’est pas encore appliqué

---

## Realtime
Le hook `useMultiWarehouse` écoute maintenant :

- `vendor_locations`
- `location_stock`
- `stock_transfers`
- `stock_transfer_items`
- `stock_losses`

Ce qui garde l’interface vendeur synchronisée sans rechargement manuel.

---

## Vérification recommandée après migration
1. Appliquer la migration Supabase.
2. Ouvrir **Gestion Multi-Sites**.
3. Créer un transfert :
   - entrepôt → entrepôt
   - entrepôt → boutique
   - entrepôt → client
4. Télécharger un reçu PDF.
5. Vérifier la mise à jour du stock et des logs.

---

## Jeux de tests couverts
- transfert cartons
- transfert unités
- transfert mixte
- cohérence du stock restant
- validation boutique avec mapping obligatoire
- conversion unités ↔ cartons
