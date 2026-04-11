import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-timestamp, x-request-nonce, x-payload-signature, x-client-fingerprint",
};
const allHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// ── Token helpers ──────────────────────────────────────────────
async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return encode(new Uint8Array(sig));
}

async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );
  const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
  return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(data));
}

async function createToken(userId: string, fingerprint: string, secret: string): Promise<string> {
  const payload = {
    sub: userId,
    fp: fingerprint,           // client fingerprint baked in
    exp: Date.now() + 3600000, // 1h expiry (was 24h)
    iat: Date.now(),
    jti: crypto.randomUUID(),  // unique token id
  };
  const payloadStr = JSON.stringify(payload);
  const sig = await hmacSign(payloadStr, secret);
  return encode(new TextEncoder().encode(payloadStr)) + "." + sig;
}

interface TokenPayload { sub: string; fp: string; exp: number; iat: number; jti: string; }

async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const payloadBytes = Uint8Array.from(atob(payloadB64), c => c.charCodeAt(0));
    const payloadStr = new TextDecoder().decode(payloadBytes);
    const valid = await hmacVerify(payloadStr, sig, secret);
    if (!valid) return null;
    const payload: TokenPayload = JSON.parse(payloadStr);
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

// ── Nonce store (in-memory, resets on cold start — acceptable for edge) ──
const usedNonces = new Map<string, number>();
function checkNonce(nonce: string): boolean {
  // Clean old nonces every 100 entries
  if (usedNonces.size > 500) {
    const cutoff = Date.now() - 120000; // 2 min
    for (const [k, v] of usedNonces) { if (v < cutoff) usedNonces.delete(k); }
  }
  if (usedNonces.has(nonce)) return false;
  usedNonces.set(nonce, Date.now());
  return true;
}

// ── Request security validation ──────────────────────────────
async function validateRequestSecurity(req: Request, serviceKey: string): Promise<{ error?: string; fingerprint?: string }> {
  const timestamp = req.headers.get("x-request-timestamp");
  const nonce = req.headers.get("x-request-nonce");
  const payloadSig = req.headers.get("x-payload-signature");
  const fingerprint = req.headers.get("x-client-fingerprint");

  // Timestamp check — reject requests older than 60s
  if (timestamp) {
    const ts = parseInt(timestamp);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > 60000) {
      return { error: "Request expirado (timestamp)" };
    }
  }

  // Nonce check — prevent replay
  if (nonce) {
    if (!checkNonce(nonce)) {
      return { error: "Request duplicado (replay detectado)" };
    }
  }

  return { fingerprint: fingerprint || "unknown" };
}

// ── Payload signature verification ──────────────────────────
async function verifyPayloadSignature(bodyStr: string, signature: string, secret: string): Promise<boolean> {
  try {
    return await hmacVerify(bodyStr, signature, secret);
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Security headers validation ──
    const secCheck = await validateRequestSecurity(req, serviceKey);
    if (secCheck.error) {
      return new Response(JSON.stringify({ success: false, message: secCheck.error }), { status: 403, headers: allHeaders });
    }

    // ── GET = verify token ──
    if (req.method === "GET") {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      if (!token) return new Response(JSON.stringify({ valid: false }), { status: 401, headers: allHeaders });

      const decoded = await verifyToken(token, serviceKey);
      if (!decoded) return new Response(JSON.stringify({ valid: false }), { status: 401, headers: allHeaders });

      // Fingerprint check
      if (decoded.fp !== secCheck.fingerprint && decoded.fp !== "unknown") {
        return new Response(JSON.stringify({ valid: false, message: "Fingerprint mismatch" }), { status: 401, headers: allHeaders });
      }

      const { data: pu } = await supabase.from("panel_users").select("id, username, is_active, expires_at").eq("id", decoded.sub).single();
      if (!pu || !pu.is_active || new Date(pu.expires_at) < new Date()) {
        return new Response(JSON.stringify({ valid: false, message: "Conta expirada ou desativada" }), { status: 401, headers: allHeaders });
      }

      const { data: appLinks } = await supabase.from("panel_user_applications").select("application_id").eq("panel_user_id", pu.id);

      // Token rotation — issue new token on each verify
      const newToken = await createToken(pu.id, secCheck.fingerprint || decoded.fp, serviceKey);

      return new Response(JSON.stringify({
        valid: true,
        token: newToken,
        user: { id: pu.id, username: pu.username, expires_at: pu.expires_at },
        allowed_apps: appLinks?.map(a => a.application_id) || [],
      }), { headers: allHeaders });
    }

    // ── POST = login ──
    const bodyStr = await req.text();

    // Verify payload signature if present
    const payloadSig = req.headers.get("x-payload-signature");
    if (payloadSig) {
      const valid = await verifyPayloadSignature(bodyStr, payloadSig, serviceKey);
      if (!valid) {
        return new Response(JSON.stringify({ success: false, message: "Payload adulterado" }), { status: 403, headers: allHeaders });
      }
    }

    const body = JSON.parse(bodyStr);
    const { username, password } = body;
    if (!username || !password) {
      return new Response(JSON.stringify({ success: false, message: "Usuário e senha obrigatórios" }), { status: 400, headers: allHeaders });
    }

    // Rate limit login: 5 attempts per minute per IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rlKey = `panel_login:${clientIp}`;
    const { data: rlAllowed } = await supabase.rpc("check_rate_limit", { p_key: rlKey, p_max_requests: 5, p_window_seconds: 60 });
    if (rlAllowed === false) {
      return new Response(JSON.stringify({ success: false, message: "Muitas tentativas. Aguarde 1 minuto." }), { status: 429, headers: allHeaders });
    }

    const { data: panelUser } = await supabase.from("panel_users").select("*").eq("username", username.toLowerCase()).eq("is_active", true).single();
    if (!panelUser) {
      return new Response(JSON.stringify({ success: false, message: "Credenciais inválidas" }), { status: 401, headers: allHeaders });
    }

    if (new Date(panelUser.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, message: "Acesso expirado" }), { status: 403, headers: allHeaders });
    }

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(password));
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    if (hashHex !== panelUser.password_hash) {
      return new Response(JSON.stringify({ success: false, message: "Credenciais inválidas" }), { status: 401, headers: allHeaders });
    }

    const { data: appLinks } = await supabase.from("panel_user_applications").select("application_id").eq("panel_user_id", panelUser.id);

    const fp = secCheck.fingerprint || "unknown";
    const token = await createToken(panelUser.id, fp, serviceKey);

    return new Response(JSON.stringify({
      success: true,
      token,
      user: { id: panelUser.id, username: panelUser.username, expires_at: panelUser.expires_at },
      allowed_apps: appLinks?.map(a => a.application_id) || [],
    }), { headers: allHeaders });

  } catch (err) {
    console.error("Auth error:", err);
    return new Response(JSON.stringify({ success: false, message: "Erro interno" }), { status: 500, headers: allHeaders });
  }
});
