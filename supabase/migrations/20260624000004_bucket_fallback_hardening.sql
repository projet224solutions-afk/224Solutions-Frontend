-- ============================================================================
-- 224SOLUTIONS — BLINDAGE BUCKETS SUPABASE (FALLBACK GCS)
-- ----------------------------------------------------------------------------
-- GCS = provider primaire en production (bucket "224solutions", dossiers internes).
-- Supabase Storage = fallback (un bucket par catégorie). Ce fichier configure le
-- fallback :
--   1. crée les buckets fallback manquants (service-gallery, …)
--   2. ajoute les policies (SELECT public, INSERT/UPDATE auth, DELETE)
--   3. ajoute les DELETE policies manquantes sur des buckets existants
--   4. vérification atomique finale
--
-- ⚠️ NON INCLUS volontairement : le passage de communication-files en PRIVÉ.
--    Ce bucket est le FOURRE-TOUT public (videos/audio/documents/stamps/travel/
--    misc) lu via getPublicUrl partout dans l'app ; le rendre privé casserait
--    l'affichage de tous ces médias (messages vocaux, tampons de factures,
--    images partagées…) tant que les lecteurs ne sont pas migrés vers des URL
--    signées. À traiter dans une migration dédiée + refactor des lecteurs.
--
-- Idempotent : ON CONFLICT DO UPDATE, DROP POLICY IF EXISTS partout. Atomique.
-- ============================================================================

BEGIN;

-- ── 1. BUCKETS FALLBACK MANQUANTS ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('service-gallery', 'service-gallery', true, 8388608,
        ARRAY['image/jpeg','image/png','image/gif','image/webp','image/avif','image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET
  public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('service-gallery-videos', 'service-gallery-videos', true, 209715200,
        ARRAY['video/mp4','video/webm','video/quicktime','video/x-msvideo'])
ON CONFLICT (id) DO UPDATE SET
  public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('property-images', 'property-images', true, 15728640,
        ARRAY['image/jpeg','image/png','image/webp','image/avif'])
ON CONFLICT (id) DO UPDATE SET
  public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('driver-photos', 'driver-photos', true, 10485760,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 2. POLICIES DES NOUVEAUX BUCKETS ────────────────────────────────────────
-- service-gallery : DELETE scoped authenticated (chemins = {serviceId}/… → pas
-- d'owner par auth.uid ; la propriété est contrôlée au niveau applicatif, seul
-- le propriétaire du service voit le gestionnaire de médias).
DROP POLICY IF EXISTS "sg_select_public" ON storage.objects;
DROP POLICY IF EXISTS "sg_insert_auth"   ON storage.objects;
DROP POLICY IF EXISTS "sg_update_auth"   ON storage.objects;
DROP POLICY IF EXISTS "sg_delete_auth"   ON storage.objects;
CREATE POLICY "sg_select_public" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'service-gallery');
CREATE POLICY "sg_insert_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-gallery');
CREATE POLICY "sg_update_auth" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'service-gallery');
CREATE POLICY "sg_delete_auth" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'service-gallery');

-- service-gallery-videos : idem
DROP POLICY IF EXISTS "sgv_select_public" ON storage.objects;
DROP POLICY IF EXISTS "sgv_insert_auth"   ON storage.objects;
DROP POLICY IF EXISTS "sgv_update_auth"   ON storage.objects;
DROP POLICY IF EXISTS "sgv_delete_auth"   ON storage.objects;
CREATE POLICY "sgv_select_public" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'service-gallery-videos');
CREATE POLICY "sgv_insert_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-gallery-videos');
CREATE POLICY "sgv_update_auth" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'service-gallery-videos');
CREATE POLICY "sgv_delete_auth" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'service-gallery-videos');

-- property-images : DELETE owner (chemins = {auth.uid}/… attendus)
DROP POLICY IF EXISTS "pi_select_public" ON storage.objects;
DROP POLICY IF EXISTS "pi_insert_auth"   ON storage.objects;
DROP POLICY IF EXISTS "pi_update_auth"   ON storage.objects;
DROP POLICY IF EXISTS "pi_delete_owner"  ON storage.objects;
CREATE POLICY "pi_select_public" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'property-images');
CREATE POLICY "pi_insert_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-images');
CREATE POLICY "pi_update_auth" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'property-images');
CREATE POLICY "pi_delete_owner" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'property-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- driver-photos : DELETE owner
DROP POLICY IF EXISTS "dp_select_public" ON storage.objects;
DROP POLICY IF EXISTS "dp_insert_auth"   ON storage.objects;
DROP POLICY IF EXISTS "dp_update_auth"   ON storage.objects;
DROP POLICY IF EXISTS "dp_delete_owner"  ON storage.objects;
CREATE POLICY "dp_select_public" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'driver-photos');
CREATE POLICY "dp_insert_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driver-photos');
CREATE POLICY "dp_update_auth" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'driver-photos');
CREATE POLICY "dp_delete_owner" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'driver-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ── 3. DELETE POLICIES MANQUANTES (additif, ne retire aucune permission) ─────
DROP POLICY IF EXISTS "prod_img_delete_owner" ON storage.objects;
CREATE POLICY "prod_img_delete_owner" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "ra_delete_owner" ON storage.objects;
CREATE POLICY "ra_delete_owner" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'restaurant-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "ai_doc_delete_owner" ON storage.objects;
CREATE POLICY "ai_doc_delete_owner" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ai-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "pv_delete_owner" ON storage.objects;
CREATE POLICY "pv_delete_owner" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ── 4. VÉRIFICATION ATOMIQUE ────────────────────────────────────────────────
DO $$
DECLARE v_ok boolean;
BEGIN
  SELECT bool_and(present) INTO v_ok FROM (
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = b AND public = true) AS present
    FROM unnest(ARRAY['service-gallery','service-gallery-videos','property-images','driver-photos']) AS b
  ) s;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'ÉCHEC : un bucket fallback manque ou n''est pas public';
  END IF;
  RAISE NOTICE '✅ MIGRATION OK : 4 buckets fallback créés/publics + policies posées';
END;
$$;

COMMIT;

-- Rapport
SELECT id,
       CASE WHEN public THEN 'PUBLIC' ELSE 'PRIVE' END AS visibilite,
       file_size_limit
FROM storage.buckets
WHERE id IN ('service-gallery','service-gallery-videos','property-images','driver-photos',
             'product-images','restaurant-assets','communication-files','avatars','digital-products')
ORDER BY id;
