-- =============================================================================
-- 21_new_certificate_samples.sql
-- Museum samples + printable rows for the newer certificate types
-- (Certification, Vehicle, Low Income, First Time Jobseeker, Other)
-- Also backfills certificates for completed appointments that have no row yet.
-- Safe to re-run. Requires 10_seed_reference_data.sql + 11_demo_accounts.sql.
-- =============================================================================

-- Keep the official catalog in sync (same IDs as 10_seed_reference_data.sql)
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

-- Create printable certificate rows for completed/issued appointments that never got one
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
