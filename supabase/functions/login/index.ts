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

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = getClientIp(req);
  const requestStart = Date.now();

  try {
    const { app_secret, username, password, hwid, version, nonce } = await req.json();

    if (!app_secret || !username || !password) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields: app_secret, username, password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify app
    const { data: app, error: appError } = await supabase
      .from("applications")
      .select("id, enabled, current_version, min_version")
      .eq("secret_key", app_secret)
      .single();

    if (appError || !app) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid application secret" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!app.enabled) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_failed", username: username?.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Application is disabled",
      });
      return new Response(
        JSON.stringify({ success: false, message: "Application is disabled" }),
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
        JSON.stringify({
          success: false,
          message: `Update required. Minimum version: ${app.min_version}, your version: ${version}`,
          update_required: true,
          current_version: app.current_version,
          min_version: app.min_version,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find user
    const { data: user, error: userError } = await supabase
      .from("software_users")
      .select("*, licenses(*)")
      .eq("application_id", app.id)
      .eq("username", username.toLowerCase())
      .single();

    if (userError || !user) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "User not found",
      });
      return new Response(
        JSON.stringify({ success: false, message: "Invalid username or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password with constant-time comparison
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Constant-time string comparison to prevent timing attacks
    const storedHash = user.password_hash;
    let mismatch = passwordHash.length !== storedHash.length ? 1 : 0;
    for (let i = 0; i < Math.max(passwordHash.length, storedHash.length); i++) {
      mismatch |= (passwordHash.charCodeAt(i) || 0) ^ (storedHash.charCodeAt(i) || 0);
    }

    if (mismatch !== 0) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Wrong password", license_id: user.license_id,
      });
      return new Response(
        JSON.stringify({ success: false, message: "Invalid username or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check license status
    const license = user.licenses;

    if (!license) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "No license associated", license_id: user.license_id,
      });
      return new Response(
        JSON.stringify({ success: false, message: "No license associated" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "banned") {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "login_banned", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "License is banned", license_id: license.id,
      });
      return new Response(
        JSON.stringify({ success: false, message: "License is banned" }),
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
        JSON.stringify({ success: false, message: "License has expired" }),
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
        JSON.stringify({ success: false, message: "Account is locked to another device" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user info (HWID, IP, last login)
    const userUpdates: Record<string, unknown> = { last_ip: ip, last_login_at: new Date().toISOString() };
    if (hwid && !user.hwid) userUpdates.hwid = hwid;
    await supabase.from("software_users").update(userUpdates).eq("id", user.id);

    // Generate session token and sign the response
    const sessionToken = generateSessionToken();
    const timestamp = Date.now();
    const signPayload = JSON.stringify({
      session: sessionToken,
      username: user.username,
      status: license.status,
      timestamp,
      nonce: nonce || "",
    });
    const signature = await hmacSign(signPayload, supabaseKey);

    // Log success
    await supabase.from("auth_logs").insert({
      application_id: app.id, event_type: "login_success", username: username.toLowerCase(),
      ip_address: ip, hwid: hwid || user.hwid, success: true, details: "Login successful", license_id: license.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Login successful",
        session_token: sessionToken,
        signature,
        timestamp,
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
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
