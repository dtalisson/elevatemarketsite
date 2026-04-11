import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const allHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

const MAX_ATTEMPTS_PER_IP = 5;
const RATE_WINDOW_SECONDS = 900; // 15 min
const LOCKOUT_AFTER = 3;
const LOCKOUT_SECONDS = 1800; // 30 min
const GENERIC_ERROR = "Credenciais inválidas";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const body = await req.json();
    const { username, password, fingerprint } = body;

    // Input validation
    if (
      !username || typeof username !== "string" || username.length > 32 ||
      !password || typeof password !== "string" || password.length > 128
    ) {
      return new Response(
        JSON.stringify({ success: false, message: GENERIC_ERROR }),
        { status: 400, headers: allHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1) Rate limit by IP
    const { data: ipAllowed } = await admin.rpc("check_rate_limit", {
      p_key: `admin_login_ip:${ip}`,
      p_max_requests: MAX_ATTEMPTS_PER_IP,
      p_window_seconds: RATE_WINDOW_SECONDS,
    });

    if (ipAllowed === false) {
      await admin.from("admin_login_logs").insert({
        ip_address: ip,
        user_agent: userAgent,
        fingerprint: typeof fingerprint === "string" ? fingerprint.slice(0, 64) : null,
        username_attempted: username.toLowerCase().slice(0, 32),
        success: false,
        failure_reason: "rate_limited",
      });

      return new Response(
        JSON.stringify({ success: false, message: "Muitas tentativas. Tente novamente mais tarde." }),
        { status: 429, headers: { ...allHeaders, "Retry-After": String(RATE_WINDOW_SECONDS) } }
      );
    }

    // 2) Check account lockout
    const { data: locked } = await admin.rpc("is_account_locked", {
      p_username: `admin:${username.toLowerCase()}`,
      p_app_id: "00000000-0000-0000-0000-000000000000",
    });

    if (locked) {
      await admin.from("admin_login_logs").insert({
        ip_address: ip,
        user_agent: userAgent,
        fingerprint: typeof fingerprint === "string" ? fingerprint.slice(0, 64) : null,
        username_attempted: username.toLowerCase().slice(0, 32),
        success: false,
        failure_reason: "account_locked",
      });

      // Anti-timing: add random delay
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));

      return new Response(
        JSON.stringify({ success: false, message: "Conta temporariamente bloqueada. Tente novamente mais tarde." }),
        { status: 403, headers: allHeaders }
      );
    }

    // 3) Attempt login via Supabase Auth
    const email = `${username.toLowerCase()}@elevateauth.local`;

    // Use anon key client for auth (not service role)
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      // Record failed attempt
      await admin.rpc("record_failed_login", {
        p_username: `admin:${username.toLowerCase()}`,
        p_app_id: "00000000-0000-0000-0000-000000000000",
        p_max_attempts: LOCKOUT_AFTER,
        p_lockout_seconds: LOCKOUT_SECONDS,
      });

      await admin.from("admin_login_logs").insert({
        ip_address: ip,
        user_agent: userAgent,
        fingerprint: typeof fingerprint === "string" ? fingerprint.slice(0, 64) : null,
        username_attempted: username.toLowerCase().slice(0, 32),
        success: false,
        failure_reason: "invalid_credentials",
      });

      // Anti-timing attack: random delay
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 1500));

      return new Response(
        JSON.stringify({ success: false, message: GENERIC_ERROR }),
        { status: 401, headers: allHeaders }
      );
    }

    // 4) Verify user has admin role
    const { data: hasAdmin } = await admin.rpc("has_role", {
      _user_id: authData.user.id,
      _role: "admin",
    });

    if (!hasAdmin) {
      // Not an admin - sign them out and deny
      await admin.from("admin_login_logs").insert({
        ip_address: ip,
        user_agent: userAgent,
        fingerprint: typeof fingerprint === "string" ? fingerprint.slice(0, 64) : null,
        username_attempted: username.toLowerCase().slice(0, 32),
        success: false,
        failure_reason: "not_admin",
      });

      return new Response(
        JSON.stringify({ success: false, message: GENERIC_ERROR }),
        { status: 401, headers: allHeaders }
      );
    }

    // 5) Success - clear lockout
    await admin.rpc("clear_lockout", {
      p_username: `admin:${username.toLowerCase()}`,
      p_app_id: "00000000-0000-0000-0000-000000000000",
    });

    await admin.from("admin_login_logs").insert({
      ip_address: ip,
      user_agent: userAgent,
      fingerprint: typeof fingerprint === "string" ? fingerprint.slice(0, 64) : null,
      username_attempted: username.toLowerCase().slice(0, 32),
      success: true,
    });

    // Return session tokens
    return new Response(
      JSON.stringify({
        success: true,
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_in: authData.session.expires_in,
          token_type: authData.session.token_type,
        },
      }),
      { status: 200, headers: allHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Erro interno" }),
      { status: 500, headers: allHeaders }
    );
  }
});
