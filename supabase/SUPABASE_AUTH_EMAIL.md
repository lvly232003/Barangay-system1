# Registration = EmailJS OTP only

Supabase **Confirm email** is turned **OFF** in Auth → Providers → Email.

## Flow

1. Fill register form → **Register Account**
2. EmailJS sends a 6-digit OTP
3. Enter OTP → Auth user + `profiles` created in Supabase
4. Sign in with email + password

No Supabase confirmation email. No SMTP required for signup.

## Local

```bash
npm start
```

Secret key in `.env` powers the OTP→account helper automatically.

## Templates

- EmailJS: `email-templates/emailjs-registration-otp.html`
- `confirm-signup.html` is unused while Confirm email is OFF (keep for later if you re-enable it)
