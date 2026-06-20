-- ============================================================================
-- MIGRATION — Index de scalabilité (audit 100M utilisateurs)
-- ============================================================================
-- Contexte : la base possède DÉJÀ ~122 index. Ce fichier AJOUTE des index COMPOSITES
-- manquants correspondant aux patterns de requêtes réels (filtre + tri) les plus fréquents.
--
-- ✅ Version SANS CONCURRENTLY → s'exécute directement dans le SQL Editor de Supabase
--    (qui enveloppe tout dans une transaction ; CONCURRENTLY y est interdit).
--    La création prend un verrou bref sur la table le temps du build — sans risque tant que
--    les tables ne sont pas gigantesques (cas actuel). Tous en IF NOT EXISTS = réexécutable.
--
-- 🔵 PLUS TARD (tables à dizaines de millions de lignes) : recréer en CONCURRENTLY via psql,
--    UNE instruction à la fois, HORS transaction :
--      psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS ... ;"
--    (voir bloc commenté en bas).
-- ============================================================================

-- ─── COMMANDES (filtre vendeur/client + statut, tri par date) ───────────────
CREATE INDEX IF NOT EXISTS idx_orders_vendor_status_created
  ON public.orders (vendor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created
  ON public.orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders (status, created_at DESC);

-- ─── WALLET / TRANSACTIONS (historique par utilisateur, tri par date) ───────
-- NB : la table n'a PAS de colonne user_id — l'historique se requête en OR sur
-- sender_user_id / receiver_user_id → un index par côté.
CREATE INDEX IF NOT EXISTS idx_wallet_tx_sender_created
  ON public.wallet_transactions (sender_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_receiver_created
  ON public.wallet_transactions (receiver_user_id, created_at DESC);

-- ─── NOTIFICATIONS (non-lues par utilisateur — requête la plus fréquente) ───
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, read, created_at DESC);

-- ─── ESCROW (liste PDG + litiges, filtre payeur/receveur/statut) ────────────
CREATE INDEX IF NOT EXISTS idx_escrow_receiver_status
  ON public.escrow_transactions (receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_escrow_payer_status
  ON public.escrow_transactions (payer_id, status);

-- ─── LIVRAISONS (file livreur + statut) ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_status
  ON public.deliveries (driver_id, status);

-- ─── PRODUITS (catalogue vendeur actif, tri récent — marketplace) ───────────
CREATE INDEX IF NOT EXISTS idx_products_vendor_active_created
  ON public.products (vendor_id, is_active, created_at DESC);

-- ─── MESSAGES (conversation directe sender↔recipient, tri chronologique) ────
-- NB : pas de colonne conversation_id — les messages se requêtent par paire
-- (sender_id, recipient_id) → un index par côté pour couvrir la requête OR.
CREATE INDEX IF NOT EXISTS idx_messages_sender_created
  ON public.messages (sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_created
  ON public.messages (recipient_id, created_at);

-- ─── TAUX DE CHANGE (lecture FX très fréquente — paire active) ──────────────
CREATE INDEX IF NOT EXISTS idx_fx_from_to_active
  ON public.currency_exchange_rates (from_currency, to_currency, is_active);

-- ─── LITIGES ESCROW (tri liste) ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_escrow_disputes_status_created
  ON public.escrow_disputes (status, created_at DESC);

-- ============================================================================
-- Si une ligne échoue (colonne/table absente dans ton schéma) : commente-la et relance.
-- Vérifier les index existants :
--   SELECT indexname, tablename FROM pg_indexes WHERE schemaname='public' ORDER BY tablename;
--
-- VARIANTE CONCURRENTLY (plus tard, grosses tables, via psql hors transaction) — exemple :
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_vendor_status_created
--     ON public.orders (vendor_id, status, created_at DESC);
-- ============================================================================
