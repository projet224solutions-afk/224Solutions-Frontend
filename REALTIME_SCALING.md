# Realtime & scalabilité (couche 3)

But : sortir les flux temps réel **haute fréquence** du chemin `postgres_changes` (qui tape le WAL
Postgres et ne tient pas à grande échelle) vers un **broadcast provider-agnostique** — Supabase
broadcast aujourd'hui, **Ably** (puis AWS IoT) par simple flag, sans réécrire la logique métier.

## Décision
| Catégorie | Transport | Pourquoi |
|---|---|---|
| Positions GPS continues (livraison, chauffeur, course) | **Broadcast** (abstraction `getLiveChannel`) | Haute fréquence + fan-out → tue le WAL |
| Présence en ligne | **Broadcast/presence** (déjà le cas) | Hors WAL |
| Statuts, notifications, argent, chat, SOS (rare) | **Supabase Realtime** (garder) | Basse fréquence / transactionnel |

## Abstraction
`src/lib/realtime/` : `getLiveChannel(name)` → adaptateur **Supabase** (défaut) ou **Ably** selon
`VITE_REALTIME_PROVIDER`. Helper positions : `src/lib/realtime/livePositions.ts`
(`publishLivePosition` / `subscribeLivePosition` + topics).

## Flux migrés en DUAL-MODE (postgres_changes + broadcast en parallèle)
1. **Positions livraison** — producteur `useDelivery.tsx`, abonné `ClientDeliveryTracking.tsx`.
2. **Position chauffeur taxi** (`taxi_drivers`) — producteur `TaxiMotoRealtimeService.publishDriverLocation`, abonné `useDriverTracking.ts`.
3. **Tracé de course** (`taxi_ride_tracking`) — producteur `TaxiMotoService.trackPosition`, abonné `useDriverTracking.ts`.

> Dual-mode = l'écriture DB est **inchangée**, le broadcast est **ajouté à côté**. Les deux chemins
> tournent en parallèle → rien n'est cassé ni manqué. **Base de données jamais modifiée.**

## Activer Ably (aucun code à écrire)
1. Créer un compte **Ably** → récupérer une **API Key**.
2. Backend : `ABLY_API_KEY=<clé>` (la route `/api/v2/realtime/token` signe les tokens).
3. Frontend (build) : `VITE_REALTIME_PROVIDER=ably`.
4. Redéployer. → Réversible en retirant les 2 variables.

## Bascule finale (décharger le WAL) — APRÈS validation live
Une fois le broadcast vérifié en conditions réelles (2 appareils : un producteur, un abonné) :
- Retirer le bloc `postgres_changes` de chacun des 3 abonnés (garder seulement `subscribeLivePosition`).
- Côté producteurs, on peut espacer/supprimer l'écriture DB des points GPS (passe à la **couche 5**
  : offload GPS → DynamoDB ; la donnée éphémère n'a pas besoin d'être en Postgres).
- Effet : le WAL Postgres n'encaisse plus le flux GPS → grosse baisse de charge DB.

## Reste du plan scaling
Couche 4 (cache) → Couche 5 (GPS → DynamoDB + **AWS IoT Core** = Option B) → Couche 6 (logs → Kinesis/S3).
