/**
 * OTP registration only (after EmailJS verifies the address).
 * Confirm-email path uses browser Auth /signup so Supabase mails Gmail — not this handler.
 */

const { createClient } = require('@supabase/supabase-js');

function friendlyAuthError(raw) {
  const msg = String(raw || 'Registration failed');
  if (/already.*(registered|exists|been)/i.test(msg)) {
    return 'This email is already registered. Sign in instead, or use a different email.';
  }
  if (/enotfound|getaddrinfo|fetch failed|network|econnrefused|etimedout/i.test(msg)) {
    return (
      'Cannot reach Supabase (DNS/network). Check SUPABASE_URL in .env — ' +
      'the project host must resolve (Dashboard → Project Settings → API → Project URL).'
    );
  }
  if (/invalid api key|jwt|unauthorized|401|403/i.test(msg)) {
    return (
      'Invalid Supabase service role key. Put the real secret key in .env as ' +
      'SUPABASE_SERVICE_ROLE_KEY (Dashboard → Project Settings → API Keys).'
    );
  }
  return msg;
}

function isPlaceholderKey(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  return /\.\.\.|your_|changeme|replace_me|sb_secret_\.\.\.|sb_publishable_\.\.\./i.test(v);
}

async function handleRegister(body) {
  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  const password = String(body.password || '');

  if (!email || !password || password.length < 6) {
    return {
      status: 400,
      payload: {
        error: 'Valid email and password (min 6 characters) are required.'
      }
    };
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceKey || isPlaceholderKey(serviceKey)) {
    return {
      status: 503,
      payload: {
        error:
          'Missing real SUPABASE_SERVICE_ROLE_KEY in .env (placeholders like sb_secret_... will not work). Copy it from Supabase → Project Settings → API Keys.'
      }
    };
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const rawRole = String(body.role || 'resident')
    .trim()
    .toLowerCase();
  const role =
    rawRole === 'admin' || rawRole === 'staff' || rawRole === 'resident'
      ? rawRole
      : rawRole === 'user'
        ? 'resident'
        : 'resident';

  const meta = {
    first_name: String(body.firstName || ''),
    last_name: String(body.lastName || ''),
    middle_name: String(body.middleName || ''),
    suffix: String(body.suffix || ''),
    birth_date: String(body.birthDate || ''),
    gender: String(body.gender || ''),
    civil_status: String(body.civilStatus || ''),
    nationality: String(body.nationality || 'Filipino'),
    phone: String(body.phone || ''),
    address: String(body.address || ''),
    role
  };

  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: meta
    });

    if (error) {
      return {
        status: 400,
        payload: { error: friendlyAuthError(error.message) }
      };
    }

    return {
      status: 200,
      payload: {
        ok: true,
        mode: 'otp',
        needsEmailConfirmation: false,
        user: { id: data.user?.id, email: data.user?.email },
        message: 'OTP verified. Account created in Supabase Auth + profiles.'
      }
    };
  } catch (e) {
    const cause = e && typeof e === 'object' && 'cause' in e ? e.cause : null;
    const detail = [
      e instanceof Error ? e.message : String(e),
      cause instanceof Error ? cause.message : cause ? String(cause) : ''
    ]
      .filter(Boolean)
      .join(' | ');

    console.error('[register-handler]', detail);

    return {
      status: 503,
      payload: { error: friendlyAuthError(detail) }
    };
  }
}

module.exports = { handleRegister };
