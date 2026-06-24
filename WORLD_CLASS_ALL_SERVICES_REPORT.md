# SERVICES DE PROXIMITÉ — NIVEAU MONDIAL — RAPPORT D'APPLICATION
Date : 2026-06-22 · Méthode : vérification + adaptation de chaque item au vrai code (build de contrôle par lot)

> ⚠️ Le prompt source était **tronqué** (s'arrête en plein Service 9). Services 10-11 et la fin du 9 absents.
> ⚠️ Les snippets du prompt sont des **esquisses basées sur un état ancien** : ~40% nécessitaient correction (colonnes inexistantes, fonctionnalités déjà présentes, ou hypothèses fausses). Détail ci-dessous.

## ✅ Services traités (build exit 0)

### S1 — Beauté / Coiffeur
- ✅ 1.1 Couleurs par coiffeur dans l'agenda — **adapté** : couleur staff si `staff_id`, sinon couleur catégorie (sinon régression des salons mono-coiffeur).
- ✅ 1.3 Couleurs de statuts corrigées (terminé=vert, annulé=rouge).
- ✅ 1.4 Onglet Commissions — **amélioré** : branché sur données complètes (`useBeautyAppointmentsAll`) au lieu du sous-ensemble « récent » (sinon montants faux).
- ⏭️ 1.5 Acompte + service à domicile : **DÉJÀ présents** dans `BeautyServices` → non dupliqués.
- ⚠️ 1.2 « Mode occupé » DB : colonne `professional_services.is_available` **inexistante** + aucun enforcement → gardé le toggle **local** (pas de régression). Réel = migration + blocage dans le flux de réservation.
- ✅ 1.6 `HairdresserModule` (640 lignes mock) **réécrit** : réutilise les composants Beauté réels (`BeautyAgenda`, `BeautyServices`, `BeautyClients`, `BeautyGallery`) via `serviceId` → interface salon 100% réelle, fin du mock. (Équipe/fidélité mock supprimés : pas de tables ; clients/galerie réels couvrent l'essentiel.)

### S2 — VTC / Taxi / Moto
- ✅ **2.4 Vrai correctif** : validation prix > 0 (avant : prix 0 / négatif / NaN acceptés).
- ✅ 2.2 Dashboard gains (4 cartes + objectif).
- ✅ 2.3 Surge pricing ×1/×1.2/×1.5/×2 (replié dans le prix, course uniquement).
- ⚠️ 2.1 Toggle En ligne/Hors ligne : même colonne `is_available` inexistante → **sauté**.

### S3 — Livraison
- ✅ 3.2 Prix auto par distance (barème 0-3 / 3-7 / 7+ km).
- ✅ 3.1 Barème tarifaire affiché.
- ⚠️ 3.3 Photo de preuve : pas de colonne de stockage sur `mobility_jobs` (le snippet ne faisait qu'un toast) → **sauté** (réel = colonne `proof_photo_url` + upload).

### S4 — Nettoyage
- ✅ 4.2 Couleurs de statuts corrigées — **adapté** (forme `{color,label}` conservée, sinon casse le JSX).
- ✅ 4.3 Badge « Agent vérifié ».
- ⏭️ 4.1 Réservation récurrente : **DÉJÀ présente** (checkbox + fréquences + remises) → non dupliquée.

### S5 — Clinique / Santé
- ✅ 5.2 Carte « Prochaine disponibilité » (style Zocdoc).
- ✅ 5.3 Indicateur no-show (RDV confirmé dont l'heure est passée + bouton « Marquer absent »).
- ⏭️ 5.1 Couleurs statuts : déjà distinctes (amber/blue/violet/emerald/gray) via i18n → non touché (les remplacer casserait les `labelKey`).
- ✅ 5.4 « IDOR » : **N/A** — les écritures passent par le backend `/api/v2/bookings/:id/status` (ownership enforced serveur), pas d'`update` supabase direct.

### S6 — Artisans (Plombier/Vitrier/Menuisier/Soudeur)
- 🛑 **AUCUNE modification — le « bug critique » du prompt est FAUX.** `useArtisanInterventions('artisan')` / `useArtisanQuotes('artisan')` prennent un **rôle** (`'artisan'|'client'`), pas un `serviceId` ; ils scopent déjà par `user.id` (`artisan_id`). Remplacer par `serviceId` aurait fait filtrer par `client_id` → **l'artisan ne verrait plus aucune intervention**. 6.2 inutile, 6.3 = toast factice, 6.4 = cosmétique. Code existant correct.

### S8 — Fitness / Salle de sport
- ✅ 8.1 Types de cours avec icônes (yoga/HIIT/pilates/muscu/cardio/boxe/natation/individuel → `service_code`).
- ✅ 8.3 Rendu enrichi (icône + couleurs/labels de statuts), actions conservées.
- ⚠️ 8.2 Capacité max / cours collectif : `NewBooking` ne supporte pas `max_capacity`/`is_group` → non persisté → **sauté** (réel = colonnes dédiées).

### S7 — Coach sportif
- ✅ **Réécrit en données réelles** (651 lignes de mock supprimées) : séances via `useServiceBookings` (création + actions confirmer/démarrer/terminer/annuler), clients **dérivés** des séances (par téléphone/nom), onglet Progression (streak global + clients les plus actifs). Programmes mock supprimés (pas de table).

### S9 — Agriculture
- ✅ Module **déjà réel et bien construit** (KPIs réels, produits/commandes/clients/saisons via `useFarm`) ; saisons **déjà guinéennes** (sèche/pluies/toute l'année). Ajout : **calendrier de référence des cultures typiques par saison en Guinée** (contenu agronomique de planification, distinct des produits réels du vendeur).
- ⚠️ Prix du marché (FBN) + achats groupés (Pinduoduo) : **non faits** — nécessitent un flux de prix réel / un backend d'achats groupés inexistants ; les fabriquer serait de la fausse donnée. Spec exacte d'ailleurs **tronquée**.

## ⛔ Bloqués (contenu absent du prompt)
- **S10 & S11** : entièrement **coupés** par la limite 50 000 caractères — aucun contenu reçu. À fournir pour traitement au mot près.

## 🔌 Audit complet des interfaces de service (post-passe)
Vérification du registre `ServiceModuleManager` : **tous les types de service ont une interface**.
- **Branchés au réel** : les 9 ci-dessus + 4 wrappers de `ServiceProjectWorkspace` (Informatique, Freelance, Maison/Déco, Réparation) + 7 à hooks réels (Immobilier, Photo, Santé, Éducation, E-commerce, Pharmacie, Construction) + Restaurant.
- **Mode + Électronique** : étaient des coquilles UI sans persistance → **réécrits en wrappers d'`EcommerceModule`** (moteur e-commerce réel). ✅
- **Désactivés volontaires** : Voyage (`VOYAGE_IS_ACTIVE=false`) + Traiteur (stub) — « bientôt disponible » assumé.

## Décision produit appliquée
Pour Coach (S7) et Coiffeur (S1.6), choix utilisateur = « brancher les séances au réel + empty-state le reste » (pas de nouvelles tables). Clients/équipe/programmes/fidélité sans table → soit dérivés des réservations, soit retirés, jamais fabriqués.

## Constat transversal
Une grande partie des « fonctionnalités » du prompt sont soit déjà présentes, soit basées sur des colonnes/hypothèses inexistantes. Les vrais gains livrés : **validation prix VTC**, dashboards & couleurs de statuts cohérentes, surge pricing, prix livraison par distance, commissions beauté (données réelles), no-show clinique, badges. Les toggles de disponibilité (mode occupé / en ligne) et la photo de preuve livraison nécessitent un **changement de schéma + enforcement** pour être réels (non fabriqués en façade).

## Build : frontend exit 0 ✅ (à chaque lot S1→S5, S8)
