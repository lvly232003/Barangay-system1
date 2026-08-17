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
