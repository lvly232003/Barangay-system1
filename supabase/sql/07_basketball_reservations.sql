-- =============================================================================
-- 07_basketball_reservations.sql
-- Resident basketball court reservation requests (FCFS queue_number)
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS public.basketball_reservation_queue_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS public.basketball_reservations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  court_id            UUID REFERENCES public.basketball_courts (id) ON DELETE SET NULL,
  court_number        INTEGER NOT NULL,
  queue_number        INTEGER NOT NULL DEFAULT nextval('public.basketball_reservation_queue_seq'),
  user_name           TEXT NOT NULL,
  user_email          TEXT NOT NULL,
  reservation_date    DATE NOT NULL,
  start_time          TEXT NOT NULL,
  end_time            TEXT NOT NULL,
  duration_hours      NUMERIC(4, 2) NOT NULL DEFAULT 1,
  purpose             TEXT NOT NULL,
  status              public.request_status NOT NULL DEFAULT 'pending',
  notes               TEXT,
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bb_reservations_queue_number
  ON public.basketball_reservations (queue_number);
CREATE INDEX IF NOT EXISTS idx_bb_reservations_user ON public.basketball_reservations (user_id);
CREATE INDEX IF NOT EXISTS idx_bb_reservations_date ON public.basketball_reservations (reservation_date);
CREATE INDEX IF NOT EXISTS idx_bb_reservations_status ON public.basketball_reservations (status);
CREATE INDEX IF NOT EXISTS idx_bb_reservations_court ON public.basketball_reservations (court_number, reservation_date);
CREATE INDEX IF NOT EXISTS idx_bb_reservations_queue_status
  ON public.basketball_reservations (status, queue_number);

CREATE OR REPLACE FUNCTION public.assign_basketball_queue_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.queue_number IS NULL THEN
    NEW.queue_number := nextval('public.basketball_reservation_queue_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_basketball_queue_number ON public.basketball_reservations;
CREATE TRIGGER trg_assign_basketball_queue_number
  BEFORE INSERT ON public.basketball_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_basketball_queue_number();

DROP TRIGGER IF EXISTS trg_basketball_reservations_updated_at ON public.basketball_reservations;
CREATE TRIGGER trg_basketball_reservations_updated_at
  BEFORE UPDATE ON public.basketball_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.basketball_reservations.queue_number IS
  'FCFS queue ticket assigned at booking time. Process pending by queue_number ASC, not reservation_date.';
