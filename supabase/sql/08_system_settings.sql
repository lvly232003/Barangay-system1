-- =============================================================================
-- 08_system_settings.sql
-- Key/value settings used by Admin > Settings
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key     TEXT NOT NULL UNIQUE,
  setting_value   TEXT,
  description     TEXT,
  updated_by      UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
