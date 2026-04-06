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
    const { license_key, app_secret, hwid } = await req.json();

    if (!license_key || !app_secret) {
      return new Response(
        JSON.stringify({ valid: false, message: "Missing license_key or app_secret" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify app secret
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

    // Find license
    const { data: license, error: licError } = await supabase
      .from("licenses")
      .select("*")
      .eq("license_key", license_key)
      .eq("application_id", app.id)
      .single();

    if (licError || !license) {
      return new Response(
        JSON.stringify({ valid: false, message: "License not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check status
    if (license.status === "banned") {
      return new Response(
        JSON.stringify({ valid: false, message: "License is banned" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "expired" || (license.expires_at && new Date(license.expires_at) < new Date())) {
      // Auto-expire
      if (license.status !== "expired") {
        await supabase.from("licenses").update({ status: "expired" }).eq("id", license.id);
      }
      return new Response(
        JSON.stringify({ valid: false, message: "License has expired" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check HWID lock
    if (license.hwid && hwid && license.hwid !== hwid) {
      return new Response(
        JSON.stringify({ valid: false, message: "License is locked to another device" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check uses
    if (license.status === "unused") {
      if (license.current_uses >= license.max_uses) {
        return new Response(
          JSON.stringify({ valid: false, message: "License max uses reached" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Activate
      const updates: Record<string, unknown> = {
        status: "active",
        current_uses: license.current_uses + 1,
        claimed_by: hwid || "unknown",
      };
      if (hwid && !license.hwid) updates.hwid = hwid;

      await supabase.from("licenses").update(updates).eq("id", license.id);
    }

    return new Response(
      JSON.stringify({
        valid: true,
        message: "License validated successfully",
        license: {
          status: "active",
          expires_at: license.expires_at,
          max_uses: license.max_uses,
          current_uses: license.current_uses + (license.status === "unused" ? 1 : 0),
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
