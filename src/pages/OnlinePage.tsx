import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Wifi, WifiOff, Globe, Monitor, Clock, User, Circle } from "lucide-react";

interface OnlineUser {
  id: string;
  username: string;
  hwid: string | null;
  last_ip: string | null;
  last_login_at: string | null;
  application_id: string;
}

interface AppInfo {
  id: string;
  name: string;
}

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

    if (appsRes.data) {
      const m: Record<string, AppInfo> = {};
      appsRes.data.forEach((a) => (m[a.id] = a));
      setApps(m);
    }
    if (usersRes.data) setUsers(usersRes.data as OnlineUser[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Realtime: listen for login events to refresh
  useEffect(() => {
    const channel = supabase
      .channel("online_users_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "auth_logs" }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const now = new Date();

  const isOnline = (lastLogin: string | null) => {
    if (!lastLogin) return false;
    const diff = (now.getTime() - new Date(lastLogin).getTime()) / 60000;
    return diff <= ONLINE_THRESHOLD_MINUTES;
  };

  const timeAgo = (date: string) => {
    const mins = Math.floor((now.getTime() - new Date(date).getTime()) / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  };

  const onlineUsers = users.filter((u) => isOnline(u.last_login_at));
  const offlineUsers = users.filter((u) => !isOnline(u.last_login_at) && u.last_login_at);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-foreground">Online</h1>
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
            style={{
              background: onlineUsers.length > 0 ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.03)",
              color: onlineUsers.length > 0 ? "hsl(142 60% 55%)" : "hsl(210 12% 38%)",
              border: `1px solid ${onlineUsers.length > 0 ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)"}`,
            }}
          >
            <Circle className="h-2 w-2 fill-current" />
            {onlineUsers.length} online
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Usuários ativos nos últimos {ONLINE_THRESHOLD_MINUTES} minutos</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Online users */}
          {onlineUsers.length > 0 ? (
            <div className="space-y-1.5">
              {onlineUsers.map((u, i) => {
                const app = apps[u.application_id];
                return (
                  <Card
                    key={u.id}
                    className="hover:border-[rgba(255,255,255,0.08)] transition-all duration-200"
                    style={{ animationDelay: `${0.03 * i}s` }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {/* Online indicator */}
                        <div className="relative flex-shrink-0">
                          <div
                            className="h-9 w-9 rounded-lg flex items-center justify-center"
                            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.12)" }}
                          >
                            <User className="h-4 w-4" style={{ color: "hsl(142 50% 50%)" }} />
                          </div>
                          <div
                            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full"
                            style={{ background: "hsl(142 60% 45%)", border: "2px solid #050508", boxShadow: "0 0 6px rgba(34,197,94,0.4)" }}
                          />
                        </div>

                        {/* User info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: "hsl(210 20% 85%)" }}>{u.username}</span>
                            {app && <span className="text-[10px]" style={{ color: "hsl(210 12% 35%)" }}>· {app.name}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {u.last_ip && (
                              <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: "hsl(210 12% 35%)" }}>
                                <Globe className="h-2.5 w-2.5" />{u.last_ip}
                              </span>
                            )}
                            {u.hwid && (
                              <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: "hsl(210 12% 35%)" }}>
                                <Monitor className="h-2.5 w-2.5" />{u.hwid.substring(0, 12)}...
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Time */}
                        <div className="flex items-center gap-1 text-[11px]" style={{ color: "hsl(142 40% 45%)" }}>
                          <Clock className="h-3 w-3" />
                          {u.last_login_at && timeAgo(u.last_login_at)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <WifiOff className="h-10 w-10" style={{ color: "hsl(210 12% 25%)" }} />
                </div>
                <p className="font-medium" style={{ color: "hsl(210 15% 45%)" }}>Nenhum usuário online</p>
                <p className="text-xs mt-1" style={{ color: "hsl(210 10% 28%)" }}>Aparecerão aqui quando fizerem login</p>
              </CardContent>
            </Card>
          )}

          {/* Recently offline */}
          {offlineUsers.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] font-medium mb-3" style={{ color: "hsl(210 10% 28%)" }}>
                Offline — último login registrado
              </p>
              <div className="space-y-1">
                {offlineUsers.slice(0, 20).map((u) => {
                  const app = apps[u.application_id];
                  return (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all"
                      style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.02)" }}
                    >
                      <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                        <User className="h-3.5 w-3.5" style={{ color: "hsl(210 10% 25%)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] font-medium" style={{ color: "hsl(210 15% 50%)" }}>{u.username}</span>
                        {app && <span className="text-[10px] ml-2" style={{ color: "hsl(210 10% 25%)" }}>· {app.name}</span>}
                      </div>
                      {u.last_ip && (
                        <span className="text-[10px] font-mono" style={{ color: "hsl(210 10% 25%)" }}>{u.last_ip}</span>
                      )}
                      <span className="text-[10px]" style={{ color: "hsl(210 10% 25%)" }}>
                        {u.last_login_at && timeAgo(u.last_login_at)}
                      </span>
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
