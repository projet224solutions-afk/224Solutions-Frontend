# AUDIT — Parcours CLIENT Beauté (état réel)

> Audit par traçage du code + RLS + RPC/grants. « ✅ » = vérifié opérationnel au niveau données. « 🔴 » = bug. « 🟠 » = écart vs cahier des charges Fresha.

## Le parcours, étape par étape

### 1. Découverte — `/beaute` (BeautyDiscovery)
- ✅ **Liste des salons** : `useBeautyProviders` lit `professional_services` (RLS « view active » → `status='active'` lisible par anon ✓). Filtre `minPrice>0` (au moins une prestation active avec prix).
- ✅ **Badges** À domicile / Walk-in / Nouveau (depuis beauty_services.is_home_service / beauty_settings.accepts_walkin / created_at).
- ✅ **Favoris** (cœur) : table `beauty_favorites`, RLS client own.
- 🔴 **Note & nombre d'avis = TOUJOURS 0** : `useBeautyProviders` calcule la note en lisant `beauty_appointments.rating`. Mais la RLS `beauty_appt_client_select` n'autorise QUE `customer_user_id = auth.uid()` → un acheteur (ou un anonyme) **ne peut pas lire les RDV des autres** → note 0 / avis 0 pour tous. **Bug réel.**

### 2. Page salon — `/beaute/:serviceId` (BeautyBooking)
- ✅ **Header salon** : `professional_services` (public read OK), services via `beauty_services` (public read `is_active`).
- 🟠 **C'est un assistant de réservation 4 étapes, PAS une page profil.** Le cahier des charges veut une page profil avec onglets **Services / Galerie / Avis** (header, répartition des notes), puis réservation. Actuellement : clic salon → directement le wizard.
- 🟠 **Galerie non affichée côté client** (table `beauty_gallery` publique existe, mais aucune UI client ne la montre).
- 🟠 **Avis non affichés** (et de toute façon bloqués par la RLS, cf. ci-dessous).

### 3. Réservation + paiement (BeautyBooking étapes 2-4)
- ✅ **Créneaux** calculés en temps réel : RPC `get_beauty_busy_slots` (GRANT anon ✓) + durée du service. Pas de chevauchement.
- ✅ **Mode domicile** (si `is_home_service`) avec frais de déplacement.
- ✅ **Paiement ATOMIQUE** : `POST /api/v2/beauty/book` → `process_beauty_booking_atomic` (verrou créneau + idempotence + dépôt OU total + débit client → crédit prestataire 0 % commission + fidélité). REVOKE PUBLIC ✓.

### 4. Mes rendez-vous — `/mes-rdv-beaute` (MyBeautyAppointments)
- ✅ **Liste** à venir / passés : RLS `beauty_appt_client_select` (client lit les siens ✓).
- ✅ **Annuler** : `cancel_beauty_booking_atomic` (remboursement si dans le délai, sinon pénalité). ✅ **Avis** : `submit_beauty_review_atomic`. ✅ **Rebooker** → /beaute/:id.

## 🔴 Bug bloquant principal
**Les avis & notes ne sont JAMAIS visibles côté client.** Cause : RLS `beauty_appointments` = lecture réservée au client propriétaire du RDV (et au prestataire). Donc :
- la page Découverte affiche **note 0 / 0 avis** pour tous les salons,
- impossible de construire un onglet **« Avis »** sur la page salon (le client ne peut pas lire les avis des autres).

**Correctif nécessaire** : un RPC public (SECURITY DEFINER) qui expose, sans PII, la **note moyenne + le nombre d'avis** par salon, et la **liste des avis vérifiés** (prénom, note, commentaire, date) — comme `verify_certificate` côté éducation. À GRANT anon/authenticated.

## 🟠 Écarts vs cahier des charges (côté client)
1. **Page profil salon** (onglets Services / Galerie / Avis) — actuellement remplacée par le wizard de réservation.
2. **Galerie avant/après publique** non affichée au client.
3. **Avis vérifiés** non affichés (+ bloqués RLS).
4. **Répartition des notes** (combien de 5★/4★…) absente.
5. **Vue carte (Leaflet)** des salons absente.
6. **Walk-in côté client** : seulement un badge, pas de flux.

## Verdict
Le **cœur transactionnel** du parcours client (découverte → créneau → paiement atomique → mes RDV → annulation/avis) est **fonctionnel et sécurisé**. Mais la **couche sociale/vitrine** (notes, avis, galerie, page profil) est soit **bloquée par la RLS** (bug réel à corriger via RPC public), soit **non encore construite** (écarts vs spec).
