import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// Duration plans in seconds
const PLANS: Record<string, { label: string; seconds: number }> = {
  "1day":     { label: "1 Dia",     seconds: 86400 },
  "trial":    { label: "Trial (3 Dias)", seconds: 259200 },
  "weekly":   { label: "Semanal (7 Dias)", seconds: 604800 },
  "monthly":  { label: "Mensal (30 Dias)", seconds: 2592000 },
  "lifetime": { label: "Lifetime (999 Dias)", seconds: 86313600 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { app_secret, plan, quantity, note } = body;

    // Validate inputs
    if (!app_secret || typeof app_secret !== "string") {
      return new Response(
        JSON.stringify({ success: false, message: "Missing or invalid app_secret" }),
        { status: 400, headers: allHeaders }
      );
    }

    if (!plan || !PLANS[plan]) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Invalid plan. Valid plans: ${Object.keys(PLANS).join(", ")}`,
          available_plans: Object.entries(PLANS).map(([key, val]) => ({
            key,
            label: val.label,
            duration_seconds: val.seconds,
          })),
        }),
        { status: 400, headers: allHeaders }
      );
    }

    const count = Math.min(Math.max(parseInt(quantity) || 1, 1), 50);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate via app_secret
    const { data: app, error: appErr } = await supabase
      .from("applications")
      .select("id, enabled, owner_id, name")
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

    const selectedPlan = PLANS[plan];

    // Create licenses
    const licensesToInsert = Array.from({ length: count }, () => ({
      application_id: app.id,
      created_by: app.owner_id,
      status: "unused" as const,
      remaining_seconds: selectedPlan.seconds,
      note: note || `${selectedPlan.label} — criada via API/Bot`,
      max_uses: 1,
    }));

    const { data: licenses, error: insertErr } = await supabase
      .from("licenses")
      .insert(licensesToInsert)
      .select("license_key, status, remaining_seconds, note, created_at");

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(
        JSON.stringify({ success: false, message: "Failed to create licenses" }),
        { status: 500, headers: allHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${count} license(s) created successfully`,
        plan: { key: plan, label: selectedPlan.label, duration_seconds: selectedPlan.seconds },
        licenses: licenses?.map((l) => ({
          key: l.license_key,
          status: l.status,
          duration_seconds: l.remaining_seconds,
          note: l.note,
          created_at: l.created_at,
        })),
      }),
      { status: 201, headers: allHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: allHeaders }
    );
  }
});
