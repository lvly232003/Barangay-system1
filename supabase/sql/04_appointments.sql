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
