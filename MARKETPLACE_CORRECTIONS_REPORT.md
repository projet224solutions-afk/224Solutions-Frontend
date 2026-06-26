# RAPPORT CORRECTIONS MARKETPLACE
Date : 2026-06-26

> Audit re-vérifié contre le code réel avant action. Plusieurs corrections de
> l'audit étaient **déjà présentes** dans la branche `frontend` (Critiques 1, 2
> produits, 3). Les corrections manquantes (Élevés) ont été appliquées.
> Règle respectée : additif uniquement, zéro suppression de fonctionnalité.

## Critiques — état vérifié

### 1. Page blanche : catégorie e-commerce + Numériques/Services ✅ (déjà en place)
- Bouton « Services Pro » : `setSelectedCategory('all')` présent — `src/pg/Marketplace.tsx:742`
- Bouton « Numériques » : `setSelectedCategory('all')` + `setSelectedDigitalCategory('all')` présents — `src/pg/Marketplace.tsx:761`
- `isEcommerceCategorySelected` ne peut plus déclencher `allItems=[]` au changement de mode.

### 2. Infinite scroll cassé par filtre pays client ✅ (déjà en place pour les produits)
- `loadProducts()` : filtre pays **côté serveur** via
  `.or('country.ilike.<pays>', { referencedTable: 'vendors' })` — `src/hooks/useMarketplaceUniversal.ts:241-244`.
  Le `.limit()` s'applique donc aux produits déjà filtrés par pays → `hasMore` cohérent.
- `loadProfessionalServices()` : la résolution pays reste via `user_id → vendors.country`
  (requête dédiée). **Non migrée vers un JOIN `vendors!inner`** : pas la cause du bug
  d'infinite-scroll (flux services distinct), et la jointure embarquée risquait un échec
  PostgREST « relationship not found » + une rupture RLS pour les services sans vendeur.
  Comportement fonctionnel conservé.

### 3. Bouton Numérique : pays ignoré sans notification ✅ (déjà en place)
- Badge informatif si `selectedCountry !== 'all'` : « Produits numériques mondiaux —
  filtre <pays> ignoré » + bouton « Effacer » — `src/pg/Marketplace.tsx:782-792`.

## Élevés — corrections appliquées dans cette passe

### 4. Catégorie « Affiliés » dans Numériques ✅ (Option A — renommage)
- `physique_affilie` renommé **« Liens Affiliés »** + icône `ExternalLink` — `src/pg/Marketplace.tsx:120`.
- Option B (suppression) écartée : violerait la règle « zéro suppression » et masquerait
  une fonctionnalité existante. Le renommage clarifie qu'il s'agit de produits physiques
  via lien d'affiliation, sans rien retirer.

### 5. Message « Aucun produit » amélioré ✅
- Message **contextuel** selon le filtre actif (pays / type / catégorie) — `src/pg/Marketplace.tsx:1124+`.
- Bouton **« Réinitialiser les filtres »** visible si filtres actifs (pays, catégorie, recherche).
- Duplication de la clé i18n `marketplace.noProducts` supprimée (0 occurrence restante).

### 6. ServiceTypesGrid : skeleton + Promise.all ✅
- Skeleton animé déjà présent pendant le chargement — `src/components/marketplace/ServiceTypesGrid.tsx:306-320`.
- Requêtes `service_types` et `professional_services` désormais **parallélisées**
  via `Promise.all([...])` — `src/components/marketplace/ServiceTypesGrid.tsx:209`.

### 7. (Élevé 4) Bouton « Mondial » ✅
- `title` dynamique : « Revenir aux produits · Sélectionner un pays » quand un mode
  non-produits est actif — `src/pg/Marketplace.tsx`.

## 🔴 Recherche produits cassée (Marketplace + accueil) — CORRIGÉ

Symptôme signalé : taper un terme ne filtrait pas les produits. **Cause double**
(la requête SQL elle-même fonctionnait — testée : « Papier » → « Papier Sublimation A4 ») :

1. **Carrousels de reco non masqués pendant la recherche** — `src/pg/Marketplace.tsx:1115`.
   La section « Sélection pour vous » / « Tendances du moment » s'affichait dès
   `selectedCategory === 'all'`, **sans tester `searchQuery`** → elle montrait tous les
   produits recommandés au-dessus de la grille filtrée → la recherche semblait inopérante.
   → Ajout de `!searchQuery.trim()` à la condition : pendant une recherche, on n'affiche
   QUE la grille de résultats filtrés.

2. **Produits de modules non filtrés** — `loadServiceProducts()` dans
   `src/hooks/useMarketplaceUniversal.ts:616`. Les items restaurant/agriculture/beauté/
   immobilier (ex. « Foutti », « Cocacola ») étaient injectés dans la grille **sans appliquer
   `searchQuery`** → polluaient les résultats. → Filtre insensible accents/casse ajouté sur
   nom + description + catégorie avant injection.

Flux page d'accueil : `HomeSearchBar` (Entrée) → `navigate('/marketplace?search=…')` →
Marketplace lit `searchParams.get('search')` au montage. OK une fois (1) et (2) corrigés.

Vérifié via pilotage réel (Playwright, port 5173) : « Papier » → 1 résultat, « Encre » →
produits Encre uniquement, terme inexistant → « Aucun produit trouvé » + bouton Réinitialiser.

## Vérifications
- `npx tsc --noEmit` → **exit 0** (0 erreur TypeScript)
- Greps de l'audit → tous satisfaits
- HMR Vite recompilé sans erreur (seul `/healthz.json` ECONNREFUSED = backend Node non lancé localement, hors périmètre)

## Fichiers modifiés
- `src/pg/Marketplace.tsx` (imports `ExternalLink`/`X`, renommage affiliés, message vide, title Mondial)
- `src/components/marketplace/ServiceTypesGrid.tsx` (Promise.all)
