import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SESSION_TTL_SECONDS = 1800; // 30 minutes

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

  try {
    const { username, hwid, app_secret, session_token } = await req.json();

    if (!username || !app_secret) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify app
    const { data: app, error: appError } = await supabase
      .from("applications")
      .select("id, enabled")
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
        JSON.stringify({ success: false, message: "Application is disabled", action: "close" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate session token if provided
    if (session_token) {
      const { data: session, error: sessionError } = await supabase
        .from("session_tokens")
        .select("*")
        .eq("token", session_token)
        .eq("application_id", app.id)
        .eq("revoked", false)
        .single();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid or revoked session", action: "reauth" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (new Date(session.expires_at) < new Date()) {
        await supabase.from("session_tokens").update({ revoked: true }).eq("id", session.id);
        return new Response(
          JSON.stringify({ success: false, message: "Session expired", action: "reauth", expired: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Renew session on heartbeat
      const newExpiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
      await supabase.from("session_tokens")
        .update({ expires_at: newExpiresAt })
        .eq("id", session.id);
    }

    // Find user and their license
    const { data: user, error: userError } = await supabase
      .from("software_users")
      .select("id, hwid, license_id, licenses(status, expires_at)")
      .eq("application_id", app.id)
      .eq("username", username.toLowerCase())
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "User not found", action: "close" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (user.hwid && hwid && user.hwid !== hwid) {
      return new Response(
        JSON.stringify({ success: false, message: "Device mismatch", action: "close", status: "hwid_mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const license = user.licenses as { status: string; expires_at: string | null } | null;

    if (!license) {
      return new Response(
        JSON.stringify({ success: false, message: "No license", action: "close" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "banned") {
      return new Response(
        JSON.stringify({ success: false, message: "License banned", action: "close", status: "banned" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "expired" || (license.expires_at && new Date(license.expires_at) < new Date())) {
      return new Response(
        JSON.stringify({ success: false, message: "License expired", action: "close", status: "expired" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last activity
    const ip = getClientIp(req);
    await supabase.from("software_users").update({
      last_ip: ip,
      last_login_at: new Date().toISOString(),
    }).eq("id", user.id);

    return new Response(
      JSON.stringify({ success: true, message: "Heartbeat OK" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
