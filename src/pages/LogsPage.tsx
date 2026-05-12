import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Copy, Trash2, Users, Shield } from "lucide-react";
import { toast } from "sonner";

interface AuthLog {
  id: string; application_id: string; license_id: string | null; event_type: string;
  username: string | null; ip_address: string | null; hwid: string | null;
  success: boolean; details: string | null; created_at: string;
}
interface AppInfo { id: string; name: string; }
interface LicenseInfo { id: string; license_key: string; status: string; expires_at: string | null; hwid: string | null; claimed_by: string | null; }

interface PanelUserLog {
  id: string;
  panel_user_id: string;
  event_type: string;
  details: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface PanelUserInfo {
  id: string;
  username: string;
}

const eventLabels: Record<string, { label: string; color: string; description: string }> = {
  login_success: { label: "Login OK", color: "bg-primary/10 text-primary", description: "O usuário fez login com sucesso na aplicação." },
  login_failed: { label: "Login Falha", color: "bg-destructive/10 text-destructive", description: "Tentativa de login falhou. Credenciais inválidas ou licença não encontrada." },
  login_banned: { label: "Banido", color: "bg-destructive/10 text-destructive", description: "O usuário tentou login mas sua licença está banida." },
  login_expired: { label: "Expirado", color: "bg-warning/10 text-warning", description: "O usuário tentou login mas sua licença está expirada." },
  login_hwid_mismatch: { label: "HWID ≠", color: "bg-warning/10 text-warning", description: "O HWID do dispositivo não corresponde ao registrado na licença." },
  pre_auth_hwid_mismatch: { label: "HWID ≠ (Pre)", color: "bg-warning/10 text-warning", description: "HWID divergente detectado na fase de pre-auth (challenge token)." },
  register_success: { label: "Registro OK", color: "bg-primary/10 text-primary", description: "Novo usuário registrado com sucesso usando uma licença válida." },
  register_failed: { label: "Registro Falha", color: "bg-destructive/10 text-destructive", description: "Tentativa de registro falhou. A licença pode já estar em uso ou ser inválida." },
  validate_success: { label: "Validação OK", color: "bg-primary/10 text-primary", description: "A licença do usuário foi validada com sucesso." },
  validate_failed: { label: "Validação Falha", color: "bg-destructive/10 text-destructive", description: "Validação de licença falhou. A licença pode não existir ou estar inválida." },
  validate_banned: { label: "Val. Banido", color: "bg-destructive/10 text-destructive", description: "Tentativa de validação com licença banida." },
  validate_expired: { label: "Val. Expirada", color: "bg-warning/10 text-warning", description: "Tentativa de validação com licença expirada." },
  validate_hwid_mismatch: { label: "Val. HWID ≠", color: "bg-warning/10 text-warning", description: "HWID não corresponde durante a validação da licença." },
};

const panelEventLabels: Record<string, { label: string; color: string; description: string }> = {
  login_success: { label: "Login OK", color: "bg-primary/10 text-primary", description: "Revendedor fez login com sucesso." },
  login_failed: { label: "Login Falha", color: "bg-destructive/10 text-destructive", description: "Tentativa de login falhou." },
  login_expired: { label: "Login Expirado", color: "bg-warning/10 text-warning", description: "Login bloqueado — conta expirada." },
  license_created: { label: "Key Criada", color: "bg-primary/10 text-primary", description: "Revendedor criou nova(s) licença(s)." },
  user_deleted: { label: "User Deletado", color: "bg-destructive/10 text-destructive", description: "Revendedor deletou um usuário de software." },
  hwid_reset: { label: "HWID Reset", color: "bg-warning/10 text-warning", description: "Revendedor resetou o HWID de um usuário." },
  license_deleted: { label: "Key Deletada", color: "bg-destructive/10 text-destructive", description: "Revendedor deletou uma licença." },
};

const LogsPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [appsMap, setAppsMap] = useState<Record<string, AppInfo>>({});
  const [licenses, setLicenses] = useState<Record<string, LicenseInfo>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSuccess, setFilterSuccess] = useState("all");
  const [selectedApp, setSelectedApp] = useState("all");
  const [selectedLog, setSelectedLog] = useState<AuthLog | null>(null);
  const [cleanupPeriod, setCleanupPeriod] = useState("1d");
  const [showCleanup, setShowCleanup] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // Panel logs state
  const [panelLogs, setPanelLogs] = useState<PanelUserLog[]>([]);
  const [panelUsers, setPanelUsers] = useState<Record<string, PanelUserInfo>>({});
  const [panelLoading, setPanelLoading] = useState(true);
  const [panelSearch, setPanelSearch] = useState("");
  const [panelFilterType, setPanelFilterType] = useState("all");
  const [panelFilterUser, setPanelFilterUser] = useState("all");
  const [selectedPanelLog, setSelectedPanelLog] = useState<PanelUserLog | null>(null);
  const [panelUsersList, setPanelUsersList] = useState<PanelUserInfo[]>([]);

  const getCleanupDate = (period: string): string | null => {
    const now = Date.now();
    switch (period) {
      case "1d": return new Date(now - 1 * 86400000).toISOString();
      case "3d": return new Date(now - 3 * 86400000).toISOString();
      case "1w": return new Date(now - 7 * 86400000).toISOString();
      case "1m": return new Date(now - 30 * 86400000).toISOString();
      case "all": return null;
      default: return null;
    }
  };

  const cleanupLogs = async () => {
    setCleanupLoading(true);
    const appIds = apps.map(a => a.id);
    if (appIds.length === 0) { setCleanupLoading(false); return; }

    const cutoff = getCleanupDate(cleanupPeriod);
    let query = supabase.from("auth_logs").delete().in("application_id", appIds);
    if (cutoff) {
      query = query.lt("created_at", cutoff);
    }

    const { error } = await query;
    if (error) toast.error(error.message);
    else {
      toast.success(`Logs ${cutoff ? "anteriores a " + new Date(cutoff).toLocaleDateString("pt-BR") : ""} apagados`);
      fetchData();
    }
    setCleanupLoading(false);
    setShowCleanup(false);
  };

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [appsRes, licRes] = await Promise.all([
      supabase.from("applications").select("id, name").eq("owner_id", user.id),
      supabase.from("licenses").select("id, license_key, status, expires_at, hwid, claimed_by"),
    ]);
    const appsList = appsRes.data || [];
    setApps(appsList);
    const m: Record<string, AppInfo> = {};
    appsList.forEach((a) => (m[a.id] = a));
    setAppsMap(m);
    if (licRes.data) {
      const lm: Record<string, LicenseInfo> = {};
      (licRes.data as LicenseInfo[]).forEach(l => lm[l.id] = l);
      setLicenses(lm);
    }
    let query = supabase.from("auth_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (selectedApp !== "all") query = query.eq("application_id", selectedApp);
    const logsRes = await query;
    if (logsRes.data) setLogs(logsRes.data as AuthLog[]);
    setLoading(false);
  };

  const fetchPanelLogs = async () => {
    if (!user) return;
    setPanelLoading(true);
    const [logsRes, usersRes] = await Promise.all([
      supabase.from("panel_user_logs").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("panel_users").select("id, username"),
    ]);

    if (usersRes.data) {
      const um: Record<string, PanelUserInfo> = {};
      usersRes.data.forEach((u: PanelUserInfo) => um[u.id] = u);
      setPanelUsers(um);
      setPanelUsersList(usersRes.data as PanelUserInfo[]);
    }

    if (logsRes.data) {
      setPanelLogs(logsRes.data as PanelUserLog[]);
    }
    setPanelLoading(false);
  };

  useEffect(() => { fetchData(); }, [user, selectedApp]);
  useEffect(() => { fetchPanelLogs(); }, [user]);

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
  const copyText = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };

  const filtered = logs.filter((log) => {
    if (search && !log.username?.toLowerCase().includes(search.toLowerCase()) && !log.ip_address?.includes(search)) return false;
    if (filterType !== "all" && !log.event_type.startsWith(filterType)) return false;
    if (filterSuccess === "success" && !log.success) return false;
    if (filterSuccess === "failed" && log.success) return false;
    return true;
  });

  const filteredPanelLogs = panelLogs.filter((log) => {
    if (panelSearch) {
      const pu = panelUsers[log.panel_user_id];
      const username = pu?.username || "";
      if (!username.toLowerCase().includes(panelSearch.toLowerCase()) && !log.ip_address?.includes(panelSearch) && !log.details?.toLowerCase().includes(panelSearch.toLowerCase())) return false;
    }
    if (panelFilterType !== "all" && log.event_type !== panelFilterType) return false;
    if (panelFilterUser !== "all" && log.panel_user_id !== panelFilterUser) return false;
    return true;
  });

  // Track unique IPs per panel user for IP change detection
  const panelUserIps: Record<string, string[]> = {};
  panelLogs.filter(l => l.event_type === "login_success" && l.ip_address).forEach(l => {
    if (!panelUserIps[l.panel_user_id]) panelUserIps[l.panel_user_id] = [];
    if (!panelUserIps[l.panel_user_id].includes(l.ip_address!)) {
      panelUserIps[l.panel_user_id].push(l.ip_address!);
    }
  });

  const InfoRow = ({ label, value, copyable, mono }: { label: string; value: string | null | undefined; copyable?: boolean; mono?: boolean }) => (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-xs text-foreground ${mono ? "font-mono" : ""} max-w-[280px] truncate`}>{value || "—"}</span>
        {copyable && value && <button onClick={() => copyText(value)} className="text-muted-foreground hover:text-primary transition-colors"><Copy className="h-3 w-3" /></button>}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Histórico de autenticação e atividades</p>
      </div>

      <Tabs defaultValue="auth" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="auth" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Shield className="h-3.5 w-3.5" />Auth Logs
          </TabsTrigger>
          <TabsTrigger value="resellers" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Users className="h-3.5 w-3.5" />Resellers
          </TabsTrigger>
        </TabsList>

        {/* ═══ AUTH LOGS TAB ═══ */}
        <TabsContent value="auth" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-3 flex-1">
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
            {logs.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 ml-3" onClick={() => setShowCleanup(true)}>
                <Trash2 className="h-3.5 w-3.5" />Limpar
              </Button>
            )}
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
                const ev = eventLabels[log.event_type] || { label: log.event_type, color: "bg-muted text-muted-foreground", description: "" };
                const app = appsMap[log.application_id];
                return (
                  <div key={log.id} className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-primary/20 transition-colors" onClick={() => setSelectedLog(log)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`${ev.color} text-[10px] border-0`}>{ev.label}</Badge>
                        {log.username && <span className="text-xs font-medium text-foreground">{log.username}</span>}
                        {app && <span className="text-[10px] text-muted-foreground">· {app.name}</span>}
                      </div>
                      {log.details && <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate max-w-md">{log.details}</p>}
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                      <span className="text-[10px] text-muted-foreground">{formatDate(log.created_at)}</span>
                      <div className="flex items-center gap-3">
                        {log.ip_address && <span className="text-[10px] font-mono text-muted-foreground">{log.ip_address}</span>}
                        {log.hwid && <span className="text-[10px] font-mono text-muted-foreground">{log.hwid.substring(0, 10)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══ RESELLERS TAB ═══ */}
        <TabsContent value="resellers" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Revendedor, IP ou detalhes..." value={panelSearch} onChange={(e) => setPanelSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={panelFilterType} onValueChange={setPanelFilterType}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Eventos</SelectItem>
                <SelectItem value="login_success">Login OK</SelectItem>
                <SelectItem value="login_failed">Login Falha</SelectItem>
                <SelectItem value="login_expired">Login Expirado</SelectItem>
                <SelectItem value="license_created">Key Criada</SelectItem>
                <SelectItem value="user_deleted">User Deletado</SelectItem>
                <SelectItem value="hwid_reset">HWID Reset</SelectItem>
                <SelectItem value="license_deleted">Key Deletada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={panelFilterUser} onValueChange={setPanelFilterUser}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos revendedores</SelectItem>
                {panelUsersList.map((pu) => <SelectItem key={pu.id} value={pu.id}>{pu.username}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {panelLoading ? (
            <div className="space-y-1.5">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 rounded-lg border border-border bg-card animate-pulse" />)}</div>
          ) : filteredPanelLogs.length === 0 ? (
            <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-16">
              <p className="text-muted-foreground font-heading font-medium">Nenhum log de revendedor</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Atividades dos revendedores aparecerão aqui</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredPanelLogs.map((log) => {
                const ev = panelEventLabels[log.event_type] || { label: log.event_type, color: "bg-muted text-muted-foreground", description: "" };
                const pu = panelUsers[log.panel_user_id];
                const username = pu?.username || log.panel_user_id.substring(0, 8);
                const userIps = panelUserIps[log.panel_user_id] || [];
                const isNewIp = log.event_type === "login_success" && log.ip_address && userIps.length > 1 && userIps[0] !== log.ip_address;

                return (
                  <div key={log.id} className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-primary/20 transition-colors" onClick={() => setSelectedPanelLog(log)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`${ev.color} text-[10px] border-0`}>{ev.label}</Badge>
                        <span className="text-xs font-medium text-foreground">{username}</span>
                        {isNewIp && <Badge variant="outline" className="bg-warning/10 text-warning text-[10px] border-0">IP Diferente</Badge>}
                      </div>
                      {log.details && <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate max-w-lg">{log.details}</p>}
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                      <span className="text-[10px] text-muted-foreground">{formatDate(log.created_at)}</span>
                      {log.ip_address && <span className="text-[10px] font-mono text-muted-foreground">{log.ip_address}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Auth Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(o) => !o && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              Detalhes do Evento
              {selectedLog && (() => {
                const ev = eventLabels[selectedLog.event_type] || { label: selectedLog.event_type, color: "bg-muted text-muted-foreground" };
                return <Badge variant="outline" className={`${ev.color} text-[10px] border-0`}>{ev.label}</Badge>;
              })()}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (() => {
            const ev = eventLabels[selectedLog.event_type] || { label: selectedLog.event_type, color: "", description: "Evento de autenticação." };
            const app = appsMap[selectedLog.application_id];
            const license = selectedLog.license_id ? licenses[selectedLog.license_id] : null;
            return (
              <div className="space-y-3">
                <p className={`text-xs leading-relaxed px-1 ${selectedLog.success ? "text-primary/80" : "text-destructive/80"}`}>{ev.description}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/50 p-3 space-y-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Usuário</p>
                    <InfoRow label="Username" value={selectedLog.username} copyable mono />
                    <InfoRow label="IP" value={selectedLog.ip_address} copyable mono />
                    <InfoRow label="HWID" value={selectedLog.hwid} copyable mono />
                  </div>
                  <div className="rounded-lg border border-border/50 p-3 space-y-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Contexto</p>
                    <InfoRow label="Aplicação" value={app?.name} />
                    <InfoRow label="Resultado" value={selectedLog.success ? "Sucesso" : "Falha"} />
                    <InfoRow label="Horário" value={formatDate(selectedLog.created_at)} />
                  </div>
                </div>
                {license && (
                  <div className="rounded-lg border border-border/50 p-3 space-y-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Licença</p>
                    <div className="grid grid-cols-2 gap-x-4">
                      <InfoRow label="Key" value={license.license_key} copyable mono />
                      <InfoRow label="Status" value={license.status} />
                      <InfoRow label="HWID cadastrado" value={license.hwid} copyable mono />
                      <InfoRow label="Expira" value={license.expires_at ? formatDate(license.expires_at) : "Sem expiração"} />
                    </div>
                  </div>
                )}
                {selectedLog.details && (
                  <p className="text-[11px] font-mono text-muted-foreground/70 bg-muted/30 rounded-md px-3 py-2 break-all">{selectedLog.details}</p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Panel Log Detail Dialog */}
      <Dialog open={!!selectedPanelLog} onOpenChange={(o) => !o && setSelectedPanelLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              Atividade do Revendedor
              {selectedPanelLog && (() => {
                const ev = panelEventLabels[selectedPanelLog.event_type] || { label: selectedPanelLog.event_type, color: "bg-muted text-muted-foreground" };
                return <Badge variant="outline" className={`${ev.color} text-[10px] border-0`}>{ev.label}</Badge>;
              })()}
            </DialogTitle>
          </DialogHeader>
          {selectedPanelLog && (() => {
            const pu = panelUsers[selectedPanelLog.panel_user_id];
            const userIps = panelUserIps[selectedPanelLog.panel_user_id] || [];
            const meta = selectedPanelLog.metadata || {};
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/50 p-3 space-y-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Revendedor</p>
                    <InfoRow label="Username" value={pu?.username || "Desconhecido"} copyable mono />
                    <InfoRow label="IP" value={selectedPanelLog.ip_address} copyable mono />
                    <InfoRow label="Horário" value={formatDate(selectedPanelLog.created_at)} />
                  </div>
                  <div className="rounded-lg border border-border/50 p-3 space-y-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">IPs Conhecidos</p>
                    {userIps.length > 0 ? userIps.map((ip, i) => (
                      <InfoRow key={i} label={`IP ${i + 1}`} value={ip} copyable mono />
                    )) : (
                      <p className="text-xs text-muted-foreground/60 py-2">Nenhum login registrado</p>
                    )}
                  </div>
                </div>

                {selectedPanelLog.details && (
                  <div className="rounded-lg border border-border/50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Detalhes</p>
                    <p className="text-xs text-foreground">{selectedPanelLog.details}</p>
                  </div>
                )}

                {Object.keys(meta).length > 0 && (
                  <div className="rounded-lg border border-border/50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Metadata</p>
                    <div className="space-y-0">
                      {Object.entries(meta).map(([key, val]) => (
                        <InfoRow key={key} label={key} value={Array.isArray(val) ? val.join(", ") : String(val ?? "—")} copyable={typeof val === "string"} mono />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Cleanup dialog */}
      <AlertDialog open={showCleanup} onOpenChange={setShowCleanup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Limpar logs de autenticação</AlertDialogTitle>
            <AlertDialogDescription>Selecione o período dos logs que deseja apagar. Esta ação é irreversível.</AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={cleanupPeriod} onValueChange={setCleanupPeriod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Mais antigos que 1 dia</SelectItem>
              <SelectItem value="3d">Mais antigos que 3 dias</SelectItem>
              <SelectItem value="1w">Mais antigos que 1 semana</SelectItem>
              <SelectItem value="1m">Mais antigos que 1 mês</SelectItem>
              <SelectItem value="all">Todos os logs</SelectItem>
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={cleanupLogs} disabled={cleanupLoading} className="bg-destructive hover:bg-destructive/90">
              {cleanupLoading ? "Limpando..." : "Limpar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default LogsPage;
