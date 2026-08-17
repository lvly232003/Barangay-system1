-- =============================================================================
-- 17_system_settings_extended.sql
-- Extra Admin Settings keys stored in system_settings (Supabase as store of record)
-- =============================================================================

INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
  ('barangay_name', 'Barangay Old Cabalan', 'Official barangay display name'),
  ('barangay_captain', 'Hon. Ronaldo A. Alba Jr', 'Barangay captain / punong barangay'),
  ('barangay_secretary', 'Edmer T. Lucido', 'Barangay secretary'),
  ('office_hours', '08:00 AM - 05:00 PM', 'Public office hours'),
  ('contact_email', 'brg.oldcabalan.1988@gmail.com', 'Public contact email'),
  ('contact_phone', '(047) 223 - 1629', 'Public contact phone'),
  ('theme_default', 'emerald', 'Default UI theme family'),
  ('email_notifications', 'true', 'Enable email notifications'),
  ('sms_notifications', 'false', 'Enable SMS notifications'),
  ('auto_approve_documents', 'false', 'Auto-approve document requests')
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = TIMEZONE('utc', NOW());

-- Keep captain / secretary values current for existing deployments
UPDATE public.system_settings
SET setting_value = 'Hon. Ronaldo A. Alba Jr',
    description = 'Barangay captain / punong barangay',
    updated_at = TIMEZONE('utc', NOW())
WHERE setting_key = 'barangay_captain';

UPDATE public.system_settings
SET setting_value = 'Edmer T. Lucido',
    description = 'Barangay secretary',
    updated_at = TIMEZONE('utc', NOW())
WHERE setting_key = 'barangay_secretary';

UPDATE public.system_settings
SET setting_value = 'brg.oldcabalan.1988@gmail.com',
    description = 'Public contact email',
    updated_at = TIMEZONE('utc', NOW())
WHERE setting_key = 'contact_email';

UPDATE public.system_settings
SET setting_value = '(047) 223 - 1629',
    description = 'Public contact phone',
    updated_at = TIMEZONE('utc', NOW())
WHERE setting_key = 'contact_phone';

UPDATE public.system_settings
SET setting_value = 'Barangay Old Cabalan',
    description = 'Official barangay display name',
    updated_at = TIMEZONE('utc', NOW())
WHERE setting_key = 'barangay_name';
