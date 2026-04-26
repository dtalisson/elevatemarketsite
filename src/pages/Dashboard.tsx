import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Users, Key, Wifi, ScrollText, Activity, ArrowRight } from "lucide-react";

interface SoftwareUser {
  id: string;
  username: string;
  last_login_at: string | null;
  application_id: string;
  created_at: string;
}

interface AuthLog {
  id: string;
  event_type: string;
  username: string | null;
  created_at: string;
  success: boolean;
}

interface AppInfo {
  id: string;
  name: string;
  enabled: boolean;
  current_version: string | null;
}

const ONLINE_THRESHOLD_MINUTES = 15;

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ users: 0, licenses: 0, active: 0, online: 0 });
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [recentUsers, setRecentUsers] = useState<SoftwareUser[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuthLog[]>([]);

  const fetchData = async () => {
    if (!user) return;
    const [appsRes, licensesRes, usersRes, logsRes] = await Promise.all([
      supabase.from("applications").select("id, name, enabled, current_version"),
      supabase.from("licenses").select("id, status"),
      supabase.from("software_users_safe")
        .select("id, username, last_login_at, application_id, created_at")
        .order("last_login_at", { ascending: false }),
      supabase.from("auth_logs")
        .select("id, event_type, username, created_at, success")
        .order("created_at", { ascending: false }).limit(8),
    ]);

    const appsData = (appsRes.data || []) as AppInfo[];
    const licenses = licensesRes.data || [];
    const users = (usersRes.data || []) as SoftwareUser[];

    const now = new Date();
    const onlineCount = users.filter((u) =>
      u.last_login_at && (now.getTime() - new Date(u.last_login_at).getTime()) / 60000 <= ONLINE_THRESHOLD_MINUTES
    ).length;

    setApps(appsData);
    setStats({
      users: users.length,
      licenses: licenses.length,
      active: licenses.filter((l) => l.status === "active").length,
      online: onlineCount,
    });
    setRecentUsers(users.slice(0, 5));
    setRecentLogs((logsRes.data || []) as AuthLog[]);
  };

  useEffect(() => { fetchData(); }, [user]);
  useEffect(() => { const i = setInterval(fetchData, 30000); return () => clearInterval(i); }, [user]);

  const timeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const cards = [
    { title: "TOTAL USERS", value: stats.users, Icon: Users },
    { title: "ACTIVE LICENSES", value: stats.active, Icon: Key },
    { title: "ONLINE NOW", value: stats.online, Icon: Wifi, accent: true },
    { title: "TOTAL LICENSES", value: stats.licenses, Icon: Activity },
  ];

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-foreground tracking-tight">Admin Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">At-a-glance platform health and recent activity.</p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-border/60 bg-card/40 px-6 py-7 flex items-center gap-5"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.accent ? "bg-primary/15" : "bg-muted/60"}`}>
              <card.Icon className={`h-5 w-5 ${card.accent ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="min-w-0">
              <p className="text-3xl font-heading font-bold text-foreground leading-none">{card.value.toLocaleString()}</p>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/70 mt-2">{card.title}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Applications status */}
        <div className="rounded-2xl border border-border/60 bg-card/40">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-heading font-semibold text-foreground">Applications status</h2>
            </div>
            <Link to="/dashboard/applications" className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {apps.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">Nenhuma aplicação cadastrada</div>
          ) : (
            <div className="divide-y divide-border/60">
              {apps.map((app) => (
                <div key={app.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{app.name}</p>
                    {app.current_version && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 font-mono">v{app.current_version}</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold tracking-[0.1em] px-2.5 py-1 rounded-md ${
                    app.enabled
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-destructive"
                  }`}>
                    {app.enabled ? "OPERATIONAL" : "MAJOR OUTAGE"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl border border-border/60 bg-card/40">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-heading font-semibold text-foreground">Recent activity</h2>
            </div>
            <Link to="/dashboard/logs" className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
              Audit log <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentLogs.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">Nenhuma atividade registrada</div>
          ) : (
            <div className="divide-y divide-border/60">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${log.success ? "bg-primary" : "bg-destructive"}`} />
                    <span className="text-[11px] font-mono text-foreground/90 bg-muted/40 px-2 py-0.5 rounded">{log.event_type}</span>
                    {log.username && (
                      <span className="text-xs text-muted-foreground truncate">{log.username}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground/70">{timeAgo(log.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Newest users */}
      <div className="mt-5 rounded-2xl border border-border/60 bg-card/40">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-heading font-semibold text-foreground">Newest users</h2>
          </div>
          <Link to="/dashboard/users" className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
            All users <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recentUsers.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Nenhum usuário registrado</div>
        ) : (
          <div className="divide-y divide-border/60">
            {recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-[11px] font-bold text-primary">
                    {u.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.username}</p>
                    <p className="text-[11px] text-muted-foreground/70">
                      Criado em {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground/70">
                  {u.last_login_at ? timeAgo(u.last_login_at) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
