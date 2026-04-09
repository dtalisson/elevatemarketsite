import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
};

const allHeaders = { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" };

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

function deepSortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepSortKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj as Record<string, unknown>).sort().reduce((acc, key) => {
      acc[key] = deepSortKeys((obj as Record<string, unknown>)[key]);
      return acc;
    }, {} as Record<string, unknown>);
  }
  return obj;
}

async function signResponse(data: Record<string, unknown>, secretKey: string): Promise<Record<string, unknown>> {
  const ts = Date.now();
  const withTs = { ...data, _ts: ts };
  const sorted = deepSortKeys(withTs) as Record<string, unknown>;
  const payload = JSON.stringify(sorted);
  const sig = await hmacSign(payload, secretKey);
  return { ...sorted, _sig: sig };
}

const SESSION_TTL_SECONDS = 1800;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { session_token } = body;

    if (!session_token) {
      return new Response(
        JSON.stringify({ valid: false, message: "Missing session_token" }),
        { status: 400, headers: allHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { app, error: authError } = await verifyAppAuth(supabase, body);
    if (!app) {
      return new Response(
        JSON.stringify({ valid: false, message: authError }),
        { status: 401, headers: allHeaders }
      );
    }

    if (!app.enabled) {
      return new Response(
        JSON.stringify(await signResponse({ valid: false, message: "Application is disabled" }, app.secret_key)),
        { status: 403, headers: allHeaders }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from("session_tokens").select("*")
      .eq("token", session_token).eq("application_id", app.id).eq("revoked", false).single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify(await signResponse({ valid: false, message: "Invalid or revoked session token" }, app.secret_key)),
        { status: 401, headers: allHeaders }
      );
    }

    if (new Date(session.expires_at) < new Date()) {
      await supabase.from("session_tokens").update({ revoked: true }).eq("id", session.id);
      return new Response(
        JSON.stringify(await signResponse({ valid: false, message: "Session expired", expired: true }, app.secret_key)),
        { status: 401, headers: allHeaders }
      );
    }

    const newExpiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    await supabase.from("session_tokens").update({ expires_at: newExpiresAt }).eq("id", session.id);

    return new Response(
      JSON.stringify(await signResponse({
        valid: true, message: "Session is valid",
        username: session.username, expires_at: newExpiresAt, ttl_seconds: SESSION_TTL_SECONDS,
      }, app.secret_key)),
      { status: 200, headers: allHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ valid: false, message: "Internal server error" }),
      { status: 500, headers: allHeaders }
    );
  }
});
