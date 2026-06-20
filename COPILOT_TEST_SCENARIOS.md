# COPILOT_TEST_SCENARIOS.md — Scénarios de test

> Pré-requis : backend Node relancé + migrations `20260615360000` & `20260615370000` appliquées + front rechargé (Ctrl+Shift+R). Clé IA (`LOVABLE_API_KEY`/`OPENAI_API_KEY`) optionnelle (sinon repli + web + mémoire fonctionnent quand même).

## 1. Réponse basique (non-régression)
- Ouvre la bulle 🤖 → tape « Bonjour ».
- ✅ Attendu : réponse arrive ; si connecté, « Bonjour {prénom} ».

## 2. Contexte temps réel
- Demande « Quel est mon solde ? ».
- ✅ Attendu : le copilot connaît ton solde/devise (injecté au prompt).

## 3. Mémoire structurée (extraction + rappel)
- Tour 1 : « Je suis coiffeur » puis « je préfère sans oignon ».
- Tour 2 (même user, plus tard) : « Recommande-moi quelque chose ».
- ✅ Attendu : extraction dans `copilot_memories` (type fact/preference) ; au tour suivant, le prompt inclut « CE QUE JE SAIS DE TOI » → réponse personnalisée.
- Vérif DB : `SELECT type, content, importance FROM copilot_memories WHERE user_id = '<toi>';`

## 4. Mémoire d'historique (persistance)
- Discute, ferme la bulle, rouvre-la (ou recharge la page).
- ✅ Attendu : l'historique se **recharge** (table `copilot_memory` via `/history`).

## 5. Recherche marketplace
- « cherche une robe » / « je veux acheter du riz ».
- ✅ Attendu : réponse + **cartes produits** (image, nom, prix) cliquables → /marketplace.

## 6. Recherche internet (sans clé)
- « C'est quoi la blockchain ? » / « Qui est Sékou Touré ? » / « Capitale du Sénégal ».
- ✅ Attendu : réponse basée sur DuckDuckGo/Wikipedia (champ `source: 'web'` côté API).

## 7. Action avec navigation
- « Comment recharger mon wallet ? » / « Je veux réserver un salon ».
- ✅ Attendu : réponse + **bouton d'action** (Recharger / Trouver un salon) → navigue vers l'écran. (Aucun paiement automatique.)

## 8. Suggestion proactive (solde bas)
- Avec un solde < 5 000 : ferme la bulle.
- ✅ Attendu : **carte proactive** « Votre solde est bas » au-dessus de la bulle (qui pulse) + bouton Recharger / Plus tard.

## 9. Guide de l'app (apprentissage features)
- « Comment ça marche l'application ? » / « Où voir mes rendez-vous ? ».
- ✅ Attendu : réponse guidée précise (wallet, beauté, abonnement…) **+ liste dynamique des services actifs** (lue en DB → inclut tout nouveau service).

## 10. Mode voix
- Active 🔊 (entête) → pose une question → ✅ la réponse est **lue à voix haute** (fr-FR).
- Tape 🎤 → parle → ✅ le texte dicté remplit le champ.
- (Si le navigateur ne supporte pas : les boutons n'apparaissent pas — dégradation propre.)

## 11. Unification (un seul composant)
- Dashboard **client** → onglet Copilot : ✅ même copilot en **plein écran** (mode embedded).
- Sur un **service** : ✅ même copilot en **bulle**.
- ✅ Attendu : comportement identique (contexte, mémoire, recherche, voix) dans les deux modes.

## 12. Repli sans clé IA (robustesse)
- Sans `LOVABLE_API_KEY`/`OPENAI_API_KEY` : pose une question « comment/où ».
- ✅ Attendu : réponse utile (repli contextuel ou info web), **jamais** « Copilot indisponible ».

## Différé (nécessite clé/infra) — NON couvert par ces tests
Streaming SSE, tool-calling Claude, contexte Ably temps réel, extraction LLM, exécution réelle des commandes/réservations, cache Redis.
