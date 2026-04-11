import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-timestamp, x-request-nonce, x-payload-signature, x-client-fingerprint",
};
const allHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// ── Crypto helpers ──────────────────────────────────────────────
async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(data));
  } catch { return false; }
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return encode(new Uint8Array(sig));
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

async function createToken(userId: string, fingerprint: string, secret: string): Promise<string> {
  const payload = { sub: userId, fp: fingerprint, exp: Date.now() + 3600000, iat: Date.now(), jti: crypto.randomUUID() };
  const payloadStr = JSON.stringify(payload);
  const sig = await hmacSign(payloadStr, secret);
  return encode(new TextEncoder().encode(payloadStr)) + "." + sig;
}

// ── Nonce anti-replay ──────────────────────────────────────────
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

// ── Security validation ──────────────────────────────────────
function validateHeaders(req: Request): { error?: string; fingerprint: string } {
  const timestamp = req.headers.get("x-request-timestamp");
  const nonce = req.headers.get("x-request-nonce");
  const fingerprint = req.headers.get("x-client-fingerprint") || "unknown";

  if (timestamp) {
    const ts = parseInt(timestamp);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > 60000) {
      return { error: "Request expirado", fingerprint };
    }
  }

  if (nonce && !checkNonce(nonce)) {
    return { error: "Replay detectado", fingerprint };
  }

  return { fingerprint };
}

const PLANS: Record<string, { label: string; seconds: number }> = {
  "1day": { label: "1 Dia", seconds: 86400 },
  "trial": { label: "Trial (3 Dias)", seconds: 259200 },
  "weekly": { label: "Semanal (7 Dias)", seconds: 604800 },
  "monthly": { label: "Mensal (30 Dias)", seconds: 2592000 },
  "lifetime": { label: "Lifetime (999 Dias)", seconds: 86313600 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Security headers ──
  const sec = validateHeaders(req);
  if (sec.error) {
    return new Response(JSON.stringify({ success: false, message: sec.error }), { status: 403, headers: allHeaders });
  }

  // ── Auth ──
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const decoded = await verifyToken(token, serviceKey);
  if (!decoded) {
    return new Response(JSON.stringify({ success: false, message: "Não autorizado" }), { status: 401, headers: allHeaders });
  }

  // Fingerprint match
  if (decoded.fp !== "unknown" && decoded.fp !== sec.fingerprint) {
    return new Response(JSON.stringify({ success: false, message: "Sessão inválida (fingerprint)" }), { status: 401, headers: allHeaders });
  }

  // Get panel user
  const { data: panelUser } = await supabase.from("panel_users").select("*").eq("id", decoded.sub).single();
  if (!panelUser || !panelUser.is_active || new Date(panelUser.expires_at) < new Date()) {
    return new Response(JSON.stringify({ success: false, message: "Acesso expirado ou desativado" }), { status: 403, headers: allHeaders });
  }

  const { data: appLinks } = await supabase.from("panel_user_applications").select("application_id").eq("panel_user_id", panelUser.id);
  const allowedApps = new Set(appLinks?.map(a => a.application_id) || []);

  // ── Verify payload signature ──
  const bodyStr = await req.text();
  const payloadSig = req.headers.get("x-payload-signature");
  if (payloadSig) {
    const valid = await hmacVerify(bodyStr, payloadSig, serviceKey);
    if (!valid) {
      return new Response(JSON.stringify({ success: false, message: "Payload adulterado" }), { status: 403, headers: allHeaders });
    }
  }

  // ── Token rotation — new token for each request ──
  const newToken = await createToken(panelUser.id, sec.fingerprint, serviceKey);

  try {
    const body = JSON.parse(bodyStr);
    const { action } = body;

    // Rate limit: 30 actions per minute
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rlKey = `panel_action:${panelUser.id}:${clientIp}`;
    const { data: rlAllowed } = await supabase.rpc("check_rate_limit", { p_key: rlKey, p_max_requests: 30, p_window_seconds: 60 });
    if (rlAllowed === false) {
      return new Response(JSON.stringify({ success: false, message: "Rate limit atingido", token: newToken }), { status: 429, headers: allHeaders });
    }

    switch (action) {
      case "create-license": {
        const { application_id, plan, quantity, note } = body;
        if (!application_id || !allowedApps.has(application_id)) {
          return new Response(JSON.stringify({ success: false, message: "Aplicação não autorizada", token: newToken }), { status: 403, headers: allHeaders });
        }
        if (!plan || !PLANS[plan]) {
          return new Response(JSON.stringify({ success: false, message: "Plano inválido", token: newToken }), { status: 400, headers: allHeaders });
        }
        const count = Math.min(Math.max(parseInt(quantity) || 1, 1), 50);
        const selectedPlan = PLANS[plan];

        const { data: app } = await supabase.from("applications").select("owner_id").eq("id", application_id).single();
        if (!app) {
          return new Response(JSON.stringify({ success: false, message: "Aplicação não encontrada", token: newToken }), { status: 404, headers: allHeaders });
        }

        const licensesToInsert = Array.from({ length: count }, () => ({
          application_id,
          created_by: app.owner_id,
          panel_user_id: panelUser.id,
          status: "unused" as const,
          remaining_seconds: selectedPlan.seconds,
          note: note || `${selectedPlan.label} — criada por ${panelUser.username}`,
          max_uses: 1,
        }));

        const { data: licenses, error } = await supabase.from("licenses").insert(licensesToInsert).select("license_key, status, remaining_seconds, note, created_at");
        if (error) {
          console.error("Insert error:", error);
          return new Response(JSON.stringify({ success: false, message: "Erro ao criar licenças", token: newToken }), { status: 500, headers: allHeaders });
        }

        return new Response(JSON.stringify({
          success: true, token: newToken,
          message: `${count} licença(s) criada(s)`,
          licenses: licenses?.map(l => ({ key: l.license_key, status: l.status, duration_seconds: l.remaining_seconds, note: l.note })),
        }), { status: 201, headers: allHeaders });
      }

      case "list-licenses": {
        const { application_id } = body;
        if (application_id && !allowedApps.has(application_id)) {
          return new Response(JSON.stringify({ success: false, message: "Aplicação não autorizada", token: newToken }), { status: 403, headers: allHeaders });
        }
        const query = supabase.from("licenses").select("*").eq("panel_user_id", panelUser.id).order("created_at", { ascending: false });
        if (application_id) query.eq("application_id", application_id);
        const { data } = await query;
        return new Response(JSON.stringify({ success: true, licenses: data || [], token: newToken }), { headers: allHeaders });
      }

      case "list-users": {
        const { application_id } = body;
        if (application_id && !allowedApps.has(application_id)) {
          return new Response(JSON.stringify({ success: false, message: "Aplicação não autorizada", token: newToken }), { status: 403, headers: allHeaders });
        }
        const { data: myLicenses } = await supabase.from("licenses").select("id").eq("panel_user_id", panelUser.id);
        const licIds = myLicenses?.map(l => l.id) || [];
        if (licIds.length === 0) {
          return new Response(JSON.stringify({ success: true, users: [], token: newToken }), { headers: allHeaders });
        }
        const { data: users } = await supabase.from("software_users").select("id, username, hwid, ip_address, last_login_at, created_at, application_id, license_id").in("license_id", licIds);
        return new Response(JSON.stringify({ success: true, users: users || [], token: newToken }), { headers: allHeaders });
      }

      case "delete-user": {
        const { user_id } = body;
        if (!user_id) return new Response(JSON.stringify({ success: false, message: "user_id obrigatório", token: newToken }), { status: 400, headers: allHeaders });
        const { data: su } = await supabase.from("software_users").select("id, license_id").eq("id", user_id).single();
        if (!su) return new Response(JSON.stringify({ success: false, message: "Usuário não encontrado", token: newToken }), { status: 404, headers: allHeaders });
        const { data: lic } = await supabase.from("licenses").select("panel_user_id").eq("id", su.license_id).single();
        if (!lic || lic.panel_user_id !== panelUser.id) {
          return new Response(JSON.stringify({ success: false, message: "Sem permissão", token: newToken }), { status: 403, headers: allHeaders });
        }
        await supabase.from("software_users").delete().eq("id", user_id);
        return new Response(JSON.stringify({ success: true, message: "Usuário deletado", token: newToken }), { headers: allHeaders });
      }

      case "reset-hwid": {
        const { user_id } = body;
        if (!user_id) return new Response(JSON.stringify({ success: false, message: "user_id obrigatório", token: newToken }), { status: 400, headers: allHeaders });
        const { data: su } = await supabase.from("software_users").select("id, license_id").eq("id", user_id).single();
        if (!su) return new Response(JSON.stringify({ success: false, message: "Usuário não encontrado", token: newToken }), { status: 404, headers: allHeaders });
        const { data: lic } = await supabase.from("licenses").select("panel_user_id").eq("id", su.license_id).single();
        if (!lic || lic.panel_user_id !== panelUser.id) {
          return new Response(JSON.stringify({ success: false, message: "Sem permissão", token: newToken }), { status: 403, headers: allHeaders });
        }
        await supabase.from("software_users").update({ hwid: null }).eq("id", user_id);
        await supabase.from("licenses").update({ hwid: null }).eq("id", su.license_id);
        return new Response(JSON.stringify({ success: true, message: "HWID resetado", token: newToken }), { headers: allHeaders });
      }

      case "get-apps": {
        const appIds = Array.from(allowedApps);
        if (appIds.length === 0) return new Response(JSON.stringify({ success: true, apps: [], token: newToken }), { headers: allHeaders });
        const { data: apps } = await supabase.from("applications").select("id, name").in("id", appIds);
        return new Response(JSON.stringify({ success: true, apps: apps || [], token: newToken }), { headers: allHeaders });
      }

      default:
        return new Response(JSON.stringify({ success: false, message: "Ação inválida", token: newToken }), { status: 400, headers: allHeaders });
    }
  } catch (err) {
    console.error("Action error:", err);
    return new Response(JSON.stringify({ success: false, message: "Erro interno" }), { status: 500, headers: allHeaders });
  }
});
