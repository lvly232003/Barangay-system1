-- =============================================================================
-- 18_storage_optional.sql
-- Optional Storage setup for BarangaySystem
-- =============================================================================
-- THIS APP DOES NOT REQUIRE SUPABASE STORAGE to run.
-- Auth, Postgres tables (profiles, appointments, certificates, courts, etc.),
-- and EmailJS OTP registration work without Storage.
--
-- If the dashboard shows "Storage: Unhealthy" after Pause/Restore:
--   1. Wait up to 5 minutes for the restored project to finish booting
--   2. Or click Restart project (Settings → General)
--   SQL cannot heal Supabase platform Storage health — that is infrastructure.
--
-- Run this script only if you want a future-ready public/private docs bucket
-- (e.g. optional ID uploads later). Safe to re-run.
-- =============================================================================

-- Ensure storage schema objects exist (Supabase provides these; IF NOT EXISTS is safe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'barangay-documents',
  'barangay-documents',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Residents can upload only into their own folder: {user_id}/...
DROP POLICY IF EXISTS "residents_upload_own_docs" ON storage.objects;
CREATE POLICY "residents_upload_own_docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'barangay-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "residents_read_own_docs" ON storage.objects;
CREATE POLICY "residents_read_own_docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'barangay-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "staff_admin_read_all_docs" ON storage.objects;
CREATE POLICY "staff_admin_read_all_docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'barangay-documents'
    AND public.current_app_role() IN ('admin', 'staff')
  );

DROP POLICY IF EXISTS "owners_delete_own_docs" ON storage.objects;
CREATE POLICY "owners_delete_own_docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'barangay-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Quick health probe (returns 1 row if bucket exists)
-- SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'barangay-documents';
