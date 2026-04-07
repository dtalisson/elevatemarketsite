import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldX, Search, Clock, Globe, Monitor, User, Bug, Cpu, AlertTriangle, Zap } from "lucide-react";

interface SecurityLog {
  id: string;
  application_id: string;
  username: string | null;
  hwid: string | null;
  event_type: string;
  details: string | null;
  client_timestamp: number | null;
  ip_address: string | null;
  created_at: string;
}

interface AppInfo {
  id: string;
  name: string;
}

const eventConfig: Record<string, { label: string; icon: typeof Bug; color: string }> = {
  DEBUGGER_DETECTED: { label: "Debugger Detectado", icon: Bug, color: "bg-red-500/20 text-red-400 border-red-500/30" },
  DUMP_TOOL_DETECTED: { label: "Dump Tool", icon: Cpu, color: "bg-red-500/20 text-red-400 border-red-500/30" },
  HWID_ABUSE: { label: "HWID Abuse", icon: AlertTriangle, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  SESSION_INVALIDATED: { label: "Sessão Invalidada", icon: Zap, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  INTEGRITY_VIOLATION: { label: "Integridade Violada", icon: ShieldX, color: "bg-red-500/20 text-red-400 border-red-500/30" },
  MEMORY_TAMPERING: { label: "Memória Adulterada", icon: Cpu, color: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const SecurityLogsPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState("all");
  const [filterEvent, setFilterEvent] = useState("all");

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const appsRes = await supabase.from("applications").select("id, name").eq("owner_id", user.id);
    setApps(appsRes.data || []);

    let query = supabase
      .from("security_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (selectedApp !== "all") {
      query = query.eq("application_id", selectedApp);
    }
    if (filterEvent !== "all") {
      query = query.eq("event_type", filterEvent);
    }

    const logsRes = await query;
    if (logsRes.data) setLogs(logsRes.data as SecurityLog[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user, selectedApp, filterEvent]);

  useEffect(() => {
    const channel = supabase
      .channel("security_logs_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "security_logs" }, (payload) => {
        const newLog = payload.new as SecurityLog;
        if (selectedApp === "all" || newLog.application_id === selectedApp) {
          if (filterEvent === "all" || newLog.event_type === filterEvent) {
            setLogs((prev) => [newLog, ...prev].slice(0, 500));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedApp, filterEvent]);

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
          <ShieldX className="h-5 w-5 text-red-400" />
          <h1 className="text-2xl font-bold text-foreground">Alertas de Segurança</h1>
        </div>
        <p className="text-sm text-muted-foreground">Tentativas de crack, debug e invasão detectadas pelo loader</p>
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
        <Select value={filterEvent} onValueChange={setFilterEvent}>
          <SelectTrigger className="w-48 bg-card/50 border-border/50">
            <SelectValue placeholder="Todos os eventos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos</SelectItem>
            {Object.entries(eventConfig).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
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
            <div className="p-4 rounded-2xl bg-red-500/10 mb-4"><ShieldX className="h-10 w-10 text-red-400" /></div>
            <p className="text-muted-foreground font-medium">Nenhum alerta de segurança</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Os alertas aparecerão em tempo real quando o loader detectar ameaças</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((log, index) => {
            const cfg = eventConfig[log.event_type] || { label: log.event_type, icon: AlertTriangle, color: "bg-muted text-muted-foreground border-border" };
            const IconComponent = cfg.icon;
            const app = appsMap[log.application_id];
            return (
              <Card
                key={log.id}
                className="glass border-red-500/20 hover:border-red-500/40 transition-all duration-200 animate-fade-in-up"
                style={{ animationDelay: `${Math.min(0.02 * (index + 1), 0.5)}s` }}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center bg-red-500/10">
                      <IconComponent className="h-4 w-4 text-red-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`${cfg.color} text-[10px]`}>
                          {cfg.label}
                        </Badge>
                        {log.username && (
                          <span className="flex items-center gap-1 text-xs text-foreground font-medium">
                            <User className="h-3 w-3 text-muted-foreground" />{log.username}
                          </span>
                        )}
                        {app && <span className="text-[10px] text-muted-foreground">· {app.name}</span>}
                      </div>
                      {log.details && (
                        <div className="mt-1">
                          <span className="text-[11px] text-muted-foreground/80">{log.details}</span>
                        </div>
                      )}
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
                          <span className="flex items-center gap-1 text-[10px] text-red-400/80 font-mono font-bold">
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

export default SecurityLogsPage;
