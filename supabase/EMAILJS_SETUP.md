# EmailJS — Registration OTP only

Verification is **Email OTP only** (Supabase Confirm email is OFF).

Config: `src/environments/environment.ts` / `environment.prod.ts`  
Template: `email-templates/emailjs-registration-otp.html`

## Current IDs (Gmail service)

| Setting | Value |
|---------|--------|
| Service | Gmail (`Gmail_API`) |
| Service ID | `service_0g0kojl` |
| Template | One-Time Password |
| Template ID | `template_gs077yl` |
| Public Key | `bjJ7RRPqSEP0aYrNn` |

**Private Key** stays in EmailJS Account → API Keys only. Never put it in Angular or commit it.

## Template fields (must match app)

| EmailJS field | Value |
|---------------|--------|
| To Email | `{{to_email}}` |
| From Name | `{{from_name}}` |
| Subject | `Your Barangay System registration code` or `{{subject}}` |

Body variables: `{{first_name}}`, `{{otp_code}}`, `{{expiry_minutes}}`, `{{site_name}}`, `{{barangay_name}}`

Paste HTML from `email-templates/emailjs-registration-otp.html` into the template Content tab.

## Flow

Register → EmailJS sends OTP → enter code → account created → login
