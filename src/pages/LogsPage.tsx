import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Search, CheckCircle2, XCircle, Clock, Globe, Monitor, User } from "lucide-react";

interface AuthLog {
  id: string; application_id: string; license_id: string | null; event_type: string;
  username: string | null; ip_address: string | null; hwid: string | null;
  success: boolean; details: string | null; created_at: string;
}
interface AppInfo { id: string; name: string; }

const eventLabels: Record<string, { label: string; color: string }> = {
  login_success: { label: "Login OK", color: "bg-success/15 text-success border-success/25" },
  login_failed: { label: "Login Falha", color: "bg-destructive/15 text-destructive border-destructive/25" },
  login_banned: { label: "Login Banido", color: "bg-destructive/15 text-destructive border-destructive/25" },
  login_expired: { label: "Login Expirado", color: "bg-warning/15 text-warning border-warning/25" },
  login_hwid_mismatch: { label: "HWID Diferente", color: "bg-warning/15 text-warning border-warning/25" },
  register_success: { label: "Registro OK", color: "bg-success/15 text-success border-success/25" },
  register_failed: { label: "Registro Falha", color: "bg-destructive/15 text-destructive border-destructive/25" },
  validate_success: { label: "Validação OK", color: "bg-success/15 text-success border-success/25" },
  validate_failed: { label: "Validação Falha", color: "bg-destructive/15 text-destructive border-destructive/25" },
  validate_banned: { label: "Validação Banido", color: "bg-destructive/15 text-destructive border-destructive/25" },
  validate_expired: { label: "Validação Expirada", color: "bg-warning/15 text-warning border-warning/25" },
  validate_hwid_mismatch: { label: "HWID Diferente", color: "bg-warning/15 text-warning border-warning/25" },
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
        <p className="text-sm text-muted-foreground">Histórico completo de autenticação e eventos</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por username ou IP..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="register">Registro</SelectItem>
            <SelectItem value="validate">Validação</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSuccess} onValueChange={setFilterSuccess}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="failed">Falha</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedApp} onValueChange={setSelectedApp}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as aplicações</SelectItem>
            {apps.map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => (<Card key={i} className="glass animate-pulse"><CardContent className="p-3 h-14" /></Card>))}</div>
      ) : filtered.length === 0 ? (
        <Card className="glass animate-fade-in-up">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/15 mb-4"><ScrollText className="h-10 w-10 text-primary" /></div>
            <p className="text-muted-foreground font-heading font-medium">Nenhum log encontrado</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Os logs aparecerão em tempo real</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((log, index) => {
            const ev = eventLabels[log.event_type] || { label: log.event_type, color: "bg-muted text-muted-foreground border-border" };
            const app = appsMap[log.application_id];
            return (
              <Card key={log.id} className="glass glass-hover animate-fade-in-up" style={{ animationDelay: `${Math.min(0.02 * (index + 1), 0.5)}s` }}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${log.success ? "bg-success/10" : "bg-destructive/10"}`}>
                      {log.success ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`${ev.color} text-[10px]`}>{ev.label}</Badge>
                        {log.username && <span className="flex items-center gap-1 text-xs text-foreground font-medium"><User className="h-3 w-3 text-muted-foreground" />{log.username}</span>}
                        {app && <span className="text-[10px] text-muted-foreground">· {app.name}</span>}
                      </div>
                      {log.details && <div className="mt-1"><span className="text-[11px] text-muted-foreground/80">{log.details}</span></div>}
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-2.5 w-2.5" />{formatDate(log.created_at)}</span>
                      <div className="flex items-center gap-2">
                        {log.ip_address && <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono"><Globe className="h-2.5 w-2.5" />{log.ip_address}</span>}
                        {log.hwid && <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono"><Monitor className="h-2.5 w-2.5" />{log.hwid.substring(0, 10)}</span>}
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

export default LogsPage;
