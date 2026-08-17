import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * OTP-only helper (optional). Confirm-email uses Auth /signup → Gmail.
 * Deploy only if you prefer Functions over /api/register:
 *   supabase functions deploy register --no-verify-jwt
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");

    if (!email || !password || password.length < 6) {
      return json(
        { error: "Valid email and password (min 6 characters) are required." },
        400
      );
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) {
      return json({ error: "Server misconfigured." }, 500);
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const rawRole = String(body.role || "resident")
      .trim()
      .toLowerCase();
    const role =
      rawRole === "admin" || rawRole === "staff" || rawRole === "resident"
        ? rawRole
        : rawRole === "user"
          ? "resident"
          : "resident";

    const meta = {
      first_name: String(body.firstName || ""),
      last_name: String(body.lastName || ""),
      middle_name: String(body.middleName || ""),
      suffix: String(body.suffix || ""),
      birth_date: String(body.birthDate || ""),
      gender: String(body.gender || ""),
      civil_status: String(body.civilStatus || ""),
      nationality: String(body.nationality || "Filipino"),
      phone: String(body.phone || ""),
      address: String(body.address || ""),
      role
    };

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: meta
    });

    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({
      ok: true,
      mode: "otp",
      needsEmailConfirmation: false,
      user: { id: data.user?.id, email: data.user?.email },
      message: "OTP verified. Account created in Supabase Auth + profiles."
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Registration failed";
    return json({ error: message }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
