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
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, Clock, Globe, Monitor, User, AlertTriangle, Trash2, Copy, Key } from "lucide-react";
import { toast } from "sonner";

interface AuthLog { id: string; application_id: string; license_id: string | null; event_type: string; username: string | null; ip_address: string | null; hwid: string | null; success: boolean; details: string | null; created_at: string; }
interface AppInfo { id: string; name: string; }
interface LicenseInfo { id: string; license_key: string; hwid: string | null; claimed_by: string | null; }

const HwidLogsPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [licenses, setLicenses] = useState<Record<string, LicenseInfo>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState("all");
  const [selectedLog, setSelectedLog] = useState<AuthLog | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [appsRes, logsRes, licRes] = await Promise.all([
      supabase.from("applications").select("id, name").eq("owner_id", user.id),
      (() => {
        let q = supabase.from("auth_logs").select("*").in("event_type", ["login_hwid_mismatch", "validate_hwid_mismatch"]).order("created_at", { ascending: false }).limit(500);
        if (selectedApp !== "all") q = q.eq("application_id", selectedApp);
        return q;
      })(),
      supabase.from("licenses").select("id, license_key, hwid, claimed_by"),
    ]);
    setApps(appsRes.data || []);
    if (logsRes.data) setLogs(logsRes.data as AuthLog[]);
    if (licRes.data) {
      const m: Record<string, LicenseInfo> = {};
      (licRes.data as LicenseInfo[]).forEach(l => m[l.id] = l);
      setLicenses(m);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user, selectedApp]);

  useEffect(() => {
    const channel = supabase.channel("hwid_logs_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "auth_logs" }, (payload) => {
        const newLog = payload.new as AuthLog;
        if ((newLog.event_type === "login_hwid_mismatch" || newLog.event_type === "validate_hwid_mismatch") && (selectedApp === "all" || newLog.application_id === selectedApp))
          setLogs((prev) => [newLog, ...prev].slice(0, 500));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedApp]);

  const clearAllLogs = async () => {
    const appIds = apps.map(a => a.id);
    if (appIds.length === 0) return;
    const { error } = await supabase.from("auth_logs").delete().in("application_id", appIds).in("event_type", ["login_hwid_mismatch", "validate_hwid_mismatch"]);
    if (error) toast.error(error.message);
    else { toast.success("Logs limpos"); setLogs([]); }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const copyText = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };

  const appsMap: Record<string, AppInfo> = {};
  apps.forEach((a) => (appsMap[a.id] = a));

  const filtered = logs.filter((log) => {
    if (search && !log.username?.toLowerCase().includes(search.toLowerCase()) && !log.ip_address?.includes(search) && !log.hwid?.toLowerCase().includes(search.toLowerCase())) return false;
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">HWID Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Tentativas com HWID diferente</p>
        </div>
        {logs.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" />Limpar Logs</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-heading">Limpar todos os logs de HWID?</AlertDialogTitle>
                <AlertDialogDescription>Todos os registros serão apagados permanentemente.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={clearAllLogs} className="bg-destructive hover:bg-destructive/90">Limpar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
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
      </div>

      {loading ? (
        <div className="space-y-1.5">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg border border-border bg-card animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground font-heading font-medium">Nenhum log de HWID</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Aparecerão em tempo real</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((log) => {
            const app = appsMap[log.application_id];
            return (
              <div key={log.id} className="rounded-lg border border-border bg-card p-3 flex items-center gap-3 cursor-pointer hover:border-primary/20 transition-colors" onClick={() => setSelectedLog(log)}>
                <div className="flex-shrink-0 h-7 w-7 rounded-md flex items-center justify-center bg-warning/10">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-warning/10 text-warning text-[10px] border-0">HWID Mismatch</Badge>
                    {log.username && <span className="flex items-center gap-1 text-xs text-foreground"><User className="h-3 w-3 text-muted-foreground" />{log.username}</span>}
                    {app && <span className="text-[10px] text-muted-foreground">· {app.name}</span>}
                  </div>
                  {log.details && <p className="text-[11px] text-muted-foreground/80 mt-0.5 truncate max-w-md">{log.details}</p>}
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-2.5 w-2.5" />{formatDate(log.created_at)}</span>
                  <div className="flex items-center gap-2">
                    {log.ip_address && <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{log.ip_address}</span>}
                    {log.hwid && <span className="text-[10px] font-mono text-warning flex items-center gap-1"><Monitor className="h-2.5 w-2.5" />{log.hwid.substring(0, 16)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedLog} onOpenChange={(o) => !o && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              Detalhes do HWID Mismatch
              <Badge variant="outline" className="bg-warning/10 text-warning text-[10px] border-0">HWID Mismatch</Badge>
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (() => {
            const app = appsMap[selectedLog.application_id];
            const license = selectedLog.license_id ? licenses[selectedLog.license_id] : null;
            return (
              <div className="space-y-4">
                <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-warning mb-2 font-semibold">O que aconteceu</p>
                  <p className="text-sm text-foreground leading-relaxed">
                    O usuário <strong>{selectedLog.username || "desconhecido"}</strong> tentou fazer login com um HWID diferente do que está registrado na licença.
                    {license?.hwid && <> O HWID cadastrado é <code className="text-xs font-mono bg-muted px-1 rounded">{license.hwid.substring(0, 20)}...</code>.</>}
                    {selectedLog.hwid && <> O HWID da tentativa foi <code className="text-xs font-mono bg-muted px-1 rounded">{selectedLog.hwid.substring(0, 20)}...</code>.</>}
                  </p>
                </div>

                {selectedLog.details && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Detalhes</p>
                    <p className="text-xs text-foreground font-mono bg-muted/50 rounded p-2 whitespace-pre-wrap break-all">{selectedLog.details}</p>
                  </div>
                )}

                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Quem tentou</p>
                  <InfoRow label="Username" value={selectedLog.username} copyable mono />
                  <InfoRow label="HWID usado" value={selectedLog.hwid} copyable mono />
                  <InfoRow label="IP" value={selectedLog.ip_address} copyable mono />
                </div>

                {license && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Licença Original</p>
                    <InfoRow label="Key" value={license.license_key} copyable mono />
                    <InfoRow label="HWID cadastrado" value={license.hwid} copyable mono />
                    <InfoRow label="Claimed by" value={license.claimed_by} mono />
                  </div>
                )}

                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Contexto</p>
                  <InfoRow label="Aplicação" value={app?.name} />
                  <InfoRow label="Evento" value={selectedLog.event_type === "login_hwid_mismatch" ? "Login HWID Mismatch" : "Validate HWID Mismatch"} />
                  <InfoRow label="Horário" value={formatDate(selectedLog.created_at)} />
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default HwidLogsPage;
