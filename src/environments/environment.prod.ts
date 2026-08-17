/**
 * Production environment — used by `ng build` (Vercel uses this automatically).
 * Registration uses same-origin /api/register (Vercel serverless).
 */
export const environment = {
  production: true,
  /** Empty = use `${origin}/api/register` on Vercel */
  registerApiUrl: '',
  apiUrl: 'https://udvyynbpzbhdmgwbkjkd.supabase.co/rest/v1',
  supabase: {
    url: 'https://udvyynbpzbhdmgwbkjkd.supabase.co',
    anonKey: 'sb_publishable_UpuN_SDJoPuOPJha_WlW3Q_ncn6vZ06',
    secretKey: '' as string,
    emailRedirectTo: '',
    siteUrl: ''
  },
  emailjs: {
    publicKey: 'bjJ7RRPqSEP0aYrNn',
    serviceId: 'service_0g0kojl',
    otpTemplateId: 'template_gs077yl',
    developmentMode: false,
    loginUrl: '',
    fromName: 'Barangay System',
    siteName: 'Barangay Appointment Certificate Management System',
    barangayName: 'Barangay Old Cabalan',
    otpSubject: 'Your Barangay System registration code',
    otpExpiryMinutes: 10
  }
};
