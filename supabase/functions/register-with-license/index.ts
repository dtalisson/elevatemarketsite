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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = getClientIp(req);

  try {
    const { license_key, app_secret, username, password, hwid, version } = await req.json();

    if (!license_key || !app_secret || !username || !password) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields: license_key, app_secret, username, password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (username.length < 3 || username.length > 32) {
      return new Response(
        JSON.stringify({ success: false, message: "Username must be between 3 and 32 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, message: "Password must be at least 6 characters" }),
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
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
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
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
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

    // Verify license
    const { data: license, error: licError } = await supabase
      .from("licenses")
      .select("*")
      .eq("license_key", license_key)
      .eq("application_id", app.id)
      .single();

    if (licError || !license) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Invalid license key",
      });
      return new Response(
        JSON.stringify({ success: false, message: "Invalid license key" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "banned") {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "License is banned", license_id: license.id,
      });
      return new Response(
        JSON.stringify({ success: false, message: "License is banned" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "expired" || (license.expires_at && new Date(license.expires_at) < new Date())) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "License expired", license_id: license.id,
      });
      return new Response(
        JSON.stringify({ success: false, message: "License has expired" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if license already has a registered user
    const { data: existingUser } = await supabase
      .from("software_users")
      .select("id")
      .eq("license_id", license.id)
      .single();

    if (existingUser) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "License already has a user", license_id: license.id,
      });
      return new Response(
        JSON.stringify({ success: false, message: "License already has a registered user" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if username already exists for this app
    const { data: existingUsername } = await supabase
      .from("software_users")
      .select("id")
      .eq("application_id", app.id)
      .eq("username", username.toLowerCase())
      .single();

    if (existingUsername) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "register_failed", username: username.toLowerCase(),
        ip_address: ip, hwid, success: false, details: "Username already taken", license_id: license.id,
      });
      return new Response(
        JSON.stringify({ success: false, message: "Username already taken" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Create user
    const { error: insertError } = await supabase
      .from("software_users")
      .insert({
        license_id: license.id,
        application_id: app.id,
        username: username.toLowerCase(),
        password_hash: passwordHash,
        hwid: hwid || null,
        ip_address: ip,
        last_ip: ip,
      });

    if (insertError) {
      return new Response(
        JSON.stringify({ success: false, message: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Activate license
    await supabase.from("licenses").update({
      status: "active",
      current_uses: license.current_uses + 1,
      claimed_by: username.toLowerCase(),
      hwid: hwid || license.hwid,
      activated_at: new Date().toISOString(),
    }).eq("id", license.id);

    // Log success
    await supabase.from("auth_logs").insert({
      application_id: app.id, event_type: "register_success", username: username.toLowerCase(),
      ip_address: ip, hwid, success: true, details: "User registered successfully", license_id: license.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "User registered successfully",
        user: { username: username.toLowerCase() },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
