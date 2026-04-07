import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

interface AuthLog {
  id: string;
  event_type: string;
  username: string | null;
  details: string | null;
  created_at: string;
  application_id: string;
}

interface AppStats {
  id: string;
  name: string;
  enabled: boolean;
  userCount: number;
  licenseCount: number;
}

const eventLabels: Record<string, string> = {
  login_success: "Login realizado",
  login_failed: "Login falhou",
  login_banned: "Login banido",
  login_expired: "Login expirado",
  login_hwid_mismatch: "HWID diferente",
  register_success: "Usuário registrado",
  register_failed: "Registro falhou",
  validate_success: "Licença validada",
  validate_failed: "Validação falhou",
  validate_banned: "Validação banida",
  validate_expired: "Validação expirada",
  validate_hwid_mismatch: "HWID diferente",
};

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ users: 0, licenses: 0, active: 0, apps: 0 });
  const [recentLogs, setRecentLogs] = useState<AuthLog[]>([]);
  const [appStats, setAppStats] = useState<AppStats[]>([]);
  const [appsMap, setAppsMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [appsRes, licensesRes, usersRes, logsRes] = await Promise.all([
        supabase.from("applications").select("id, name, enabled"),
        supabase.from("licenses").select("id, status, application_id"),
        supabase.from("software_users").select("id, application_id"),
        supabase.from("auth_logs").select("id, event_type, username, details, created_at, application_id").order("created_at", { ascending: false }).limit(10),
      ]);

      const apps = appsRes.data || [];
      const licenses = licensesRes.data || [];
      const users = usersRes.data || [];

      const m: Record<string, string> = {};
      apps.forEach((a) => (m[a.id] = a.name));
      setAppsMap(m);

      setStats({
        users: users.length,
        licenses: licenses.length,
        active: licenses.filter((l) => l.status === "active").length,
        apps: apps.length,
      });

      setAppStats(
        apps.map((app) => ({
          id: app.id,
          name: app.name,
          enabled: app.enabled,
          userCount: users.filter((u) => u.application_id === app.id).length,
          licenseCount: licenses.filter((l) => l.application_id === app.id).length,
        }))
      );

      if (logsRes.data) setRecentLogs(logsRes.data as AuthLog[]);
    };
    fetch();
  }, [user]);

  const timeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const cards = [
    { title: "Total Usuários", value: stats.users },
    { title: "Licenças Ativas", value: stats.active },
    { title: "Aplicações", value: stats.apps },
    { title: "Total Licenças", value: stats.licenses },
  ];

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral das suas aplicações</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {cards.map((card) => (
          <div key={card.title} className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-2">{card.title}</p>
            <p className="text-3xl font-heading font-bold text-foreground">{card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Recent Activity */}
        <div className="rounded-lg border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-heading font-semibold text-foreground">Atividade Recente</h2>
          </div>
          {recentLogs.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentLogs.map((log) => (
                <div key={log.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground font-medium">
                      {eventLabels[log.event_type] || log.event_type}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {log.username || log.details || "—"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-xs text-primary font-medium">{appsMap[log.application_id] || "—"}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Apps Summary */}
        <div className="rounded-lg border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-heading font-semibold text-foreground">Suas Aplicações</h2>
          </div>
          {appStats.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma aplicação</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {appStats.map((app) => (
                <div key={app.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground">{app.name}</span>
                    <Badge className={`text-[10px] ${app.enabled ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                      {app.enabled ? "Active" : "Off"}
                    </Badge>
                  </div>
                  <div className="flex gap-8">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Usuários</p>
                      <p className="text-sm font-heading font-bold text-foreground">{app.userCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Licenças</p>
                      <p className="text-sm font-heading font-bold text-foreground">{app.licenseCount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
