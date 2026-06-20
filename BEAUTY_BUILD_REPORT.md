# BEAUTY_BUILD_REPORT — État réel & plan (Fresha-level)

> Rapport HONNÊTE. « Fait » = codé + `tsc` 0 erreur. **Rien n'est déployé ni testé en runtime.**

## Ce qui existait déjà (avant cette session)
- `beauty_appointments` (professional_service_id, beauty_service_id, staff_id, customer_*, date/time, duration, status, notes) + `beauty_services` (name, duration, price, category, is_active, image_url) + `beauty_staff`.
- Module prestataire `BeautyModule` à 4 onglets : Vue d'ensemble (KPIs réels), **Agenda hebdo 15 min** (`BeautyAgenda`), **Services** CRUD (`BeautyServices`, + image/vidéo ajoutés), **Clients** CRM basique (`BeautyClients`).
- Page client `BeautyBooking` (4 étapes) + RPC `get_beauty_busy_slots` (créneaux) + `mark_beauty_no_show_atomic`.
- **TROU MAJEUR identifié** : la réservation client n'encaissait **AUCUN** paiement (simple `insert` d'un RDV « pending »).

## Phase 1 — FONDATION PAYANTE (FAIT cette session, tsc 0, migration `20260615290000` À LANCER)
- Étend `beauty_services` : `deposit_required`, `is_home_service`, `home_service_extra_fee`.
- Étend `beauty_appointments` : `booking_type` (salon/home/walkin), `client_address`, `total_price`, `deposit_paid`, `remaining_amount`, `penalty_applied`, `paid`, `idempotency_key` (unique), `rating`, `review_text`.
- Nouvelles tables : `beauty_settings` (walk-in, fenêtre d'annulation, % pénalité, fidélité, heure rappel), `beauty_client_notes`, `beauty_loyalty`.
- **RPC atomique `process_beauty_booking_atomic`** : verrou anti-chevauchement de créneau + idempotence + dépôt OU total + **débit wallet client → crédit prestataire** (Beauté = 0 % commission, modèle Fresha) + incrément fidélité. REVOKE FROM PUBLIC.
- Backend `POST /api/v2/beauty/book` + page client `BeautyBooking` **rebranchée sur le paiement réel** + **mode domicile** (frais déplacement) + récap dépôt/solde.

## Reste à construire (phases suivantes — PAS encore faites)
- **Phase 2 — Services pro** : dépôt configurable + toggle domicile/frais + **walk-in** (paramètre) + **forfaits** (durée cumulée) + catégories drag-and-drop.
- **Phase 3 — Walk-in & agenda** : création RDV walk-in depuis l'agenda (existe partiellement), toggle « Indisponible » (congé), navigation Jour/Semaine/Mois, taux de remplissage, bouton « Optimiser » (IA scheduling).
- **Phase 4 — CRM complet** : fiche client 4 onglets (Historique, Notes privées `beauty_client_notes`, Photos avant/après, Fidélité `beauty_loyalty`), filtres (inactifs/fidèles/nouveaux/anniversaires).
- **Phase 5 — Galerie réalisations** : upload batch + filigrane GCS + public/privé + catégories.
- **Phase 6 — Rappels & consentement** : config J-1/H-2 (Twilio/FCM) + log + politique d'annulation auto (pénalité) + formulaires de consentement signés (GCS).
- **Phase 7 — Fidélité & analytics** : programme automatique + écran analytics (CA/RDV/panier/note, Recharts, taux remplissage par jour, top services, no-shows).
- **Phase 8 — Client** : 3 modes complets (walk-in côté client), **mes RDV** (annuler/rebooker/avis), **favoris**, **avis vérifiés**, **carte marketplace riche** (badges Disponible aujourd'hui / À domicile / Walk-in / Très demandé / Nouveau), tri par dispo + plan + note, vue carte Leaflet.
- **Phase 9 — Copilot beauté** contextualisé (cheveux/peau/historique) + **notifications** FCM/Ably ciblées (provider-{id}, availability-{id}).

## Écart d'adaptation assumé vs le spec brut
- Le spec proposait une table `beauty_bookings` (provider_id) + des `UPDATE wallets.balance` directs. J'ai **adapté** : on garde `beauty_appointments` (déjà en prod) et on utilise les **primitives atomiques durcies** de la plateforme (`wallet_debit_internal` / `credit_user_wallet_safe`) au lieu d'écritures wallet brutes — plus sûr (idempotence + AML).
