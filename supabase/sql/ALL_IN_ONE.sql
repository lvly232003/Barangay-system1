-- =============================================================================
-- ALL_IN_ONE.sql
-- BarangaySystem · schema + seeds + demo accounts + museum samples
-- Demo admin: admin@gmail.com / admin123
-- pgcrypto via extensions.crypt / extensions.gen_salt (Supabase-safe)
-- =============================================================================


-- >>> BEGIN FILE: 01_extensions_and_enums.sql

-- =============================================================================
-- 01_extensions_and_enums.sql
-- Barangay Appointment Certificate Management System
-- Run first in Supabase SQL Editor
-- =============================================================================

-- Supabase installs pgcrypto under the "extensions" schema (not public).
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'resident');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.request_status AS ENUM (
    'pending', 'approved', 'rejected', 'completed', 'issued', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$;


-- >>> END FILE: 01_extensions_and_enums.sql


-- >>> BEGIN FILE: 02_profiles.sql

-- =============================================================================
-- 02_profiles.sql
-- Citizen / staff / admin profile records (linked to auth.users)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email             TEXT NOT NULL UNIQUE,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  middle_name       TEXT,
  suffix            TEXT,
  birth_date        DATE,
  gender            TEXT,
  civil_status      TEXT,
  nationality       TEXT DEFAULT 'Filipino',
  phone             TEXT,
  address           TEXT,
  purok             TEXT,
  position          TEXT,
  department        TEXT,
  employee_id       TEXT,
  hire_date         DATE,
  role              public.app_role NOT NULL DEFAULT 'resident',
  status            public.account_status NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role := 'resident';
BEGIN
  IF NEW.raw_user_meta_data ? 'role' THEN
    BEGIN
      v_role := (NEW.raw_user_meta_data ->> 'role')::public.app_role;
    EXCEPTION WHEN others THEN
      v_role := 'resident';
    END;
  END IF;

  INSERT INTO public.profiles (
    id, email, first_name, last_name, middle_name, suffix,
    birth_date, gender, civil_status, nationality, phone, address, role
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    NEW.raw_user_meta_data ->> 'middle_name',
    NEW.raw_user_meta_data ->> 'suffix',
    NULLIF(NEW.raw_user_meta_data ->> 'birth_date', '')::DATE,
    NEW.raw_user_meta_data ->> 'gender',
    NEW.raw_user_meta_data ->> 'civil_status',
    COALESCE(NEW.raw_user_meta_data ->> 'nationality', 'Filipino'),
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'address',
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    role = EXCLUDED.role,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    address = COALESCE(EXCLUDED.address, public.profiles.address),
    updated_at = TIMEZONE('utc', NOW());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff') AND status = 'active'
  );
$$;


-- >>> END FILE: 02_profiles.sql


-- >>> BEGIN FILE: 03_certificate_forms.sql

-- =============================================================================
-- 03_certificate_forms.sql
-- Admin-managed certificate form catalog (clearance, indigency, permits, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.certificate_forms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  type              TEXT NOT NULL,
  description       TEXT,
  requirements      TEXT[] NOT NULL DEFAULT '{}',
  price             NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fee               NUMERIC(12, 2) NOT NULL DEFAULT 0,
  processing_time   TEXT DEFAULT '1 day',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_certificate_forms_active ON public.certificate_forms (is_active);
CREATE INDEX IF NOT EXISTS idx_certificate_forms_type ON public.certificate_forms (type);

DROP TRIGGER IF EXISTS trg_certificate_forms_updated_at ON public.certificate_forms;
CREATE TRIGGER trg_certificate_forms_updated_at
  BEFORE UPDATE ON public.certificate_forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- >>> END FILE: 03_certificate_forms.sql


-- >>> BEGIN FILE: 04_appointments.sql

-- =============================================================================
-- 04_appointments.sql
-- Certificate appointment requests submitted by residents
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  certificate_form_id UUID REFERENCES public.certificate_forms (id) ON DELETE SET NULL,
  certificate_type    TEXT,
  certificate_name    TEXT,
  status              public.request_status NOT NULL DEFAULT 'pending',
  appointment_date    DATE,
  appointment_time    TEXT,
  requested_date      DATE,
  requested_time      TEXT,
  purpose             TEXT,
  notes               TEXT,
  first_name          TEXT,
  last_name           TEXT,
  middle_name         TEXT,
  address             TEXT,
  purok               TEXT,
  date_of_birth       DATE,
  gender              TEXT,
  civil_status        TEXT,
  phone_no            TEXT,
  resident_since      TEXT,
  user_email          TEXT,
  user_name           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_appointments_user ON public.appointments (user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments (appointment_date);

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- >>> END FILE: 04_appointments.sql


-- >>> BEGIN FILE: 05_certificates.sql

-- =============================================================================
-- 05_certificates.sql
-- Issued / processed certificates linked to residents and appointments
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.certificates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  appointment_id        UUID REFERENCES public.appointments (id) ON DELETE SET NULL,
  certificate_form_id   UUID REFERENCES public.certificate_forms (id) ON DELETE SET NULL,
  user_name             TEXT NOT NULL,
  certificate_type      TEXT NOT NULL,
  certificate_number    TEXT UNIQUE,
  status                public.request_status NOT NULL DEFAULT 'pending',
  request_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_date           DATE,
  expiry_date           DATE,
  purpose               TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON public.certificates (user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON public.certificates (status);
CREATE INDEX IF NOT EXISTS idx_certificates_appointment ON public.certificates (appointment_id);

DROP TRIGGER IF EXISTS trg_certificates_updated_at ON public.certificates;
CREATE TRIGGER trg_certificates_updated_at
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- >>> END FILE: 05_certificates.sql


-- >>> BEGIN FILE: 06_basketball_courts.sql

-- =============================================================================
-- 06_basketball_courts.sql
-- Basketball court inventory managed by admin / staff
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.basketball_courts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_number          INTEGER NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  location              TEXT NOT NULL,
  capacity              INTEGER NOT NULL DEFAULT 10,
  amenities             TEXT[] NOT NULL DEFAULT '{}',
  hourly_rate           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  maintenance_start     DATE,
  maintenance_end       DATE,
  maintenance_reason    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_basketball_courts_active ON public.basketball_courts (is_active);
CREATE INDEX IF NOT EXISTS idx_basketball_courts_number ON public.basketball_courts (court_number);

DROP TRIGGER IF EXISTS trg_basketball_courts_updated_at ON public.basketball_courts;
CREATE TRIGGER trg_basketball_courts_updated_at
  BEFORE UPDATE ON public.basketball_courts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- >>> END FILE: 06_basketball_courts.sql


-- >>> BEGIN FILE: 07_basketball_reservations.sql

-- =============================================================================
-- 07_basketball_reservations.sql
-- Resident basketball court reservation requests (FCFS queue_number)
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS public.basketball_reservation_queue_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS public.basketball_reservations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  court_id            UUID REFERENCES public.basketball_courts (id) ON DELETE SET NULL,
  court_number        INTEGER NOT NULL,
  queue_number        INTEGER NOT NULL DEFAULT nextval('public.basketball_reservation_queue_seq'),
  user_name           TEXT NOT NULL,
  user_email          TEXT NOT NULL,
  reservation_date    DATE NOT NULL,
  start_time          TEXT NOT NULL,
  end_time            TEXT NOT NULL,
  duration_hours      NUMERIC(4, 2) NOT NULL DEFAULT 1,
  purpose             TEXT NOT NULL,
  status              public.request_status NOT NULL DEFAULT 'pending',
  notes               TEXT,
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bb_reservations_queue_number
  ON public.basketball_reservations (queue_number);
CREATE INDEX IF NOT EXISTS idx_bb_reservations_user ON public.basketball_reservations (user_id);
CREATE INDEX IF NOT EXISTS idx_bb_reservations_date ON public.basketball_reservations (reservation_date);
CREATE INDEX IF NOT EXISTS idx_bb_reservations_status ON public.basketball_reservations (status);
CREATE INDEX IF NOT EXISTS idx_bb_reservations_court ON public.basketball_reservations (court_number, reservation_date);
CREATE INDEX IF NOT EXISTS idx_bb_reservations_queue_status
  ON public.basketball_reservations (status, queue_number);

CREATE OR REPLACE FUNCTION public.assign_basketball_queue_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.queue_number IS NULL THEN
    NEW.queue_number := nextval('public.basketball_reservation_queue_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_basketball_queue_number ON public.basketball_reservations;
CREATE TRIGGER trg_assign_basketball_queue_number
  BEFORE INSERT ON public.basketball_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_basketball_queue_number();

DROP TRIGGER IF EXISTS trg_basketball_reservations_updated_at ON public.basketball_reservations;
CREATE TRIGGER trg_basketball_reservations_updated_at
  BEFORE UPDATE ON public.basketball_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.basketball_reservations.queue_number IS
  'FCFS queue ticket assigned at booking time. Process pending by queue_number ASC, not reservation_date.';


-- >>> END FILE: 07_basketball_reservations.sql


-- >>> BEGIN FILE: 08_system_settings.sql

-- =============================================================================
-- 08_system_settings.sql
-- Key/value settings used by Admin > Settings
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key     TEXT NOT NULL UNIQUE,
  setting_value   TEXT,
  description     TEXT,
  updated_by      UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- >>> END FILE: 08_system_settings.sql


-- >>> BEGIN FILE: 09_rls_policies.sql

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


-- >>> END FILE: 09_rls_policies.sql


-- >>> BEGIN FILE: 10_seed_reference_data.sql

-- =============================================================================
-- 10_seed_reference_data.sql
-- Non-account seed data: certificate forms, courts, default settings
-- (Demo login accounts live in 11_demo_accounts.sql)
-- =============================================================================

-- Certificate forms catalog (official barangay fee schedule)
INSERT INTO public.certificate_forms (
  id, name, type, description, requirements, price, fee, processing_time, is_active
) VALUES
  (
    '11111111-1111-1111-1111-111111111101',
    'Barangay Clearance',
    'Clearance',
    'Standard clearance for employment and legal requirements',
    ARRAY['Valid ID', 'Proof of Residency'],
    50, 50, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111104',
    'Barangay Residency',
    'Certificate',
    'Proof of residency within the barangay',
    ARRAY['Valid ID'],
    50, 50, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111103',
    'Barangay Certification',
    'Certificate',
    'General certifications (e.g. Living Together, Guardianship)',
    ARRAY['Valid ID', 'Supporting Documents'],
    50, 50, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111106',
    'Vehicle Inspection / Renewal',
    'Certificate',
    'Vehicle inspection and renewal certification',
    ARRAY['Valid ID', 'Vehicle Documents'],
    50, 50, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111102',
    'Indigency',
    'Certificate',
    'Certificate of indigency for financial assistance',
    ARRAY['Valid ID', 'Barangay Endorsement'],
    0, 0, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111107',
    'Low Income',
    'Certificate',
    'Low income certification for assistance programs',
    ARRAY['Valid ID'],
    0, 0, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111108',
    'First Time Jobseeker',
    'Certificate',
    'First time jobseeker certification',
    ARRAY['Valid ID'],
    0, 0, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111105',
    'Business Endorsement',
    'Business Endorsement',
    'Barangay endorsement for business permit processing',
    ARRAY['DTI Registration', 'Valid ID', 'Business Address Proof'],
    0, 0, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111109',
    'Other Certifications',
    'Certificate',
    'Other barangay certifications as applicable',
    ARRAY['Valid ID', 'Supporting Documents'],
    50, 50, '1 day', TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  requirements = EXCLUDED.requirements,
  price = EXCLUDED.price,
  fee = EXCLUDED.fee,
  processing_time = EXCLUDED.processing_time,
  is_active = EXCLUDED.is_active,
  updated_at = TIMEZONE('utc', NOW());

-- Basketball courts
INSERT INTO public.basketball_courts (
  id, court_number, name, location, capacity, amenities, hourly_rate, is_active
) VALUES
  (
    '22222222-2222-2222-2222-222222222201',
    1,
    'Main Basketball Court',
    'Barangay Sports Complex',
    20,
    ARRAY['Lighting', 'Seating', 'Water Station', 'Restroom'],
    100,
    TRUE
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    2,
    'Secondary Basketball Court',
    'Barangay Sports Complex',
    15,
    ARRAY['Lighting', 'Seating', 'Water Station'],
    80,
    TRUE
  ),
  (
    '22222222-2222-2222-2222-222222222203',
    3,
    'Community Basketball Court',
    'Community Center',
    12,
    ARRAY['Lighting', 'Water Station'],
    50,
    TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  court_number = EXCLUDED.court_number,
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  capacity = EXCLUDED.capacity,
  amenities = EXCLUDED.amenities,
  hourly_rate = EXCLUDED.hourly_rate,
  is_active = EXCLUDED.is_active,
  updated_at = TIMEZONE('utc', NOW());

-- Default system settings
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
  ('barangay_name', 'Barangay Old Cabalan', 'Official barangay display name'),
  ('barangay_captain', 'Hon. Ronaldo A. Alba Jr', 'Barangay captain / punong barangay'),
  ('barangay_secretary', 'Edmer T. Lucido', 'Barangay secretary'),
  ('office_hours', '08:00 AM - 05:00 PM', 'Public office hours'),
  ('contact_email', 'brg.oldcabalan.1988@gmail.com', 'Public contact email'),
  ('contact_phone', '(047) 223 - 1629', 'Public contact phone'),
  ('theme_default', 'emerald', 'Default UI theme family'),
  ('email_notifications', 'true', 'Enable email notifications'),
  ('sms_notifications', 'false', 'Enable SMS notifications'),
  ('auto_approve_documents', 'false', 'Auto-approve document requests')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  updated_at = TIMEZONE('utc', NOW());


-- >>> END FILE: 10_seed_reference_data.sql


-- >>> BEGIN FILE: 11_demo_accounts.sql

-- =============================================================================
-- 11_demo_accounts.sql
-- Demo Auth users + profiles for BarangaySystem (Supabase Auth)
-- Run AFTER schema 01–10, or use ALL_IN_ONE.sql
--
-- LOGIN (exact emails/passwords for the Angular app):
--   admin@gmail.com      role=admin     password=admin123
--   staff@gmail.com      role=staff     password=staff123
--   user@gmail.com       role=resident  password=user123
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.upsert_demo_auth_user(
  p_fixed_id UUID,
  p_email TEXT,
  p_password TEXT,
  p_role public.app_role,
  p_first_name TEXT,
  p_last_name TEXT,
  p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_instance_id UUID;
  v_user_id UUID;
  v_meta JSONB;
  v_hash TEXT;
BEGIN
  -- Fully-qualified pgcrypto (Supabase keeps it in schema "extensions")
  v_hash := extensions.crypt(p_password, extensions.gen_salt('bf'::text));

  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  v_meta := jsonb_build_object(
    'first_name', p_first_name,
    'last_name', p_last_name,
    'role', p_role::text
  ) || COALESCE(p_meta, '{}'::jsonb);

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_fixed_id) THEN
      v_user_id := extensions.gen_random_uuid();
    ELSE
      v_user_id := p_fixed_id;
    END IF;

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      v_instance_id,
      v_user_id,
      'authenticated',
      'authenticated',
      lower(p_email),
      v_hash,
      NOW(),
      '',
      '',
      '',
      '',
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      v_meta,
      NOW(),
      NOW()
    );
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = v_hash,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      confirmation_token = '',
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || v_meta,
      raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  DELETE FROM auth.identities
  WHERE user_id = v_user_id
     OR (provider = 'email' AND provider_id = v_user_id::text)
     OR (provider = 'email' AND lower(identity_data ->> 'email') = lower(p_email));

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    extensions.gen_random_uuid(),
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', lower(p_email),
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    v_user_id::text,
    NOW(),
    NOW(),
    NOW()
  );

  INSERT INTO public.profiles (
    id, email, first_name, last_name, phone, address, role, status,
    birth_date, gender, civil_status, nationality
  ) VALUES (
    v_user_id,
    lower(p_email),
    p_first_name,
    p_last_name,
    p_meta ->> 'phone',
    p_meta ->> 'address',
    p_role,
    'active',
    NULLIF(p_meta ->> 'birth_date', '')::DATE,
    p_meta ->> 'gender',
    p_meta ->> 'civil_status',
    COALESCE(p_meta ->> 'nationality', 'Filipino')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    address = COALESCE(EXCLUDED.address, public.profiles.address),
    role = EXCLUDED.role,
    status = 'active',
    updated_at = TIMEZONE('utc', NOW());

  RETURN v_user_id;
END;
$$;

SELECT public.upsert_demo_auth_user(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'admin@gmail.com',
  'admin123',
  'admin',
  'Admin',
  'User',
  jsonb_build_object('phone', '09170000001', 'address', 'Barangay Hall, Narra Lane Purok 11, Old Cabalan, Olongapo City')
);

SELECT public.upsert_demo_auth_user(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  'staff@gmail.com',
  'staff123',
  'staff',
  'Staff',
  'Officer',
  jsonb_build_object('phone', '09170000002', 'address', 'Barangay Hall, Narra Lane Purok 11, Old Cabalan, Olongapo City')
);

SELECT public.upsert_demo_auth_user(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
  'user@gmail.com',
  'user123',
  'resident',
  'Resident',
  'User',
  jsonb_build_object(
    'phone', '09170000003',
    'address', 'Narra Lane Purok 11, Old Cabalan, Olongapo City',
    'birth_date', '1995-05-15',
    'gender', 'Male',
    'civil_status', 'Single',
    'nationality', 'Filipino'
  )
);

-- Sample activity for resident
DO $$
DECLARE
  v_resident UUID;
BEGIN
  SELECT id INTO v_resident FROM auth.users WHERE lower(email) = 'user@gmail.com' LIMIT 1;
  IF v_resident IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.appointments (
    id, user_id, certificate_form_id, certificate_type, certificate_name,
    status, appointment_date, appointment_time, requested_date, requested_time,
    purpose, user_email, user_name, first_name, last_name, address, phone_no
  ) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    v_resident,
    '11111111-1111-1111-1111-111111111101',
    'Clearance',
    'Barangay Clearance',
    'pending',
    CURRENT_DATE + 3,
    '09:00 AM',
    CURRENT_DATE,
    '09:00 AM',
    'Employment requirement',
    'user@gmail.com',
    'Resident User',
    'Resident',
    'User',
    'Narra Lane Purok 11, Old Cabalan, Olongapo City',
    '09170000003'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.basketball_reservations (
    id, user_id, court_id, court_number, queue_number, user_name, user_email,
    reservation_date, start_time, end_time, duration_hours, purpose, status, notes
  ) VALUES (
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    v_resident,
    '22222222-2222-2222-2222-222222222201',
    1,
    1,
    'Resident User',
    'user@gmail.com',
    CURRENT_DATE + 5,
    '6:00 AM',
    '8:00 AM',
    2,
    'Morning basketball practice',
    'pending',
    'Demo reservation'
  )
  ON CONFLICT (id) DO UPDATE SET
    queue_number = COALESCE(public.basketball_reservations.queue_number, EXCLUDED.queue_number);
END $$;


-- >>> END FILE: 11_demo_accounts.sql


-- >>> BEGIN FILE: 12_fix_admin_gmail_login.sql

-- =============================================================================
-- 12_fix_admin_gmail_login.sql
-- SELF-CONTAINED quick fix — paste alone in Supabase SQL Editor and Run.
-- Creates/updates: admin@gmail.com / admin123 (role=admin, email confirmed)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.upsert_demo_auth_user(
  p_fixed_id UUID,
  p_email TEXT,
  p_password TEXT,
  p_role public.app_role,
  p_first_name TEXT,
  p_last_name TEXT,
  p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_instance_id UUID;
  v_user_id UUID;
  v_meta JSONB;
  v_hash TEXT;
BEGIN
  -- Fully-qualified pgcrypto (Supabase keeps it in schema "extensions")
  v_hash := extensions.crypt(p_password, extensions.gen_salt('bf'::text));

  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  v_meta := jsonb_build_object(
    'first_name', p_first_name,
    'last_name', p_last_name,
    'role', p_role::text
  ) || COALESCE(p_meta, '{}'::jsonb);

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = p_fixed_id) THEN
      v_user_id := extensions.gen_random_uuid();
    ELSE
      v_user_id := p_fixed_id;
    END IF;

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      v_instance_id,
      v_user_id,
      'authenticated',
      'authenticated',
      lower(p_email),
      v_hash,
      NOW(),
      '',
      '',
      '',
      '',
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      v_meta,
      NOW(),
      NOW()
    );
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = v_hash,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      confirmation_token = '',
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || v_meta,
      raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  DELETE FROM auth.identities
  WHERE user_id = v_user_id
     OR (provider = 'email' AND provider_id = v_user_id::text)
     OR (provider = 'email' AND lower(identity_data ->> 'email') = lower(p_email));

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    extensions.gen_random_uuid(),
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', lower(p_email),
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    v_user_id::text,
    NOW(),
    NOW(),
    NOW()
  );

  INSERT INTO public.profiles (
    id, email, first_name, last_name, phone, address, role, status,
    birth_date, gender, civil_status, nationality
  ) VALUES (
    v_user_id,
    lower(p_email),
    p_first_name,
    p_last_name,
    p_meta ->> 'phone',
    p_meta ->> 'address',
    p_role,
    'active',
    NULLIF(p_meta ->> 'birth_date', '')::DATE,
    p_meta ->> 'gender',
    p_meta ->> 'civil_status',
    COALESCE(p_meta ->> 'nationality', 'Filipino')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    address = COALESCE(EXCLUDED.address, public.profiles.address),
    role = EXCLUDED.role,
    status = 'active',
    updated_at = TIMEZONE('utc', NOW());

  RETURN v_user_id;
END;
$$;

SELECT public.upsert_demo_auth_user(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'admin@gmail.com',
  'admin123',
  'admin',
  'Admin',
  'User',
  jsonb_build_object('phone', '09170000001', 'address', 'Barangay Hall, Narra Lane Purok 11, Old Cabalan, Olongapo City')
);

-- Verify
SELECT id, email, email_confirmed_at IS NOT NULL AS confirmed, raw_user_meta_data->>'role' AS meta_role
FROM auth.users
WHERE lower(email) = 'admin@gmail.com';

SELECT id, email, role, status
FROM public.profiles
WHERE lower(email) = 'admin@gmail.com';

SELECT user_id, provider, provider_id, identity_data->>'email' AS email
FROM auth.identities
WHERE lower(identity_data->>'email') = 'admin@gmail.com';


-- >>> END FILE: 12_fix_admin_gmail_login.sql


-- >>> BEGIN FILE: 13_sample_museum_certificates.sql

-- =============================================================================
-- 13_sample_museum_certificates.sql
-- Sample / museum archive certificates (preview formats + coverage demos)
-- Run AFTER 10 + 11 (needs admin profile for user_id)
-- Tagged with notes containing [museum-sample] so Certificate Museum can find them
-- =============================================================================

DO $$
DECLARE
  v_admin UUID;
BEGIN
  SELECT id INTO v_admin
  FROM public.profiles
  WHERE lower(email) = 'admin@gmail.com'
  LIMIT 1;

  IF v_admin IS NULL THEN
    SELECT id INTO v_admin
    FROM public.profiles
    WHERE role = 'admin'
    LIMIT 1;
  END IF;

  IF v_admin IS NULL THEN
    RAISE NOTICE 'No admin profile found — run 11_demo_accounts.sql first.';
    RETURN;
  END IF;

  INSERT INTO public.certificates (
    id, user_id, appointment_id, certificate_form_id,
    user_name, certificate_type, certificate_number, status,
    request_date, issued_date, expiry_date, purpose, notes
  ) VALUES
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd1',
    v_admin,
    NULL,
    '11111111-1111-1111-1111-111111111101',
    'Juan Dela Cruz',
    'Barangay Clearance',
    'BMS-CLR-SAMPLE-001',
    'issued',
    CURRENT_DATE - 30,
    CURRENT_DATE - 28,
    CURRENT_DATE + 337,
    'Employment requirement (museum sample)',
    '[museum-sample] Official layout preview for Barangay Clearance coverage.'
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd2',
    v_admin,
    NULL,
    '11111111-1111-1111-1111-111111111102',
    'Maria Santos',
    'Indigency',
    'BMS-IND-SAMPLE-001',
    'issued',
    CURRENT_DATE - 20,
    CURRENT_DATE - 18,
    NULL,
    'Medical assistance (museum sample)',
    '[museum-sample] Official layout preview for Indigency coverage.'
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd3',
    v_admin,
    NULL,
    '11111111-1111-1111-1111-111111111105',
    'Pedro Reyes Trading',
    'Business Endorsement',
    'BMS-BUS-SAMPLE-001',
    'issued',
    CURRENT_DATE - 45,
    CURRENT_DATE - 40,
    CURRENT_DATE + 320,
    'Business permit processing (museum sample)',
    '[museum-sample] Official layout preview for Business Endorsement coverage.'
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd4',
    v_admin,
    NULL,
    '11111111-1111-1111-1111-111111111104',
    'Ana Lopez',
    'Barangay Residency',
    'BMS-RES-SAMPLE-001',
    'issued',
    CURRENT_DATE - 10,
    CURRENT_DATE - 9,
    CURRENT_DATE + 356,
    'School enrollment (museum sample)',
    '[museum-sample] Official layout preview for Barangay Residency coverage.'
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd5',
    v_admin,
    NULL,
    '11111111-1111-1111-1111-111111111103',
    'Rosa Mendoza',
    'Barangay Certification',
    'BMS-CERT-SAMPLE-001',
    'issued',
    CURRENT_DATE - 12,
    CURRENT_DATE - 11,
    CURRENT_DATE + 354,
    'Living Together / Guardianship (museum sample)',
    '[museum-sample] Official layout preview for Barangay Certification coverage.'
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd6',
    v_admin,
    NULL,
    '11111111-1111-1111-1111-111111111106',
    'Carlo Diaz',
    'Vehicle Inspection / Renewal',
    'BMS-VEH-SAMPLE-001',
    'issued',
    CURRENT_DATE - 8,
    CURRENT_DATE - 7,
    CURRENT_DATE + 358,
    'Vehicle inspection / renewal (museum sample)',
    '[museum-sample] Official layout preview for Vehicle Inspection / Renewal coverage.'
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd7',
    v_admin,
    NULL,
    '11111111-1111-1111-1111-111111111107',
    'Elena Cruz',
    'Low Income',
    'BMS-LOW-SAMPLE-001',
    'issued',
    CURRENT_DATE - 16,
    CURRENT_DATE - 15,
    NULL,
    'Assistance program requirement (museum sample)',
    '[museum-sample] Official layout preview for Low Income coverage.'
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd8',
    v_admin,
    NULL,
    '11111111-1111-1111-1111-111111111108',
    'Mark Villanueva',
    'First Time Jobseeker',
    'BMS-JOB-SAMPLE-001',
    'issued',
    CURRENT_DATE - 6,
    CURRENT_DATE - 5,
    CURRENT_DATE + 360,
    'First time jobseeker certification (museum sample)',
    '[museum-sample] Official layout preview for First Time Jobseeker coverage.'
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd9',
    v_admin,
    NULL,
    '11111111-1111-1111-1111-111111111109',
    'Grace Ramos',
    'Other Certifications',
    'BMS-OTH-SAMPLE-001',
    'issued',
    CURRENT_DATE - 4,
    CURRENT_DATE - 3,
    CURRENT_DATE + 362,
    'Other official barangay certification (museum sample)',
    '[museum-sample] Official layout preview for Other Certifications coverage.'
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    certificate_form_id = EXCLUDED.certificate_form_id,
    certificate_type = EXCLUDED.certificate_type,
    certificate_number = EXCLUDED.certificate_number,
    status = EXCLUDED.status,
    issued_date = EXCLUDED.issued_date,
    purpose = EXCLUDED.purpose,
    notes = EXCLUDED.notes,
    updated_at = TIMEZONE('utc', NOW());
END $$;


-- >>> END FILE: 13_sample_museum_certificates.sql


-- >>> BEGIN FILE: 14_basketball_queue_fcfs.sql

-- =============================================================================
-- 14_basketball_queue_fcfs.sql
-- First-come-first-served queue numbers for basketball court reservations
-- Safe to re-run on existing projects (adds column/trigger if missing)
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS public.basketball_reservation_queue_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE public.basketball_reservations
  ADD COLUMN IF NOT EXISTS queue_number INTEGER;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id
    FROM public.basketball_reservations
    WHERE queue_number IS NULL
    ORDER BY created_at ASC, id ASC
  LOOP
    UPDATE public.basketball_reservations
    SET queue_number = nextval('public.basketball_reservation_queue_seq')
    WHERE id = r.id;
  END LOOP;
END $$;

SELECT setval(
  'public.basketball_reservation_queue_seq',
  GREATEST(
    (SELECT COALESCE(MAX(queue_number), 0) FROM public.basketball_reservations),
    1
  )
);

ALTER TABLE public.basketball_reservations
  ALTER COLUMN queue_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bb_reservations_queue_number
  ON public.basketball_reservations (queue_number);

CREATE INDEX IF NOT EXISTS idx_bb_reservations_queue_status
  ON public.basketball_reservations (status, queue_number);

CREATE OR REPLACE FUNCTION public.assign_basketball_queue_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.queue_number IS NULL THEN
    NEW.queue_number := nextval('public.basketball_reservation_queue_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_basketball_queue_number ON public.basketball_reservations;
CREATE TRIGGER trg_assign_basketball_queue_number
  BEFORE INSERT ON public.basketball_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_basketball_queue_number();

COMMENT ON COLUMN public.basketball_reservations.queue_number IS
  'FCFS queue ticket assigned at booking time. Process pending reservations by queue_number ASC, not by reservation_date.';


-- >>> END FILE: 14_basketball_queue_fcfs.sql


-- >>> BEGIN FILE: 15_profile_extended_fields.sql
-- =============================================================================
-- 15_profile_extended_fields.sql
-- Staff/admin job fields on profiles + demo dummy details
-- Run after 02_profiles.sql / 11_demo_accounts.sql
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS employee_id TEXT,
  ADD COLUMN IF NOT EXISTS hire_date DATE;

COMMENT ON COLUMN public.profiles.position IS 'Job title / position (staff & admin)';
COMMENT ON COLUMN public.profiles.department IS 'Department (staff & admin)';
COMMENT ON COLUMN public.profiles.employee_id IS 'Employee ID (staff & admin)';
COMMENT ON COLUMN public.profiles.hire_date IS 'Hire date (staff & admin)';

-- Seed / refresh dummy details for demo accounts (editable in Profile UI)
UPDATE public.profiles SET
  first_name = 'Admin',
  last_name = 'User',
  middle_name = 'System',
  phone = '09170000001',
  address = 'Barangay Hall, Narra Lane Purok 11, Old Cabalan, Olongapo City',
  purok = 'Purok 11',
  nationality = 'Filipino',
  gender = 'Male',
  civil_status = 'Single',
  birth_date = '1990-01-15',
  position = 'Barangay Administrator',
  department = 'Office of the Punong Barangay',
  employee_id = 'ADM-001',
  hire_date = '2022-01-10',
  updated_at = TIMEZONE('utc', NOW())
WHERE lower(email) = 'admin@gmail.com';

UPDATE public.profiles SET
  first_name = 'Staff',
  last_name = 'User',
  middle_name = 'Ops',
  phone = '09170000002',
  address = 'Barangay Hall, Narra Lane Purok 11, Old Cabalan, Olongapo City',
  purok = 'Purok 2',
  nationality = 'Filipino',
  gender = 'Female',
  civil_status = 'Married',
  birth_date = '1992-06-20',
  position = 'Document Processor',
  department = 'Administrative Services',
  employee_id = 'EMP-001',
  hire_date = '2023-01-15',
  updated_at = TIMEZONE('utc', NOW())
WHERE lower(email) = 'staff@gmail.com';

UPDATE public.profiles SET
  first_name = 'Resident',
  last_name = 'User',
  middle_name = 'Demo',
  phone = '09170000003',
  address = 'Narra Lane Purok 11, Old Cabalan, Olongapo City',
  purok = 'Purok 11',
  nationality = 'Filipino',
  gender = 'Male',
  civil_status = 'Single',
  birth_date = '2000-03-10',
  position = NULL,
  department = NULL,
  employee_id = NULL,
  hire_date = NULL,
  updated_at = TIMEZONE('utc', NOW())
WHERE lower(email) = 'user@gmail.com';

-- >>> END FILE: 15_profile_extended_fields.sql


-- >>> BEGIN FILE: 16_pickup_reminders.sql
-- =============================================================================
-- 16_pickup_reminders.sql
-- Shared pickup / pending reminder notifications for admin, staff, and residents
-- Run after appointments + certificates + RLS helpers exist
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_audience') THEN
    CREATE TYPE public.reminder_audience AS ENUM ('ops', 'resident');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_item_status') THEN
    CREATE TYPE public.reminder_item_status AS ENUM ('active', 'dismissed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pickup_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key      TEXT NOT NULL UNIQUE,
  audience        public.reminder_audience NOT NULL,
  user_id         UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES public.appointments (id) ON DELETE CASCADE,
  certificate_id  UUID REFERENCES public.certificates (id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('appointment', 'document')),
  urgency         TEXT NOT NULL CHECK (urgency IN ('pending', 'pickup', 'ready')),
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  reference       TEXT,
  resident_name   TEXT,
  status          public.reminder_item_status NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  dismissed_at    TIMESTAMPTZ,
  dismissed_by    UUID REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pickup_reminders_audience_status
  ON public.pickup_reminders (audience, status);
CREATE INDEX IF NOT EXISTS idx_pickup_reminders_user_status
  ON public.pickup_reminders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_pickup_reminders_appointment
  ON public.pickup_reminders (appointment_id);

DROP TRIGGER IF EXISTS trg_pickup_reminders_updated_at ON public.pickup_reminders;
CREATE TRIGGER trg_pickup_reminders_updated_at
  BEFORE UPDATE ON public.pickup_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Upsert one reminder row (reactivates if previously dismissed for same source_key after status change)
CREATE OR REPLACE FUNCTION public.upsert_pickup_reminder(
  p_source_key TEXT,
  p_audience public.reminder_audience,
  p_user_id UUID,
  p_appointment_id UUID,
  p_certificate_id UUID,
  p_kind TEXT,
  p_urgency TEXT,
  p_title TEXT,
  p_message TEXT,
  p_reference TEXT,
  p_resident_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pickup_reminders (
    source_key, audience, user_id, appointment_id, certificate_id,
    kind, urgency, title, message, reference, resident_name, status
  ) VALUES (
    p_source_key, p_audience, p_user_id, p_appointment_id, p_certificate_id,
    p_kind, p_urgency, p_title, p_message, p_reference, p_resident_name, 'active'
  )
  ON CONFLICT (source_key) DO UPDATE SET
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    reference = EXCLUDED.reference,
    resident_name = EXCLUDED.resident_name,
    urgency = EXCLUDED.urgency,
    kind = EXCLUDED.kind,
    status = 'active',
    dismissed_at = NULL,
    dismissed_by = NULL,
    updated_at = TIMEZONE('utc', NOW());
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_appointment_reminders(p_appointment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pickup_reminders
  SET status = 'dismissed',
      dismissed_at = TIMEZONE('utc', NOW()),
      updated_at = TIMEZONE('utc', NOW())
  WHERE appointment_id = p_appointment_id
    AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_reminders_for_appointment(p_appointment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a RECORD;
  v_name TEXT;
  v_label TEXT;
  v_ref TEXT;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_name := COALESCE(NULLIF(TRIM(a.user_name), ''), 'Resident');
  v_label := COALESCE(NULLIF(TRIM(a.certificate_name), ''), NULLIF(TRIM(a.certificate_type), ''), 'document');
  v_ref := 'APT-' || UPPER(LEFT(REPLACE(a.id::text, '-', ''), 8));

  -- Clear previous active reminders for this appointment, then recreate for current status
  PERFORM public.deactivate_appointment_reminders(a.id);

  IF a.status::text = 'pending' THEN
    PERFORM public.upsert_pickup_reminder(
      'ops:appt-pending:' || a.id::text,
      'ops', a.user_id, a.id, NULL,
      'appointment', 'pending',
      'Pending appointment review',
      v_name || ' requested ' || v_label || '. Review and approve in Appointment Management.',
      v_ref, v_name
    );
  ELSIF a.status::text = 'approved' THEN
    PERFORM public.upsert_pickup_reminder(
      'ops:appt-pickup:' || a.id::text,
      'ops', a.user_id, a.id, NULL,
      'appointment', 'pickup',
      'Ready for pickup reminder',
      v_name || '''s ' || v_label || ' request is approved — schedule / confirm pickup.',
      v_ref, v_name
    );
    PERFORM public.upsert_pickup_reminder(
      'resident:appt-pickup:' || a.id::text,
      'resident', a.user_id, a.id, NULL,
      'appointment', 'pickup',
      'Appointment approved — pickup soon',
      'Your ' || v_label || ' request was approved. Please wait for issuance, then pick up at the barangay hall.',
      v_ref, v_name
    );
  ELSIF a.status::text IN ('completed', 'issued') THEN
    PERFORM public.upsert_pickup_reminder(
      'ops:appt-ready:' || a.id::text,
      'ops', a.user_id, a.id, NULL,
      'document', 'ready',
      'Document ready for pickup',
      v_name || '''s ' || v_label || ' is ready. Confirm resident pickup at the barangay hall.',
      'DOC-' || UPPER(LEFT(REPLACE(a.id::text, '-', ''), 8)), v_name
    );
    PERFORM public.upsert_pickup_reminder(
      'resident:appt-ready:' || a.id::text,
      'resident', a.user_id, a.id, NULL,
      'document', 'ready',
      'Your document is ready for pickup',
      'Your ' || v_label || ' is ready. Please claim it at the barangay hall during office hours.',
      'DOC-' || UPPER(LEFT(REPLACE(a.id::text, '-', ''), 8)), v_name
    );
  END IF;
  -- rejected / cancelled → left dismissed via deactivate above
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_reminders_for_certificate(p_certificate_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  v_name TEXT;
  v_label TEXT;
  v_ref TEXT;
  v_has_appt_ready BOOLEAN;
BEGIN
  SELECT * INTO c FROM public.certificates WHERE id = p_certificate_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF c.status::text NOT IN ('issued', 'completed') THEN
    UPDATE public.pickup_reminders
    SET status = 'dismissed',
        dismissed_at = TIMEZONE('utc', NOW()),
        updated_at = TIMEZONE('utc', NOW())
    WHERE certificate_id = c.id AND status = 'active';
    RETURN;
  END IF;

  v_name := COALESCE(NULLIF(TRIM(c.user_name), ''), 'Resident');
  v_label := COALESCE(NULLIF(TRIM(c.certificate_type), ''), 'certificate');
  v_ref := COALESCE(NULLIF(TRIM(c.certificate_number), ''), 'CERT-' || UPPER(LEFT(REPLACE(c.id::text, '-', ''), 8)));

  IF c.appointment_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.pickup_reminders
      WHERE appointment_id = c.appointment_id
        AND urgency = 'ready'
        AND status = 'active'
    ) INTO v_has_appt_ready;
    IF v_has_appt_ready THEN
      RETURN;
    END IF;
  END IF;

  PERFORM public.upsert_pickup_reminder(
    'ops:cert-pickup:' || c.id::text,
    'ops', c.user_id, c.appointment_id, c.id,
    'document', 'pickup',
    'Certificate pickup reminder',
    v_name || '''s ' || v_label || ' (' || v_ref || ') is issued — release on pickup.',
    v_ref, v_name
  );
  PERFORM public.upsert_pickup_reminder(
    'resident:cert-pickup:' || c.id::text,
    'resident', c.user_id, c.appointment_id, c.id,
    'document', 'pickup',
    'Your certificate is ready for pickup',
    'Your ' || v_label || ' (' || v_ref || ') is ready. Please claim it at the barangay hall.',
    v_ref, v_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_appointment_reminders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_reminders_for_appointment(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_sync_reminders ON public.appointments;
CREATE TRIGGER trg_appointments_sync_reminders
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_appointment_reminders();

CREATE OR REPLACE FUNCTION public.trg_sync_certificate_reminders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_reminders_for_certificate(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_certificates_sync_reminders ON public.certificates;
CREATE TRIGGER trg_certificates_sync_reminders
  AFTER INSERT OR UPDATE OF status ON public.certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_certificate_reminders();

-- Backfill from existing rows
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.appointments LOOP
    PERFORM public.sync_reminders_for_appointment(r.id);
  END LOOP;
  FOR r IN SELECT id FROM public.certificates LOOP
    PERFORM public.sync_reminders_for_certificate(r.id);
  END LOOP;
END $$;

ALTER TABLE public.pickup_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pickup_reminders_select" ON public.pickup_reminders;
CREATE POLICY "pickup_reminders_select"
  ON public.pickup_reminders FOR SELECT
  USING (
    (audience = 'ops' AND public.is_staff_or_admin())
    OR (audience = 'resident' AND auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "pickup_reminders_dismiss" ON public.pickup_reminders;
CREATE POLICY "pickup_reminders_dismiss"
  ON public.pickup_reminders FOR UPDATE
  USING (
    (audience = 'ops' AND public.is_staff_or_admin())
    OR (audience = 'resident' AND auth.uid() = user_id)
  )
  WITH CHECK (
    (audience = 'ops' AND public.is_staff_or_admin())
    OR (audience = 'resident' AND auth.uid() = user_id)
  );

COMMENT ON TABLE public.pickup_reminders IS
  'Pickup / pending reminder notifications for ops (admin+staff) and residents';

-- >>> END FILE: 16_pickup_reminders.sql


-- >>> BEGIN FILE: 17_system_settings_extended.sql
-- =============================================================================
-- 17_system_settings_extended.sql
-- Extra Admin Settings keys stored in system_settings (Supabase as store of record)
-- =============================================================================

INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
  ('barangay_name', 'Barangay Old Cabalan', 'Official barangay display name'),
  ('barangay_captain', 'Hon. Ronaldo A. Alba Jr', 'Barangay captain / punong barangay'),
  ('barangay_secretary', 'Edmer T. Lucido', 'Barangay secretary'),
  ('office_hours', '08:00 AM - 05:00 PM', 'Public office hours'),
  ('contact_email', 'brg.oldcabalan.1988@gmail.com', 'Public contact email'),
  ('contact_phone', '(047) 223 - 1629', 'Public contact phone'),
  ('theme_default', 'emerald', 'Default UI theme family'),
  ('email_notifications', 'true', 'Enable email notifications'),
  ('sms_notifications', 'false', 'Enable SMS notifications'),
  ('auto_approve_documents', 'false', 'Auto-approve document requests')
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = TIMEZONE('utc', NOW());

-- Keep captain / secretary values current for existing deployments
UPDATE public.system_settings
SET setting_value = 'Hon. Ronaldo A. Alba Jr',
    description = 'Barangay captain / punong barangay',
    updated_at = TIMEZONE('utc', NOW())
WHERE setting_key = 'barangay_captain';

UPDATE public.system_settings
SET setting_value = 'Edmer T. Lucido',
    description = 'Barangay secretary',
    updated_at = TIMEZONE('utc', NOW())
WHERE setting_key = 'barangay_secretary';

UPDATE public.system_settings
SET setting_value = 'brg.oldcabalan.1988@gmail.com',
    description = 'Public contact email',
    updated_at = TIMEZONE('utc', NOW())
WHERE setting_key = 'contact_email';

UPDATE public.system_settings
SET setting_value = '(047) 223 - 1629',
    description = 'Public contact phone',
    updated_at = TIMEZONE('utc', NOW())
WHERE setting_key = 'contact_phone';

UPDATE public.system_settings
SET setting_value = 'Barangay Old Cabalan',
    description = 'Official barangay display name',
    updated_at = TIMEZONE('utc', NOW())
WHERE setting_key = 'barangay_name';

-- >>> END FILE: 17_system_settings_extended.sql


-- >>> BEGIN FILE: 18_storage_optional.sql

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
--   2. Or click Restart project (Settings â†’ General)
--   SQL cannot heal Supabase platform Storage health â€” that is infrastructure.
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

-- <<< END FILE: 18_storage_optional.sql


-- >>> BEGIN FILE: 19_supabase_grants.sql
-- =============================================================================
-- 19_supabase_grants.sql
-- Ensure authenticated clients can call RLS helper functions and tables.
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated, service_role;

-- <<< END FILE: 19_supabase_grants.sql


-- >>> BEGIN FILE: 20_fix_appointments_display.sql
-- =============================================================================
-- 20_fix_appointments_display.sql
-- Backfill appointment display fields used by Document / Appointment Management
-- =============================================================================

UPDATE public.appointments a
SET certificate_name = COALESCE(NULLIF(TRIM(a.certificate_name), ''), cf.name, a.certificate_type)
FROM public.certificate_forms cf
WHERE a.certificate_form_id = cf.id
  AND (a.certificate_name IS NULL OR TRIM(a.certificate_name) = '');

UPDATE public.appointments
SET
  certificate_name = COALESCE(NULLIF(TRIM(certificate_name), ''), NULLIF(TRIM(certificate_type), ''), 'Certificate'),
  certificate_type = COALESCE(NULLIF(TRIM(certificate_type), ''), NULLIF(TRIM(certificate_name), ''), 'Certificate'),
  appointment_date = COALESCE(appointment_date, requested_date),
  requested_date = COALESCE(requested_date, appointment_date),
  appointment_time = COALESCE(NULLIF(TRIM(appointment_time), ''), NULLIF(TRIM(requested_time), '')),
  requested_time = COALESCE(NULLIF(TRIM(requested_time), ''), NULLIF(TRIM(appointment_time), '')),
  user_name = COALESCE(
    NULLIF(TRIM(user_name), ''),
    NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), '')
  ),
  updated_at = TIMEZONE('utc', NOW())
WHERE
  certificate_name IS NULL
  OR TRIM(certificate_name) = ''
  OR appointment_date IS NULL
  OR requested_date IS NULL
  OR user_name IS NULL
  OR TRIM(user_name) = '';

-- <<< END FILE: 20_fix_appointments_display.sql


-- >>> BEGIN FILE: 21_new_certificate_samples.sql
-- =============================================================================
-- 21_new_certificate_samples.sql
-- Museum samples + printable rows for the newer certificate types
-- (Certification, Vehicle, Low Income, First Time Jobseeker, Other)
-- Also backfills certificates for completed appointments that have no row yet.
-- =============================================================================

INSERT INTO public.certificate_forms (
  id, name, type, description, requirements, price, fee, processing_time, is_active
) VALUES
  (
    '11111111-1111-1111-1111-111111111101',
    'Barangay Clearance',
    'Clearance',
    'Standard clearance for employment and legal requirements',
    ARRAY['Valid ID', 'Proof of Residency'],
    50, 50, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111104',
    'Barangay Residency',
    'Certificate',
    'Proof of residency within the barangay',
    ARRAY['Valid ID'],
    50, 50, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111103',
    'Barangay Certification',
    'Certificate',
    'General certifications (e.g. Living Together, Guardianship)',
    ARRAY['Valid ID', 'Supporting Documents'],
    50, 50, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111106',
    'Vehicle Inspection / Renewal',
    'Certificate',
    'Vehicle inspection and renewal certification',
    ARRAY['Valid ID', 'Vehicle Documents'],
    50, 50, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111102',
    'Indigency',
    'Certificate',
    'Certificate of indigency for financial assistance',
    ARRAY['Valid ID', 'Barangay Endorsement'],
    0, 0, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111107',
    'Low Income',
    'Certificate',
    'Low income certification for assistance programs',
    ARRAY['Valid ID'],
    0, 0, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111108',
    'First Time Jobseeker',
    'Certificate',
    'First time jobseeker certification',
    ARRAY['Valid ID'],
    0, 0, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111105',
    'Business Endorsement',
    'Business Endorsement',
    'Barangay endorsement for business permit processing',
    ARRAY['DTI Registration', 'Valid ID', 'Business Address Proof'],
    0, 0, '1 day', TRUE
  ),
  (
    '11111111-1111-1111-1111-111111111109',
    'Other Certifications',
    'Certificate',
    'Other barangay certifications as applicable',
    ARRAY['Valid ID', 'Supporting Documents'],
    50, 50, '1 day', TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  requirements = EXCLUDED.requirements,
  price = EXCLUDED.price,
  fee = EXCLUDED.fee,
  processing_time = EXCLUDED.processing_time,
  is_active = EXCLUDED.is_active,
  updated_at = TIMEZONE('utc', NOW());

DO $$
DECLARE
  v_admin UUID;
BEGIN
  SELECT id INTO v_admin
  FROM public.profiles
  WHERE lower(email) = 'admin@gmail.com'
  LIMIT 1;

  IF v_admin IS NULL THEN
    SELECT id INTO v_admin
    FROM public.profiles
    WHERE role = 'admin'
    LIMIT 1;
  END IF;

  IF v_admin IS NULL THEN
    RAISE NOTICE 'No admin profile found — run 11_demo_accounts.sql first.';
    RETURN;
  END IF;

  INSERT INTO public.certificates (
    id, user_id, appointment_id, certificate_form_id,
    user_name, certificate_type, certificate_number, status,
    request_date, issued_date, expiry_date, purpose, notes
  ) VALUES
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd5',
    v_admin,
    NULL,
    '11111111-1111-1111-1111-111111111103',
    'Rosa Mendoza',
    'Barangay Certification',
    'BMS-CERT-SAMPLE-001',
    'issued',
    CURRENT_DATE - 12,
    CURRENT_DATE - 11,
    CURRENT_DATE + 354,
    'Living Together / Guardianship (museum sample)',
    '[museum-sample] Official layout preview for Barangay Certification coverage.'
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd6',
    v_admin,
    NULL,
    '11111111-1111-1111-1111-111111111106',
    'Carlo Diaz',
    'Vehicle Inspection / Renewal',
    'BMS-VEH-SAMPLE-001',
    'issued',
    CURRENT_DATE - 8,
    CURRENT_DATE - 7,
    CURRENT_DATE + 358,
    'Vehicle inspection / renewal (museum sample)',
    '[museum-sample] Official layout preview for Vehicle Inspection / Renewal coverage.'
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd7',
    v_admin,
    NULL,
    '11111111-1111-1111-1111-111111111107',
    'Elena Cruz',
    'Low Income',
    'BMS-LOW-SAMPLE-001',
    'issued',
    CURRENT_DATE - 16,
    CURRENT_DATE - 15,
    NULL,
    'Assistance program requirement (museum sample)',
    '[museum-sample] Official layout preview for Low Income coverage.'
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd8',
    v_admin,
    NULL,
    '11111111-1111-1111-1111-111111111108',
    'Mark Villanueva',
    'First Time Jobseeker',
    'BMS-JOB-SAMPLE-001',
    'issued',
    CURRENT_DATE - 6,
    CURRENT_DATE - 5,
    CURRENT_DATE + 360,
    'First time jobseeker certification (museum sample)',
    '[museum-sample] Official layout preview for First Time Jobseeker coverage.'
  ),
  (
    'dddddddd-dddd-dddd-dddd-ddddddddddd9',
    v_admin,
    NULL,
    '11111111-1111-1111-1111-111111111109',
    'Grace Ramos',
    'Other Certifications',
    'BMS-OTH-SAMPLE-001',
    'issued',
    CURRENT_DATE - 4,
    CURRENT_DATE - 3,
    CURRENT_DATE + 362,
    'Other official barangay certification (museum sample)',
    '[museum-sample] Official layout preview for Other Certifications coverage.'
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    certificate_form_id = EXCLUDED.certificate_form_id,
    certificate_type = EXCLUDED.certificate_type,
    certificate_number = EXCLUDED.certificate_number,
    status = EXCLUDED.status,
    issued_date = EXCLUDED.issued_date,
    purpose = EXCLUDED.purpose,
    notes = EXCLUDED.notes,
    updated_at = TIMEZONE('utc', NOW());
END $$;

INSERT INTO public.certificates (
  user_id, appointment_id, certificate_form_id,
  user_name, certificate_type, certificate_number, status,
  request_date, issued_date, purpose, notes
)
SELECT
  a.user_id,
  a.id,
  a.certificate_form_id,
  COALESCE(
    NULLIF(TRIM(a.user_name), ''),
    NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
    'Resident'
  ),
  COALESCE(
    NULLIF(TRIM(a.certificate_name), ''),
    NULLIF(TRIM(a.certificate_type), ''),
    cf.name,
    'Certificate'
  ),
  'BMS-' || UPPER(SUBSTRING(
    REGEXP_REPLACE(
      COALESCE(NULLIF(TRIM(a.certificate_name), ''), NULLIF(TRIM(a.certificate_type), ''), 'CERT'),
      '[^A-Za-z]',
      '',
      'g'
    ) FROM 1 FOR 4
  )) || '-' || SUBSTRING(REPLACE(a.id::text, '-', '') FROM 1 FOR 8),
  'issued',
  COALESCE(a.requested_date, a.appointment_date, CURRENT_DATE),
  COALESCE(a.updated_at::date, CURRENT_DATE),
  a.purpose,
  a.notes
FROM public.appointments a
LEFT JOIN public.certificate_forms cf ON cf.id = a.certificate_form_id
WHERE a.status::text IN ('completed', 'issued')
  AND NOT EXISTS (
    SELECT 1 FROM public.certificates c WHERE c.appointment_id = a.id
  );

-- <<< END FILE: 21_new_certificate_samples.sql


-- >>> BEGIN FILE: 22_fix_barangay_address.sql
-- =============================================================================
-- 22_fix_barangay_address.sql
-- Align barangay name, hall address, and demo profile addresses
-- to Narra Lane Purok 11, Old Cabalan, Olongapo City
-- =============================================================================

UPDATE public.system_settings
SET setting_value = 'Barangay Old Cabalan',
    description = 'Official barangay display name',
    updated_at = TIMEZONE('utc', NOW())
WHERE setting_key = 'barangay_name';

UPDATE public.system_settings
SET setting_value = '(047) 223 - 1629',
    description = 'Public contact phone',
    updated_at = TIMEZONE('utc', NOW())
WHERE setting_key = 'contact_phone';

INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'office_address',
  'Narra Lane Purok 11, Old Cabalan, Olongapo City',
  'Official barangay hall address'
)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  updated_at = TIMEZONE('utc', NOW());

UPDATE public.profiles SET
  address = 'Barangay Hall, Narra Lane Purok 11, Old Cabalan, Olongapo City',
  purok = COALESCE(NULLIF(TRIM(purok), ''), 'Purok 11'),
  updated_at = TIMEZONE('utc', NOW())
WHERE lower(email) IN ('admin@gmail.com', 'staff@gmail.com');

UPDATE public.profiles SET
  address = 'Narra Lane Purok 11, Old Cabalan, Olongapo City',
  purok = COALESCE(NULLIF(TRIM(purok), ''), 'Purok 11'),
  updated_at = TIMEZONE('utc', NOW())
WHERE lower(email) = 'user@gmail.com';

UPDATE public.appointments SET
  address = 'Narra Lane Purok 11, Old Cabalan, Olongapo City',
  purok = COALESCE(NULLIF(TRIM(purok), ''), 'Purok 11'),
  updated_at = TIMEZONE('utc', NOW())
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';

-- <<< END FILE: 22_fix_barangay_address.sql




