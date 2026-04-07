import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const [secRes, authRes] = await Promise.all([
    supabase.from("security_logs").delete().lt("created_at", twoDaysAgo),
    supabase.from("auth_logs").delete().lt("created_at", twoDaysAgo),
  ]);

  return new Response(JSON.stringify({
    security_error: secRes.error?.message || null,
    auth_error: authRes.error?.message || null,
    cleaned_at: new Date().toISOString(),
  }), { headers: { "Content-Type": "application/json" } });
});
