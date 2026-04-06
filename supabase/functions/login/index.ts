import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { app_secret, username, password, hwid, version } = await req.json();

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
      return new Response(
        JSON.stringify({ success: false, message: "Application is disabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check version
    if (version && app.min_version && compareVersions(version, app.min_version) < 0) {
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
      return new Response(
        JSON.stringify({ success: false, message: "Invalid username or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    if (user.password_hash !== passwordHash) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid username or password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check license status
    const license = user.licenses;

    if (!license) {
      return new Response(
        JSON.stringify({ success: false, message: "No license associated" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "banned") {
      return new Response(
        JSON.stringify({ success: false, message: "License is banned" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "expired" || (license.expires_at && new Date(license.expires_at) < new Date())) {
      if (license.status !== "expired") {
        await supabase.from("licenses").update({ status: "expired" }).eq("id", license.id);
      }
      return new Response(
        JSON.stringify({ success: false, message: "License has expired" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check HWID
    if (user.hwid && hwid && user.hwid !== hwid) {
      return new Response(
        JSON.stringify({ success: false, message: "Account is locked to another device" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update HWID if not set
    if (hwid && !user.hwid) {
      await supabase.from("software_users").update({ hwid }).eq("id", user.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Login successful",
        user: {
          username: user.username,
          license: {
            status: license.status,
            expires_at: license.expires_at,
          },
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
