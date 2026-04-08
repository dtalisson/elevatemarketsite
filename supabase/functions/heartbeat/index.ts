import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { verifyAppHmac } from "../_shared/hmac-verify.ts";

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

  try {
    const { username, hwid, app_secret, app_hash, timestamp, status } = await req.json();

    if (!username || (!app_secret && !app_hash)) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { app, error: appVerifyError } = await verifyAppHmac(
      { app_hash, app_secret, timestamp },
      supabase
    );

    if (appVerifyError || !app) {
      return new Response(
        JSON.stringify({ success: false, message: appVerifyError || "Invalid application" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!app.enabled) {
      return new Response(
        JSON.stringify({ success: false, message: "Application is disabled", action: "close" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
