-- ============================================================================
-- 🧹 NETTOYAGE DES DONNÉES DE TEST DÉRIVÉES PAR LES CHANGEMENTS DE DEVISE
--
-- Contexte : des changements de devise répétés (PDG) ont réécrit les prix produits
-- et converti les soldes wallet → valeurs dérivées (ex. débit escrow « 76 GNF » pour
-- une commande de 20 000 GNF). Ce script remet les comptes de test au propre.
--
-- ⚠️  À exécuter dans Supabase Dashboard → SQL Editor.
-- ⚠️  ORDRE : exécute D'ABORD la PARTIE A (inspection, lecture seule) et NOTE les IDs +
--     les valeurs réelles. Puis adapte la PARTIE B avec ces valeurs avant de COMMIT.
-- ⚠️  La PARTIE B est encadrée par BEGIN ... ROLLBACK : par défaut elle N'ÉCRIT RIEN
--     (tu vois l'effet sans l'appliquer). Remplace ROLLBACK par COMMIT seulement quand
--     les valeurs sont bonnes.
-- ============================================================================


-- ████████████████████████████████████████████████████████████████████████████
-- PARTIE A — INSPECTION (LECTURE SEULE, sans risque)
-- ████████████████████████████████████████████████████████████████████████████

-- A1. Retrouver les comptes de test (vendeur VND0007 + acheteuse Maïmouna).
--     Ajuste les filtres si besoin (le code public peut être dans custom_id ou public_id).
SELECT 'PROFILE' AS kind, id, first_name, last_name,
       custom_id, public_id, role, detected_currency, detected_country
FROM public.profiles
WHERE custom_id = 'VND0007'
   OR public_id = 'VND0007'
   OR lower(first_name || ' ' || last_name) LIKE '%maimouna%'
   OR lower(first_name || ' ' || last_name) LIKE '%maïmouna%'
ORDER BY last_name;

-- A2. Wallets de ces comptes (ATTENTION : un user peut avoir PLUSIEURS lignes wallet,
--     une par devise — créées par les changements successifs. À consolider.)
SELECT w.user_id, p.first_name, p.last_name, w.id AS wallet_id,
       w.currency, w.balance, w.is_blocked, w.updated_at
FROM public.wallets w
JOIN public.profiles p ON p.id = w.user_id
WHERE p.custom_id = 'VND0007' OR p.public_id = 'VND0007'
   OR lower(p.first_name || ' ' || p.last_name) LIKE '%ma%mouna%'
ORDER BY p.last_name, w.currency;

-- A3. Produits du vendeur (prix + devise — vérifier s'ils ont dérivé).
SELECT pr.id, pr.name, pr.price, pr.currency, pr.seller_currency, pr.is_active, pr.updated_at
FROM public.products pr
JOIN public.vendors v ON v.id = pr.vendor_id
JOIN public.profiles p ON p.id = v.user_id
WHERE p.custom_id = 'VND0007' OR p.public_id = 'VND0007'
ORDER BY pr.updated_at DESC;

-- A4. Dernières transactions/escrow suspectes (les « 76 GNF »).
SELECT wt.id, wt.transaction_type, wt.amount, wt.description, wt.created_at,
       wt.metadata->>'wallet_currency'  AS wallet_currency,
       wt.metadata->>'order_currency'   AS order_currency,
       wt.metadata->>'product_amount'   AS product_amount,
       wt.metadata->>'total_debited'    AS total_debited
FROM public.wallet_transactions wt
WHERE wt.description ILIKE '%marketplace%'
ORDER BY wt.created_at DESC
LIMIT 20;


-- ████████████████████████████████████████████████████████████████████████████
-- PARTIE B — NETTOYAGE (TRANSACTIONNEL — ROLLBACK PAR DÉFAUT)
-- Remplis d'abord les valeurs <<...>> avec celles relevées en PARTIE A.
-- Laisse ROLLBACK pour PRÉVISUALISER ; mets COMMIT pour APPLIQUER.
-- ████████████████████████████████████████████████████████████████████████████

BEGIN;

-- ── Paramètres : colle ici les UUID relevés en A1 ───────────────────────────
-- (Astuce : tu peux aussi remplacer les UUID par des sous-requêtes par custom_id/nom.)
--   <<VENDOR_USER_ID>>  = id du profil VND0007
--   <<BUYER_USER_ID>>   = id du profil Maïmouna

-- B1. Reconsolider la devise : remettre TOUS les wallets de test en GNF.
--     (Si plusieurs lignes wallet existent par user, garde-en UNE en GNF — voir B1bis.)
UPDATE public.wallets
SET currency = 'GNF', updated_at = now()
WHERE user_id IN ('<<VENDOR_USER_ID>>', '<<BUYER_USER_ID>>');

-- B1bis. (Optionnel) Si des doublons de wallet ont été créés (1 par devise), fusionne :
--     additionne les soldes dans une seule ligne GNF puis supprime les autres.
--     À FAIRE MANUELLEMENT après avoir vu A2 (ne pas exécuter à l'aveugle).
--   -- Exemple (à adapter) :
--   -- UPDATE public.wallets SET balance = <<SOLDE_PROPRE>> WHERE id = <<WALLET_ID_A_GARDER>>;
--   -- DELETE FROM public.wallets WHERE user_id = '<<...>>' AND id <> <<WALLET_ID_A_GARDER>>;

-- B2. Aligner la devise du profil (affichage) sur GNF.
UPDATE public.profiles
SET detected_currency = 'GNF',
    detected_country  = COALESCE(detected_country, 'GN')
WHERE id IN ('<<VENDOR_USER_ID>>', '<<BUYER_USER_ID>>');

-- B3. Remettre les produits en GNF avec leur prix canonique (valeurs vues en POS :
--     Chargeur I Phone 17 = 20 000 ; Case métallique iphone 17 = 50 000 — adapte au besoin).
--     ⚠️ Mets le PRIX CANONIQUE voulu (en GNF), pas la valeur dérivée.
UPDATE public.products pr
SET price           = <<PRIX_GNF>>,        -- ex. 20000
    currency        = 'GNF',
    seller_currency = 'GNF',
    updated_at      = now()
WHERE pr.id = '<<PRODUCT_ID>>';
--   (Répète B3 pour chaque produit à corriger, ou liste les ids dans un IN (...).)

-- B4. (Optionnel) Supprimer les commandes/escrow/transactions de test corrompues
--     (les « 76 GNF »). NE PAS exécuter si ces commandes doivent être conservées.
--   -- DELETE FROM public.wallet_transactions WHERE id IN ('<<TX_ID_1>>', '<<TX_ID_2>>');
--   -- DELETE FROM public.escrow_transactions WHERE order_id IN ('<<ORDER_ID_1>>');
--   -- DELETE FROM public.order_items        WHERE order_id IN ('<<ORDER_ID_1>>');
--   -- DELETE FROM public.orders             WHERE id       IN ('<<ORDER_ID_1>>');

-- ── Vérification AVANT de décider ───────────────────────────────────────────
-- (ces SELECT s'exécutent dans la transaction → montrent l'état APRÈS B1–B4)
SELECT 'WALLETS APRES' AS check, user_id, currency, balance FROM public.wallets
  WHERE user_id IN ('<<VENDOR_USER_ID>>', '<<BUYER_USER_ID>>');
SELECT 'PRODUITS APRES' AS check, id, name, price, currency, seller_currency FROM public.products
  WHERE id = '<<PRODUCT_ID>>';

-- 👉 Si tout est bon, remplace la ligne ci-dessous par COMMIT;  Sinon laisse ROLLBACK;
ROLLBACK;
-- COMMIT;
