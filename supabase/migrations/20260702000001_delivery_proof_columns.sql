-- ============================================================================
-- Preuve de livraison : colonnes de stockage + rétention (purge 7 j)
-- ----------------------------------------------------------------------------
-- Le vendeur/livreur téléverse une photo (et éventuellement une vidéo) de preuve
-- de livraison dans le bucket GCS PRIVÉ « 224solutions-private ». Seuls les CHEMINS
-- sont stockés ici (préfixe « gcs: » = GCS privé, sinon = Supabase Storage hérité).
-- 7 jours APRÈS la confirmation de réception par le client (delivery_confirmed_at),
-- le job « delivery-proof.cleanup » supprime les fichiers et marque purged (RGPD).
--
-- Idempotent : réexécutable sans erreur (ADD COLUMN IF NOT EXISTS).
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_proof_photo_path  text,
  ADD COLUMN IF NOT EXISTS delivery_proof_video_path  text,
  ADD COLUMN IF NOT EXISTS delivery_proof_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_proof_purged_at   timestamptz;

COMMENT ON COLUMN public.orders.delivery_proof_photo_path IS
  'Chemin de la photo de preuve de livraison. Préfixe « gcs: » = bucket GCS privé, sinon Supabase Storage (héritage).';
COMMENT ON COLUMN public.orders.delivery_proof_video_path IS
  'Chemin de la vidéo de preuve de livraison (optionnel). Même convention de préfixe que la photo.';
COMMENT ON COLUMN public.orders.delivery_proof_uploaded_at IS
  'Horodatage du dépôt de la preuve par le vendeur/livreur.';
COMMENT ON COLUMN public.orders.delivery_confirmed_at IS
  'Horodatage de la confirmation de réception par le client. Ancre de rétention : purge de la preuve 7 j après.';
COMMENT ON COLUMN public.orders.delivery_proof_purged_at IS
  'Horodatage de purge de la preuve (fichiers supprimés + chemins effacés). NULL = non purgée.';

-- Index partiel pour le job de purge : cible uniquement les commandes avec preuve
-- encore présente et non purgée (la grande majorité des lignes est exclue → index léger).
CREATE INDEX IF NOT EXISTS idx_orders_delivery_proof_purge
  ON public.orders (delivery_confirmed_at)
  WHERE delivery_proof_photo_path IS NOT NULL
    AND delivery_proof_purged_at IS NULL;
