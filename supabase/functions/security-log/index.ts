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

const VALID_EVENTS = [
  "DUMP_TOOL_DETECTED",
  "DEBUGGER_DETECTED",
  "HWID_ABUSE",
  "SESSION_INVALIDATED",
  "INTEGRITY_VIOLATION",
  "MEMORY_TAMPERING",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = getClientIp(req);

  try {
    const { username, hwid, event_type, details, timestamp: clientTimestamp, app_secret, app_hash, timestamp } = await req.json();

    if ((!app_secret && !app_hash) || !event_type) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!VALID_EVENTS.includes(event_type)) {
      return new Response(
        JSON.stringify({ success: false, message: `Invalid event_type. Valid: ${VALID_EVENTS.join(", ")}` }),
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

    await supabase.from("security_logs").insert({
      application_id: app.id,
      username: username || null,
      hwid: hwid || null,
      event_type,
      details: details || null,
      client_timestamp: clientTimestamp || null,
      ip_address: ip,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Security event logged" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
