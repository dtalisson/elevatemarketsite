import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

interface SoftwareUser {
  id: string;
  username: string;
  hwid: string | null;
  last_ip: string | null;
  last_login_at: string | null;
  application_id: string;
  created_at: string;
}

interface LoginLog {
  id: string;
  event_type: string;
  username: string | null;
  ip_address: string | null;
  hwid: string | null;
  created_at: string;
  application_id: string;
  success: boolean;
}

interface AppInfo {
  id: string;
  name: string;
  enabled: boolean;
}

const ONLINE_THRESHOLD_MINUTES = 15;

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ users: 0, licenses: 0, active: 0, online: 0 });
  const [softwareUsers, setSoftwareUsers] = useState<SoftwareUser[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [appsMap, setAppsMap] = useState<Record<string, AppInfo>>({});

  const fetchData = async () => {
    if (!user) return;
    const [appsRes, licensesRes, usersRes, logsRes] = await Promise.all([
      supabase.from("applications").select("id, name, enabled"),
      supabase.from("licenses").select("id, status"),
      supabase.from("software_users_safe").select("id, username, hwid, last_ip, last_login_at, application_id, created_at").order("last_login_at", { ascending: false }),
      supabase.from("auth_logs").select("id, event_type, username, ip_address, hwid, created_at, application_id, success")
        .in("event_type", ["login_success", "login_failed", "login_banned", "login_expired", "login_hwid_mismatch"])
        .order("created_at", { ascending: false }).limit(20),
    ]);

    const apps = appsRes.data || [];
    const licenses = licensesRes.data || [];
    const users = usersRes.data || [] as SoftwareUser[];

    const m: Record<string, AppInfo> = {};
    apps.forEach((a) => (m[a.id] = a));
    setAppsMap(m);

    const now = new Date();
    const onlineCount = users.filter((u) => u.last_login_at && (now.getTime() - new Date(u.last_login_at).getTime()) / 60000 <= ONLINE_THRESHOLD_MINUTES).length;

    setStats({
      users: users.length,
      licenses: licenses.length,
      active: licenses.filter((l) => l.status === "active").length,
      online: onlineCount,
    });

    setSoftwareUsers(users as SoftwareUser[]);
    if (logsRes.data) setLoginLogs(logsRes.data as LoginLog[]);
  };

  useEffect(() => { fetchData(); }, [user]);
  useEffect(() => { const i = setInterval(fetchData, 30000); return () => clearInterval(i); }, [user]);

  const now = new Date();
  const isOnline = (lastLogin: string | null) => lastLogin ? (now.getTime() - new Date(lastLogin).getTime()) / 60000 <= ONLINE_THRESHOLD_MINUTES : false;

  const timeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const sessionDuration = (lastLogin: string | null, created: string) => {
    if (!lastLogin) return "—";
    const start = new Date(created).getTime();
    const last = new Date(lastLogin).getTime();
    const diff = Math.max(0, last - start);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "<1min";
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ${mins % 60}min`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  };

  const cards = [
    { title: "Online Agora", value: stats.online, highlight: true },
    { title: "Total Usuários", value: stats.users },
    { title: "Licenças Ativas", value: stats.active },
    { title: "Total Licenças", value: stats.licenses },
  ];

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral em tempo real</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {cards.map((card) => (
          <div key={card.title} className={`rounded-lg border p-5 ${card.highlight ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
            <p className="text-xs text-muted-foreground mb-2">{card.title}</p>
            <p className={`text-3xl font-heading font-bold ${card.highlight ? "text-primary" : "text-foreground"}`}>{card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Usuários ativos */}
        <div className="rounded-lg border border-border bg-card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-heading font-semibold text-foreground">Sessões de Usuários</h2>
            <span className="text-[10px] text-muted-foreground">Atualiza a cada 30s</span>
          </div>
          {softwareUsers.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhum usuário registrado</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {softwareUsers.slice(0, 15).map((u) => {
                const online = isOnline(u.last_login_at);
                const app = appsMap[u.application_id];
                return (
                  <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center text-[10px] font-bold text-foreground">
                        {u.username[0].toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-card ${online ? "bg-primary" : "bg-muted-foreground/40"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{u.username}</span>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border-0 ${online ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {online ? "online" : "offline"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {app && <span className="text-[10px] text-muted-foreground">{app.name}</span>}
                        {u.last_ip && <span className="text-[10px] font-mono text-muted-foreground/60">{u.last_ip}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-muted-foreground">{u.last_login_at ? timeAgo(u.last_login_at) : "—"}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sessionDuration(u.last_login_at, u.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Login history */}
        <div className="rounded-lg border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-heading font-semibold text-foreground">Logins Recentes</h2>
          </div>
          {loginLogs.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhum login registrado</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {loginLogs.map((log) => {
                const app = appsMap[log.application_id];
                return (
                  <div key={log.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{log.username || "—"}</span>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border-0 ${log.success ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                          {log.success ? "ok" : "falhou"}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(log.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {app && <span className="text-[10px] text-muted-foreground">{app.name}</span>}
                      {log.ip_address && <span className="text-[10px] font-mono text-muted-foreground/50">{log.ip_address}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
