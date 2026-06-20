# Feuille de route scalabilité AWS (100M) — état & couches 5–6

## État global
| Couche | Objet | État | Bloqueur |
|---|---|---|---|
| 1 | Scaling horizontal backend (ECS Fargate) | ✅ Code prêt | Provisionner ECS/ALB/ElastiCache |
| 2 | Pooling DB | ✅ Déjà sûr (PostgREST) | — |
| 3 | Realtime (flux GPS hors WAL) | ✅ Code prêt (dual-mode) | Valider live + activer Ably |
| 4 | Cache | ✅ FX caché + helper `getOrSet` | — (autres cibles en option) |
| 5 | GPS → DynamoDB + AWS IoT Core | ⏳ **Gated AWS** | Compte/ressources AWS |
| 6 | Logs/analytics → Kinesis/S3 | ⏳ **Gated AWS** | Compte/ressources AWS |
| (S) | Stockage fichiers → S3 + CloudFront | ⏳ **Gated AWS** | Compte/ressources AWS |

> Les couches 1–4 couvrent ce qui est réalisable **sans AWS**. Les couches 5–6 (+ stockage)
> exigent des **ressources AWS provisionnées** ; le code est conçu pour s'y brancher par flag.

---

## Couche 5 — GPS : DynamoDB (données) + AWS IoT Core (temps réel)

**Pourquoi** : les positions GPS continues sont le plus gros volume d'écritures. À 100M, elles ne
doivent ni taper le WAL Postgres (fait : broadcast en couche 3) ni être stockées en relationnel.

**Cible** :
- **Temps réel** → AWS IoT Core (MQTT) : adaptateur `LiveChannel` (même interface que Supabase/Ably).
  `VITE_REALTIME_PROVIDER=aws-iot`. Encaisse des millions de connexions simultanées.
- **Historique/télémetrie** → DynamoDB (clé partition `entityId`, tri `timestamp`, TTL auto pour
  purge des points anciens) ou Timestream (séries temporelles).

**Étapes** :
1. **Avant AWS (déjà possible)** : valider le broadcast live (2 appareils) sur les 3 flux migrés
   (couche 3), puis **retirer les `postgres_changes`** de ces abonnés → WAL déchargé immédiatement.
   Ensuite **throttler l'écriture DB** des points GPS (ex. 1 point/10 s pour l'historique au lieu de
   chaque point) dans `useDelivery`/`TaxiMotoService.trackPosition`.
2. **Provisionner AWS** : table DynamoDB `live_positions` (PK `entity_id`, SK `ts`, TTL `expire_at`),
   AWS IoT Core (politique + endpoint), IAM.
3. **Backend** : endpoint `/api/v2/realtime/iot-endpoint` (URL WebSocket signée SigV4) + writer
   DynamoDB (`@aws-sdk/client-dynamodb`). Adaptateur front `awsIotLiveChannel` (lazy `mqtt`).
4. **Bascule** : `VITE_REALTIME_PROVIDER=aws-iot`, rediriger les writes historiques vers DynamoDB.

---

## Couche 6 — Logs / analytics → Kinesis → S3 (→ Athena/Redshift)

**Pourquoi** : les logs d'événements/analytics sont append-only et énormes ; ils ne doivent jamais
gonfler Postgres.

**Cible** : producteur backend → **Kinesis Data Firehose** → **S3** (Parquet) → requêtes **Athena**
(ou chargement Redshift). Bus d'événements déjà esquissé : `src/services/kafka/HybridEventService.ts`.

**Étapes** :
1. **Provisionner** : flux Firehose + bucket S3 + (option) table Athena.
2. **Backend** : abstraction `trackEvent(type, payload)` → écrit en `logger` aujourd'hui, **PutRecord**
   Kinesis quand `ANALYTICS_SINK=kinesis` (`@aws-sdk/client-firehose`). Brancher aux points
   d'événements (commandes, connexions, actions).
3. **Bascule** : `ANALYTICS_SINK=kinesis`. Archiver/élaguer `audit_logs` Postgres (garder N jours).

---

## Stockage fichiers (image/vidéo) → S3 + CloudFront

Actuel : **GCS** (bucket `224solutions`) primaire + **Supabase Storage** repli. Abstraction
`useStorageUpload` (mapping dossier→bucket) déjà en place.
**Cible AWS** : bucket **S3** + **CloudFront** (CDN). Ajouter un adaptateur S3 dans `useStorageUpload`
(presigned PUT via backend), flag `STORAGE_PROVIDER=s3`. La DB ne stocke que les URLs (inchangé).

---

## Dépendances à installer le moment venu (quand AWS est prêt)
- `@aws-sdk/client-dynamodb`, `@aws-sdk/client-firehose`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- `mqtt` (front, lazy) pour l'adaptateur AWS IoT

> Non installées maintenant pour ne pas alourdir le bundle avec du code inerte. Chaque adaptateur
> est additif + derrière un flag (défaut = comportement actuel) → **aucune régression** à l'ajout.

## Prérequis ops transverses (toi / DevOps)
Compte AWS + IAM, VPC, ECS/ALB (couche 1), ElastiCache (Redis), DynamoDB, IoT Core, Kinesis Firehose,
S3 + CloudFront. Une fois les credentials/ressources en place, je branche les adaptateurs (testables) en une passe.
