import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Trash2, ShieldOff, ShieldCheck, Copy } from "lucide-react";
import { toast } from "sonner";

interface BlacklistEntry {
  id: string;
  application_id: string;
  ip_address: string | null;
  hwid: string | null;
  reason: string | null;
  details: string | null;
  active: boolean;
  created_at: string;
  created_by: string;
}

interface AppInfo { id: string; name: string; }

interface GlobalBan { hwid: string; reason: string | null; banned_at: string; }

const BlacklistPage = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [globalBans, setGlobalBans] = useState<GlobalBan[]>([]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("active");
  const [addOpen, setAddOpen] = useState(false);
  const [unbanning, setUnbanning] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState({ app_id: "", ip: "", hwid: "", reason: "", details: "" });

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const appsRes = await supabase.from("applications").select("id, name").eq("owner_id", user.id);
    setApps(appsRes.data || []);

    let query = supabase.from("blacklist").select("*").order("created_at", { ascending: false });
    if (selectedApp !== "all") query = query.eq("application_id", selectedApp);
    if (filterStatus === "active") query = query.eq("active", true);
    else if (filterStatus === "inactive") query = query.eq("active", false);

    const [res, globalRes] = await Promise.all([
      query,
      supabase.from("banned_hwids").select("hwid, reason, banned_at").order("banned_at", { ascending: false }),
    ]);
    if (res.data) setEntries(res.data as BlacklistEntry[]);
    setGlobalBans((globalRes.data as GlobalBan[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user, selectedApp, filterStatus]);

  const addEntry = async () => {
    if (!user || !newEntry.app_id) return;
    if (!newEntry.ip && !newEntry.hwid) {
      toast.error("Informe pelo menos um IP ou HWID");
      return;
    }
    const { error } = await supabase.from("blacklist").insert({
      application_id: newEntry.app_id,
      ip_address: newEntry.ip || null,
      hwid: newEntry.hwid || null,
      reason: newEntry.reason || null,
      details: newEntry.details || null,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Adicionado à blacklist");
      setAddOpen(false);
      setNewEntry({ app_id: "", ip: "", hwid: "", reason: "", details: "" });
      fetchData();
    }
  };

  // Full unban: removes global HWID ban + deactivates blacklist + clears failure counters
  const unbanHwid = async (hwid: string) => {
    setUnbanning(hwid);
    const { error } = await supabase.rpc("unban_hwid", { p_hwid: hwid });
    setUnbanning(null);
    if (error) toast.error(error.message);
    else {
      toast.success("HWID desbanido completamente (global + blacklist + contadores)");
      fetchData();
    }
  };

  const toggleActive = async (entry: BlacklistEntry) => {
    // Deactivating an entry with HWID → full unban so the user stops getting banned everywhere
    if (entry.active && entry.hwid) {
      await unbanHwid(entry.hwid);
      return;
    }
    const { error } = await supabase.from("blacklist").update({ active: !entry.active }).eq("id", entry.id);
    if (error) toast.error(error.message);
    else {
      toast.success(entry.active ? "Removido da blacklist" : "Reativado na blacklist");
      fetchData();
    }
  };

  const deleteEntry = async (entry: BlacklistEntry) => {
    // If it has a HWID, clear the global ban + counters too
    if (entry.hwid) {
      const { error: rpcError } = await supabase.rpc("unban_hwid", { p_hwid: entry.hwid });
      if (rpcError) { toast.error(rpcError.message); return; }
    }
    const { error } = await supabase.from("blacklist").delete().eq("id", entry.id);
    if (error) toast.error(error.message);
    else { toast.success("Entrada removida e HWID desbanido"); fetchData(); }
  };

  const copyText = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };
  const formatDate = (date: string) => new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const appsMap: Record<string, AppInfo> = {};
  apps.forEach((a) => (appsMap[a.id] = a));

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return e.ip_address?.includes(s) || e.hwid?.toLowerCase().includes(s) || e.reason?.toLowerCase().includes(s);
  });

  const filteredGlobal = globalBans.filter((g) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return g.hwid.toLowerCase().includes(s) || g.reason?.toLowerCase().includes(s);
  });

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Blacklist</h1>
          <p className="text-sm text-muted-foreground mt-1">IPs e HWIDs banidos</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />Adicionar
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="IP, HWID ou motivo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={selectedApp} onValueChange={setSelectedApp}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas apps</SelectItem>
            {apps.map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Global HWID bans */}
      {!loading && filteredGlobal.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-heading font-semibold text-foreground mb-2 flex items-center gap-2">
            <ShieldOff className="h-4 w-4 text-destructive" /> Bans Globais de HWID ({filteredGlobal.length})
          </h2>
          <div className="space-y-1">
            {filteredGlobal.map((ban) => (
              <div key={ban.hwid} className="rounded-lg border border-destructive/30 bg-card px-4 py-3 flex items-center gap-3">
                <div className="h-2 w-2 rounded-full flex-shrink-0 bg-destructive" />
                <div className="flex-1 min-w-0">
                  <button onClick={() => copyText(ban.hwid)} className="flex items-center gap-1 hover:text-primary transition-colors">
                    <Badge variant="outline" className="text-[10px] font-mono bg-destructive/5 text-destructive border-destructive/20">HWID: {ban.hwid.substring(0, 28)}{ban.hwid.length > 28 ? "..." : ""}</Badge>
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </button>
                  {ban.reason && <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate max-w-md">{ban.reason}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground mr-2">{formatDate(ban.banned_at)}</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={unbanning === ban.hwid} onClick={() => unbanHwid(ban.hwid)}>
                    <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                    {unbanning === ban.hwid ? "Desbanindo..." : "Desbanir"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {loading ? (
        <div className="space-y-1.5">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg border border-border bg-card animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-16">
          <ShieldCheck className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-muted-foreground font-heading font-medium">Nenhuma entrada na blacklist</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Adicione IPs ou HWIDs para bloquear</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((entry) => {
            const app = appsMap[entry.application_id];
            return (
              <div key={entry.id} className={`rounded-lg border bg-card px-4 py-3 flex items-center gap-3 transition-colors ${entry.active ? "border-destructive/20" : "border-border opacity-60"}`}>
                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${entry.active ? "bg-destructive" : "bg-muted-foreground/30"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.ip_address && (
                      <button onClick={() => copyText(entry.ip_address!)} className="flex items-center gap-1 hover:text-primary transition-colors">
                        <Badge variant="outline" className="text-[10px] font-mono">IP: {entry.ip_address}</Badge>
                      </button>
                    )}
                    {entry.hwid && (
                      <button onClick={() => copyText(entry.hwid!)} className="flex items-center gap-1 hover:text-primary transition-colors">
                        <Badge variant="outline" className="text-[10px] font-mono bg-destructive/5 text-destructive border-destructive/20">HWID: {entry.hwid.substring(0, 20)}...</Badge>
                      </button>
                    )}
                    {app && <span className="text-[10px] text-muted-foreground">· {app.name}</span>}
                  </div>
                  {entry.reason && <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate max-w-md">{entry.reason}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground mr-2">{formatDate(entry.created_at)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(entry)} title={entry.active ? "Desativar" : "Reativar"}>
                    {entry.active ? <ShieldOff className="h-3.5 w-3.5 text-warning" /> : <ShieldCheck className="h-3.5 w-3.5 text-green-500" />}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover da blacklist?</AlertDialogTitle>
                        <AlertDialogDescription>Essa entrada será deletada permanentemente.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteEntry(entry)} className="bg-destructive hover:bg-destructive/90">Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Adicionar à Blacklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={newEntry.app_id} onValueChange={(v) => setNewEntry({ ...newEntry, app_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione a aplicação" /></SelectTrigger>
              <SelectContent>
                {apps.map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="IP Address (opcional)" value={newEntry.ip} onChange={(e) => setNewEntry({ ...newEntry, ip: e.target.value })} className="font-mono text-sm" />
            <Input placeholder="HWID (opcional)" value={newEntry.hwid} onChange={(e) => setNewEntry({ ...newEntry, hwid: e.target.value })} className="font-mono text-sm" />
            <Input placeholder="Motivo" value={newEntry.reason} onChange={(e) => setNewEntry({ ...newEntry, reason: e.target.value })} />
            <Textarea placeholder="Detalhes adicionais (opcional)" value={newEntry.details} onChange={(e) => setNewEntry({ ...newEntry, details: e.target.value })} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={addEntry} className="bg-destructive hover:bg-destructive/90">Banir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default BlacklistPage;
