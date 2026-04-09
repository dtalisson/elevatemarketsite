import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, Trash2, Copy, Ban, ShieldOff } from "lucide-react";
import { toast } from "sonner";

interface SecurityLog { id: string; application_id: string; username: string | null; hwid: string | null; event_type: string; details: string | null; client_timestamp: number | null; ip_address: string | null; created_at: string; }
interface AppInfo { id: string; name: string; }

const eventConfig: Record<string, { label: string; color: string; description: string }> = {
  DEBUGGER_DETECTED: { label: "Debugger", color: "bg-destructive/10 text-destructive", description: "Um debugger foi detectado anexado ao processo da aplicação. Isso indica que alguém está tentando analisar ou modificar o comportamento do software em tempo real." },
  DUMP_TOOL_DETECTED: { label: "Dump Tool", color: "bg-destructive/10 text-destructive", description: "Uma ferramenta de dump de memória foi detectada. O usuário pode estar tentando extrair o código ou dados sensíveis da aplicação da memória RAM." },
  HWID_ABUSE: { label: "HWID Abuse", color: "bg-warning/10 text-warning", description: "Abuso de HWID detectado. Múltiplas tentativas de uso com hardware IDs diferentes, indicando possível compartilhamento ou clonagem de licença." },
  SESSION_INVALIDATED: { label: "Sessão Inv.", color: "bg-warning/10 text-warning", description: "A sessão do usuário foi invalidada por atividade suspeita, como tentativa de login simultâneo ou manipulação de token de sessão." },
  INTEGRITY_VIOLATION: { label: "Integridade", color: "bg-destructive/10 text-destructive", description: "Violação de integridade detectada. Os arquivos ou o código da aplicação foram modificados, indicando possível crack ou patch não autorizado." },
  MEMORY_TAMPERING: { label: "Memória", color: "bg-destructive/10 text-destructive", description: "Manipulação de memória detectada. Alguém está usando ferramentas como Cheat Engine ou similares para modificar valores na memória do processo." },
};

const SecurityLogsPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState("all");
  const [filterEvent, setFilterEvent] = useState("all");
  const [selectedLog, setSelectedLog] = useState<SecurityLog | null>(null);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<{ log: SecurityLog; type: "ip" | "hwid" | "both" } | null>(null);
  const [banReason, setBanReason] = useState("");

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

  const clearAllLogs = async () => {
    const appIds = apps.map(a => a.id);
    if (appIds.length === 0) return;
    const { error } = await supabase.from("security_logs").delete().in("application_id", appIds);
    if (error) toast.error(error.message);
    else { toast.success("Logs limpos"); setLogs([]); }
  };

  const openBanDialog = (log: SecurityLog, type: "ip" | "hwid" | "both") => {
    setBanTarget({ log, type });
    setBanReason(`${eventConfig[log.event_type]?.label || log.event_type} - ${log.details || "Atividade suspeita"}`);
    setBanDialogOpen(true);
  };

  const executeBan = async () => {
    if (!banTarget || !user) return;
    const { log, type } = banTarget;

    const entry: Record<string, unknown> = {
      application_id: log.application_id,
      reason: banReason || "Banido via logs de segurança",
      details: `Evento: ${log.event_type}\nDetalhes: ${log.details || "N/A"}\nUsername: ${log.username || "N/A"}\nData do evento: ${log.created_at}`,
      source_log_id: log.id,
      created_by: user.id,
    };

    if (type === "ip" || type === "both") entry.ip_address = log.ip_address;
    if (type === "hwid" || type === "both") entry.hwid = log.hwid;

    // If banning both but only one exists, pick what's available
    if (type === "both") {
      if (!log.ip_address) entry.ip_address = undefined;
      if (!log.hwid) entry.hwid = undefined;
    }

    const { error } = await supabase.from("blacklist").insert(entry);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Adicionado à blacklist!");
      setBanDialogOpen(false);
      setBanTarget(null);
      setBanReason("");
    }
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
          <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Segurança</h1>
          <p className="text-sm text-muted-foreground mt-1">Tentativas de crack e invasão</p>
        </div>
        {logs.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" />Limpar Logs</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-heading">Limpar todos os logs de segurança?</AlertDialogTitle>
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
            const cfg = eventConfig[log.event_type] || { label: log.event_type, color: "bg-muted text-muted-foreground", description: "" };
            const app = appsMap[log.application_id];
            return (
              <div key={log.id} className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3 hover:border-primary/20 transition-colors">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedLog(log)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`${cfg.color} text-[10px] border-0`}>{cfg.label}</Badge>
                    {log.username && <span className="text-xs font-medium text-foreground">{log.username}</span>}
                    {app && <span className="text-[10px] text-muted-foreground">· {app.name}</span>}
                  </div>
                  {log.details && <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate max-w-md">{log.details}</p>}
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <div className="flex flex-col items-end gap-0.5 mr-2">
                    <span className="text-[10px] text-muted-foreground">{formatDate(log.created_at)}</span>
                    <div className="flex items-center gap-3">
                      {log.ip_address && <span className="text-[10px] font-mono text-muted-foreground">{log.ip_address}</span>}
                      {log.hwid && <span className="text-[10px] font-mono text-destructive">{log.hwid.substring(0, 16)}</span>}
                    </div>
                  </div>
                  {/* Ban buttons */}
                  <div className="flex items-center gap-1">
                    {log.ip_address && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openBanDialog(log, "ip"); }} title="Banir IP">
                        <Ban className="h-3.5 w-3.5 text-warning" />
                      </Button>
                    )}
                    {log.hwid && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openBanDialog(log, "hwid"); }} title="Banir HWID">
                        <ShieldOff className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                    {log.ip_address && log.hwid && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openBanDialog(log, "both"); }} title="Banir IP + HWID">
                        <Ban className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(o) => !o && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              Detalhes do Alerta
              {selectedLog && (() => {
                const cfg = eventConfig[selectedLog.event_type] || { label: selectedLog.event_type, color: "bg-muted text-muted-foreground" };
                return <Badge variant="outline" className={`${cfg.color} text-[10px] border-0`}>{cfg.label}</Badge>;
              })()}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (() => {
            const cfg = eventConfig[selectedLog.event_type] || { label: selectedLog.event_type, color: "", description: "Evento de segurança desconhecido." };
            const app = appsMap[selectedLog.application_id];
            return (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-destructive/80 px-1">{cfg.description}</p>

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
                    <InfoRow label="Tipo" value={selectedLog.event_type} mono />
                    <InfoRow label="Horário" value={formatDate(selectedLog.created_at)} />
                    <InfoRow label="Cliente" value={selectedLog.client_timestamp ? formatDate(new Date(selectedLog.client_timestamp).toISOString()) : null} />
                  </div>
                </div>

                {selectedLog.details && (
                  <p className="text-[11px] font-mono text-muted-foreground/70 bg-muted/30 rounded-md px-3 py-2 break-all">{selectedLog.details}</p>
                )}

                {/* Ban actions in detail modal */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">Banir:</span>
                  {selectedLog.ip_address && (
                    <Button variant="outline" size="sm" className="gap-1.5 text-warning border-warning/30 hover:bg-warning/10" onClick={() => { setSelectedLog(null); openBanDialog(selectedLog, "ip"); }}>
                      <Ban className="h-3 w-3" />IP
                    </Button>
                  )}
                  {selectedLog.hwid && (
                    <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { setSelectedLog(null); openBanDialog(selectedLog, "hwid"); }}>
                      <ShieldOff className="h-3 w-3" />HWID
                    </Button>
                  )}
                  {selectedLog.ip_address && selectedLog.hwid && (
                    <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { setSelectedLog(null); openBanDialog(selectedLog, "both"); }}>
                      <Ban className="h-3 w-3" />IP + HWID
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Ban Confirmation Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-destructive flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Confirmar Banimento
            </DialogTitle>
          </DialogHeader>
          {banTarget && (
            <div className="space-y-3">
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-1.5">
                {(banTarget.type === "ip" || banTarget.type === "both") && banTarget.log.ip_address && (
                  <p className="text-xs"><span className="text-muted-foreground">IP:</span> <span className="font-mono text-foreground">{banTarget.log.ip_address}</span></p>
                )}
                {(banTarget.type === "hwid" || banTarget.type === "both") && banTarget.log.hwid && (
                  <p className="text-xs"><span className="text-muted-foreground">HWID:</span> <span className="font-mono text-foreground">{banTarget.log.hwid}</span></p>
                )}
                <p className="text-xs"><span className="text-muted-foreground">App:</span> <span className="text-foreground">{appsMap[banTarget.log.application_id]?.name || "—"}</span></p>
              </div>
              <Input placeholder="Motivo do ban" value={banReason} onChange={(e) => setBanReason(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Este IP/HWID será bloqueado de usar qualquer endpoint da aplicação (login, validação de licença, etc).</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)}>Cancelar</Button>
            <Button onClick={executeBan} className="bg-destructive hover:bg-destructive/90 gap-1.5"><Ban className="h-3.5 w-3.5" />Banir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default SecurityLogsPage;
