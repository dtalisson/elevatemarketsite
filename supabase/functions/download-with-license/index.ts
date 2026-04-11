import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "Content-Disposition, X-File-Name, X-File-Size, X-App-Name, X-File-Version",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { license_key } = body;

    if (!license_key || typeof license_key !== "string" || license_key.length > 64) {
      return new Response(
        JSON.stringify({ success: false, message: "Chave de licença inválida" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the license
    const { data: license, error: licErr } = await supabase
      .from("licenses")
      .select("id, application_id, status, expires_at")
      .eq("license_key", license_key)
      .single();

    if (licErr || !license) {
      return new Response(
        JSON.stringify({ success: false, message: "Licença não encontrada" }),
        { status: 404, headers: jsonHeaders }
      );
    }

    if (license.status === "banned") {
      return new Response(
        JSON.stringify({ success: false, message: "Licença suspensa" }),
        { status: 403, headers: jsonHeaders }
      );
    }

    if (license.status === "expired" || (license.expires_at && new Date(license.expires_at) < new Date())) {
      return new Response(
        JSON.stringify({ success: false, message: "Licença expirada" }),
        { status: 403, headers: jsonHeaders }
      );
    }

    // Get the latest download for this application
    const { data: dl, error: dlErr } = await supabase
      .from("downloads")
      .select("id, file_name, file_path, file_size, version, application_id, applications(name)")
      .eq("application_id", license.application_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (dlErr || !dl) {
      return new Response(
        JSON.stringify({ success: false, message: "Nenhum download disponível para esta aplicação" }),
        { status: 404, headers: jsonHeaders }
      );
    }

    // Download file directly from storage (stream it through the edge function)
    const { data: fileData, error: fileErr } = await supabase.storage
      .from("downloads")
      .download(dl.file_path);

    if (fileErr || !fileData) {
      return new Response(
        JSON.stringify({ success: false, message: "Erro ao obter arquivo" }),
        { status: 500, headers: jsonHeaders }
      );
    }

    const fileName = dl.file_name || "download";

    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(dl.file_size || fileData.size),
        "X-File-Name": fileName,
        "X-File-Size": String(dl.file_size || fileData.size),
        "X-App-Name": (dl as any).applications?.name || "App",
        "X-File-Version": dl.version || "",
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: "Erro interno" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
