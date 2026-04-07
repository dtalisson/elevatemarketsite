import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, CheckCircle2, XCircle, Clock, Globe, Monitor, User } from "lucide-react";

interface AuthLog {
  id: string; application_id: string; license_id: string | null; event_type: string;
  username: string | null; ip_address: string | null; hwid: string | null;
  success: boolean; details: string | null; created_at: string;
}
interface AppInfo { id: string; name: string; }

const eventLabels: Record<string, { label: string; color: string }> = {
  login_success: { label: "Login OK", color: "bg-primary/10 text-primary" },
  login_failed: { label: "Login Falha", color: "bg-destructive/10 text-destructive" },
  login_banned: { label: "Banido", color: "bg-destructive/10 text-destructive" },
  login_expired: { label: "Expirado", color: "bg-warning/10 text-warning" },
  login_hwid_mismatch: { label: "HWID ≠", color: "bg-warning/10 text-warning" },
  register_success: { label: "Registro OK", color: "bg-primary/10 text-primary" },
  register_failed: { label: "Registro Falha", color: "bg-destructive/10 text-destructive" },
  validate_success: { label: "Validação OK", color: "bg-primary/10 text-primary" },
  validate_failed: { label: "Validação Falha", color: "bg-destructive/10 text-destructive" },
  validate_banned: { label: "Val. Banido", color: "bg-destructive/10 text-destructive" },
  validate_expired: { label: "Val. Expirada", color: "bg-warning/10 text-warning" },
  validate_hwid_mismatch: { label: "Val. HWID ≠", color: "bg-warning/10 text-warning" },
};

const LogsPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [appsMap, setAppsMap] = useState<Record<string, AppInfo>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSuccess, setFilterSuccess] = useState("all");
  const [selectedApp, setSelectedApp] = useState("all");

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const appsRes = await supabase.from("applications").select("id, name").eq("owner_id", user.id);
    const appsList = appsRes.data || [];
    setApps(appsList);
    const m: Record<string, AppInfo> = {};
    appsList.forEach((a) => (m[a.id] = a));
    setAppsMap(m);
    let query = supabase.from("auth_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (selectedApp !== "all") query = query.eq("application_id", selectedApp);
    const logsRes = await query;
    if (logsRes.data) setLogs(logsRes.data as AuthLog[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user, selectedApp]);

  useEffect(() => {
    const channel = supabase
      .channel("auth_logs_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "auth_logs" }, (payload) => {
        const newLog = payload.new as AuthLog;
        if (selectedApp === "all" || newLog.application_id === selectedApp) setLogs((prev) => [newLog, ...prev].slice(0, 500));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedApp]);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const filtered = logs.filter((log) => {
    if (search && !log.username?.toLowerCase().includes(search.toLowerCase()) && !log.ip_address?.includes(search)) return false;
    if (filterType !== "all" && !log.event_type.startsWith(filterType)) return false;
    if (filterSuccess === "success" && !log.success) return false;
    if (filterSuccess === "failed" && log.success) return false;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Histórico de autenticação</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Username ou IP..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="register">Registro</SelectItem>
            <SelectItem value="validate">Validação</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSuccess} onValueChange={setFilterSuccess}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="failed">Falha</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedApp} onValueChange={setSelectedApp}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas apps</SelectItem>
            {apps.map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-1.5">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 rounded-lg border border-border bg-card animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground font-heading font-medium">Nenhum log</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Aparecerão em tempo real</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((log) => {
            const ev = eventLabels[log.event_type] || { label: log.event_type, color: "bg-muted text-muted-foreground" };
            const app = appsMap[log.application_id];
            return (
              <div key={log.id} className="rounded-lg border border-border bg-card p-3 flex items-center gap-3">
                <div className={`flex-shrink-0 h-7 w-7 rounded-md flex items-center justify-center ${log.success ? "bg-primary/10" : "bg-destructive/10"}`}>
                  {log.success ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`${ev.color} text-[10px] border-0`}>{ev.label}</Badge>
                    {log.username && <span className="flex items-center gap-1 text-xs text-foreground"><User className="h-3 w-3 text-muted-foreground" />{log.username}</span>}
                    {app && <span className="text-[10px] text-muted-foreground">· {app.name}</span>}
                  </div>
                  {log.details && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{log.details}</p>}
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-2.5 w-2.5" />{formatDate(log.created_at)}</span>
                  <div className="flex items-center gap-2">
                    {log.ip_address && <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{log.ip_address}</span>}
                    {log.hwid && <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1"><Monitor className="h-2.5 w-2.5" />{log.hwid.substring(0, 10)}</span>}
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

export default LogsPage;
