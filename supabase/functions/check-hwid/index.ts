import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const hwid = typeof body?.hwid === "string" ? body.hwid.trim() : "";

    if (!hwid || hwid.length > 128) {
      return new Response(
        JSON.stringify({ banned: false, error: "invalid_hwid" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("banned_hwids")
      .select("hwid, reason, banned_at")
      .eq("hwid", hwid)
      .maybeSingle();

    if (error) {
      return new Response(
        JSON.stringify({ banned: false, error: "lookup_failed" }),
        { status: 500, headers: jsonHeaders }
      );
    }

    if (data) {
      return new Response(
        JSON.stringify({
          banned: true,
          status: "banned",
          message: data.reason || "HWID banido.",
          banned_at: data.banned_at,
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    return new Response(
      JSON.stringify({ banned: false }),
      { status: 200, headers: jsonHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ banned: false, error: "internal_error" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
