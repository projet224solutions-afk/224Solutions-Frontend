-- =======================================================================
-- SCRIPT DE RESTAURATION DU COMPTE VENDEUR: abconte2008@gmail.com
-- =======================================================================
-- Ce script restaure le compte vendeur qui a été accidentellement
-- converti en CEO par la migration auto_promote_latest_user_to_ceo
-- =======================================================================

DO $$
DECLARE
  v_email TEXT := 'abconte2008@gmail.com';
  v_user_id UUID;
  v_old_role TEXT;
  v_public_id TEXT;
  v_custom_id TEXT;
  v_products_count INT;
  v_orders_count INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '🔧 RESTAURATION DU COMPTE VENDEUR: %', v_email;
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- 1. Trouver l'utilisateur et vérifier son état actuel
  SELECT id, role, public_id, custom_id INTO v_user_id, v_old_role, v_public_id, v_custom_id
  FROM profiles
  WHERE email = v_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '❌ Aucun utilisateur trouvé avec l''email: %', v_email;
  END IF;

  RAISE NOTICE '📧 Email: %', v_email;
  RAISE NOTICE '🆔 UUID: %', v_user_id;
  RAISE NOTICE '📌 Rôle actuel: %', v_old_role;
  RAISE NOTICE '🎫 Public ID: %', COALESCE(v_public_id, 'AUCUN');
  RAISE NOTICE '🎫 Custom ID: %', COALESCE(v_custom_id, 'AUCUN');
  RAISE NOTICE '';

  -- 2. Vérifier les données vendeur existantes
  SELECT COUNT(*) INTO v_products_count
  FROM products
  WHERE vendor_id = v_user_id;

  SELECT COUNT(*) INTO v_orders_count
  FROM orders
  WHERE vendor_id = v_user_id;

  RAISE NOTICE '📦 Produits trouvés: %', v_products_count;
  RAISE NOTICE '🛒 Commandes trouvées: %', v_orders_count;
  RAISE NOTICE '';

  -- 3. Restaurer le rôle vendeur
  UPDATE profiles
  SET
    role = 'vendeur',
    updated_at = NOW()
  WHERE id = v_user_id;

  RAISE NOTICE '✅ Rôle restauré vers: vendeur';

  -- 4. Mettre à jour l'ID personnalisé vers format vendeur si nécessaire
  BEGIN
    -- Essayer avec la fonction existante
    SELECT generate_custom_id_with_role('vendeur') INTO v_custom_id;

    UPDATE profiles
    SET custom_id = v_custom_id,
        updated_at = NOW()
    WHERE id = v_user_id;

    -- Aussi mettre à jour dans user_ids si la table existe
    BEGIN
      UPDATE user_ids
      SET custom_id = v_custom_id
      WHERE user_id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Table user_ids peut ne pas exister
    END;

    RAISE NOTICE '✅ ID personnalisé mis à jour: %', v_custom_id;
  EXCEPTION WHEN OTHERS THEN
    -- Générer manuellement si la fonction n'existe pas
    v_custom_id := 'VND' || LPAD(FLOOR(RANDOM() * 9999)::TEXT, 4, '0');

    UPDATE profiles
    SET custom_id = v_custom_id
    WHERE id = v_user_id;

    RAISE NOTICE '✅ ID personnalisé généré manuellement: %', v_custom_id;
  END;

  -- 5. Réinitialiser les limites de carte virtuelle vers limites vendeur standard
  BEGIN
    UPDATE virtual_cards
    SET
      daily_limit = 5000000,    -- 5M GNF (limite vendeur standard)
      monthly_limit = 20000000, -- 20M GNF (limite vendeur standard)
      updated_at = NOW()
    WHERE user_id = v_user_id;

    RAISE NOTICE '✅ Limites carte virtuelle réinitialisées (vendeur standard)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Pas de carte virtuelle à mettre à jour';
  END;

  -- 6. Supprimer de la table PDG si présent (le vendeur ne doit pas y être)
  BEGIN
    DELETE FROM pdg WHERE id = v_user_id;
    RAISE NOTICE '✅ Entrée supprimée de la table PDG';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Pas d''entrée PDG à supprimer (normal)';
  END;

  -- 7. S'assurer que le vendeur existe dans la table vendors
  BEGIN
    INSERT INTO vendors (user_id, created_at, updated_at)
    VALUES (v_user_id, NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING;
    RAISE NOTICE '✅ Entrée vendors vérifiée/créée';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Table vendors non accessible';
  END;

  -- 8. Vérifier l'intégrité des données
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '📊 VÉRIFICATION DES DONNÉES VENDEUR';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';

  -- Afficher les produits
  IF v_products_count > 0 THEN
    RAISE NOTICE '✅ % produit(s) toujours associé(s) au vendeur', v_products_count;
  ELSE
    RAISE NOTICE '⚠️ Aucun produit trouvé pour ce vendeur';
  END IF;

  -- Afficher les commandes
  IF v_orders_count > 0 THEN
    RAISE NOTICE '✅ % commande(s) toujours associée(s) au vendeur', v_orders_count;
  ELSE
    RAISE NOTICE '⚠️ Aucune commande trouvée pour ce vendeur';
  END IF;

  -- Vérifier le wallet
  IF EXISTS (SELECT 1 FROM wallets WHERE user_id = v_user_id) THEN
    RAISE NOTICE '✅ Wallet intact';
  ELSE
    -- Créer le wallet s'il n'existe pas
    BEGIN
      INSERT INTO wallets (user_id, balance, currency, created_at, updated_at)
      VALUES (v_user_id, 0, 'GNF', NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING;
      RAISE NOTICE '✅ Wallet créé';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '⚠️ Impossible de créer le wallet';
    END;
  END IF;

  -- Résumé final
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ RESTAURATION TERMINÉE AVEC SUCCÈS !';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📧 Email: %', v_email;
  RAISE NOTICE '🆔 UUID: %', v_user_id;
  RAISE NOTICE '📌 Nouveau rôle: vendeur';
  RAISE NOTICE '🎫 ID personnalisé: %', v_custom_id;
  RAISE NOTICE '📦 Produits: %', v_products_count;
  RAISE NOTICE '🛒 Commandes: %', v_orders_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔓 L''utilisateur peut maintenant se reconnecter en tant que VENDEUR';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════════';

END $$;

-- =======================================================================
-- REQUÊTE DE VÉRIFICATION (exécutez après le script ci-dessus)
-- =======================================================================
SELECT
  p.id,
  p.email,
  p.role,
  p.full_name,
  p.first_name,
  p.last_name,
  p.public_id,
  p.custom_id,
  p.is_active,
  p.created_at,
  w.balance as wallet_balance,
  (SELECT COUNT(*) FROM products WHERE vendor_id = p.id) as products_count,
  (SELECT COUNT(*) FROM orders WHERE vendor_id = p.id) as orders_count
FROM profiles p
LEFT JOIN wallets w ON p.id = w.user_id
WHERE p.email = 'abconte2008@gmail.com';
