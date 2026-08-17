# Supabase Confirm email → Gmail (Auth policy)

**Confirm email is ON:** users cannot sign in until they open the link Supabase sends to their inbox.  
This is **not** EmailJS. Template: `supabase/email-templates/confirm-signup.html`

## Why it was failing

Auth signup returned `Error sending confirmation email` — Supabase’s built-in mailer cannot deliver. You need **Custom SMTP**.

## Setup Custom SMTP (required for Confirm → Gmail)

1. Open Supabase → **Project Settings → Authentication** (or Auth → SMTP)
2. Enable **Custom SMTP**
3. Use a provider (examples):

### Resend (recommended)

| Field | Value |
|-------|--------|
| Host | `smtp.resend.com` |
| Port | `465` |
| User | `resend` |
| Pass | your Resend API key |
| Sender email | a verified domain/address in Resend |
| Sender name | `Barangay System` |

### Gmail app password

| Field | Value |
|-------|--------|
| Host | `smtp.gmail.com` |
| Port | `465` |
| User | your Gmail |
| Pass | [App Password](https://myaccount.google.com/apppasswords) (not your normal password) |
| Sender | same Gmail |

4. Auth → **Email Templates → Confirm signup**  
   Paste `confirm-signup.html` + subject from this repo.
5. Auth → **URL Configuration**  
   - Site URL: `http://localhost:4200` (or your Vercel URL)  
   - Redirect URLs: `http://localhost:4200/**`, `https://your-app.vercel.app/**`

## App behavior (aligned)

| Choice | Flow |
|--------|------|
| **Confirm email (Supabase)** | `signUp` → email to Gmail → user clicks link → then login works |
| **Email OTP (EmailJS)** | EmailJS OTP → then Auth user created already verified |

No in-app “Confirm” button. Confirmation is only from Gmail.
