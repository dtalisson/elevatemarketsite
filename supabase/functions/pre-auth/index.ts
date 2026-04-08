import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || req.headers.get("cf-connecting-ip")
    || "unknown";
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function buildCanonicalPayload(body: Record<string, unknown>): string {
  const authFields = ["app_id", "app_secret", "signature", "timestamp", "nonce"];
  const filtered = Object.entries(body)
    .filter(([k]) => !authFields.includes(k))
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(Object.fromEntries(filtered));
}

const REQUEST_MAX_AGE_MS = 60_000;

async function verifyAppAuth(supabase: any, body: Record<string, unknown>) {
  if (body.app_id && body.signature && body.timestamp) {
    const { data: app, error } = await supabase
      .from("applications").select("id, enabled, secret_key")
      .eq("id", body.app_id).single();
    if (error || !app) return { app: null, error: "Invalid app_id" };
    const ts = Number(body.timestamp);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > REQUEST_MAX_AGE_MS)
      return { app: null, error: "Request expired" };
    const canonical = buildCanonicalPayload(body);
    const message = `${body.timestamp}:${body.nonce || ""}:${canonical}`;
    const expectedSig = await hmacSign(message, app.secret_key);
    if (!constantTimeCompare(expectedSig, body.signature as string))
      return { app: null, error: "Invalid signature" };
    return { app };
  }
  if (body.app_secret) {
    const { data: app, error } = await supabase
      .from("applications").select("id, enabled, secret_key")
      .eq("secret_key", body.app_secret).single();
    if (error || !app) return { app: null, error: "Invalid app_secret" };
    return { app };
  }
  return { app: null, error: "Missing authentication" };
}

async function signResponse(data: Record<string, unknown>, secretKey: string): Promise<Record<string, unknown>> {
  const ts = Date.now();
  const withTs = { ...data, _ts: ts };
  const sorted = Object.keys(withTs).sort().reduce((obj, key) => { obj[key] = withTs[key]; return obj; }, {} as Record<string, unknown>);
  const payload = JSON.stringify(sorted);
  const sig = await hmacSign(payload, secretKey);
  return { ...sorted, _sig: sig };
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const { username, hwid } = body;

    if (!username) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields: username" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { app, error: authError } = await verifyAppAuth(supabase, body);
    if (!app) {
      return new Response(
        JSON.stringify({ success: false, message: authError }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!app.enabled) {
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Application is disabled" }, app.secret_key)),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from("software_users")
      .select("id, hwid")
      .eq("application_id", app.id)
      .eq("username", username.toLowerCase())
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "User not found" }, app.secret_key)),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check HWID
    if (user.hwid && hwid && user.hwid !== hwid) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "pre_auth_hwid_mismatch",
        username: username.toLowerCase(), ip_address: ip, hwid,
        success: false, details: `HWID mismatch at pre-auth: expected ${user.hwid}`,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Device mismatch", status: "hwid_mismatch" }, app.secret_key)),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate challenge token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    await supabase.from("pre_auth_tokens").delete()
      .eq("application_id", app.id).eq("username", username.toLowerCase());

    await supabase.from("pre_auth_tokens").insert({
      application_id: app.id,
      username: username.toLowerCase(),
      hwid: hwid || null,
      token,
      expires_at: expiresAt,
    });

    return new Response(
      JSON.stringify(await signResponse({ success: true, token, message: "Challenge token generated" }, app.secret_key)),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
