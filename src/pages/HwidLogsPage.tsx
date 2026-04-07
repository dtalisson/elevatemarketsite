import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Search, Clock, Globe, Monitor, User, AlertTriangle } from "lucide-react";

interface AuthLog {
  id: string;
  application_id: string;
  license_id: string | null;
  event_type: string;
  username: string | null;
  ip_address: string | null;
  hwid: string | null;
  success: boolean;
  details: string | null;
  created_at: string;
}

interface AppInfo {
  id: string;
  name: string;
}

const HwidLogsPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState("all");

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const [appsRes] = await Promise.all([
      supabase.from("applications").select("id, name").eq("owner_id", user.id),
    ]);

    const appsList = appsRes.data || [];
    setApps(appsList);

    let query = supabase
      .from("auth_logs")
      .select("*")
      .in("event_type", ["login_hwid_mismatch", "validate_hwid_mismatch"])
      .order("created_at", { ascending: false })
      .limit(500);

    if (selectedApp !== "all") {
      query = query.eq("application_id", selectedApp);
    }

    const logsRes = await query;
    if (logsRes.data) setLogs(logsRes.data as AuthLog[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user, selectedApp]);

  useEffect(() => {
    const channel = supabase
      .channel("hwid_logs_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "auth_logs" }, (payload) => {
        const newLog = payload.new as AuthLog;
        if (newLog.event_type === "login_hwid_mismatch" || newLog.event_type === "validate_hwid_mismatch") {
          if (selectedApp === "all" || newLog.application_id === selectedApp) {
            setLogs((prev) => [newLog, ...prev].slice(0, 500));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedApp]);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const appsMap: Record<string, AppInfo> = {};
  apps.forEach((a) => (appsMap[a.id] = a));

  const filtered = logs.filter((log) => {
    if (search && !log.username?.toLowerCase().includes(search.toLowerCase()) && !log.ip_address?.includes(search) && !log.hwid?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="mb-6 animate-fade-in-up">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-5 w-5 text-orange-400" />
          <h1 className="text-2xl font-bold text-foreground">HWID Logs</h1>
        </div>
        <p className="text-sm text-muted-foreground">Tentativas de acesso com HWID diferente do registrado</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por username, IP ou HWID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card/50 border-border/50" />
        </div>
        <Select value={selectedApp} onValueChange={setSelectedApp}>
          <SelectTrigger className="w-48 bg-card/50 border-border/50">
            <SelectValue placeholder="Todas as aplicações" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as aplicações</SelectItem>
            {apps.map((app) => (
              <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="glass border-border/30 animate-pulse"><CardContent className="p-3 h-14" /></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="glass border-border/30 animate-fade-in-up">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-2xl bg-orange-500/10 mb-4"><ShieldAlert className="h-10 w-10 text-orange-400" /></div>
            <p className="text-muted-foreground font-medium">Nenhuma tentativa de HWID diferente</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Os logs aparecerão em tempo real quando alguém tentar usar uma key em outro dispositivo</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((log, index) => {
            const app = appsMap[log.application_id];
            return (
              <Card
                key={log.id}
                className="glass border-orange-500/20 hover:border-orange-500/40 transition-all duration-200 animate-fade-in-up"
                style={{ animationDelay: `${Math.min(0.02 * (index + 1), 0.5)}s` }}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center bg-orange-500/10">
                      <AlertTriangle className="h-4 w-4 text-orange-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]">
                          HWID Mismatch
                        </Badge>
                        {log.username && (
                          <span className="flex items-center gap-1 text-xs text-foreground font-medium">
                            <User className="h-3 w-3 text-muted-foreground" />{log.username}
                          </span>
                        )}
                        {app && <span className="text-[10px] text-muted-foreground">· {app.name}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {log.details && <span className="text-[11px] text-muted-foreground/80">{log.details}</span>}
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />{formatDate(log.created_at)}
                      </span>
                      <div className="flex items-center gap-2">
                        {log.ip_address && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                            <Globe className="h-2.5 w-2.5" />{log.ip_address}
                          </span>
                        )}
                        {log.hwid && (
                          <span className="flex items-center gap-1 text-[10px] text-orange-400/80 font-mono font-bold">
                            <Monitor className="h-2.5 w-2.5" />{log.hwid.substring(0, 16)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
};

export default HwidLogsPage;
