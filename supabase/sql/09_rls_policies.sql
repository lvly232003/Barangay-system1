-- =============================================================================
-- 09_rls_policies.sql
-- Row Level Security for all barangay system tables
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basketball_courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basketball_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- ---------- profiles ----------
DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON public.profiles;
CREATE POLICY "profiles_select_own_or_staff"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles FOR UPDATE
  USING (
    auth.uid() = id
    OR (public.current_app_role() = 'admin')
  );

DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin"
  ON public.profiles FOR INSERT
  WITH CHECK (public.current_app_role() = 'admin' OR auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE
  USING (public.current_app_role() = 'admin');

-- ---------- certificate_forms ----------
DROP POLICY IF EXISTS "certificate_forms_select_all_authenticated" ON public.certificate_forms;
CREATE POLICY "certificate_forms_select_all_authenticated"
  ON public.certificate_forms FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "certificate_forms_write_admin" ON public.certificate_forms;
CREATE POLICY "certificate_forms_write_admin"
  ON public.certificate_forms FOR ALL
  USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');

-- ---------- appointments ----------
DROP POLICY IF EXISTS "appointments_select_own_or_staff" ON public.appointments;
CREATE POLICY "appointments_select_own_or_staff"
  ON public.appointments FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "appointments_insert_own" ON public.appointments;
CREATE POLICY "appointments_insert_own"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "appointments_update_own_or_staff" ON public.appointments;
CREATE POLICY "appointments_update_own_or_staff"
  ON public.appointments FOR UPDATE
  USING (auth.uid() = user_id OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "appointments_delete_staff" ON public.appointments;
CREATE POLICY "appointments_delete_staff"
  ON public.appointments FOR DELETE
  USING (public.is_staff_or_admin());

-- ---------- certificates ----------
DROP POLICY IF EXISTS "certificates_select_own_or_staff" ON public.certificates;
CREATE POLICY "certificates_select_own_or_staff"
  ON public.certificates FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "certificates_write_staff" ON public.certificates;
CREATE POLICY "certificates_write_staff"
  ON public.certificates FOR ALL
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- ---------- basketball_courts ----------
DROP POLICY IF EXISTS "basketball_courts_select_authenticated" ON public.basketball_courts;
CREATE POLICY "basketball_courts_select_authenticated"
  ON public.basketball_courts FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "basketball_courts_write_staff" ON public.basketball_courts;
CREATE POLICY "basketball_courts_write_staff"
  ON public.basketball_courts FOR ALL
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- ---------- basketball_reservations ----------
DROP POLICY IF EXISTS "bb_reservations_select_own_or_staff" ON public.basketball_reservations;
CREATE POLICY "bb_reservations_select_own_or_staff"
  ON public.basketball_reservations FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "bb_reservations_insert_own" ON public.basketball_reservations;
CREATE POLICY "bb_reservations_insert_own"
  ON public.basketball_reservations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bb_reservations_update_own_or_staff" ON public.basketball_reservations;
CREATE POLICY "bb_reservations_update_own_or_staff"
  ON public.basketball_reservations FOR UPDATE
  USING (auth.uid() = user_id OR public.is_staff_or_admin());

DROP POLICY IF EXISTS "bb_reservations_delete_staff" ON public.basketball_reservations;
CREATE POLICY "bb_reservations_delete_staff"
  ON public.basketball_reservations FOR DELETE
  USING (public.is_staff_or_admin());

-- ---------- system_settings ----------
DROP POLICY IF EXISTS "system_settings_select_authenticated" ON public.system_settings;
CREATE POLICY "system_settings_select_authenticated"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "system_settings_write_admin" ON public.system_settings;
CREATE POLICY "system_settings_write_admin"
  ON public.system_settings FOR ALL
  USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated, service_role;
