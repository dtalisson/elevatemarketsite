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

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
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

// Input limits
const MAX_USERNAME_LENGTH = 32;
const MIN_USERNAME_LENGTH = 3;
const MAX_PASSWORD_LENGTH = 256;
const MIN_PASSWORD_LENGTH = 6;
const MAX_HWID_LENGTH = 128;
const MAX_LICENSE_KEY_LENGTH = 64;

// Rate limits: 5 register attempts per IP per 10 minutes
const RATE_LIMIT_IP_MAX = 5;
const RATE_LIMIT_IP_WINDOW = 600;

// Username validation: only alphanumeric, underscore, hyphen
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const { license_key, username, password, hwid, version } = body;

    // Input validation
    if (!license_key || !username || !password) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields: license_key, username, password" }),
        { status: 400, headers: allHeaders }
      );
    }

    if (typeof username !== "string" || typeof password !== "string" || typeof license_key !== "string") {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid input types" }),
        { status: 400, headers: allHeaders }
      );
    }

    if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
      return new Response(
        JSON.stringify({ success: false, message: `Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters` }),
        { status: 400, headers: allHeaders }
      );
    }

    if (!USERNAME_REGEX.test(username)) {
      return new Response(
        JSON.stringify({ success: false, message: "Username can only contain letters, numbers, underscores and hyphens" }),
        { status: 400, headers: allHeaders }
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return new Response(
        JSON.stringify({ success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }),
        { status: 400, headers: allHeaders }
      );
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      return new Response(
        JSON.stringify({ success: false, message: "Password too long" }),
        { status: 400, headers: allHeaders }
      );
    }

    if (license_key.length > MAX_LICENSE_KEY_LENGTH) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid license key" }),
        { status: 400, headers: allHeaders }
      );
    }

    if (hwid && (typeof hwid !== "string" || hwid.length > MAX_HWID_LENGTH)) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid HWID" }),
        { status: 400, headers: allHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limit by IP
    const { data: ipAllowed } = await supabase.rpc("check_rate_limit", {
      p_key: `register_ip:${ip}`,
      p_max_requests: RATE_LIMIT_IP_MAX,
      p_window_seconds: RATE_LIMIT_IP_WINDOW,
    });

    if (ipAllowed === false) {
      return new Response(
        JSON.stringify({ success: false, message: "Too many registration attempts. Try again later." }),
        { status: 429, headers: { ...allHeaders, "Retry-After": String(RATE_LIMIT_IP_WINDOW) } }
      );
    }

    const { app, error: authError } = await verifyAppAuth(supabase, body);
    if (!app) {
      return new Response(
        JSON.stringify({ success: false, message: authError }),
        { status: 401, headers: allHeaders }
      );
    }

    if (!app.enabled) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Application is disabled",
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Application is disabled" }, app.secret_key)),
        { status: 403, headers: allHeaders }
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
        { status: 403, headers: allHeaders }
      );
    }

    const { data: license, error: licError } = await supabase
      .from("licenses").select("*")
      .eq("license_key", license_key).eq("application_id", app.id).single();

    if (licError || !license) {
      if (hwid) {
        await supabase.rpc("record_hwid_failure", { p_app_id: app.id, p_hwid: hwid, p_reason: "Auto: key inválida no registro", p_max: 1 });
      }
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Invalid license key",
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Invalid license key" }, app.secret_key)),
        { status: 404, headers: allHeaders }
      );
    }

    if (license.status === "banned") {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "License is banned", license_id: license.id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "License is banned" }, app.secret_key)),
        { status: 403, headers: allHeaders }
      );
    }

    if (license.status === "expired" || (license.expires_at && new Date(license.expires_at) < new Date())) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "License expired", license_id: license.id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "License has expired" }, app.secret_key)),
        { status: 403, headers: allHeaders }
      );
    }

    // Check if license already claimed (atomic check via current_uses)
    if (license.status !== "unused" || license.current_uses >= license.max_uses) {
      if (hwid) {
        await supabase.rpc("record_hwid_failure", { p_app_id: app.id, p_hwid: hwid, p_reason: "Auto: tentou registrar key já usada", p_max: 1 });
      }
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "License already claimed", license_id: license.id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "License already has a registered user" }, app.secret_key)),
        { status: 409, headers: allHeaders }
      );
    }

    // Check username taken
    const { data: existingUsername } = await supabase
      .from("software_users").select("id")
      .eq("application_id", app.id).eq("username", username.toLowerCase()).single();

    if (existingUsername) {
      if (hwid) {
        await supabase.rpc("record_hwid_failure", { p_app_id: app.id, p_hwid: hwid, p_reason: "Auto: tentou registrar username já usado", p_max: 1 });
      }
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Username already taken", license_id: license.id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Username already taken" }, app.secret_key)),
        { status: 409, headers: allHeaders }
      );
    }

    // Hash password with salt (username as salt)
    const encoder = new TextEncoder();
    const salted = password + username.toLowerCase();
    const data = encoder.encode(salted);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // RACE CONDITION FIX: Atomically claim the license first
    // Only update if status is still 'unused' (prevents double-claim)
    const licenseUpdates: Record<string, unknown> = {
      status: "active", current_uses: license.current_uses + 1,
      claimed_by: username.toLowerCase(), hwid: hwid || license.hwid,
      activated_at: new Date().toISOString(),
    };
    // Calculate expires_at from remaining_seconds at activation time
    if (license.remaining_seconds && license.remaining_seconds > 0) {
      licenseUpdates.expires_at = new Date(Date.now() + license.remaining_seconds * 1000).toISOString();
    }
    const { data: claimedLicense, error: claimError } = await supabase
      .from("licenses")
      .update(licenseUpdates)
      .eq("id", license.id)
      .eq("status", "unused") // Atomic check - prevents race condition
      .select()
      .single();

    if (claimError || !claimedLicense) {
      // License was claimed by another request between our check and update
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "License claimed by another request (race)", license_id: license.id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "License already claimed" }, app.secret_key)),
        { status: 409, headers: allHeaders }
      );
    }

    // Now create the user
    const { error: insertError } = await supabase
      .from("software_users")
      .insert({
        license_id: license.id, application_id: app.id,
        username: username.toLowerCase(), password_hash: passwordHash,
        hwid: hwid || null,
        ip_address: ip, last_ip: ip,
      });

    if (insertError) {
      // Rollback license claim
      await supabase.from("licenses").update({
        status: "unused", current_uses: license.current_uses,
        claimed_by: null, hwid: null, activated_at: null,
      }).eq("id", license.id);

      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Failed to create user" }, app.secret_key)),
        { status: 500, headers: allHeaders }
      );
    }

    await supabase.from("auth_logs").insert({
      application_id: app.id, event_type: "register_success", username: username.toLowerCase(),
      ip_address: ip, hwid, success: true, details: "User registered successfully", license_id: license.id,
    });

    return new Response(
      JSON.stringify(await signResponse({
        success: true, message: "User registered successfully",
        user: { username: username.toLowerCase() },
      }, app.secret_key)),
      { status: 201, headers: allHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: allHeaders }
    );
  }
});
