# TESTS_SCENARIOS — Scénarios de test manuel (logique métier)

> Scénarios à exécuter manuellement (2 appareils/2 onglets pour les courses concurrentes).
> Chaque scénario : **étapes exactes** + **résultat attendu**. ✅ = comportement déjà vérifié
> dans le code ; 🔎 = à confirmer en conditions réelles.

---

## 1. Client — Idempotence / double paiement ✅
1. Préparer un panier, ouvrir l'onglet réseau.
2. Cliquer « Payer » **2× très vite** (ou rejouer la requête avec le même `Idempotency-Key`).
3. **Attendu** : 1 seul débit ; le 2ᵉ appel rejoue la **même réponse** (replay) ou renvoie
   `409 Opération en cours`. Jamais 2 débits.
4. Variante : rejouer la même clé avec un **payload modifié** → `422` (réutilisation frauduleuse).

## 2. Client — Solde insuffisant
1. Wallet à 1 000 GNF. Tenter une commande de 5 000 GNF (paiement wallet).
2. **Attendu** : refus `INSUFFICIENT_FUNDS`, **aucun** débit, **aucune** commande créée, solde inchangé.

## 3. Client — Annulation après acceptation chauffeur 🔎
1. Créer une course (escrow `held` si payée wallet), un chauffeur accepte.
2. Annuler côté client.
3. **Attendu** : frais d'annulation appliqués selon règle ; remboursement du reste **atomique**
   (`cancel_order_and_refund_wallet` / `refund_order_escrow`) ; statut course cohérent.

## 4. Client — Accès aux données d'un autre client (IDOR)
1. Se connecter en client A, récupérer un order_id de A.
2. Tenter `GET` d'un order_id appartenant au client B (manipulation d'ID).
3. **Attendu** : `403`/`404`, aucune donnée de B (RLS + vérif serveur).

## 5. Taxi — Race d'acceptation ✅ (2 appareils)
1. Une course `requested` visible par 2 chauffeurs en ligne.
2. Les 2 cliquent « Accepter » **simultanément**.
3. **Attendu** : **1 seul** obtient la course (`success`) ; l'autre reçoit `409 LOCKED`
   ou `409 ALREADY_ASSIGNED`. La course n'a **qu'un** `driver_id`.

## 6. Taxi — Prix non manipulable
1. Intercepter la requête de création de course et **forcer un prix bas**.
2. **Attendu** : le serveur **recalcule** le tarif (`calculate_taxi_fare`) ; le prix client est ignoré.

## 7. Taxi-moto — Capacité 1 passager 🔎
1. Tenter de réserver une course moto avec **2 passagers** via l'API directement.
2. **Attendu** : rejet serveur (capacité moto = 1).

## 8. Livreur — Multi-livraisons / preuve 🔎
1. Marquer une livraison « complétée ».
2. **Attendu** : transition de statut contrôlée ; preuve (photo) stockée en GCS ;
   gains crédités **après** confirmation (pas avant).

## 9. Vendeur — Stock concurrent ✅ (2 onglets)
1. Produit avec `stock_quantity = 1`. Deux clients achètent **en même temps**.
2. **Attendu** : **1 seule** commande réussit ; l'autre reçoit « Insufficient stock ».
   Stock final = 0, jamais négatif (`FOR UPDATE` + tout-ou-rien).

## 10. Vendeur — Prix manipulé au checkout
1. Modifier le prix d'un article dans la requête de checkout.
2. **Attendu** : le serveur utilise le prix **en base** (`create_order_core` lit `p.price`), pas celui du client.

## 11. Agent vendeur — Isolation 🔎
1. Agent rattaché au vendeur V1. Tenter d'accéder/modifier les données du vendeur V2.
2. **Attendu** : refus (`is_vendor_agent_of` + `agent_has_permission`). Toute action loggée avec l'ID de l'agent.

## 12. Abonnement — Paiement avant activation ✅
1. Acheter un abonnement payant avec solde **insuffisant**.
2. **Attendu** : **aucune** activation, **aucun** débit (ROLLBACK), message solde insuffisant.
3. Variante double-clic : **un seul** abonnement créé, **un seul** débit (`DUPLICATE_PAYMENT`).

## 13. Abonnement — Expiration
1. Forcer `period_end` à hier sur un abonnement actif.
2. **Attendu** : accès **coupé** aujourd'hui (gating serveur `has_active_subscription` /
   `mark_expired_subscriptions`). Pas d'accès résiduel.

## 14. Service de proximité — Double réservation 🔎
1. Réserver un créneau, puis tenter de **re-réserver le même créneau**.
2. **Attendu** : 2ᵉ réservation refusée ; limites d'abonnement vérifiées **serveur**
   (`get_active_service_subscription_limits`), non contournables par appel API direct.

## 15. Admin — Accès & audit 🔎
1. Utilisateur non-admin appelle une route `/api/admin/*`.
2. **Attendu** : `403` (rôle vérifié serveur à chaque requête). Action admit financière →
   entrée d'audit avec admin_id + timestamp + montant avant/après.
3. 🟠 Vérifier la présence d'un **2ᵉ facteur** sur les ops sensibles (point ouvert).

## 16. Produit digital — Lien de téléchargement 🔎
1. Acheter un produit digital, récupérer le lien.
2. **Attendu** : URL **signée + expirante** ; après expiration → accès refusé ; pas d'URL publique permanente.

## 17. Remboursement — Pas de double crédit 🔎
1. Annuler une commande déjà remboursée (rejouer l'action).
2. **Attendu** : **un seul** crédit ; la 2ᵉ tentative est neutralisée (idempotence / statut escrow).
