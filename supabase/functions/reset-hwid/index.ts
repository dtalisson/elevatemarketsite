import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const allHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { app_secret, license_key } = body;

    if (!app_secret || typeof app_secret !== "string") {
      return new Response(
        JSON.stringify({ success: false, message: "Missing or invalid app_secret" }),
        { status: 400, headers: allHeaders }
      );
    }

    if (!license_key || typeof license_key !== "string") {
      return new Response(
        JSON.stringify({ success: false, message: "Missing or invalid license_key" }),
        { status: 400, headers: allHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Authenticate via app_secret
    const { data: app, error: appErr } = await supabase
      .from("applications")
      .select("id, enabled, name")
      .eq("secret_key", app_secret)
      .single();

    if (appErr || !app) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid app_secret" }),
        { status: 401, headers: allHeaders }
      );
    }

    if (!app.enabled) {
      return new Response(
        JSON.stringify({ success: false, message: "Application is disabled" }),
        { status: 403, headers: allHeaders }
      );
    }

    // Find the license
    const { data: license, error: licErr } = await supabase
      .from("licenses")
      .select("id, license_key, status, hwid, claimed_by, application_id")
      .eq("license_key", license_key.trim().toUpperCase())
      .eq("application_id", app.id)
      .single();

    if (licErr || !license) {
      return new Response(
        JSON.stringify({ success: false, message: "License not found for this application" }),
        { status: 404, headers: allHeaders }
      );
    }

    if (license.status === "banned") {
      return new Response(
        JSON.stringify({ success: false, message: "License is banned" }),
        { status: 403, headers: allHeaders }
      );
    }

    // Reset HWID on the license
    const { error: updateLicErr } = await supabase
      .from("licenses")
      .update({ hwid: null })
      .eq("id", license.id);

    if (updateLicErr) {
      console.error("License update error:", updateLicErr);
      return new Response(
        JSON.stringify({ success: false, message: "Failed to reset license HWID" }),
        { status: 500, headers: allHeaders }
      );
    }

    // Also reset HWID on the software_user linked to this license
    const { data: updatedUsers } = await supabase
      .from("software_users")
      .update({ hwid: null })
      .eq("license_id", license.id)
      .select("username");

    return new Response(
      JSON.stringify({
        success: true,
        message: "HWID reset successfully",
        license_key: license.license_key,
        users_reset: updatedUsers?.map(u => u.username) || [],
      }),
      { status: 200, headers: allHeaders }
    );
  } catch (err) {
    console.error("Reset HWID error:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: allHeaders }
    );
  }
});
