import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SESSION_TTL_SECONDS = 1800; // 30 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { session_token, app_secret } = await req.json();

    if (!session_token || !app_secret) {
      return new Response(
        JSON.stringify({ valid: false, message: "Missing session_token or app_secret" }),
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
        JSON.stringify({ valid: false, message: "Invalid application secret" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!app.enabled) {
      return new Response(
        JSON.stringify({ valid: false, message: "Application is disabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find session token
    const { data: session, error: sessionError } = await supabase
      .from("session_tokens")
      .select("*")
      .eq("token", session_token)
      .eq("application_id", app.id)
      .eq("revoked", false)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ valid: false, message: "Invalid or revoked session token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      await supabase.from("session_tokens").update({ revoked: true }).eq("id", session.id);
      return new Response(
        JSON.stringify({ valid: false, message: "Session expired", expired: true }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Renew session: extend expiration on each valid request
    const newExpiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    await supabase.from("session_tokens")
      .update({ expires_at: newExpiresAt })
      .eq("id", session.id);

    return new Response(
      JSON.stringify({
        valid: true,
        message: "Session is valid",
        username: session.username,
        expires_at: newExpiresAt,
        ttl_seconds: SESSION_TTL_SECONDS,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ valid: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
