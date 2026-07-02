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

    // 1) Global HWID ban
    const { data: banGlobal, error: gErr } = await supabase
      .from("banned_hwids")
      .select("hwid, reason, banned_at")
      .eq("hwid", hwid)
      .maybeSingle();

    if (gErr) {
      return new Response(
        JSON.stringify({ banned: false, error: "lookup_failed" }),
        { status: 500, headers: jsonHeaders }
      );
    }

    if (banGlobal) {
      return new Response(
        JSON.stringify({
          banned: true,
          status: "banned",
          source: "banned_hwids",
          message: banGlobal.reason || "Seu HWID está banido permanentemente.",
          banned_at: banGlobal.banned_at,
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // 2) Per-application blacklist (any active entry for this HWID)
    const { data: banBlacklist, error: bErr } = await supabase
      .from("blacklist")
      .select("hwid, reason, application_id, created_at")
      .eq("hwid", hwid)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (bErr) {
      return new Response(
        JSON.stringify({ banned: false, error: "lookup_failed" }),
        { status: 500, headers: jsonHeaders }
      );
    }

    if (banBlacklist) {
      return new Response(
        JSON.stringify({
          banned: true,
          status: "banned",
          source: "blacklist",
          application_id: banBlacklist.application_id,
          message: banBlacklist.reason || "Acesso negado: Seu HWID está na blacklist.",
          banned_at: banBlacklist.created_at,
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    return new Response(
      JSON.stringify({ banned: false, status: "active" }),
      { status: 200, headers: jsonHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ banned: false, error: "internal_error" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
