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

async function hmacSign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { app_secret, app_hash, timestamp, version, nonce } = await req.json();

    if (!app_secret && !app_hash) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing app authentication" }),
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
        JSON.stringify({ success: false, message: appVerifyError || "Invalid application" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Need full app data for messages
    const { data: fullApp } = await supabase
      .from("applications")
      .select("name, msg_disabled, msg_maintenance, msg_outdated")
      .eq("id", app.id)
      .single();

    const ts = Date.now();
    let status = "online";
    let message = "Application is online";
    let update_required = false;
    let update_available = false;

    if (!app.enabled) {
      status = "disabled";
      message = fullApp?.msg_disabled || "Application is currently disabled";
    } else if (version && app.min_version && compareVersions(version, app.min_version) < 0) {
      status = "outdated";
      message = fullApp?.msg_outdated || `Update required. Minimum version: ${app.min_version}`;
      update_required = true;
    } else if (version && app.current_version && compareVersions(version, app.current_version) < 0) {
      update_available = true;
      message = "A new version is available";
    }

    const responseData = {
      success: true,
      status,
      message,
      app: {
        name: fullApp?.name || "",
        enabled: app.enabled,
        current_version: app.current_version,
        min_version: app.min_version,
        update_required,
        update_available,
      },
      timestamp: ts,
      nonce: nonce || null,
    };

    const signPayload = JSON.stringify({ status, timestamp: ts, nonce: nonce || "" });
    const signature = await hmacSign(signPayload, supabaseKey);
    (responseData as Record<string, unknown>).signature = signature;

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
