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
