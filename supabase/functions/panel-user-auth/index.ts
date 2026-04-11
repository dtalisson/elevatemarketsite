import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const allHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// Simple HMAC-based token
async function createToken(userId: string, secret: string): Promise<string> {
  const payload = { sub: userId, exp: Date.now() + 86400000, iat: Date.now() };
  const payloadStr = JSON.stringify(payload);
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadStr));
  return encode(new TextEncoder().encode(payloadStr)) + "." + encode(new Uint8Array(sig));
}

async function verifyToken(token: string, secret: string): Promise<{ sub: string } | null> {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;
    const payloadBytes = Uint8Array.from(atob(payloadB64), c => c.charCodeAt(0));
    const payloadStr = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadStr);
    if (payload.exp < Date.now()) return null;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payloadStr));
    if (!valid) return null;
    return { sub: payload.sub };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.pathname.split("/").pop(); // login or verify

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    if (action === "verify" || req.method === "GET") {
      // Verify token
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ valid: false }), { status: 401, headers: allHeaders });
      }
      const decoded = await verifyToken(token, serviceKey);
      if (!decoded) {
        return new Response(JSON.stringify({ valid: false }), { status: 401, headers: allHeaders });
      }
      // Check user still active and not expired
      const { data: pu } = await supabase.from("panel_users").select("id, username, is_active, expires_at").eq("id", decoded.sub).single();
      if (!pu || !pu.is_active || new Date(pu.expires_at) < new Date()) {
        return new Response(JSON.stringify({ valid: false, message: "Conta expirada ou desativada" }), { status: 401, headers: allHeaders });
      }
      // Get allowed apps
      const { data: appLinks } = await supabase.from("panel_user_applications").select("application_id").eq("panel_user_id", pu.id);
      return new Response(JSON.stringify({
        valid: true,
        user: { id: pu.id, username: pu.username, expires_at: pu.expires_at },
        allowed_apps: appLinks?.map(a => a.application_id) || [],
      }), { headers: allHeaders });
    }

    // POST = login
    const body = await req.json();
    const { username, password } = body;
    if (!username || !password) {
      return new Response(JSON.stringify({ success: false, message: "Usuário e senha obrigatórios" }), { status: 400, headers: allHeaders });
    }

    const { data: panelUser } = await supabase.from("panel_users").select("*").eq("username", username.toLowerCase()).eq("is_active", true).single();
    if (!panelUser) {
      return new Response(JSON.stringify({ success: false, message: "Credenciais inválidas" }), { status: 401, headers: allHeaders });
    }

    // Check expiration
    if (new Date(panelUser.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, message: "Acesso expirado" }), { status: 403, headers: allHeaders });
    }

    // Verify password using bcrypt-compatible check
    // We store passwords hashed with Web Crypto
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(password));
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    if (hashHex !== panelUser.password_hash) {
      return new Response(JSON.stringify({ success: false, message: "Credenciais inválidas" }), { status: 401, headers: allHeaders });
    }

    // Get allowed apps
    const { data: appLinks } = await supabase.from("panel_user_applications").select("application_id").eq("panel_user_id", panelUser.id);

    const token = await createToken(panelUser.id, serviceKey);

    return new Response(JSON.stringify({
      success: true,
      token,
      user: { id: panelUser.id, username: panelUser.username, expires_at: panelUser.expires_at },
      allowed_apps: appLinks?.map(a => a.application_id) || [],
    }), { headers: allHeaders });

  } catch {
    return new Response(JSON.stringify({ success: false, message: "Erro interno" }), { status: 500, headers: allHeaders });
  }
});
