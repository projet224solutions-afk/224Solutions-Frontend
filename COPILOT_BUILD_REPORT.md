# COPILOT_BUILD_REPORT.md — Ce qui a été construit

> Amélioration ADDITIVE du Copilot 224 existant (un seul composant). Aucun fichier supprimé, contrat `/api/v2/copilot` inchangé, tsc front+back = 0, build de production OK.

## Construit (opérationnel)

### Contexte temps réel (PART 3, version réelle)
- `src/hooks/useCopilotContext.ts` — prénom, rôle, **solde+devise**, service courant (lecture seule, dégradation propre).
- Injecté dans le system prompt backend (champ `context` optionnel).
- ⚠️ Adaptation : pas d'Ably temps réel (le solde est lu à l'ouverture, pas poussé en live). Le canal Ably wallet/orders/bookings est **différé** (infra).

### Mémoire (PART 2) — DEUX niveaux
- **Historique brut** : table `copilot_memory` + persistance best-effort + `GET /api/v2/copilot/history` + préchargement de la bulle.
- **Mémoires STRUCTURÉES** : table `copilot_memories` (type preference/action/fact/feedback, importance 1-3, tags, expiration). **Extraction heuristique** (sans clé IA) des préférences/faits depuis les messages, **réinjectées** dans chaque prompt (« CE QUE JE SAIS DE TOI »).
- ⚠️ Adaptation : extraction par règles (pas d'appel LLM d'extraction — ça nécessiterait une clé). Si une clé IA est ajoutée, l'extraction peut être enrichie. Pas de cache Redis (lecture DB directe, légère).

### Actions (PART 4, version sûre)
- `deriveActions()` → boutons d'action sous la réponse (Recharger wallet, Marketplace, Réserver, Mes RDV) = **navigation**, jamais de paiement/commande automatique.
- ⚠️ Différé : le registre complet (place_order, request_taxi, book_appointment avec exécution réelle + ActionCard de confirmation) — gros chantier, exécute de l'argent → à faire avec une UX de confirmation dédiée.

### Proactivité (PART 5, version légère)
- Carte proactive « solde bas » au-dessus de la bulle (+ pulse) avec « Recharger / Plus tard ».
- Suggestions contextuelles à l'ouverture (`proactiveSuggestions`).
- ⚠️ Différé : moteur 30s + triggers RDV-2h / commande-en-retard / heure-déjeuner (nécessite le contexte temps réel Ably).

### Recherche (PART 1 & 7)
- **Marketplace** : `POST /api/v2/copilot/search` (Node) + cartes produits sous la réponse.
- **Internet (sans clé)** : `webSearch()` via DuckDuckGo Instant Answer + Wikipedia FR.

### Voix (PART 8)
- `src/hooks/useCopilotVoice.ts` (Web Speech API : TTS + dictée). Boutons 🔊/🎤, off par défaut, dégradation propre.

### Apprentissage features (PART 6, version DB)
- `dynamicAppKnowledge()` lit `service_types` actifs → nouveaux services connus **automatiquement**.
- Tables `copilot_tutorials_completed` / `copilot_features_seen` créées (suivi).
- ⚠️ Différé : `OnboardingOverlay` interactif + tutoriels pas-à-pas (UI lourde).

### Interface (PART 9) & Unification (PART 10)
- **Un seul composant** `Copilot224` bi-mode : `variant="bubble"` (flottant) | `variant="embedded"` (plein écran, remplace l'ancien `CopiloteChat` sur ClientDashboard / Vendor / Actionnaire / DigitalVendor).
- Cartes produits + boutons d'action + carte proactive intégrés.

### Backend (PART 11)
- Route Node `/api/v2/copilot` (+ `/history`, `/search`). System prompt = persona métier + contexte + mémoire + guide app + info web. Repli sans clé IA opérationnel.
- ⚠️ Différé : **streaming SSE** + **tool-calling Claude** + rate-limit Redis (nécessitent clé Claude + Redis prod).

## Migrations (à appliquer)
- `20260615360000_copilot_memory.sql` (historique) — appliquée.
- `20260615370000_copilot_advanced.sql` (mémoires structurées + tutoriels + features).

## Honnêteté — ce qui nécessite des CLÉS / INFRA (différé)
1. **Streaming Claude + tool-calling** → clé Anthropic.
2. **Extraction de mémoire par LLM** (vs heuristique) → clé IA.
3. **Contexte temps réel Ably** (wallet/orders/bookings poussés live) → config Ably.
4. **Cache Redis** des mémoires → Redis prod.
5. **Exécution réelle des actions** (commander/réserver/taxi) → UX de confirmation + branchement aux RPC atomiques existants.
