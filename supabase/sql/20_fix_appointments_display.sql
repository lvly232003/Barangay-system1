-- =============================================================================
-- 20_fix_appointments_display.sql
-- Backfill appointment display fields used by Document / Appointment Management
-- (certificate name, resident name, schedule, requested date)
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
