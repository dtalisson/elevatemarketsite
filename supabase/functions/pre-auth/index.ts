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

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = getClientIp(req);

  try {
    const { username, hwid, app_secret, app_hash, timestamp } = await req.json();

    if (!username || (!app_secret && !app_hash)) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify app via HMAC-TOTP or legacy secret
    const { app, error: appError } = await verifyAppHmac(
      { app_hash, app_secret, timestamp },
      supabase
    );

    if (appError || !app) {
      return new Response(
        JSON.stringify({ success: false, message: appError || "Invalid application" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!app.enabled) {
      return new Response(
        JSON.stringify({ success: false, message: "Application is disabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from("software_users")
      .select("id, hwid")
      .eq("application_id", app.id)
      .eq("username", username.toLowerCase())
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check HWID before generating token
    if (user.hwid && hwid && user.hwid !== hwid) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "pre_auth_hwid_mismatch",
        username: username.toLowerCase(), ip_address: ip, hwid,
        success: false, details: `HWID mismatch at pre-auth: expected ${user.hwid}`,
      });
      return new Response(
        JSON.stringify({ success: false, message: "Device mismatch", status: "hwid_mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate challenge token (expires in 60 seconds)
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    // Cleanup old tokens for this user
    await supabase
      .from("pre_auth_tokens")
      .delete()
      .eq("application_id", app.id)
      .eq("username", username.toLowerCase());

    // Insert new token
    await supabase.from("pre_auth_tokens").insert({
      application_id: app.id,
      username: username.toLowerCase(),
      hwid: hwid || null,
      token,
      expires_at: expiresAt,
    });

    return new Response(
      JSON.stringify({
        success: true,
        token,
        message: "Challenge token generated",
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
