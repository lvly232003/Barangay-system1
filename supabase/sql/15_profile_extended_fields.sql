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
