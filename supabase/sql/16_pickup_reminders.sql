-- =============================================================================
-- 16_pickup_reminders.sql
-- Shared pickup / pending reminder notifications for admin, staff, and residents
-- Run after appointments + certificates + RLS helpers exist
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_audience') THEN
    CREATE TYPE public.reminder_audience AS ENUM ('ops', 'resident');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_item_status') THEN
    CREATE TYPE public.reminder_item_status AS ENUM ('active', 'dismissed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pickup_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key      TEXT NOT NULL UNIQUE,
  audience        public.reminder_audience NOT NULL,
  user_id         UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES public.appointments (id) ON DELETE CASCADE,
  certificate_id  UUID REFERENCES public.certificates (id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('appointment', 'document')),
  urgency         TEXT NOT NULL CHECK (urgency IN ('pending', 'pickup', 'ready')),
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  reference       TEXT,
  resident_name   TEXT,
  status          public.reminder_item_status NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  dismissed_at    TIMESTAMPTZ,
  dismissed_by    UUID REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pickup_reminders_audience_status
  ON public.pickup_reminders (audience, status);
CREATE INDEX IF NOT EXISTS idx_pickup_reminders_user_status
  ON public.pickup_reminders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_pickup_reminders_appointment
  ON public.pickup_reminders (appointment_id);

DROP TRIGGER IF EXISTS trg_pickup_reminders_updated_at ON public.pickup_reminders;
CREATE TRIGGER trg_pickup_reminders_updated_at
  BEFORE UPDATE ON public.pickup_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Upsert one reminder row (reactivates if previously dismissed for same source_key after status change)
CREATE OR REPLACE FUNCTION public.upsert_pickup_reminder(
  p_source_key TEXT,
  p_audience public.reminder_audience,
  p_user_id UUID,
  p_appointment_id UUID,
  p_certificate_id UUID,
  p_kind TEXT,
  p_urgency TEXT,
  p_title TEXT,
  p_message TEXT,
  p_reference TEXT,
  p_resident_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pickup_reminders (
    source_key, audience, user_id, appointment_id, certificate_id,
    kind, urgency, title, message, reference, resident_name, status
  ) VALUES (
    p_source_key, p_audience, p_user_id, p_appointment_id, p_certificate_id,
    p_kind, p_urgency, p_title, p_message, p_reference, p_resident_name, 'active'
  )
  ON CONFLICT (source_key) DO UPDATE SET
    title = EXCLUDED.title,
    message = EXCLUDED.message,
    reference = EXCLUDED.reference,
    resident_name = EXCLUDED.resident_name,
    urgency = EXCLUDED.urgency,
    kind = EXCLUDED.kind,
    status = 'active',
    dismissed_at = NULL,
    dismissed_by = NULL,
    updated_at = TIMEZONE('utc', NOW());
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_appointment_reminders(p_appointment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pickup_reminders
  SET status = 'dismissed',
      dismissed_at = TIMEZONE('utc', NOW()),
      updated_at = TIMEZONE('utc', NOW())
  WHERE appointment_id = p_appointment_id
    AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_reminders_for_appointment(p_appointment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a RECORD;
  v_name TEXT;
  v_label TEXT;
  v_ref TEXT;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_name := COALESCE(NULLIF(TRIM(a.user_name), ''), 'Resident');
  v_label := COALESCE(NULLIF(TRIM(a.certificate_name), ''), NULLIF(TRIM(a.certificate_type), ''), 'document');
  v_ref := 'APT-' || UPPER(LEFT(REPLACE(a.id::text, '-', ''), 8));

  -- Clear previous active reminders for this appointment, then recreate for current status
  PERFORM public.deactivate_appointment_reminders(a.id);

  IF a.status::text = 'pending' THEN
    PERFORM public.upsert_pickup_reminder(
      'ops:appt-pending:' || a.id::text,
      'ops', a.user_id, a.id, NULL,
      'appointment', 'pending',
      'Pending appointment review',
      v_name || ' requested ' || v_label || '. Review and approve in Appointment Management.',
      v_ref, v_name
    );
  ELSIF a.status::text = 'approved' THEN
    PERFORM public.upsert_pickup_reminder(
      'ops:appt-pickup:' || a.id::text,
      'ops', a.user_id, a.id, NULL,
      'appointment', 'pickup',
      'Ready for pickup reminder',
      v_name || '''s ' || v_label || ' request is approved — schedule / confirm pickup.',
      v_ref, v_name
    );
    PERFORM public.upsert_pickup_reminder(
      'resident:appt-pickup:' || a.id::text,
      'resident', a.user_id, a.id, NULL,
      'appointment', 'pickup',
      'Appointment approved — pickup soon',
      'Your ' || v_label || ' request was approved. Please wait for issuance, then pick up at the barangay hall.',
      v_ref, v_name
    );
  ELSIF a.status::text IN ('completed', 'issued') THEN
    PERFORM public.upsert_pickup_reminder(
      'ops:appt-ready:' || a.id::text,
      'ops', a.user_id, a.id, NULL,
      'document', 'ready',
      'Document ready for pickup',
      v_name || '''s ' || v_label || ' is ready. Confirm resident pickup at the barangay hall.',
      'DOC-' || UPPER(LEFT(REPLACE(a.id::text, '-', ''), 8)), v_name
    );
    PERFORM public.upsert_pickup_reminder(
      'resident:appt-ready:' || a.id::text,
      'resident', a.user_id, a.id, NULL,
      'document', 'ready',
      'Your document is ready for pickup',
      'Your ' || v_label || ' is ready. Please claim it at the barangay hall during office hours.',
      'DOC-' || UPPER(LEFT(REPLACE(a.id::text, '-', ''), 8)), v_name
    );
  END IF;
  -- rejected / cancelled → left dismissed via deactivate above
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_reminders_for_certificate(p_certificate_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  v_name TEXT;
  v_label TEXT;
  v_ref TEXT;
  v_has_appt_ready BOOLEAN;
BEGIN
  SELECT * INTO c FROM public.certificates WHERE id = p_certificate_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF c.status::text NOT IN ('issued', 'completed') THEN
    UPDATE public.pickup_reminders
    SET status = 'dismissed',
        dismissed_at = TIMEZONE('utc', NOW()),
        updated_at = TIMEZONE('utc', NOW())
    WHERE certificate_id = c.id AND status = 'active';
    RETURN;
  END IF;

  v_name := COALESCE(NULLIF(TRIM(c.user_name), ''), 'Resident');
  v_label := COALESCE(NULLIF(TRIM(c.certificate_type), ''), 'certificate');
  v_ref := COALESCE(NULLIF(TRIM(c.certificate_number), ''), 'CERT-' || UPPER(LEFT(REPLACE(c.id::text, '-', ''), 8)));

  IF c.appointment_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.pickup_reminders
      WHERE appointment_id = c.appointment_id
        AND urgency = 'ready'
        AND status = 'active'
    ) INTO v_has_appt_ready;
    IF v_has_appt_ready THEN
      RETURN;
    END IF;
  END IF;

  PERFORM public.upsert_pickup_reminder(
    'ops:cert-pickup:' || c.id::text,
    'ops', c.user_id, c.appointment_id, c.id,
    'document', 'pickup',
    'Certificate pickup reminder',
    v_name || '''s ' || v_label || ' (' || v_ref || ') is issued — release on pickup.',
    v_ref, v_name
  );
  PERFORM public.upsert_pickup_reminder(
    'resident:cert-pickup:' || c.id::text,
    'resident', c.user_id, c.appointment_id, c.id,
    'document', 'pickup',
    'Your certificate is ready for pickup',
    'Your ' || v_label || ' (' || v_ref || ') is ready. Please claim it at the barangay hall.',
    v_ref, v_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_appointment_reminders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_reminders_for_appointment(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_sync_reminders ON public.appointments;
CREATE TRIGGER trg_appointments_sync_reminders
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_appointment_reminders();

CREATE OR REPLACE FUNCTION public.trg_sync_certificate_reminders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_reminders_for_certificate(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_certificates_sync_reminders ON public.certificates;
CREATE TRIGGER trg_certificates_sync_reminders
  AFTER INSERT OR UPDATE OF status ON public.certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_certificate_reminders();

-- Backfill from existing rows
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.appointments LOOP
    PERFORM public.sync_reminders_for_appointment(r.id);
  END LOOP;
  FOR r IN SELECT id FROM public.certificates LOOP
    PERFORM public.sync_reminders_for_certificate(r.id);
  END LOOP;
END $$;

ALTER TABLE public.pickup_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pickup_reminders_select" ON public.pickup_reminders;
CREATE POLICY "pickup_reminders_select"
  ON public.pickup_reminders FOR SELECT
  USING (
    (audience = 'ops' AND public.is_staff_or_admin())
    OR (audience = 'resident' AND auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "pickup_reminders_dismiss" ON public.pickup_reminders;
CREATE POLICY "pickup_reminders_dismiss"
  ON public.pickup_reminders FOR UPDATE
  USING (
    (audience = 'ops' AND public.is_staff_or_admin())
    OR (audience = 'resident' AND auth.uid() = user_id)
  )
  WITH CHECK (
    (audience = 'ops' AND public.is_staff_or_admin())
    OR (audience = 'resident' AND auth.uid() = user_id)
  );

COMMENT ON TABLE public.pickup_reminders IS
  'Pickup / pending reminder notifications for ops (admin+staff) and residents';
