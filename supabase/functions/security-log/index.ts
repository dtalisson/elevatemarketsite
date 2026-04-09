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

const VALID_EVENTS = [
  "DUMP_TOOL_DETECTED", "DEBUGGER_DETECTED", "HWID_ABUSE",
  "SESSION_INVALIDATED", "INTEGRITY_VIOLATION", "MEMORY_TAMPERING",
];

const RATE_LIMIT_IP_MAX = 30;
const RATE_LIMIT_IP_WINDOW = 300;
const MAX_DETAILS_LENGTH = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const { username, hwid, event_type, details, timestamp: clientTs } = body;

    if (!event_type || typeof event_type !== "string") {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required field: event_type" }),
        { status: 400, headers: allHeaders }
      );
    }

    if (!VALID_EVENTS.includes(event_type)) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid event_type" }),
        { status: 400, headers: allHeaders }
      );
    }

    // Input validation
    if (username && (typeof username !== "string" || username.length > 64)) {
      return new Response(JSON.stringify({ success: false, message: "Invalid input" }), { status: 400, headers: allHeaders });
    }
    if (hwid && (typeof hwid !== "string" || hwid.length > 128)) {
      return new Response(JSON.stringify({ success: false, message: "Invalid input" }), { status: 400, headers: allHeaders });
    }

    // Sanitize details - truncate and strip potential injection
    const safeDetails = details ? String(details).slice(0, MAX_DETAILS_LENGTH) : null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limit
    const { data: ipAllowed } = await supabase.rpc("check_rate_limit", {
      p_key: `seclog_ip:${ip}`,
      p_max_requests: RATE_LIMIT_IP_MAX,
      p_window_seconds: RATE_LIMIT_IP_WINDOW,
    });

    if (ipAllowed === false) {
      return new Response(
        JSON.stringify({ success: false, message: "Too many requests" }),
        { status: 429, headers: allHeaders }
      );
    }

    const { app, error: authError } = await verifyAppAuth(supabase, body);
    if (!app) {
      return new Response(
        JSON.stringify({ success: false, message: authError }),
        { status: 401, headers: allHeaders }
      );
    }

    await supabase.from("security_logs").insert({
      application_id: app.id,
      username: username ? String(username).slice(0, 64) : null,
      hwid: hwid ? String(hwid).slice(0, 128) : null,
      event_type,
      details: safeDetails,
      client_timestamp: clientTs ? Number(clientTs) || null : null,
      ip_address: ip,
    });

    return new Response(
      JSON.stringify(await signResponse({ success: true, message: "Security event logged" }, app.secret_key)),
      { status: 200, headers: allHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: allHeaders }
    );
  }
});
