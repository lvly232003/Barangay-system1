export const environment = {
  production: false,
  /** Local: http://localhost:3001 (auto-started by npm start). Production: empty → /api/register */
  registerApiUrl: 'http://localhost:3001/api/register',
  /** Legacy REST API (kept for reference; app uses Supabase as primary DB) */
  apiUrl: 'https://udvyynbpzbhdmgwbkjkd.supabase.co/rest/v1',
  supabase: {
    url: 'https://udvyynbpzbhdmgwbkjkd.supabase.co',
    /** Browser-safe publishable key (enable RLS — already defined in supabase/sql) */
    anonKey: 'sb_publishable_UpuN_SDJoPuOPJha_WlW3Q_ncn6vZ06',
    /**
     * Secret key must NEVER be shipped in the Angular client.
     * Keep it in .env as SUPABASE_SERVICE_ROLE_KEY for register-api / Vercel only.
     */
    secretKey: '' as string,
    /** Where confirm-email / auth links return after click */
    emailRedirectTo: 'http://localhost:4200/login',
    siteUrl: 'http://localhost:4200'
  },
  /**
   * EmailJS — registration OTP only (browser Public Key).
   * Private Key stays in EmailJS Account → never put it here.
   * Guide: supabase/EMAILJS_SETUP.md
   */
  emailjs: {
    publicKey: 'bjJ7RRPqSEP0aYrNn',
    serviceId: 'service_0g0kojl',
    otpTemplateId: 'template_gs077yl',
    /** false = send real OTP emails */
    developmentMode: false,
    loginUrl: 'http://localhost:4200/login',
    fromName: 'Barangay System',
    siteName: 'Barangay Appointment Certificate Management System',
    barangayName: 'Barangay Old Cabalan',
    otpSubject: 'Your Barangay System registration code',
    otpExpiryMinutes: 10
  }
};
