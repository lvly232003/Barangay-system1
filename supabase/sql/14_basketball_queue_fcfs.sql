-- =============================================================================
-- 14_basketball_queue_fcfs.sql
-- First-come-first-served queue numbers for basketball court reservations
-- Run on existing projects after 07_basketball_reservations.sql
-- =============================================================================
-- RULE: Queue number is assigned at submission time (created_at order).
-- A resident who books later waits behind earlier submitters, even if they
-- picked an earlier play date. Staff/admin should process pending by queue_number.
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS public.basketball_reservation_queue_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE public.basketball_reservations
  ADD COLUMN IF NOT EXISTS queue_number INTEGER;

-- Backfill existing rows in true FCFS order
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id
    FROM public.basketball_reservations
    WHERE queue_number IS NULL
    ORDER BY created_at ASC, id ASC
  LOOP
    UPDATE public.basketball_reservations
    SET queue_number = nextval('public.basketball_reservation_queue_seq')
    WHERE id = r.id;
  END LOOP;
END $$;

-- Keep sequence ahead of any existing numbers
SELECT setval(
  'public.basketball_reservation_queue_seq',
  GREATEST(
    (SELECT COALESCE(MAX(queue_number), 0) FROM public.basketball_reservations),
    1
  )
);

ALTER TABLE public.basketball_reservations
  ALTER COLUMN queue_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bb_reservations_queue_number
  ON public.basketball_reservations (queue_number);

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

COMMENT ON COLUMN public.basketball_reservations.queue_number IS
  'FCFS queue ticket assigned at booking time. Process pending reservations by queue_number ASC, not by reservation_date.';
