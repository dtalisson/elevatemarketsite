import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-timestamp, x-request-nonce, x-client-fingerprint",
};
const allHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// ── Nonce store (in-memory, resets on cold start) ──
const usedNonces = new Map<string, number>();
function checkNonce(nonce: string): boolean {
  if (usedNonces.size > 500) {
    const cutoff = Date.now() - 120000;
    for (const [k, v] of usedNonces) { if (v < cutoff) usedNonces.delete(k); }
  }
  if (usedNonces.has(nonce)) return false;
  usedNonces.set(nonce, Date.now());
  return true;
}

function validateSecurity(req: Request): { error?: string; fingerprint: string } {
  const timestamp = req.headers.get("x-request-timestamp");
  const nonce = req.headers.get("x-request-nonce");
  const fingerprint = req.headers.get("x-client-fingerprint") || "unknown";

  if (timestamp) {
    const ts = parseInt(timestamp);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > 60000) {
      return { error: "Request expirado (timestamp)", fingerprint };
    }
  }

  if (nonce && !checkNonce(nonce)) {
    return { error: "Request duplicado (replay detectado)", fingerprint };
  }

  return { fingerprint };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Security validation ──
    const sec = validateSecurity(req);
    if (sec.error) {
      return new Response(JSON.stringify({ success: false, message: sec.error }), { status: 403, headers: allHeaders });
    }

    const body = await req.json();
    const { username, password } = body;
    if (!username || !password) {
      return new Response(JSON.stringify({ success: false, message: "Usuário e senha obrigatórios" }), { status: 400, headers: allHeaders });
    }

    // ── Rate limit: 5 attempts per minute per IP ──
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = req.headers.get("user-agent") || null;
    const rlKey = `admin_login:${clientIp}`;
    const { data: rlAllowed } = await supabase.rpc("check_rate_limit", { p_key: rlKey, p_max_requests: 5, p_window_seconds: 60 });
    if (rlAllowed === false) {
      // Log failed attempt
      await supabase.from("admin_login_logs").insert({
        username_attempted: username.toLowerCase(),
        ip_address: clientIp,
        user_agent: userAgent,
        fingerprint: sec.fingerprint,
        success: false,
        failure_reason: "Rate limited",
      });
      return new Response(JSON.stringify({ success: false, message: "Muitas tentativas. Aguarde 1 minuto." }), { status: 429, headers: allHeaders });
    }

    // ── Authenticate via Supabase Auth ──
    const email = `${username.toLowerCase()}@elevateauth.local`;
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.session) {
      // Log failed attempt
      await supabase.from("admin_login_logs").insert({
        username_attempted: username.toLowerCase(),
        ip_address: clientIp,
        user_agent: userAgent,
        fingerprint: sec.fingerprint,
        success: false,
        failure_reason: authError?.message || "Invalid credentials",
      });
      return new Response(JSON.stringify({ success: false, message: "Credenciais inválidas" }), { status: 401, headers: allHeaders });
    }

    // Log successful login
    await supabase.from("admin_login_logs").insert({
      username_attempted: username.toLowerCase(),
      ip_address: clientIp,
      user_agent: userAgent,
      fingerprint: sec.fingerprint,
      success: true,
    });

    return new Response(JSON.stringify({
      success: true,
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
    }), { headers: allHeaders });

  } catch (err) {
    console.error("Admin login error:", err);
    return new Response(JSON.stringify({ success: false, message: "Erro interno" }), { status: 500, headers: allHeaders });
  }
});
