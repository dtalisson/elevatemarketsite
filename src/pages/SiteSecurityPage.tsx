import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Shield, ShieldAlert, ShieldCheck, ShieldX, Globe, Monitor, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdminLog {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  fingerprint: string | null;
  username_attempted: string;
  success: boolean;
  failure_reason: string | null;
  created_at: string;
}

const reasonLabels: Record<string, { label: string; color: string }> = {
  rate_limited: { label: "Rate Limited", color: "text-amber-400" },
  account_locked: { label: "Conta Bloqueada", color: "text-red-400" },
  invalid_credentials: { label: "Credenciais Inválidas", color: "text-red-400" },
  not_admin: { label: "Sem Permissão", color: "text-orange-400" },
};

function parseUserAgent(ua: string | null): { browser: string; os: string } {
  if (!ua) return { browser: "Desconhecido", os: "Desconhecido" };
  let browser = "Outro";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";

  let os = "Outro";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return { browser, os };
}

const SiteSecurityPage = () => {
  const [filter, setFilter] = useState<"all" | "failed" | "success">("all");

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-login-logs", filter],
    queryFn: async () => {
      let query = supabase
        .from("admin_login_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filter === "failed") query = query.eq("success", false);
      if (filter === "success") query = query.eq("success", true);

      const { data, error } = await query;
      if (error) throw error;
      return data as AdminLog[];
    },
  });

  const stats = {
    total: logs.length,
    failed: logs.filter((l) => !l.success).length,
    success: logs.filter((l) => l.success).length,
    uniqueIps: new Set(logs.map((l) => l.ip_address)).size,
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Segurança do Site
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Monitoramento de tentativas de login no painel</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        {[
          { label: "Total", value: stats.total, icon: Shield, color: "text-primary" },
          { label: "Falhas", value: stats.failed, icon: ShieldX, color: "text-red-400" },
          { label: "Sucesso", value: stats.success, icon: ShieldCheck, color: "text-emerald-400" },
          { label: "IPs Únicos", value: stats.uniqueIps, icon: Globe, color: "text-blue-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={cn("h-4 w-4", s.color)} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className={cn("text-2xl font-bold font-mono", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg bg-secondary/50 w-fit">
        {([
          { key: "all", label: "Todos" },
          { key: "failed", label: "Falhas" },
          { key: "success", label: "Sucesso" },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              filter === f.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Logs */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const { browser, os } = parseUserAgent(log.user_agent);
            const reason = log.failure_reason ? reasonLabels[log.failure_reason] : null;

            return (
              <div
                key={log.id}
                className={cn(
                  "rounded-lg border bg-card p-4 transition-colors",
                  log.success ? "border-emerald-500/20" : "border-red-500/20"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                      log.success ? "bg-emerald-500/10" : "bg-red-500/10"
                    )}>
                      {log.success ? (
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <ShieldAlert className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-medium text-foreground">
                          {log.username_attempted}
                        </span>
                        {log.success ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                            LOGIN OK
                          </span>
                        ) : reason ? (
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 font-medium", reason.color)}>
                            {reason.label}
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">
                            FALHA
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Globe className="h-3 w-3" />
                          {log.ip_address || "N/A"}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Monitor className="h-3 w-3" />
                          {browser} · {os}
                        </span>
                        {log.fingerprint && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            FP: {log.fingerprint}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                    <Clock className="h-3 w-3" />
                    {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
};

export default SiteSecurityPage;
