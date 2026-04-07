import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Globe, Monitor, Clock, Circle } from "lucide-react";

interface OnlineUser { id: string; username: string; hwid: string | null; last_ip: string | null; last_login_at: string | null; application_id: string; }
interface AppInfo { id: string; name: string; }

const ONLINE_THRESHOLD_MINUTES = 15;

const OnlinePage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [apps, setApps] = useState<Record<string, AppInfo>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [usersRes, appsRes] = await Promise.all([
      supabase.from("software_users").select("id, username, hwid, last_ip, last_login_at, application_id").order("last_login_at", { ascending: false }),
      supabase.from("applications").select("id, name").eq("owner_id", user.id),
    ]);
    if (appsRes.data) { const m: Record<string, AppInfo> = {}; appsRes.data.forEach((a) => (m[a.id] = a)); setApps(m); }
    if (usersRes.data) setUsers(usersRes.data as OnlineUser[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);
  useEffect(() => { const interval = setInterval(fetchData, 30000); return () => clearInterval(interval); }, [user]);
  useEffect(() => {
    const channel = supabase.channel("online_users_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "auth_logs" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const now = new Date();
  const isOnline = (lastLogin: string | null) => lastLogin ? (now.getTime() - new Date(lastLogin).getTime()) / 60000 <= ONLINE_THRESHOLD_MINUTES : false;
  const timeAgo = (date: string) => {
    const mins = Math.floor((now.getTime() - new Date(date).getTime()) / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const onlineUsers = users.filter((u) => isOnline(u.last_login_at));
  const offlineUsers = users.filter((u) => !isOnline(u.last_login_at) && u.last_login_at);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Online</h1>
          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${onlineUsers.length > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            <Circle className="h-1.5 w-1.5 fill-current" />
            {onlineUsers.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Últimos {ONLINE_THRESHOLD_MINUTES} minutos</p>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg border border-border bg-card animate-pulse" />)}</div>
      ) : (
        <div className="space-y-6">
          {onlineUsers.length > 0 ? (
            <div className="space-y-1.5">
              {onlineUsers.map((u) => {
                const app = apps[u.application_id];
                return (
                  <div key={u.id} className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {u.username[0].toUpperCase()}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-card" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{u.username}</span>
                        {app && <span className="text-[10px] text-muted-foreground">· {app.name}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {u.last_ip && <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{u.last_ip}</span>}
                        {u.hwid && <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1"><Monitor className="h-2.5 w-2.5" />{u.hwid.substring(0, 12)}...</span>}
                      </div>
                    </div>
                    <span className="text-[11px] text-primary flex items-center gap-1"><Clock className="h-3 w-3" />{u.last_login_at && timeAgo(u.last_login_at)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-16">
              <p className="font-heading font-medium text-muted-foreground">Nenhum usuário online</p>
              <p className="text-xs mt-1 text-muted-foreground/60">Aparecerão aqui quando fizerem login</p>
            </div>
          )}

          {offlineUsers.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-medium mb-2 text-muted-foreground/60">Offline</p>
              <div className="space-y-1">
                {offlineUsers.slice(0, 20).map((u) => {
                  const app = apps[u.application_id];
                  return (
                    <div key={u.id} className="flex items-center gap-3 rounded-md px-4 py-2.5 bg-muted/30 border border-border/50">
                      <span className="text-xs font-medium text-muted-foreground">{u.username}</span>
                      {app && <span className="text-[10px] text-muted-foreground/50">· {app.name}</span>}
                      <span className="ml-auto text-[10px] text-muted-foreground/50">{u.last_login_at && timeAgo(u.last_login_at)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
};

export default OnlinePage;
