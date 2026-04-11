import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const allHeaders = { ...corsHeaders, "Content-Type": "application/json" };

async function verifyToken(token: string, secret: string): Promise<{ sub: string } | null> {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;
    const payloadBytes = Uint8Array.from(atob(payloadB64), c => c.charCodeAt(0));
    const payloadStr = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadStr);
    if (payload.exp < Date.now()) return null;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payloadStr));
    if (!valid) return null;
    return { sub: payload.sub };
  } catch { return null; }
}

const PLANS: Record<string, { label: string; seconds: number }> = {
  "1day": { label: "1 Dia", seconds: 86400 },
  "trial": { label: "Trial (3 Dias)", seconds: 259200 },
  "weekly": { label: "Semanal (7 Dias)", seconds: 604800 },
  "monthly": { label: "Mensal (30 Dias)", seconds: 2592000 },
  "lifetime": { label: "Lifetime (999 Dias)", seconds: 86313600 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Auth check
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const decoded = await verifyToken(token, serviceKey);
  if (!decoded) {
    return new Response(JSON.stringify({ success: false, message: "Não autorizado" }), { status: 401, headers: allHeaders });
  }

  // Get panel user & check active/expired
  const { data: panelUser } = await supabase.from("panel_users").select("*").eq("id", decoded.sub).single();
  if (!panelUser || !panelUser.is_active || new Date(panelUser.expires_at) < new Date()) {
    return new Response(JSON.stringify({ success: false, message: "Acesso expirado ou desativado" }), { status: 403, headers: allHeaders });
  }

  // Get allowed app IDs
  const { data: appLinks } = await supabase.from("panel_user_applications").select("application_id").eq("panel_user_id", panelUser.id);
  const allowedApps = new Set(appLinks?.map(a => a.application_id) || []);

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "create-license": {
        const { application_id, plan, quantity, note } = body;
        if (!application_id || !allowedApps.has(application_id)) {
          return new Response(JSON.stringify({ success: false, message: "Aplicação não autorizada" }), { status: 403, headers: allHeaders });
        }
        if (!plan || !PLANS[plan]) {
          return new Response(JSON.stringify({ success: false, message: "Plano inválido" }), { status: 400, headers: allHeaders });
        }
        const count = Math.min(Math.max(parseInt(quantity) || 1, 1), 50);
        const selectedPlan = PLANS[plan];

        // Get app owner_id for created_by
        const { data: app } = await supabase.from("applications").select("owner_id").eq("id", application_id).single();
        if (!app) {
          return new Response(JSON.stringify({ success: false, message: "Aplicação não encontrada" }), { status: 404, headers: allHeaders });
        }

        const licensesToInsert = Array.from({ length: count }, () => ({
          application_id,
          created_by: app.owner_id,
          panel_user_id: panelUser.id,
          status: "unused" as const,
          remaining_seconds: selectedPlan.seconds,
          note: note || `${selectedPlan.label} — criada por ${panelUser.username}`,
          max_uses: 1,
        }));

        const { data: licenses, error } = await supabase.from("licenses").insert(licensesToInsert).select("license_key, status, remaining_seconds, note, created_at");
        if (error) {
          console.error("Insert error:", error);
          return new Response(JSON.stringify({ success: false, message: "Erro ao criar licenças" }), { status: 500, headers: allHeaders });
        }

        return new Response(JSON.stringify({
          success: true,
          message: `${count} licença(s) criada(s)`,
          licenses: licenses?.map(l => ({ key: l.license_key, status: l.status, duration_seconds: l.remaining_seconds, note: l.note })),
        }), { status: 201, headers: allHeaders });
      }

      case "list-licenses": {
        const { application_id } = body;
        if (application_id && !allowedApps.has(application_id)) {
          return new Response(JSON.stringify({ success: false, message: "Aplicação não autorizada" }), { status: 403, headers: allHeaders });
        }
        const query = supabase.from("licenses").select("*").eq("panel_user_id", panelUser.id).order("created_at", { ascending: false });
        if (application_id) query.eq("application_id", application_id);
        const { data } = await query;
        return new Response(JSON.stringify({ success: true, licenses: data || [] }), { headers: allHeaders });
      }

      case "list-users": {
        const { application_id } = body;
        if (application_id && !allowedApps.has(application_id)) {
          return new Response(JSON.stringify({ success: false, message: "Aplicação não autorizada" }), { status: 403, headers: allHeaders });
        }
        // Only show users whose licenses were created by this panel user
        const { data: myLicenses } = await supabase.from("licenses").select("id").eq("panel_user_id", panelUser.id);
        const licIds = myLicenses?.map(l => l.id) || [];
        if (licIds.length === 0) {
          return new Response(JSON.stringify({ success: true, users: [] }), { headers: allHeaders });
        }
        const { data: users } = await supabase.from("software_users").select("id, username, hwid, ip_address, last_login_at, created_at, application_id, license_id").in("license_id", licIds);
        return new Response(JSON.stringify({ success: true, users: users || [] }), { headers: allHeaders });
      }

      case "delete-user": {
        const { user_id } = body;
        if (!user_id) return new Response(JSON.stringify({ success: false, message: "user_id obrigatório" }), { status: 400, headers: allHeaders });
        // Verify user belongs to a license this panel user created
        const { data: su } = await supabase.from("software_users").select("id, license_id").eq("id", user_id).single();
        if (!su) return new Response(JSON.stringify({ success: false, message: "Usuário não encontrado" }), { status: 404, headers: allHeaders });
        const { data: lic } = await supabase.from("licenses").select("panel_user_id").eq("id", su.license_id).single();
        if (!lic || lic.panel_user_id !== panelUser.id) {
          return new Response(JSON.stringify({ success: false, message: "Sem permissão" }), { status: 403, headers: allHeaders });
        }
        await supabase.from("software_users").delete().eq("id", user_id);
        return new Response(JSON.stringify({ success: true, message: "Usuário deletado" }), { headers: allHeaders });
      }

      case "reset-hwid": {
        const { user_id } = body;
        if (!user_id) return new Response(JSON.stringify({ success: false, message: "user_id obrigatório" }), { status: 400, headers: allHeaders });
        const { data: su } = await supabase.from("software_users").select("id, license_id").eq("id", user_id).single();
        if (!su) return new Response(JSON.stringify({ success: false, message: "Usuário não encontrado" }), { status: 404, headers: allHeaders });
        const { data: lic } = await supabase.from("licenses").select("panel_user_id").eq("id", su.license_id).single();
        if (!lic || lic.panel_user_id !== panelUser.id) {
          return new Response(JSON.stringify({ success: false, message: "Sem permissão" }), { status: 403, headers: allHeaders });
        }
        await supabase.from("software_users").update({ hwid: null }).eq("id", user_id);
        await supabase.from("licenses").update({ hwid: null }).eq("id", su.license_id);
        return new Response(JSON.stringify({ success: true, message: "HWID resetado" }), { headers: allHeaders });
      }

      case "get-apps": {
        const appIds = Array.from(allowedApps);
        if (appIds.length === 0) return new Response(JSON.stringify({ success: true, apps: [] }), { headers: allHeaders });
        const { data: apps } = await supabase.from("applications").select("id, name").in("id", appIds);
        return new Response(JSON.stringify({ success: true, apps: apps || [] }), { headers: allHeaders });
      }

      default:
        return new Response(JSON.stringify({ success: false, message: "Ação inválida" }), { status: 400, headers: allHeaders });
    }
  } catch {
    return new Response(JSON.stringify({ success: false, message: "Erro interno" }), { status: 500, headers: allHeaders });
  }
});
