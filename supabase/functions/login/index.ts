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

// Build canonical payload: sort body keys excluding auth fields, stringify
function buildCanonicalPayload(body: Record<string, unknown>): string {
  const authFields = ["app_id", "app_secret", "signature", "timestamp", "nonce"];
  const filtered = Object.entries(body)
    .filter(([k]) => !authFields.includes(k))
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(Object.fromEntries(filtered));
}

const REQUEST_MAX_AGE_MS = 60_000; // 60 seconds

interface AppAuthResult {
  app: { id: string; enabled: boolean; current_version: string | null; min_version: string | null; secret_key: string } | null;
  error?: string;
}

async function verifyAppAuth(supabase: any, body: Record<string, unknown>): Promise<AppAuthResult> {
  // New HMAC mode: app_id + timestamp + nonce + signature
  if (body.app_id && body.signature && body.timestamp) {
    const { data: app, error: appError } = await supabase
      .from("applications")
      .select("id, enabled, current_version, min_version, secret_key")
      .eq("id", body.app_id)
      .single();

    if (appError || !app) {
      return { app: null, error: "Invalid app_id" };
    }

    // Verify timestamp freshness (anti-replay)
    const ts = Number(body.timestamp);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > REQUEST_MAX_AGE_MS) {
      return { app: null, error: "Request expired or invalid timestamp" };
    }

    // Reconstruct and verify signature
    const canonical = buildCanonicalPayload(body);
    const message = `${body.timestamp}:${body.nonce || ""}:${canonical}`;
    const expectedSig = await hmacSign(message, app.secret_key);

    if (!constantTimeCompare(expectedSig, body.signature as string)) {
      return { app: null, error: "Invalid signature" };
    }

    return { app };
  }

  // Legacy mode: app_secret (backward compat - will be deprecated)
  if (body.app_secret) {
    const { data: app, error: appError } = await supabase
      .from("applications")
      .select("id, enabled, current_version, min_version, secret_key")
      .eq("secret_key", body.app_secret)
      .single();

    if (appError || !app) {
      return { app: null, error: "Invalid app_secret" };
    }

    return { app };
  }

  return { app: null, error: "Missing authentication (app_id+signature or app_secret)" };
}

async function signResponse(data: Record<string, unknown>, secretKey: string): Promise<Record<string, unknown>> {
  const ts = Date.now();
  const payload = JSON.stringify({ ...data, _ts: ts });
  const sig = await hmacSign(payload, secretKey);
  return { ...data, _ts: ts, _sig: sig };
}

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

const SESSION_TTL_SECONDS = 1800;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const { username, password, hwid, version, nonce, challenge_token } = body;

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields: username, password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify app (HMAC or legacy)
    const { app, error: authError } = await verifyAppAuth(supabase, body);
    if (!app) {
      return new Response(
        JSON.stringify({ success: false, message: authError }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!app.enabled) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_failed", username: username?.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Application is disabled",
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Application is disabled" }, app.secret_key)),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check version
    if (version && app.min_version && compareVersions(version, app.min_version) < 0) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_failed", username: username?.toLowerCase(),
        ip_address: ip, hwid, success: false, details: `Version outdated: ${version} < ${app.min_version}`,
      });
      return new Response(
        JSON.stringify(await signResponse({
          success: false,
          message: `Update required. Minimum version: ${app.min_version}, your version: ${version}`,
          update_required: true,
          current_version: app.current_version,
          min_version: app.min_version,
        }, app.secret_key)),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate challenge token if provided
    if (challenge_token) {
      const { data: tokenData, error: tokenError } = await supabase
        .from("pre_auth_tokens")
        .select("*")
        .eq("token", challenge_token)
        .eq("application_id", app.id)
        .eq("username", username.toLowerCase())
        .single();

      if (tokenError || !tokenData) {
        await supabase.from("auth_logs").insert({
          application_id: app.id, event_type: "login_failed", username: username.toLowerCase(),
          ip_address: ip, hwid, success: false, details: "Invalid challenge token",
        });
        return new Response(
          JSON.stringify(await signResponse({ success: false, message: "Invalid or expired challenge token" }, app.secret_key)),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new Date(tokenData.expires_at) < new Date() || tokenData.used) {
        await supabase.from("pre_auth_tokens").delete().eq("id", tokenData.id);
        await supabase.from("auth_logs").insert({
          application_id: app.id, event_type: "login_failed", username: username.toLowerCase(),
          ip_address: ip, hwid, success: false, details: "Challenge token expired or already used",
        });
        return new Response(
          JSON.stringify(await signResponse({ success: false, message: "Challenge token expired" }, app.secret_key)),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (tokenData.hwid && hwid && tokenData.hwid !== hwid) {
        await supabase.from("pre_auth_tokens").delete().eq("id", tokenData.id);
        await supabase.from("auth_logs").insert({
          application_id: app.id, event_type: "login_failed", username: username.toLowerCase(),
          ip_address: ip, hwid, success: false, details: "HWID mismatch between pre-auth and login",
        });
        return new Response(
          JSON.stringify(await signResponse({ success: false, message: "Device mismatch", status: "hwid_mismatch" }, app.secret_key)),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("pre_auth_tokens").update({ used: true }).eq("id", tokenData.id);
    }

    // Find user
    const { data: user, error: userError } = await supabase
      .from("software_users")
      .select("*, licenses(*, ban_reason)")
      .eq("application_id", app.id)
      .eq("username", username.toLowerCase())
      .single();

    if (userError || !user) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "User not found",
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Invalid username or password" }, app.secret_key)),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const storedHash = user.password_hash;
    if (!constantTimeCompare(passwordHash, storedHash)) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Wrong password", license_id: user.license_id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Invalid username or password" }, app.secret_key)),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check license
    const license = user.licenses;
    if (!license) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "No license associated", license_id: user.license_id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "No license associated" }, app.secret_key)),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "banned") {
      const banReason = (license as any).ban_reason;
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_banned", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: banReason ? `License paused: ${banReason}` : "License is paused", license_id: license.id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: banReason ? `License paused: ${banReason}` : "License is currently paused" }, app.secret_key)),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "expired" || (license.expires_at && new Date(license.expires_at) < new Date())) {
      if (license.status !== "expired") {
        await supabase.from("licenses").update({ status: "expired" }).eq("id", license.id);
      }
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_expired", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "License expired", license_id: license.id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "License has expired" }, app.secret_key)),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check HWID
    if (user.hwid && hwid && user.hwid !== hwid) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_hwid_mismatch", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: `HWID mismatch: expected ${user.hwid}`, license_id: license.id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Account is locked to another device" }, app.secret_key)),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user info
    const userUpdates: Record<string, unknown> = { last_ip: ip, last_login_at: new Date().toISOString() };
    if (hwid && !user.hwid) userUpdates.hwid = hwid;
    await supabase.from("software_users").update(userUpdates).eq("id", user.id);

    // Revoke existing sessions
    await supabase
      .from("session_tokens")
      .update({ revoked: true })
      .eq("application_id", app.id)
      .eq("username", username.toLowerCase())
      .eq("revoked", false);

    // Generate session token
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

    await supabase.from("session_tokens").insert({
      application_id: app.id,
      username: username.toLowerCase(),
      token: sessionToken,
      hwid: hwid || null,
      ip_address: ip,
      expires_at: expiresAt,
    });

    // Log success
    await supabase.from("auth_logs").insert({
      application_id: app.id, event_type: "login_success", username: username.toLowerCase(),
      ip_address: ip, hwid: hwid || user.hwid, success: true, details: "Login successful", license_id: license.id,
    });

    const responseData = {
      success: true,
      message: "Login successful",
      session_token: sessionToken,
      session_expires_at: expiresAt,
      session_ttl_seconds: SESSION_TTL_SECONDS,
      nonce: nonce || null,
      user: {
        username: user.username,
        license: {
          status: license.status,
          expires_at: license.expires_at,
        },
      },
      app: {
        current_version: app.current_version,
        update_available: version && app.current_version ? compareVersions(version, app.current_version) < 0 : false,
      },
    };

    return new Response(
      JSON.stringify(await signResponse(responseData, app.secret_key)),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
