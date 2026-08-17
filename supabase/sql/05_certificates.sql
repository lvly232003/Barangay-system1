-- =============================================================================
-- 05_certificates.sql
-- Issued / processed certificates linked to residents and appointments
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.certificates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  appointment_id        UUID REFERENCES public.appointments (id) ON DELETE SET NULL,
  certificate_form_id   UUID REFERENCES public.certificate_forms (id) ON DELETE SET NULL,
  user_name             TEXT NOT NULL,
  certificate_type      TEXT NOT NULL,
  certificate_number    TEXT UNIQUE,
  status                public.request_status NOT NULL DEFAULT 'pending',
  request_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_date           DATE,
  expiry_date           DATE,
  purpose               TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON public.certificates (user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON public.certificates (status);
CREATE INDEX IF NOT EXISTS idx_certificates_appointment ON public.certificates (appointment_id);

DROP TRIGGER IF EXISTS trg_certificates_updated_at ON public.certificates;
CREATE TRIGGER trg_certificates_updated_at
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
