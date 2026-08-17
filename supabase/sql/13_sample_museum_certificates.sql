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
