-- =============================================================================
-- 06_basketball_courts.sql
-- Basketball court inventory managed by admin / staff
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.basketball_courts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_number          INTEGER NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  location              TEXT NOT NULL,
  capacity              INTEGER NOT NULL DEFAULT 10,
  amenities             TEXT[] NOT NULL DEFAULT '{}',
  hourly_rate           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  maintenance_start     DATE,
  maintenance_end       DATE,
  maintenance_reason    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_basketball_courts_active ON public.basketball_courts (is_active);
CREATE INDEX IF NOT EXISTS idx_basketball_courts_number ON public.basketball_courts (court_number);

DROP TRIGGER IF EXISTS trg_basketball_courts_updated_at ON public.basketball_courts;
CREATE TRIGGER trg_basketball_courts_updated_at
  BEFORE UPDATE ON public.basketball_courts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
