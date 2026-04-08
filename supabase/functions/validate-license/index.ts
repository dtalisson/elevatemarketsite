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

  const ip = getClientIp(req);

  try {
    const { license_key, app_secret, app_hash, timestamp, hwid } = await req.json();

    if (!license_key || (!app_secret && !app_hash)) {
      return new Response(
        JSON.stringify({ valid: false, message: "Missing license_key or app authentication" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify app via HMAC-TOTP or legacy secret
    const { app, error: appVerifyError } = await verifyAppHmac(
      { app_hash, app_secret, timestamp },
      supabase
    );

    if (appVerifyError || !app) {
      return new Response(
        JSON.stringify({ valid: false, message: appVerifyError || "Invalid application" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!app.enabled) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "validate_failed",
        ip_address: ip, hwid, success: false, details: "Application is disabled",
      });
      return new Response(
        JSON.stringify({ valid: false, message: "Application is disabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: license, error: licError } = await supabase
      .from("licenses")
      .select("*")
      .eq("license_key", license_key)
      .eq("application_id", app.id)
      .single();

    if (licError || !license) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "validate_failed",
        ip_address: ip, hwid, success: false, details: "License not found",
      });
      return new Response(
        JSON.stringify({ valid: false, message: "License not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "banned") {
      const banReason = (license as any).ban_reason;
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "validate_banned",
        ip_address: ip, hwid, success: false, details: banReason ? `License paused: ${banReason}` : "License is paused", license_id: license.id,
      });
      return new Response(
        JSON.stringify({ valid: false, message: banReason ? `License paused: ${banReason}` : "License is currently paused" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "expired" || (license.expires_at && new Date(license.expires_at) < new Date())) {
      if (license.status !== "expired") {
        await supabase.from("licenses").update({ status: "expired" }).eq("id", license.id);
      }
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "validate_expired",
        ip_address: ip, hwid, success: false, details: "License expired", license_id: license.id,
      });
      return new Response(
        JSON.stringify({ valid: false, message: "License has expired" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.hwid && hwid && license.hwid !== hwid) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "validate_hwid_mismatch",
        ip_address: ip, hwid, success: false, details: "HWID mismatch", license_id: license.id,
      });
      return new Response(
        JSON.stringify({ valid: false, message: "License is locked to another device" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (license.status === "unused") {
      if (license.current_uses >= license.max_uses) {
        return new Response(
          JSON.stringify({ valid: false, message: "License max uses reached" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updates: Record<string, unknown> = {
        status: "active",
        current_uses: license.current_uses + 1,
        claimed_by: hwid || "unknown",
        activated_at: new Date().toISOString(),
      };
      if (hwid && !license.hwid) updates.hwid = hwid;

      await supabase.from("licenses").update(updates).eq("id", license.id);
    }

    await supabase.from("auth_logs").insert({
      application_id: app.id, event_type: "validate_success",
      ip_address: ip, hwid, success: true, details: "License validated", license_id: license.id,
    });

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
  } catch {
    return new Response(
      JSON.stringify({ valid: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
