-- =============================================================================
-- 22_fix_barangay_address.sql
-- Align barangay name, hall address, and demo profile addresses
-- to Narra Lane Purok 11, Old Cabalan, Olongapo City
-- Safe to re-run.
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
