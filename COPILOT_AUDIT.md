# COPILOT_AUDIT.md — État actuel du Copilot 224

> Audit par lecture du code (Règle N°1). Aucune ligne modifiée à ce stade.

## 1. Test de référence (Règle N°3)
Copilot **opérationnel** : `Copilot224` (bulle) → `POST /api/v2/copilot` (backend Node) → réponse.
Sans clé IA (`LOVABLE_API_KEY`/`OPENAI_API_KEY`), un **repli contextuel par métier** répond (ajouté récemment). Avec clé → IA réelle (Gemini/GPT). « Bonjour » renvoie une réponse. ✅

## 2. Cartographie — ce qui EXISTE (⚠️ FRAGMENTÉ : 5-6 copilots, viole la Règle N°4)

### A. Copilot224 — `src/components/service-common/Copilot224.tsx`
- Bulle flottante, historique de **session** (non persisté), suggestions.
- API : **backend Node** `POST /api/v2/copilot` (`backend/src/routes/copilot.routes.ts`).
- `SERVICE_PROMPTS` : prompt expert par métier (20+ services), garde-fous, repli sans clé.
- **Monté** : `ServiceDashboard.tsx` (2 chemins de rendu). ✅ Conforme à la règle « tout en Node.js ».

### B. CopiloteChat — `src/components/copilot/CopiloteChat.tsx` (interface « ChatGPT »)
- UI riche (avatars, scroll, historique). `useCopilote` → `CopiloteService` (v3.0 : circuit breaker + audit trail).
- API : **Edge Function** `pdg-ai-assistant` (via `supabase.functions.invoke`).
- Contexte utilisateur : `UserContext` (name, role, **balance**, currency).
- Recherche marketplace : `copiloteSearchService` → `/edge-functions/copilote/search`.
- **Persistance** : table `copilot_conversations`.
- **Monté** : `ClientDashboard`, `ActionnaireDashboard`, `VendorRoutes`, `DigitalVendorCopilot`.

### C. VendorCopilot — `useVendorCopilot.ts`
- API : Edge Function `vendor-ai-assistant` (analyse dashboard/inventaire/ventes/clients).

### D. PDGCopilot — `PDGCopilot.tsx` + `usePDGCopilot` + `PDGCopilotService`
- Analyse exécutive à partir d'un **ID** (vendeur/client/transaction). Edge Functions `pdg-ai-assistant` / `pdg-copilot`.

### E. Niche : `RealEstateCopilot`, `DigitalVendorCopilot`.

### Edge Functions IA existantes (6)
`ai-copilot`, `client-ai-assistant`, `pdg-ai-assistant`, `pdg-copilot`, `service-ai-assistant`, `vendor-ai-assistant`.

### Tables
- `copilot_conversations` (persistance/mémoire — utilisée par CopiloteChat).
- `conversations` / `conversation_participants` (messagerie, **distincte** du copilot).

## 3. Ce qui FONCTIONNE et NE DOIT PAS être cassé
- ✅ `Copilot224` + route Node `/api/v2/copilot` (+ repli sans clé). **Socle à conserver et étendre.**
- ✅ `CopiloteChat` persistance (`copilot_conversations`) + `UserContext` + audit trail.
- ✅ `copiloteSearchService` (recherche marketplace) — réutilisable.
- ✅ PDGCopilot (analyse par ID) — spécialisé, à garder tel quel.

## 4. Ce qui MANQUE (vs les 10 capacités demandées)
| # | Capacité | État |
|---|---|---|
| 1 | Contexte utilisateur temps réel | 🟠 partiel (CopiloteChat: name/role/balance ; Copilot224: **aucun**) |
| 2 | Mémoire inter-conversations | 🟠 CopiloteChat persiste ; **Copilot224 = session seule** |
| 3 | Actions réelles (réserver/payer/chercher) | 🔴 absent (pas de function calling / tools) |
| 4 | Proactivité (suggestions spontanées) | 🔴 absent |
| 5 | Réponse **vocale** | 🔴 absent |
| 6 | Recherche produits marketplace | 🟠 existe pour CopiloteChat, **pas branché à Copilot224** |
| 7 | Apprentissage auto des features | 🔴 absent |
| 8 | Recherche internet | 🔴 absent |
| 9 | Connecter tous les services entre eux | 🔴 absent |
| 10 | Guider l'utilisateur | 🟠 partiel (prompts métier) |

## 5. Problèmes / dette (à corriger sans casser)
1. **🔴 Fragmentation (Règle N°4)** : 5-6 composants copilot + 6 edge functions. Un seul devrait exister.
2. **Mélange Node ↔ Edge Functions** : Copilot224 = Node (conforme à la règle interne « tout en Node.js, jamais Edge ») ; CopiloteChat/Vendor/PDG = Edge Functions. → direction = **converger vers Node**.
3. **Copilot224 sans contexte ni mémoire** : il ne connaît pas l'utilisateur ni l'historique passé.
4. **Pas d'actions, pas de voix, pas de recherche** dans Copilot224.

## 6. Décision d'architecture proposée (à valider)
**`Copilot224` devient le composant UNIQUE** (déjà Node, déjà monté globalement, conforme à la règle interne). On l'**étend additivement** (contexte, mémoire, recherche, voix, actions). Les autres copilots (CopiloteChat, Vendor, niche) seront **migrés écran par écran** vers Copilot224, l'ancien restant disponible jusqu'à migration de chaque écran (Règle N°2 : additif ; Règle N°4 : un seul à la fin). PDGCopilot (analyse par ID) reste spécialisé. **Aucune** edge function supprimée (on les laisse, on cesse progressivement de les appeler).
