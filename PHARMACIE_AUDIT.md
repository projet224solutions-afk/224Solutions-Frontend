# PHARMACIE_AUDIT.md — Architecture de référence des services (avant construction)

> But : documenter **exactement** comment un service de l'app est structuré, afin que le
> service **Pharmacie** soit ajouté **à l'identique**, sans modifier ni casser l'existant.
> Service de référence retenu : **Restaurant** (le plus complet : module 10 onglets, paiement
> atomique, abonnements, agents, livraison, copilot, temps réel, marketplace public).

Date : 2026-06-17. Règle d'or : **AJOUT pur** (nouveau `service_type` + nouveaux fichiers).
On ne touche pas aux services existants.

---

## 0. Constat préalable — « pharmacie » aujourd'hui

- Il n'existe **pas** de service Pharmacie autonome. Le code `sante` (service_type id
  `3ce16e66-fb56-47a5-831a-ca879e71cdda`, `serviceTypesConfig.ts`) porte `legacyCodes:['…','pharmacie','pharma']`
  et est rendu par `HealthModule` (dashboard analytics générique santé qui délègue produits/ventes
  au compte **vendeur**). Ce n'est PAS le service demandé (ordonnance → validation pharmacien).
- **Décision** : créer un **nouveau service_type `pharmacie`** (catégorie « Santé & Bien-être »,
  à côté de `sante`), avec son propre module et son propre flux métier. On **ne retire pas** la
  pharmacie de `sante` (non destructif) ; on ajoute un service distinct.

---

## 1. Les briques communes d'un service (ce que TOUT service réutilise)

| Brique | Fichier / objet | Rôle | Réutilisé tel quel ? |
|---|---|---|---|
| Table service pro | `professional_services` (user_id, service_type_id, business_name, status, latitude/longitude, logo_url, cover_image_url, metadata, rating, total_reviews, opening_hours) | Identité du service, propriété = `user_id` | ✅ OUI |
| Type de service | `service_types` (code, name, category, icon) + `src/config/serviceTypesConfig.ts` | Catalogue des services | ➕ AJOUTER `pharmacie` |
| Point d'entrée propriétaire | `src/pg/ServiceDashboard.tsx` (`/dashboard/service/:serviceId`) | `userServices.find(id)` = propriété ; si `FULL_MODULE_CODES.has(code)` → rend le module plein écran | ➕ AJOUTER `pharmacie` à `FULL_MODULE_CODES` |
| Routeur de module | `src/components/professional-services/modules/ServiceModuleManager.tsx` (`MODULE_MAP`) | code → composant module | ➕ AJOUTER `'pharmacie': PharmacyModule` |
| Wallet temps réel | `WalletBar` (Ably) + `<Money>` (FX) + primitives `credit_user_wallet_safe` / `wallet_debit_internal` | Solde + recharge sur chaque page | ✅ OUI |
| Copilot | `src/components/service-common/Copilot224.tsx` (`service=<code>` → personnalité backend `/api/v2/copilot`) | Assistant contextuel (bulle) | ✅ OUI (perso « pharmacie » côté backend) |
| Abonnement | `service_plans` (par `service_type_id`) + RPC `get_service_subscription` + `resolve_service_commission_rate` + `purchase_service_subscription_atomic` + `ServiceSubscriptionCard` / `SubscriptionBadge` | Plans + commission + gating | ➕ AJOUTER les 4 plans `pharmacie` |
| Paiement atomique | RPC `process_restaurant_order` (modèle) : débit client → crédit net service → commission PDG, idempotent (clé unique), garde wallet, ledger `wallet_transactions` | Encaissement tout-ou-rien | ➕ CRÉER `process_pharmacy_order` (calqué) |
| Livraison | `deliveries` (+ pont `restaurant_order_id`, `ensureRestaurantDelivery`, trigger filet de sécurité, `pay_restaurant_delivery`) ; système livreur commun (`useDelivery`, `LivreurDashboard`, GPS Ably) | Dispatch coursier mutualisé | ✅ RÉUTILISER (ajouter `pharmacy_order_id`) |
| Découverte client | `src/pg/Restaurants.tsx` + `useRestaurantsDiscovery` + endpoint **public** `/api/v2/restaurant/marketplace` (service-role, tri par plan, ouvert/fermé, badges) | Liste publique côté client | ➕ CRÉER équivalent pharmacie |
| Agents + permissions | `restaurant_agents` + `is_service_owner_or_agent` + UI gestion + interface agent filtrée | Délégation par module | ⏳ OPTIONNEL (phase ultérieure) |
| Avis | `service_reviews` + trigger `recompute_service_rating` → `professional_services.rating/total_reviews` ; RPC `submit_restaurant_review` (achat vérifié, 1/client) | Notation | ✅ RÉUTILISER (RPC pharmacie analogue) |
| Backend routes | `backend/src/routes/restaurant.routes.ts` monté `/api/v2/restaurant` (verifyJWT, priceOrder serveur, propriété vérifiée, `allowAnonymous` pour endpoints publics) | API métier | ➕ CRÉER `pharmacy.routes.ts` → `/api/v2/pharmacy` |
| Notifications | Firebase FCM (push) + Ably (canaux temps réel) | Alertes | ✅ RÉUTILISER (canaux `pharmacy-*`, `prescription-*`, `order-*`) |

---

## 2. Le flux d'un paiement de service (modèle restaurant → pharmacie)

`process_restaurant_order` (migrations 20260615400000 → 20260616140000) :
1. **Idempotence** : si `idempotency_key` déjà vu → renvoie le résultat existant (pas de double débit).
2. **Garde** : service introuvable / auto-commande / wallet service bloqué → refus AVANT tout débit.
3. **Commission** : `resolve_service_commission_rate(owner,'<service>',défaut)` = POURCENTAGE → `/100`.
4. **Débit client** `wallet_debit_internal` → **crédit net service** `credit_user_wallet_safe`
   (FX/AML/cap) → **assertion** crédit reçu sinon rollback → **commission PDG**.
5. **Ledger** `wallet_transactions` (type enum — penser à ajouter `pharmacy_payment` si besoin).
6. `REVOKE ALL FROM PUBLIC` + `GRANT service_role`. Appel via backend (jamais le client direct).

➡️ **Pharmacie** : `process_pharmacy_order` suit EXACTEMENT ce squelette + une **garde médicale
spécifique** : refuser si l'ordonnance liée n'est pas `status='validated'` (cf. spec). Commission
via `resolve_service_commission_rate(pharmacy_owner,'pharmacy',15)`. ⚠️ NE PAS faire d'`UPDATE wallets
SET balance` brut (le SQL de la spec est indicatif) — utiliser les **primitives durcies** comme le
restaurant (AML/FX/quarantaine/ledger), sinon on contourne la sécurité argent de la plateforme.

---

## 3. Le flux livraison (réutiliser, ne pas recréer)

- Table `deliveries` polyvalente : `order_id` (e-commerce, nullable), `restaurant_order_id` (FK unique).
- Course créée à l'acceptation (backend) + **filet de sécurité** trigger `ensure_restaurant_delivery`
  (création quel que soit le chemin) ; versement livreur à la livraison via `pay_restaurant_delivery`
  (frais en séquestre payés par le client, 98,5 % au livreur).
- ➡️ **Pharmacie** : ajouter `pharmacy_order_id` (FK unique) à `deliveries` + une fonction
  `ensure_pharmacy_delivery` analogue, et réutiliser tout le système livreur (`useDelivery`, GPS Ably,
  `ClientDeliveryTracking`). **Aucune** recréation de système de livraison.

---

## 4. Abonnements (auditer avant de créer — comme demandé)

Système `service_plans` **déjà robuste et vérifié** (cf. mémoire) :
- Paiement AVANT activation : `purchase_service_subscription_atomic` (débit puis insert sub). ✅
- Expiration coupe l'accès : `resolve_service_commission_rate` filtre `status='active' AND current_period_end>now()` → sinon défaut. ✅
- Plafonds appliqués par triggers DB (ex. plafond produits/promotions). ✅
- Commission par plan (`service_plans.commission_rate`). ✅

➡️ **Pharmacie** : insérer 4 lignes `service_plans` pour le `service_type_id` pharmacie :
| Plan | Prix/mois | Commission | Limites |
|---|---|---|---|
| Gratuit | 0 | (défaut) | 10 ordonnances/mois, sans livraison, bas de liste |
| Basic | 12 000 GNF | … | 50 ordonnances/mois, livraison, 100 médicaments |
| Pro | 30 000 GNF | … | illimité, badge partenaire, analytics, garde, priorité |
| Premium | 60 000 GNF | … | tout Pro + badge Certifiée, mise en avant, maladies chroniques, renouvellement auto |
(Le plafond « X ordonnances/mois » + « N médicaments » = nouveaux triggers de gating, sur le modèle
`enforce_service_product_cap` / `enforce_restaurant_promotion_cap`.)

---

## 5. Sécurité médicale (spécifique pharmacie, NON négociable)

- **Badge urgence** : composant `PharmacySafetyBadge` (« Urgence ? Appelez le 15… ») affiché sur
  CHAQUE page pharmacie (client + pharmacien).
- **Validation manuelle** : aucune ordonnance n'est validée automatiquement. `prescriptions.status`
  passe à `validated` UNIQUEMENT par action explicite du pharmacien (jamais de trigger/job auto).
- **Médicament sous ordonnance** : `pharmacy_medications.requires_prescription` ; non délivrable sans
  ordonnance validée. La RPC `process_pharmacy_order` REFUSE si `prescriptions.status<>'validated'`.
- **Copilot bridé** : la personnalité backend `pharmacy` interdit tout conseil médical/diagnostic ;
  réponse type → orienter vers pharmacien/médecin/téléconsultation. (Garde côté system prompt backend.)

---

## 6. Tables à créer (additives — voir spec pour le DDL détaillé)

`prescriptions`, `pharmacy_orders`, `pharmacy_medications`, `medication_reminders`, `pharmacy_oncall`.
Toutes en **RLS** : client voit les siennes (`client_id=auth.uid()`), pharmacien voit celles de son
service (propriété via `professional_services.user_id` / fonction dédiée), `service_role` plein accès.
⚠️ Ne PAS laisser de policy `USING (true)` (cf. fuite `restaurant_orders` corrigée cette session).
La spec fournie utilise `pharmacy_id REFERENCES auth.users` ; pour rester homogène avec les autres
services, on liera plutôt à `professional_services.id` (le compte pharmacien = `user_id` du service).

---

## 7. Écrans à créer (sur le modèle restaurant)

**Pharmacien** (module `PharmacyModule`, onglets — calqué sur `RestaurantModule`) :
1. Tableau de bord (4 métriques + file ordonnances + toggles ouvert/de garde)
2. **Validation des ordonnances** (cœur — file d'attente, photo zoomable, saisie médicaments, valider/refuser manuel)
3. Préparation (Kanban Payées→En prépa→Prêtes, comme `RestaurantOrdersKanban`)
4. Catalogue médicaments (CRUD `pharmacy_medications`, comme `RestaurantMenuManager`)
5. Garde & horaires (`pharmacy_oncall` + `opening_hours`)
6. Analytics (Recharts, comme `RestaurantAnalytics`)
+ Wallet / Liens de paiement / Copilot / Badge abonnement / Badge sécurité (barre commune).

**Client** :
- Accueil pharmacie (`/pharmacie`) : « J'ai une ordonnance » / « Pharmacie de garde » + liste pharmacies
  (public, sur le modèle `Restaurants.tsx`).
- Flux guidé d'envoi d'ordonnance (scan → choix pharmacie → mode récupération → envoi).
- Réception devis → paiement (PayButton224 → `process_pharmacy_order`).
- Suivi (timeline + GPS livreur Ably).
- Mes ordonnances (historique + renouvellement chronique).
- Rappels de prise (`medication_reminders` + FCM).

---

## 8. Points d'intégration (ne rien casser)

- `serviceTypesConfig.ts` : ➕ entrée `pharmacie` (catégorie Santé, `showInVendorSignup:true`).
- `ServiceModuleManager.MODULE_MAP` : ➕ `'pharmacie': PharmacyModule`.
- `ServiceDashboard.FULL_MODULE_CODES` : ➕ `'pharmacie'`.
- `App.tsx` : ➕ routes client `/pharmacie`, `/pharmacie/:id`, flux ordonnance (lazy + ProtectedRoute
  où nécessaire ; pages publiques sans garde).
- `service_types` (DB) : ➕ ligne `pharmacie` + 4 `service_plans`.
- Backend : ➕ `pharmacy.routes.ts` monté `/api/v2/pharmacy` (sans toucher les autres routes).
- Copilot backend : ➕ personnalité `pharmacy` (system prompt bridé).
- `deliveries` : ➕ colonne `pharmacy_order_id` (additive, comme `restaurant_order_id`).

---

## 9. Plan de construction par phases (testé à chaque étape, migrations à appliquer)

1. **Phase 1 — Fondation** : service_type `pharmacie` + serviceTypesConfig + tables (prescriptions,
   pharmacy_orders, pharmacy_medications, medication_reminders, pharmacy_oncall) + RLS scopé + 4 plans.
2. **Phase 2 — Paiement atomique** : RPC `process_pharmacy_order` (garde ordonnance validée + primitives
   durcies) + `pharmacy.routes` (envoi ordonnance, devis, paiement) + test e2e (paiement, idempotence,
   refus si non validée, solde insuffisant).
3. **Phase 3 — Interface pharmacien** : `PharmacyModule` (6 écrans) + branchement ServiceDashboard.
4. **Phase 4 — Interface client** : accueil + flux ordonnance + devis + suivi + mes ordonnances.
5. **Phase 5 — Livraison** : `pharmacy_order_id` + `ensure_pharmacy_delivery` + suivi GPS.
6. **Phase 6 — Garde, rappels, chronique, copilot bridé, notifications** + badges sécurité partout.
7. **Phase 7 — Découverte publique + tri par abonnement + analytics.**

Chaque phase = code additif + migration(s) à appliquer + test e2e, comme le service restaurant.

---

## 10. Rapports

- `PHARMACIE_AUDIT.md` (ce document) ✅
- `PHARMACIE_BUILD_REPORT.md` (au fil de la construction)
- `PHARMACIE_TEST_SCENARIOS.md` (scénarios : envoi, validation, refus, équivalent générique, paiement,
  livraison, retrait, garde, rappel, double paiement bloqué)
