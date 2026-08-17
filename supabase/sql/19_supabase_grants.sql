-- =============================================================================
-- 19_supabase_grants.sql
-- Ensure authenticated clients can call RLS helper functions and tables.
-- Run this if the dashboard shows 0 users while you are signed in as admin.
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated, service_role;
