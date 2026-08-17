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
