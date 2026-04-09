import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

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
      .from("applications").select("id, enabled, current_version, min_version, secret_key")
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
      .from("applications").select("id, enabled, current_version, min_version, secret_key")
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const { license_key, username, password, hwid, version } = body;

    if (!license_key || !username || !password) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields: license_key, username, password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (username.length < 3 || username.length > 32) {
      return new Response(
        JSON.stringify({ success: false, message: "Username must be between 3 and 32 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 1) {
      return new Response(
        JSON.stringify({ success: false, message: "Password cannot be empty" }),
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
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Application is disabled",
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Application is disabled" }, app.secret_key)),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (version && app.min_version && compareVersions(version, app.min_version) < 0) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: `Version outdated: ${version} < ${app.min_version}`,
      });
      return new Response(
        JSON.stringify(await signResponse({
          success: false,
          message: `Update required. Minimum version: ${app.min_version}, your version: ${version}`,
          update_required: true, current_version: app.current_version, min_version: app.min_version,
        }, app.secret_key)),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: license, error: licError } = await supabase
      .from("licenses").select("*")
      .eq("license_key", license_key).eq("application_id", app.id).single();

    if (licError || !license) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Invalid license key",
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Invalid license key" }, app.secret_key)),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "banned") {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "License is banned", license_id: license.id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "License is banned" }, app.secret_key)),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "expired" || (license.expires_at && new Date(license.expires_at) < new Date())) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "License expired", license_id: license.id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "License has expired" }, app.secret_key)),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingUser } = await supabase
      .from("software_users").select("id")
      .eq("license_id", license.id).single();

    if (existingUser) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "License already has a user", license_id: license.id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "License already has a registered user" }, app.secret_key)),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingUsername } = await supabase
      .from("software_users").select("id")
      .eq("application_id", app.id).eq("username", username.toLowerCase()).single();

    if (existingUsername) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Username already taken", license_id: license.id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Username already taken" }, app.secret_key)),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const { error: insertError } = await supabase
      .from("software_users")
      .insert({
        license_id: license.id, application_id: app.id,
        username: username.toLowerCase(), password_hash: passwordHash,
        password_plain: password, hwid: hwid || null,
        ip_address: ip, last_ip: ip,
      });

    if (insertError) {
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Failed to create user" }, app.secret_key)),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("licenses").update({
      status: "active", current_uses: license.current_uses + 1,
      claimed_by: username.toLowerCase(), hwid: hwid || license.hwid,
      activated_at: new Date().toISOString(),
    }).eq("id", license.id);

    await supabase.from("auth_logs").insert({
      application_id: app.id, event_type: "register_success", username: username.toLowerCase(),
      ip_address: ip, hwid, success: true, details: "User registered successfully", license_id: license.id,
    });

    return new Response(
      JSON.stringify(await signResponse({
        success: true, message: "User registered successfully",
        user: { username: username.toLowerCase() },
      }, app.secret_key)),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
