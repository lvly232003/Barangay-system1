import { environment } from '../../environments/environment';

/**
 * EmailJS — registration OTP only.
 * Supabase Auth handles its own confirmation emails (confirm-signup template).
 * Guide: supabase/EMAILJS_SETUP.md
 */

export const EMAIL_CONFIG = {
  publicKey: environment.emailjs.publicKey,
  serviceId: environment.emailjs.serviceId,
  otpTemplateId: environment.emailjs.otpTemplateId
};

export const DEVELOPMENT_MODE = environment.emailjs.developmentMode;

export const EMAIL_TEMPLATES = {
  FROM_NAME: environment.emailjs.fromName,
  SITE_NAME: environment.emailjs.siteName,
  BARANGAY_NAME: environment.emailjs.barangayName,
  OTP_SUBJECT: environment.emailjs.otpSubject,
  OTP_EXPIRY_MINUTES: environment.emailjs.otpExpiryMinutes
};
