import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface AuthLog {
  id: string; application_id: string; license_id: string | null; event_type: string;
  username: string | null; ip_address: string | null; hwid: string | null;
  success: boolean; details: string | null; created_at: string;
}
interface AppInfo { id: string; name: string; }
interface LicenseInfo { id: string; license_key: string; status: string; expires_at: string | null; hwid: string | null; claimed_by: string | null; }

const eventLabels: Record<string, { label: string; color: string; description: string }> = {
  login_success: { label: "Login OK", color: "bg-primary/10 text-primary", description: "O usuário fez login com sucesso na aplicação." },
  login_failed: { label: "Login Falha", color: "bg-destructive/10 text-destructive", description: "Tentativa de login falhou. Credenciais inválidas ou licença não encontrada." },
  login_banned: { label: "Banido", color: "bg-destructive/10 text-destructive", description: "O usuário tentou login mas sua licença está banida." },
  login_expired: { label: "Expirado", color: "bg-warning/10 text-warning", description: "O usuário tentou login mas sua licença está expirada." },
  login_hwid_mismatch: { label: "HWID ≠", color: "bg-warning/10 text-warning", description: "O HWID do dispositivo não corresponde ao registrado na licença." },
  register_success: { label: "Registro OK", color: "bg-primary/10 text-primary", description: "Novo usuário registrado com sucesso usando uma licença válida." },
  register_failed: { label: "Registro Falha", color: "bg-destructive/10 text-destructive", description: "Tentativa de registro falhou. A licença pode já estar em uso ou ser inválida." },
  validate_success: { label: "Validação OK", color: "bg-primary/10 text-primary", description: "A licença do usuário foi validada com sucesso." },
  validate_failed: { label: "Validação Falha", color: "bg-destructive/10 text-destructive", description: "Validação de licença falhou. A licença pode não existir ou estar inválida." },
  validate_banned: { label: "Val. Banido", color: "bg-destructive/10 text-destructive", description: "Tentativa de validação com licença banida." },
  validate_expired: { label: "Val. Expirada", color: "bg-warning/10 text-warning", description: "Tentativa de validação com licença expirada." },
  validate_hwid_mismatch: { label: "Val. HWID ≠", color: "bg-warning/10 text-warning", description: "HWID não corresponde durante a validação da licença." },
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
  const copyText = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };

  const filtered = logs.filter((log) => {
    if (search && !log.username?.toLowerCase().includes(search.toLowerCase()) && !log.ip_address?.includes(search)) return false;
    if (filterType !== "all" && !log.event_type.startsWith(filterType)) return false;
    if (filterSuccess === "success" && !log.success) return false;
    if (filterSuccess === "failed" && log.success) return false;
    return true;
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
    </DashboardLayout>
  );
};

export default LogsPage;
