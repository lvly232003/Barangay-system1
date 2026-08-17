-- =============================================================================
-- 03_certificate_forms.sql
-- Admin-managed certificate form catalog (clearance, indigency, permits, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.certificate_forms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  type              TEXT NOT NULL,
  description       TEXT,
  requirements      TEXT[] NOT NULL DEFAULT '{}',
  price             NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fee               NUMERIC(12, 2) NOT NULL DEFAULT 0,
  processing_time   TEXT DEFAULT '1 day',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_certificate_forms_active ON public.certificate_forms (is_active);
CREATE INDEX IF NOT EXISTS idx_certificate_forms_type ON public.certificate_forms (type);

DROP TRIGGER IF EXISTS trg_certificate_forms_updated_at ON public.certificate_forms;
CREATE TRIGGER trg_certificate_forms_updated_at
  BEFORE UPDATE ON public.certificate_forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
