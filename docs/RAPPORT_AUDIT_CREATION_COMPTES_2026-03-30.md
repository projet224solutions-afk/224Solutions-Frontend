# Rapport d'audit - Creation de comptes par type

Date: 2026-03-30
Perimetre: Frontend Auth (email/password + OAuth), resolution de route post-auth, creation profile/wallet/carte via trigger SQL.

## Resume executif

Le systeme de creation de comptes est globalement robuste et couvre bien les types de comptes principaux (client, vendeur physique/digital, prestataire, livreur, taxi, transitaire, syndicat, agent, vendor_agent).

Points forts:
- OAuth et signup classique convergent vers une logique de role coherente.
- Trigger SQL handle_new_user cree automatiquement profil + wallet + carte.
- Redirection post-auth specifique pour vendeur (business_type) et prestataire (professional_services).

Points de vigilance:
- Une incoherence metadata dans Auth envoie service_type pour vendeur au lieu de prestataire.
- Complexite elevee du flux OAuth (flags localStorage + polling + corrections de role), avec risque de regressions futures.
- Quelques fallbacks vers client/home qui masquent des erreurs metier au lieu de les expliciter.

## Analyse detaillee par flux

### 1) Signup classique (email + mot de passe)

Comportement observe:
- Validation role + donnees formulaire.
- Generation d'un custom_id avant creation auth.
- Creation auth via Supabase Auth signUp.
- Post-creation metier par role:
  - taxi: creation taxi_drivers + tentative sync bureau members.
  - vendeur: creation vendors avec business_type physical/digital.
  - prestataire: creation professional_services selon service_types.code.

Reference code:
- src/pages/Auth.tsx (handleSubmit, bloc signup)

Evaluation:
- Bon decoupage des cas metier.
- Bonne gestion d'erreurs utilisateur (email deja pris, rate limit).
- La creation metier post-signup est correcte mais depend de plusieurs insertions frontend (partiellement transactionnelles).

### 2) Signup OAuth (Google/Facebook)

Comportement observe:
- Avant redirection OAuth, stockage d'intention de role/type via localStorage:
  - oauth_intent_role
  - oauth_is_new_signup
  - oauth_vendor_shop_type
  - oauth_service_type
- Au retour OAuth, le role reel est stabilise via:
  - polling profile dans Auth.tsx
  - logique de correction de role dans useAuth.tsx
- Si role final vendeur: creation vendors si absent.
- Si role final prestataire: creation professional_services si absent.

Reference code:
- src/pages/Auth.tsx (callbacks SIGNED_IN)
- src/hooks/useAuth.tsx (refreshProfile, createVendorForOAuth, createServiceForOAuthPrestataire)

Evaluation:
- Le mecanisme est fonctionnel et resilent.
- La logique est toutefois tres complexe (double validation du role + polling + fallbacks), ce qui augmente le risque de bug en maintenance.

### 3) Resolution de route apres authentification

Comportement observe:
- vendor_agent: route tokenisee /vendor-agent/:access_token.
- vendeur: DB prioritaire via vendors.business_type, fallback local pour signup/OAuth frais.
- prestataire: route vers /dashboard/service/:id si service existe, sinon /service-selection.
- autres roles: mapping getDashboardRoute.

Reference code:
- src/utils/postAuthRoute.ts
- src/hooks/useRoleRedirect.ts

Evaluation:
- Bonne priorite a la base de donnees pour la verite metier vendeur.
- Cas prestataire bien gere.
- Presence de fallbacks prudents qui evitent les blocages UX.

### 4) Trigger SQL de creation profil

Comportement observe:
- Fonction handle_new_user mappe role depuis:
  - raw_user_meta_data.role
  - sinon account_type (marchand->vendeur, service->prestataire, etc.)
- Cree automatiquement:
  - profiles
  - wallets
  - virtual_cards
- Enum user_role mis a jour pour inclure prestataire, bureau, vendor_agent, driver.

Reference SQL:
- supabase/migrations/20260307050338_832282a6-6acb-4a7b-8240-719bcf50f531.sql
- supabase/migrations/20260307050300_66706f24-17bf-4289-a1ec-670156e345a7.sql

Evaluation:
- Bonne couverture DB-first.
- Le fallback client en cas d'exception protege la creation mais peut cacher un probleme de mapping metier.

## Incoherences et risques identifies

### Critique
Aucune anomalie critique bloquante identifiee sur ce perimetre.

### Eleve
1. Metadata service_type affecte au mauvais role (vendeur)
- Observation: service_type est rempli quand role = vendeur, alors que la logique metier actuelle reserve les services pro au role prestataire.
- Impact: metadata incoherente, bruit de donnees, confusion analytique/future logique backend.
- Emplacement: src/pages/Auth.tsx (options.data de signUp)

### Moyen
2. Complexite OAuth elevee (Auth + useAuth en double orchestration)
- Observation: role final est gere dans deux couches (polling + correction profile).
- Impact: risque de regressions subtiles lors d'evolutions, difficultes de debug.

3. Fallbacks silencieux vers client/home
- Observation: certains chemins degradent vers client/home si mapping/echec.
- Impact: erreurs metier non visibles immediatement.

### Faible
4. Backend auth.routes.js non utilise pour signup reel
- Observation: routes backend OAuth sont placeholders (501) et Supabase Auth est la source reelle.
- Impact: surtout documentaire/architecture, pas bloquant.

## Conclusion

Le systeme de creation de compte fonctionne globalement bien pour les types de compte cibles et les routes post-auth sont bien specialisees selon le role.

L'axe principal d'amelioration n'est pas la fonctionnalite brute mais la reduction de complexite et l'hygiene de coherence des metadata.

## Recommandations

Priorite P1
- Corriger l'affectation metadata service_type pour qu'elle corresponde au role prestataire (ou la supprimer completement du payload signUp si non utilisee).

Priorite P2
- Centraliser la logique d'orchestration OAuth (role intentionnel + stabilization profile) dans un seul module pour eviter la double logique Auth.tsx/useAuth.tsx.

Priorite P2
- Ajouter un log metier explicite quand un fallback client/home est applique, pour faciliter la surveillance.

Priorite P3
- Documenter officiellement que le backend auth.routes.js est non source pour OAuth, afin d'eviter les confusions d'equipe.
