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

interface AppAuthResult {
  app: { id: string; enabled: boolean; current_version: string | null; min_version: string | null; secret_key: string } | null;
  error?: string;
}

async function verifyAppAuth(supabase: any, body: Record<string, unknown>): Promise<AppAuthResult> {
  if (body.app_id && body.signature && body.timestamp) {
    const { data: app, error: appError } = await supabase
      .from("applications")
      .select("id, enabled, current_version, min_version, secret_key")
      .eq("id", body.app_id)
      .single();

    if (appError || !app) return { app: null, error: "Invalid app_id" };

    const ts = Number(body.timestamp);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > REQUEST_MAX_AGE_MS)
      return { app: null, error: "Request expired or invalid timestamp" };

    const canonical = buildCanonicalPayload(body);
    const message = `${body.timestamp}:${body.nonce || ""}:${canonical}`;
    const expectedSig = await hmacSign(message, app.secret_key);

    if (!constantTimeCompare(expectedSig, body.signature as string))
      return { app: null, error: "Invalid signature" };

    return { app };
  }

  if (body.app_secret) {
    const { data: app, error: appError } = await supabase
      .from("applications")
      .select("id, enabled, current_version, min_version, secret_key")
      .eq("secret_key", body.app_secret)
      .single();

    if (appError || !app) return { app: null, error: "Invalid app_secret" };
    return { app };
  }

  return { app: null, error: "Missing authentication (app_id+signature or app_secret)" };
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

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Input validation limits
const MAX_USERNAME_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 256;
const MAX_HWID_LENGTH = 128;
const MAX_VERSION_LENGTH = 32;
const MAX_NONCE_LENGTH = 64;
const MAX_BODY_SIZE = 2048;

const SESSION_TTL_SECONDS = 1800;

// Rate limits: 10 login attempts per IP per 5 minutes, 5 per username per 5 minutes
const RATE_LIMIT_IP_MAX = 10;
const RATE_LIMIT_IP_WINDOW = 300;
const RATE_LIMIT_USER_MAX = 5;
const RATE_LIMIT_USER_WINDOW = 300;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = getClientIp(req);

  try {
    // Body size check
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
      return new Response(
        JSON.stringify({ success: false, message: "Request too large" }),
        { status: 413, headers: allHeaders }
      );
    }

    const body = await req.json();
    const { username, password, hwid, version, nonce, challenge_token } = body;

    // Input validation
    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 400, headers: allHeaders }
      );
    }

    if (typeof username !== "string" || username.length > MAX_USERNAME_LENGTH ||
        typeof password !== "string" || password.length > MAX_PASSWORD_LENGTH) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid input" }),
        { status: 400, headers: allHeaders }
      );
    }

    if (hwid && (typeof hwid !== "string" || hwid.length > MAX_HWID_LENGTH)) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid input" }),
        { status: 400, headers: allHeaders }
      );
    }

    if (version && (typeof version !== "string" || version.length > MAX_VERSION_LENGTH)) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid input" }),
        { status: 400, headers: allHeaders }
      );
    }

    if (nonce && (typeof nonce !== "string" || nonce.length > MAX_NONCE_LENGTH)) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid input" }),
        { status: 400, headers: allHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limit by IP
    const { data: ipAllowed } = await supabase.rpc("check_rate_limit", {
      p_key: `login_ip:${ip}`,
      p_max_requests: RATE_LIMIT_IP_MAX,
      p_window_seconds: RATE_LIMIT_IP_WINDOW,
    });

    if (ipAllowed === false) {
      return new Response(
        JSON.stringify({ success: false, message: "Too many requests. Try again later." }),
        { status: 429, headers: { ...allHeaders, "Retry-After": String(RATE_LIMIT_IP_WINDOW) } }
      );
    }

    // Verify app (HMAC or legacy)
    const { app, error: authError } = await verifyAppAuth(supabase, body);
    if (!app) {
      return new Response(
        JSON.stringify({ success: false, message: authError }),
        { status: 401, headers: allHeaders }
      );
    }

    // Rate limit by username
    const { data: userAllowed } = await supabase.rpc("check_rate_limit", {
      p_key: `login_user:${app.id}:${username.toLowerCase()}`,
      p_max_requests: RATE_LIMIT_USER_MAX,
      p_window_seconds: RATE_LIMIT_USER_WINDOW,
    });

    if (userAllowed === false) {
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Account temporarily locked. Try again later." }, app.secret_key)),
        { status: 429, headers: { ...allHeaders, "Retry-After": String(RATE_LIMIT_USER_WINDOW) } }
      );
    }

    // Check account lockout
    const { data: isLocked } = await supabase.rpc("is_account_locked", {
      p_username: username.toLowerCase(),
      p_app_id: app.id,
    });

    if (isLocked) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_locked", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Account locked due to too many failed attempts",
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Account locked. Try again in 15 minutes." }, app.secret_key)),
        { status: 429, headers: allHeaders }
      );
    }

    if (!app.enabled) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_failed", username: username?.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Application is disabled",
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Application is disabled" }, app.secret_key)),
        { status: 403, headers: allHeaders }
      );
    }

    // Global HWID ban (banned_hwids)
    if (hwid) {
      const { data: gBan } = await supabase
        .from("banned_hwids").select("reason").eq("hwid", hwid).maybeSingle();
      if (gBan) {
        await supabase.from("auth_logs").insert({
          application_id: app.id, event_type: "login_hwid_banned", username: username?.toLowerCase(),
          ip_address: ip, hwid, success: false, details: `HWID globally banned: ${gBan.reason || "banned"}`,
        });
        return new Response(
          JSON.stringify(await signResponse({ success: false, status: "banned", message: gBan.reason || "HWID banido." }, app.secret_key)),
          { status: 403, headers: allHeaders }
        );
      }
    }

    // Check blacklist
    const { data: blResult } = await supabase.rpc("is_blacklisted", {
      p_app_id: app.id,
      p_ip: ip || null,
      p_hwid: hwid || null,
    });
    if (blResult && blResult.length > 0 && blResult[0].blocked) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_blacklisted", username: username?.toLowerCase(),
        ip_address: ip, hwid, success: false, details: `Blacklisted: ${blResult[0].block_reason || "Blocked"}`,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Access denied" }, app.secret_key)),
        { status: 403, headers: allHeaders }
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
        { status: 403, headers: allHeaders }
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
          { status: 401, headers: allHeaders }
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
          { status: 401, headers: allHeaders }
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
          { status: 403, headers: allHeaders }
        );
      }

      await supabase.from("pre_auth_tokens").update({ used: true }).eq("id", tokenData.id);
    }

    // Find user — generic error for both user not found and wrong password
    const { data: user, error: userError } = await supabase
      .from("software_users")
      .select("*, licenses(*, ban_reason)")
      .eq("application_id", app.id)
      .eq("username", username.toLowerCase())
      .single();

    if (userError || !user) {
      // Record failed attempt (don't reveal user doesn't exist)
      await supabase.rpc("record_failed_login", { p_username: username.toLowerCase(), p_app_id: app.id });
      if (hwid) {
        await supabase.rpc("record_hwid_failure", { p_app_id: app.id, p_hwid: hwid, p_reason: "Auto: credenciais inválidas", p_max: 5, p_window_seconds: 31536000 });
      }
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Invalid credentials",
      });
      // Add artificial delay to prevent timing attacks
      await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Invalid username or password" }, app.secret_key)),
        { status: 401, headers: allHeaders }
      );
    }

    // Verify password (salted: hash = SHA-256(password + username))
    const encoder = new TextEncoder();
    const salted = password + user.username; // username as salt for backward compat awareness
    const data = encoder.encode(salted);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Try salted first, then fallback to unsalted for backward compat
    const storedHash = user.password_hash;
    let passwordMatch = constantTimeCompare(passwordHash, storedHash);

    if (!passwordMatch) {
      // Fallback: try unsalted hash (legacy)
      const unsaltedData = encoder.encode(password);
      const unsaltedBuffer = await crypto.subtle.digest("SHA-256", unsaltedData);
      const unsaltedHash = Array.from(new Uint8Array(unsaltedBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      passwordMatch = constantTimeCompare(unsaltedHash, storedHash);

      // If legacy match, upgrade hash to salted version
      if (passwordMatch) {
        await supabase.from("software_users").update({ password_hash: passwordHash }).eq("id", user.id);
      }
    }

    if (!passwordMatch) {
      // Record failed login attempt
      const isNowLocked = await supabase.rpc("record_failed_login", {
        p_username: username.toLowerCase(),
        p_app_id: app.id,
      });
      if (hwid) {
        await supabase.rpc("record_hwid_failure", { p_app_id: app.id, p_hwid: hwid, p_reason: "Auto: senha incorreta", p_max: 5, p_window_seconds: 31536000 });
      }
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: isNowLocked?.data ? "Account locked after too many attempts" : "Wrong password", license_id: user.license_id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "Invalid username or password" }, app.secret_key)),
        { status: 401, headers: allHeaders }
      );
    }

    // Clear lockout on successful login
    await supabase.rpc("clear_lockout", { p_username: username.toLowerCase(), p_app_id: app.id });

    // Check license
    const license = user.licenses;
    if (!license) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "No license associated", license_id: user.license_id,
      });
      return new Response(
        JSON.stringify(await signResponse({ success: false, message: "No license associated" }, app.secret_key)),
        { status: 403, headers: allHeaders }
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
        { status: 403, headers: allHeaders }
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
        { status: 403, headers: allHeaders }
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
        { status: 403, headers: allHeaders }
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
      { status: 200, headers: allHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: allHeaders }
    );
  }
});
