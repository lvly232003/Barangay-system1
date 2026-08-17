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
