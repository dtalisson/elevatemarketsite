import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Key, Clock, User, Search, Monitor, RotateCcw, Eye, EyeOff, Ban, CheckCircle2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type License = Tables<"licenses">;
interface Application { id: string; name: string; }
interface SoftwareUser { id: string; username: string; password_hash: string; password_plain: string | null; hwid: string | null; license_id: string; }

const statusColors: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  unused: "bg-muted text-muted-foreground",
  expired: "bg-warning/10 text-warning",
  banned: "bg-destructive/10 text-destructive",
};

const Licenses = () => {
  const { user } = useAuth();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [softwareUsers, setSoftwareUsers] = useState<Record<string, SoftwareUser>>({});
  const [selectedApp, setSelectedApp] = useState("");
  const [filterApp, setFilterApp] = useState("all");
  const [expDays, setExpDays] = useState("");
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [banTargetId, setBanTargetId] = useState<string | null>(null);

  const fetchData = async () => {
    const [licRes, appRes, usersRes] = await Promise.all([
      supabase.from("licenses").select("*").order("created_at", { ascending: false }),
      supabase.from("applications").select("id, name"),
      supabase.from("software_users").select("id, username, password_hash, password_plain, hwid, license_id"),
    ]);
    if (licRes.data) setLicenses(licRes.data as License[]);
    if (appRes.data) setApps(appRes.data);
    if (usersRes.data) {
      const userMap: Record<string, SoftwareUser> = {};
      (usersRes.data as SoftwareUser[]).forEach((u) => (userMap[u.license_id] = u));
      setSoftwareUsers(userMap);
    }
  };

  useEffect(() => { if (user) fetchData(); }, [user]);

  const createLicenses = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedApp) return;
    setLoading(true);
    const qty = Math.min(Math.max(parseInt(quantity) || 1, 1), 100);
    const expiresAt = expDays ? new Date(Date.now() + parseInt(expDays) * 86400000).toISOString() : null;
    const inserts = Array.from({ length: qty }, () => ({
      application_id: selectedApp, created_by: user.id, max_uses: 1, expires_at: expiresAt, note: note || null,
    }));
    const { error } = await supabase.from("licenses").insert(inserts);
    if (error) toast.error(error.message);
    else { toast.success(`${qty} licença(s) criada(s)!`); setOpen(false); setNote(""); setExpDays(""); setQuantity("1"); fetchData(); }
    setLoading(false);
  };

  const deleteLicense = async (id: string) => {
    const { error } = await supabase.from("licenses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removida"); setSelectedLicense(null); fetchData(); }
  };

  const resetHwid = async (licenseId: string) => {
    const { error: licErr } = await supabase.from("licenses").update({ hwid: null }).eq("id", licenseId);
    if (licErr) { toast.error("Erro"); return; }
    const su = softwareUsers[licenseId];
    if (su) await supabase.from("software_users").update({ hwid: null }).eq("id", su.id);
    toast.success("HWID resetado!");
    fetchData();
    if (selectedLicense?.id === licenseId) setSelectedLicense((p) => p ? { ...p, hwid: null } : null);
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("licenses").delete().in("id", ids);
    if (error) toast.error(error.message);
    else { toast.success(`${ids.length} excluída(s)`); setSelected(new Set()); fetchData(); }
    setBulkLoading(false);
  };

  const bulkResetHwid = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selected);
    await supabase.from("licenses").update({ hwid: null }).in("id", ids);
    for (const id of ids) { const su = softwareUsers[id]; if (su) await supabase.from("software_users").update({ hwid: null }).eq("id", su.id); }
    toast.success(`HWID resetado em ${ids.length}`);
    setSelected(new Set()); fetchData(); setBulkLoading(false);
  };

  const deactivateLicense = async (licenseId: string, reason: string) => {
    // Find the license to calculate remaining time
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic) return;

    const updates: { status: "banned"; ban_reason: string | null; remaining_seconds?: number | null } = {
      status: "banned",
      ban_reason: reason || null,
    };

    if (lic.expires_at) {
      const remaining = Math.max(0, Math.floor((new Date(lic.expires_at).getTime() - Date.now()) / 1000));
      updates.remaining_seconds = remaining;
    }

    const { error } = await supabase.from("licenses").update(updates).eq("id", licenseId);
    if (error) toast.error(error.message);
    else { toast.success("Licença desativada"); fetchData(); }
  };

  const activateLicense = async (licenseId: string) => {
    const lic = licenses.find(l => l.id === licenseId);
    if (!lic) return;

    const updates: { status: "active"; ban_reason: null; expires_at?: string; remaining_seconds?: null } = {
      status: "active",
      ban_reason: null,
    };

    if ((lic as any).remaining_seconds && (lic as any).remaining_seconds > 0) {
      updates.expires_at = new Date(Date.now() + (lic as any).remaining_seconds * 1000).toISOString();
      updates.remaining_seconds = null;
    }

    const { error } = await supabase.from("licenses").update(updates).eq("id", licenseId);
    if (error) toast.error(error.message);
    else { toast.success("Licença ativada"); fetchData(); }
  };

  const bulkBan = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selected);
    for (const id of ids) {
      await deactivateLicense(id, "Banimento em massa");
    }
    setSelected(new Set()); fetchData(); setBulkLoading(false);
  };

  const bulkActivate = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selected);
    for (const id of ids) {
      await activateLicense(id);
    }
    setSelected(new Set()); fetchData(); setBulkLoading(false);
  };

  const copyKey = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };
  const formatDate = (date: string) => new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const getAppName = (appId: string) => apps.find((a) => a.id === appId)?.name || "—";

  const filtered = licenses.filter((lic) => {
    if (filterApp !== "all" && lic.application_id !== filterApp) return false;
    if (search) {
      const s = search.toLowerCase();
      const su = softwareUsers[lic.id];
      if (!lic.license_key.toLowerCase().includes(s) && !lic.claimed_by?.toLowerCase().includes(s) && !su?.username.toLowerCase().includes(s)) return false;
    }
    if (filterStatus !== "all" && lic.status !== filterStatus) return false;
    return true;
  });

  const toggleSelect = (id: string) => { setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const toggleAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((l) => l.id))); };

  const appCounts = apps.map((app) => ({ ...app, count: licenses.filter((l) => l.application_id === app.id).length }));

  const InfoRow = ({ label, value, copyable, mono }: { label: string; value: string | null | undefined; copyable?: boolean; mono?: boolean }) => (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-xs text-foreground ${mono ? "font-mono" : ""} max-w-[220px] truncate`}>{value || "—"}</span>
        {copyable && value && <button onClick={() => copyKey(value)} className="text-muted-foreground hover:text-primary transition-colors"><Copy className="h-3 w-3" /></button>}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Licenças</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie suas keys</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={apps.length === 0} size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Gerar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">Gerar Licenças</DialogTitle></DialogHeader>
            <form onSubmit={createLicenses} className="space-y-4">
              <div className="space-y-2">
                <Label>Aplicação</Label>
                <Select value={selectedApp} onValueChange={setSelectedApp}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{apps.map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Quantidade</Label><Input type="number" min="1" max="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
              <div className="space-y-2"><Label>Expiração (dias)</Label><Input type="number" min="1" value={expDays} onChange={(e) => setExpDays(e.target.value)} placeholder="Sem expiração" /></div>
              <div className="space-y-2"><Label>Nota</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></div>
              <Button type="submit" className="w-full" disabled={loading || !selectedApp}>{loading ? "Gerando..." : "Gerar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {apps.length > 1 && (
        <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
          <button
            onClick={() => { setFilterApp("all"); setSelected(new Set()); }}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap ${filterApp === "all" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Todas ({licenses.length})
          </button>
          {appCounts.map((app) => (
            <button
              key={app.id}
              onClick={() => { setFilterApp(app.id); setSelected(new Set()); }}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap ${filterApp === app.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {app.name} ({app.count})
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar key ou usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="unused">Unused</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
          <span className="text-xs font-medium text-foreground mr-2">{selected.size} selecionada(s)</span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-destructive" disabled={bulkLoading}><Trash2 className="h-3 w-3" />Excluir</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-heading">Excluir {selected.size} licença(s)?</AlertDialogTitle>
                <AlertDialogDescription>Irreversível. Usuários associados serão removidos.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={bulkDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 text-muted-foreground" onClick={bulkResetHwid} disabled={bulkLoading}><RotateCcw className="h-3 w-3" />HWID</Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 text-muted-foreground" onClick={bulkBan} disabled={bulkLoading}><Ban className="h-3 w-3" />Banir</Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 text-muted-foreground" onClick={bulkActivate} disabled={bulkLoading}><CheckCircle2 className="h-3 w-3" />Ativar</Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors">Limpar</button>
        </div>
      )}

      {apps.length === 0 ? (
        <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-16">
          <p className="text-foreground font-heading font-medium">Crie uma aplicação primeiro</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-16">
          <p className="text-foreground font-heading font-medium">{search || filterStatus !== "all" ? "Nenhuma encontrada" : "Nenhuma licença"}</p>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-3 px-4 py-2">
            <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
            <span className="text-[11px] text-muted-foreground">Selecionar todas</span>
          </div>

          {filtered.map((lic) => {
            const su = softwareUsers[lic.id];
            const isSelected = selected.has(lic.id);
            return (
              <div
                key={lic.id}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors cursor-pointer ${isSelected ? "border-primary/30 bg-primary/5" : "border-border bg-card hover:border-primary/20"}`}
              >
                <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(lic.id)} onClick={(e) => e.stopPropagation()} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary flex-shrink-0" />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedLicense(lic); setShowPassword(false); }}>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-[11px] text-foreground/80">{lic.license_key.substring(0, 24)}...</code>
                    <Badge variant="outline" className={`${statusColors[lic.status] || ""} text-[9px] px-1.5 py-0 border-0`}>{lic.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {filterApp === "all" && <span className="text-[10px] text-muted-foreground">{getAppName(lic.application_id)}</span>}
                    {lic.hwid ? (
                      <span className="flex items-center gap-1 text-[10px] text-primary"><Monitor className="h-2.5 w-2.5" />Locked</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Monitor className="h-2.5 w-2.5" />—</span>
                    )}
                    {su && <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><User className="h-2.5 w-2.5" />{su.username}</span>}
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-2.5 w-2.5" />{formatDate(lic.created_at)}</span>
                  </div>
                </div>
                <button className="text-muted-foreground hover:text-primary flex-shrink-0 transition-colors" onClick={(e) => { e.stopPropagation(); copyKey(lic.license_key); }}>
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedLicense} onOpenChange={(o) => { if (!o) { setSelectedLicense(null); setShowPassword(false); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              Detalhes
              {selectedLicense && <Badge variant="outline" className={`${statusColors[selectedLicense.status]} text-[10px] border-0`}>{selectedLicense.status}</Badge>}
            </DialogTitle>
          </DialogHeader>
          {selectedLicense && (() => {
            const su = softwareUsers[selectedLicense.id];
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/50 p-3 space-y-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Chave</p>
                    <InfoRow label="Key" value={selectedLicense.license_key} copyable mono />
                    <InfoRow label="App" value={getAppName(selectedLicense.application_id)} />
                    <InfoRow label="Nota" value={selectedLicense.note} />
                  </div>
                  <div className="rounded-lg border border-border/50 p-3 space-y-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Usuário</p>
                    {su ? (
                      <>
                        <InfoRow label="Username" value={su.username} copyable mono />
                        <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                          <span className="text-xs text-muted-foreground">Senha</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-foreground font-mono max-w-[140px] truncate">{showPassword ? (su.password_plain || "N/A") : "••••••••"}</span>
                            <button onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground hover:text-primary transition-colors">{showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</button>
                            {su.password_plain && <button onClick={() => copyKey(su.password_plain!)} className="text-muted-foreground hover:text-primary transition-colors"><Copy className="h-3 w-3" /></button>}
                          </div>
                        </div>
                      </>
                    ) : <p className="text-xs text-muted-foreground/60 py-2">Nenhum usuário</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/50 p-3 space-y-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Dispositivo</p>
                    <InfoRow label="Status" value={selectedLicense.status} />
                    <InfoRow label="Usado por" value={selectedLicense.claimed_by} />
                    <InfoRow label="HWID" value={selectedLicense.hwid} copyable mono />
                  </div>
                  <div className="rounded-lg border border-border/50 p-3 space-y-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Datas</p>
                    <InfoRow label="Criada" value={formatDate(selectedLicense.created_at)} />
                    <InfoRow label="Ativada" value={selectedLicense.activated_at ? formatDate(selectedLicense.activated_at) : null} />
                    <InfoRow label="Expira" value={selectedLicense.expires_at ? formatDate(selectedLicense.expires_at) : "Sem expiração"} />
                  </div>
                </div>

                <div className="flex gap-2">
                  {selectedLicense.status === "active" || selectedLicense.status === "unused" ? (
                    <Button variant="outline" className="flex-1 text-warning border-warning/30 hover:bg-warning/10" size="sm"
                      onClick={async () => {
                        const { error } = await supabase.from("licenses").update({ status: "banned" as const }).eq("id", selectedLicense.id);
                        if (error) toast.error(error.message);
                        else { toast.success("Licença desativada"); setSelectedLicense((p) => p ? { ...p, status: "banned" } : null); fetchData(); }
                      }}><Ban className="mr-1.5 h-3.5 w-3.5" />Desativar</Button>
                  ) : (
                    <Button variant="outline" className="flex-1 text-primary border-primary/30 hover:bg-primary/10" size="sm"
                      onClick={async () => {
                        const { error } = await supabase.from("licenses").update({ status: "active" as const }).eq("id", selectedLicense.id);
                        if (error) toast.error(error.message);
                        else { toast.success("Licença ativada"); setSelectedLicense((p) => p ? { ...p, status: "active" } : null); fetchData(); }
                      }}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Ativar</Button>
                  )}
                  {selectedLicense.hwid && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="flex-1 text-warning border-warning/30 hover:bg-warning/10" size="sm"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />HWID</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle className="font-heading">Resetar HWID?</AlertDialogTitle><AlertDialogDescription>Será travado no próximo login.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => resetHwid(selectedLicense.id)} className="bg-warning hover:bg-warning/90 text-warning-foreground">Resetar</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex-1" size="sm"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle className="font-heading">Excluir licença?</AlertDialogTitle><AlertDialogDescription>Licença e usuário serão removidos.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteLicense(selectedLicense.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Licenses;
