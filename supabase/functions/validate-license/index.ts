import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
};

const allHeaders = { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" };

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || req.headers.get("cf-connecting-ip")
    || "unknown";
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function buildCanonicalPayload(body: Record<string, unknown>): string {
  const authFields = ["app_id", "app_secret", "signature", "timestamp", "nonce"];
  const filtered = Object.entries(body)
    .filter(([k]) => !authFields.includes(k))
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(Object.fromEntries(filtered));
}

const REQUEST_MAX_AGE_MS = 60_000;

async function verifyAppAuth(supabase: any, body: Record<string, unknown>) {
  if (body.app_id && body.signature && body.timestamp) {
    const { data: app, error } = await supabase
      .from("applications").select("id, enabled, secret_key")
      .eq("id", body.app_id).single();
    if (error || !app) return { app: null, error: "Invalid app_id" };
    const ts = Number(body.timestamp);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > REQUEST_MAX_AGE_MS)
      return { app: null, error: "Request expired" };
    const canonical = buildCanonicalPayload(body);
    const message = `${body.timestamp}:${body.nonce || ""}:${canonical}`;
    const expectedSig = await hmacSign(message, app.secret_key);
    if (!constantTimeCompare(expectedSig, body.signature as string))
      return { app: null, error: "Invalid signature" };
    return { app };
  }
  if (body.app_secret) {
    const { data: app, error } = await supabase
      .from("applications").select("id, enabled, secret_key")
      .eq("secret_key", body.app_secret).single();
    if (error || !app) return { app: null, error: "Invalid app_secret" };
    return { app };
  }
  return { app: null, error: "Missing authentication" };
}

function deepSortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepSortKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj as Record<string, unknown>).sort().reduce((acc, key) => {
      acc[key] = deepSortKeys((obj as Record<string, unknown>)[key]);
      return acc;
    }, {} as Record<string, unknown>);
  }
  return obj;
}

async function signResponse(data: Record<string, unknown>, secretKey: string): Promise<Record<string, unknown>> {
  const ts = Date.now();
  const withTs = { ...data, _ts: ts };
  const sorted = deepSortKeys(withTs) as Record<string, unknown>;
  const payload = JSON.stringify(sorted);
  const sig = await hmacSign(payload, secretKey);
  return { ...sorted, _sig: sig };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const { license_key, hwid } = body;

    if (!license_key || typeof license_key !== "string" || license_key.length > 64) {
      return new Response(
        JSON.stringify({ valid: false, message: "Missing or invalid license_key" }),
        { status: 400, headers: allHeaders }
      );
    }

    if (hwid && (typeof hwid !== "string" || hwid.length > 128)) {
      return new Response(
        JSON.stringify({ valid: false, message: "Invalid input" }),
        { status: 400, headers: allHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rate limit
    const { data: ipAllowed } = await supabase.rpc("check_rate_limit", {
      p_key: `vlicense_ip:${ip}`,
      p_max_requests: 20,
      p_window_seconds: 300,
    });
    if (ipAllowed === false) {
      return new Response(
        JSON.stringify({ valid: false, message: "Too many requests" }),
        { status: 429, headers: { ...allHeaders, "Retry-After": "300" } }
      );
    }

    const { app, error: authError } = await verifyAppAuth(supabase, body);
    if (!app) {
      return new Response(
        JSON.stringify({ valid: false, message: authError }),
        { status: 401, headers: allHeaders }
      );
    }

    if (!app.enabled) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "validate_failed",
        ip_address: ip, hwid, success: false, details: "Application is disabled",
      });
      return new Response(
        JSON.stringify(await signResponse({ valid: false, message: "Application is disabled" }, app.secret_key)),
        { status: 403, headers: allHeaders }
      );
    }

    // Check blacklist
    const { data: blResult } = await supabase.rpc("is_blacklisted", {
      p_app_id: app.id,
      p_ip: ip || null,
      p_hwid: hwid || null,
    });
    if (blResult && blResult.length > 0 && blResult[0].blocked) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "validate_blacklisted",
        ip_address: ip, hwid, success: false, details: `Blacklisted: ${blResult[0].block_reason || "Blocked"}`,
      });
      return new Response(
        JSON.stringify(await signResponse({ valid: false, message: "Access denied" }, app.secret_key)),
        { status: 403, headers: allHeaders }
      );
    }

    const { data: license, error: licError } = await supabase
      .from("licenses").select("*")
      .eq("license_key", license_key).eq("application_id", app.id).single();

    if (licError || !license) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "validate_failed",
        ip_address: ip, hwid, success: false, details: "License not found",
      });
      return new Response(
        JSON.stringify(await signResponse({ valid: false, message: "License not found" }, app.secret_key)),
        { status: 404, headers: allHeaders }
      );
    }

    if (license.status === "banned") {
      const banReason = (license as any).ban_reason;
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "validate_banned",
        ip_address: ip, hwid, success: false, details: banReason ? `License paused: ${banReason}` : "License is paused", license_id: license.id,
      });
      return new Response(
        JSON.stringify(await signResponse({ valid: false, message: banReason ? `License paused: ${banReason}` : "License is currently paused" }, app.secret_key)),
        { status: 403, headers: allHeaders }
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
        JSON.stringify(await signResponse({ valid: false, message: "License has expired" }, app.secret_key)),
        { status: 403, headers: allHeaders }
      );
    }

    if (license.hwid && hwid && license.hwid !== hwid) {
      await supabase.from("auth_logs").insert({
        application_id: app.id, event_type: "validate_hwid_mismatch",
        ip_address: ip, hwid, success: false, details: "HWID mismatch", license_id: license.id,
      });
      return new Response(
        JSON.stringify(await signResponse({ valid: false, message: "License is locked to another device" }, app.secret_key)),
        { status: 403, headers: allHeaders }
      );
    }

    if (license.status === "unused") {
      if (license.current_uses >= license.max_uses) {
        return new Response(
          JSON.stringify(await signResponse({ valid: false, message: "License max uses reached" }, app.secret_key)),
          { status: 403, headers: allHeaders }
        );
      }

      // RACE CONDITION FIX: atomic update with status check
      const updates: Record<string, unknown> = {
        status: "active", current_uses: license.current_uses + 1,
        claimed_by: hwid || "unknown", activated_at: new Date().toISOString(),
      };
      // Calculate expires_at from remaining_seconds at activation time
      if (license.remaining_seconds && license.remaining_seconds > 0) {
        updates.expires_at = new Date(Date.now() + license.remaining_seconds * 1000).toISOString();
      }
      if (hwid && !license.hwid) updates.hwid = hwid;
      const { data: claimed, error: claimErr } = await supabase
        .from("licenses").update(updates).eq("id", license.id).eq("status", "unused").select().single();
      if (claimErr || !claimed) {
        return new Response(
          JSON.stringify(await signResponse({ valid: false, message: "License already claimed" }, app.secret_key)),
          { status: 409, headers: allHeaders }
        );
      }
    }

    await supabase.from("auth_logs").insert({
      application_id: app.id, event_type: "validate_success",
      ip_address: ip, hwid, success: true, details: "License validated", license_id: license.id,
    });

    return new Response(
      JSON.stringify(await signResponse({
        valid: true, message: "License validated successfully",
        license: {
          status: "active", expires_at: license.expires_at,
          max_uses: license.max_uses,
          current_uses: license.current_uses + (license.status === "unused" ? 1 : 0),
        },
      }, app.secret_key)),
      { status: 200, headers: allHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ valid: false, message: "Internal server error" }),
      { status: 500, headers: allHeaders }
    );
  }
});
