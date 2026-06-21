# AUDIT INTERFACE VENDEUR DIGITAL — CORRECTIONS APPLIQUÉES
Date : 2026-06-21

## Résumé
| # | Problème | Sévérité | Statut |
|---|----------|----------|--------|
| 1 | Prix à 0 GNF autorisé | CRITIQUE | ✅ Corrigé (`<= 0` + `isNaN`) |
| 2 | Suppression/archivage/republication sans merchant_id | ÉLEVÉ | ✅ Corrigé (3 handlers) |
| 3 | Routes add-product / payment-links sans ProtectedRoute | ÉLEVÉ | ✅ Corrigé |
| 4 | Badge "Publié" en bleu | MODÉRÉ | ✅ Vert #16a34a |
| 5 | Gradient résiduel métriques secondaires | MODÉRÉ | ✅ Aplati (#04439e/5) |
| 6 | 14 console.log exposent URLs GCS | MODÉRÉ | ✅ Supprimés (+ 2 console.error nettoyés) |
| 7 | Point de statut vendeur orange non standard | MODÉRÉ | ✅ Vert #16a34a + pulse |

## Fichiers modifiés
- `src/components/digital-products/DigitalProductForm.tsx` — validation prix `<= 0` (+ `isNaN`) ; suppression de 10 `console.log` (exposaient URLs GCS/vidéos + étapes) + `console.error` description retiré ; 2 `console.error` upload nettoyés (plus de nom de fichier ni erreur brute) ; `console.error` création produit **conservé** (erreur fonctionnelle utile).
- `src/components/vendor/VendorDigitalProducts.tsx` — `.eq('merchant_id', …)` ajouté sur `handleDelete`, `handleArchive`, `handleRepublish` (défense en profondeur, en plus de la RLS) ; `statusColors.published` → **vert #16a34a**, `pending` → bleu pâle, `rejected` → rouge pâle.
- `src/components/digital-vendor/DigitalVendorRoutes.tsx` — `add-product` enveloppée dans `ProtectedRoute feature="products_basic"` ; `payment-links` dans `ProtectedRoute feature="payment_links"` (features vérifiées dans `useSubscriptionFeatures.ts`).
- `src/components/digital-vendor/DigitalVendorDashboardHome.tsx` — `bg-[linear-gradient(...)]` des 4 cartes métriques → `bg-[#04439e]/5` solide.
- `src/components/digital-vendor/DigitalVendorHeader.tsx` — point de statut `bg-[#ff6a1a]` → **`bg-[#16a34a]` + animate-pulse** ; bouton déconnexion (orange) **inchangé** comme demandé.

## Écart assumé
- L'alias de route `liens-de-paiement` (suggéré en option dans le prompt) **n'a pas été ajouté** : cette route n'existe pas dans le fichier et n'est liée nulle part → éviter une route morte. La vraie route `payment-links` est désormais protégée (objectif sécurité atteint).

## Vérifications (toutes ✅)
- prix `<= 0` présent · `console.log` = 0 dans DigitalProductForm · `merchant_id` = 3 occurrences · `published` = vert · 2 routes protégées · 0 `linear-gradient` dans DashboardHome · point statut vert.

## Build : vite (voir ci-dessous)
