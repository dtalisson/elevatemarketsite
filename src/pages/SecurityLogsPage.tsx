import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Clock, Globe, Monitor, User, Bug, Cpu, AlertTriangle, Zap, ShieldX } from "lucide-react";

interface SecurityLog { id: string; application_id: string; username: string | null; hwid: string | null; event_type: string; details: string | null; client_timestamp: number | null; ip_address: string | null; created_at: string; }
interface AppInfo { id: string; name: string; }

const eventConfig: Record<string, { label: string; icon: typeof Bug; color: string }> = {
  DEBUGGER_DETECTED: { label: "Debugger", icon: Bug, color: "bg-destructive/10 text-destructive" },
  DUMP_TOOL_DETECTED: { label: "Dump Tool", icon: Cpu, color: "bg-destructive/10 text-destructive" },
  HWID_ABUSE: { label: "HWID Abuse", icon: AlertTriangle, color: "bg-warning/10 text-warning" },
  SESSION_INVALIDATED: { label: "Sessão Inv.", icon: Zap, color: "bg-warning/10 text-warning" },
  INTEGRITY_VIOLATION: { label: "Integridade", icon: ShieldX, color: "bg-destructive/10 text-destructive" },
  MEMORY_TAMPERING: { label: "Memória", icon: Cpu, color: "bg-destructive/10 text-destructive" },
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
    let query = supabase.from("security_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (selectedApp !== "all") query = query.eq("application_id", selectedApp);
    if (filterEvent !== "all") query = query.eq("event_type", filterEvent);
    const logsRes = await query;
    if (logsRes.data) setLogs(logsRes.data as SecurityLog[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user, selectedApp, filterEvent]);

  useEffect(() => {
    const channel = supabase.channel("security_logs_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "security_logs" }, (payload) => {
        const newLog = payload.new as SecurityLog;
        if (selectedApp === "all" || newLog.application_id === selectedApp) {
          if (filterEvent === "all" || newLog.event_type === filterEvent) setLogs((prev) => [newLog, ...prev].slice(0, 500));
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedApp, filterEvent]);

  const formatDate = (date: string) => new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const appsMap: Record<string, AppInfo> = {};
  apps.forEach((a) => (appsMap[a.id] = a));

  const filtered = logs.filter((log) => {
    if (search && !log.username?.toLowerCase().includes(search.toLowerCase()) && !log.ip_address?.includes(search) && !log.hwid?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Segurança</h1>
        <p className="text-sm text-muted-foreground mt-1">Tentativas de crack e invasão</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Username, IP ou HWID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={selectedApp} onValueChange={setSelectedApp}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas apps</SelectItem>
            {apps.map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEvent} onValueChange={setFilterEvent}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(eventConfig).map(([key, cfg]) => <SelectItem key={key} value={key}>{cfg.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-1.5">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg border border-border bg-card animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground font-heading font-medium">Nenhum alerta</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Aparecerão em tempo real</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((log) => {
            const cfg = eventConfig[log.event_type] || { label: log.event_type, icon: AlertTriangle, color: "bg-muted text-muted-foreground" };
            const IconComponent = cfg.icon;
            const app = appsMap[log.application_id];
            return (
              <div key={log.id} className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
                <div className="flex-shrink-0 h-7 w-7 rounded-md flex items-center justify-center bg-destructive/10">
                  <IconComponent className="h-3.5 w-3.5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`${cfg.color} text-[10px] border-0`}>{cfg.label}</Badge>
                    {log.username && <span className="flex items-center gap-1 text-xs text-foreground"><User className="h-3 w-3 text-muted-foreground" />{log.username}</span>}
                    {app && <span className="text-[10px] text-muted-foreground">· {app.name}</span>}
                  </div>
                  {log.details && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{log.details}</p>}
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-2.5 w-2.5" />{formatDate(log.created_at)}</span>
                  <div className="flex items-center gap-2">
                    {log.ip_address && <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{log.ip_address}</span>}
                    {log.hwid && <span className="text-[10px] font-mono text-destructive flex items-center gap-1"><Monitor className="h-2.5 w-2.5" />{log.hwid.substring(0, 16)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
};

export default SecurityLogsPage;
