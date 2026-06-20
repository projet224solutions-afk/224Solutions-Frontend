# COPILOT_IMPROVEMENT_PLAN.md — Plan d'amélioration (additif, non destructif)

> À VALIDER avant tout code (Règle N°1, étape 4). Stratégie : **Copilot224 = composant unique**, étendu **additivement** ; contrat API existant **inchangé** ; autres copilots migrés écran par écran (Règle N°4) ; aucune edge function supprimée.

## Principe de non-régression (Règles N°2 & N°3)
- Le contrat **`POST /api/v2/copilot { service, message, history } → { reply }` reste IDENTIQUE.** Tous les nouveaux champs (requête & réponse) sont **OPTIONNELS** → si absents, comportement actuel **inchangé**.
- `Copilot224` garde ses props actuelles (`service`, `title`, `suggestions`). Les nouvelles props sont optionnelles avec valeurs par défaut sûres.
- Après **chaque** phase : re-test « Bonjour » → réponse OK, sinon rollback.

---

## Phase 1 — Contexte utilisateur temps réel  (capacité #1)
**CRÉER** `src/hooks/useCopilotContext.ts` — agrège : prénom, rôle, solde wallet + devise, service actif, 1-2 infos récentes. Lecture seule.
**MODIFIER** (additif) :
- `backend/src/routes/copilot.routes.ts` : accepter `context?` dans le body → injecté dans le system prompt (« Tu connais : … »). Si absent → comme avant.
- `src/components/service-common/Copilot224.tsx` : prop optionnelle `context?` envoyée si fournie.
*Pourquoi* : le copilot connaît l'utilisateur. *Non-cassant* : champ optionnel.

## Phase 2 — Mémoire persistante  (capacité #2)
**CRÉER** migration `copilot_memory` (user_id, service, role, content, created_at ; RLS user own) — OU réutiliser `copilot_conversations` si schéma compatible (à vérifier avant).
**CRÉER** `src/hooks/useCopilotMemory.ts` (charger/sauver l'historique).
**MODIFIER** (additif) `copilot.routes.ts` : à chaque tour, persister (best-effort) ; nouvel endpoint **`GET /api/v2/copilot/history`**. La route `/copilot` continue de renvoyer `{ reply }`.
**MODIFIER** `Copilot224.tsx` : au 1er ouverture, précharger l'historique (optionnel).
*Non-cassant* : nouvelle table + nouvel endpoint ; l'ancien flux marche sans.

## Phase 3 — Recherche marketplace  (capacité #6)
**CRÉER** endpoint Node `POST /api/v2/copilot/search` (réutilise la logique de `copiloteSearchService`, mais en **Node** conformément à la règle interne).
**MODIFIER** `Copilot224.tsx` : si l'IA détecte une intention « cherche un produit/service », afficher des **cartes résultats** sous la réponse (composant interne, additif).
*Non-cassant* : nouvel endpoint + rendu conditionnel.

## Phase 4 — Voix  (capacité #5) — optionnelle
**CRÉER** `src/hooks/useCopilotVoice.ts` (Web Speech API : `speechSynthesis` TTS + `SpeechRecognition` dictée). 100 % front, aucun backend.
**MODIFIER** `Copilot224.tsx` : bouton 🔊 (lire la réponse) + 🎤 (dicter), **désactivés par défaut**.
*Non-cassant* : purement additif, dégradation propre si le navigateur ne supporte pas.

## Phase 5 — Actions réelles  (capacités #3, #9, #10)
**MODIFIER** (additif) `copilot.routes.ts` : la réponse peut inclure `actions?: [{type, label, params}]` (ex. `navigate`, `prefill_booking`, `recharge_wallet`). Si l'IA ne propose rien → champ absent.
**MODIFIER** `Copilot224.tsx` : rendre des **boutons d'action** sous la réponse ; l'exécution se fait côté front (navigation, ouverture d'un écran). Aucune action sensible (paiement) sans confirmation explicite de l'utilisateur.
*Non-cassant* : `actions` optionnel ; le front l'ignore s'il est absent.

## Phase 6 — Proactivité  (capacité #4)
**MODIFIER** `Copilot224.tsx` : à l'ouverture (sans message), afficher 2-3 **suggestions contextuelles** dérivées du `context` (ex. « Ton abonnement expire dans 3 jours »). Réutilise la prop `suggestions` existante.
*Non-cassant* : enrichit l'écran d'accueil de la bulle.

## Phase 7 — Unification (Règle N°4)  — migration écran par écran
Remplacer progressivement `CopiloteChat` (et Vendor/niche) par `Copilot224` **un écran à la fois** :
1. `ClientDashboard` → 2. `VendorRoutes` → 3. `ActionnaireDashboard` → 4. `DigitalVendorCopilot`.
À chaque écran : monter `Copilot224`, vérifier « Bonjour », puis retirer l'ancien **de cet écran seulement**. `CopiloteChat.tsx` reste tant qu'un écran l'utilise.
**Suppression finale** de `CopiloteChat`/edge functions = **action destructive → validation explicite requise** (Règle N°2). PDGCopilot (analyse par ID) **conservé**.

## Phase 8 — Capacités avancées (optionnel, nécessite clés externes)
- **#8 Recherche internet** : endpoint Node `POST /api/v2/copilot/web` (API de recherche — clé requise).
- **#7 Apprentissage auto des features** : indexer une base de connaissances de l'app (doc interne) injectée dans le contexte.
→ Planifiées séparément (dépendances externes).

---

## Récapitulatif des fichiers

### MODIFIÉS (additif uniquement, contrat inchangé)
- `backend/src/routes/copilot.routes.ts` — champs optionnels `context`, persistance, `actions`, endpoints `/history` & `/search`.
- `src/components/service-common/Copilot224.tsx` — props optionnelles (context, voix, mémoire, actions, résultats).
- `src/pg/ServiceDashboard.tsx` — passe le `context` (mineur).
- (Phase 7) écrans montant CopiloteChat → montent Copilot224, un par un.

### CRÉÉS (nouveaux fichiers)
- `src/hooks/useCopilotContext.ts`
- `src/hooks/useCopilotMemory.ts`
- `src/hooks/useCopilotVoice.ts`
- `supabase/migrations/…_copilot_memory.sql` (si nécessaire après vérif de `copilot_conversations`)
- (Phase 3) endpoint search Node ; (Phase 8) endpoint web.

### NE PAS TOUCHER (tant que non migré / sans validation)
- `CopiloteChat.tsx`, `CopiloteService.ts`, `useCopilote.ts`, `useVendorCopilot.ts`, `PDGCopilot*`, les **6 edge functions**, la table `copilot_conversations`.

## Ordre d'exécution proposé
Phase 1 → 2 → 6 → 3 → 5 → 4 → 7 → (8). Chaque phase = un lot testé (tsc + « Bonjour ») avant la suivante.
