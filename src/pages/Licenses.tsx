import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
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

interface Application {
  id: string;
  name: string;
}

interface SoftwareUser {
  id: string;
  username: string;
  password_hash: string;
  password_plain: string | null;
  hwid: string | null;
  license_id: string;
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  unused: "bg-muted text-muted-foreground border-border",
  expired: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  banned: "bg-red-500/20 text-red-400 border-red-500/30",
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
      application_id: selectedApp,
      created_by: user.id,
      max_uses: 1,
      expires_at: expiresAt,
      note: note || null,
    }));
    const { error } = await supabase.from("licenses").insert(inserts);
    if (error) toast.error(error.message);
    else {
      toast.success(`${qty} licença(s) criada(s)!`);
      setOpen(false); setNote(""); setExpDays(""); setQuantity("1");
      fetchData();
    }
    setLoading(false);
  };

  const deleteLicense = async (id: string) => {
    const { error } = await supabase.from("licenses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Licença removida"); setSelectedLicense(null); fetchData(); }
  };

  const resetHwid = async (licenseId: string) => {
    const { error: licErr } = await supabase.from("licenses").update({ hwid: null }).eq("id", licenseId);
    if (licErr) { toast.error("Erro ao resetar HWID"); return; }
    const su = softwareUsers[licenseId];
    if (su) await supabase.from("software_users").update({ hwid: null }).eq("id", su.id);
    toast.success("HWID resetado!");
    fetchData();
    if (selectedLicense?.id === licenseId) setSelectedLicense((p) => p ? { ...p, hwid: null } : null);
  };

  // Bulk actions
  const bulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("licenses").delete().in("id", ids);
    if (error) toast.error(error.message);
    else { toast.success(`${ids.length} licença(s) excluída(s)`); setSelected(new Set()); fetchData(); }
    setBulkLoading(false);
  };

  const bulkResetHwid = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selected);
    await supabase.from("licenses").update({ hwid: null }).in("id", ids);
    // Reset software_users hwid for those licenses
    for (const id of ids) {
      const su = softwareUsers[id];
      if (su) await supabase.from("software_users").update({ hwid: null }).eq("id", su.id);
    }
    toast.success(`HWID resetado em ${ids.length} licença(s)`);
    setSelected(new Set());
    fetchData();
    setBulkLoading(false);
  };

  const bulkBan = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("licenses").update({ status: "banned" as const }).in("id", ids);
    if (error) toast.error(error.message);
    else { toast.success(`${ids.length} licença(s) banida(s)`); setSelected(new Set()); fetchData(); }
    setBulkLoading(false);
  };

  const bulkActivate = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("licenses").update({ status: "active" as const }).in("id", ids);
    if (error) toast.error(error.message);
    else { toast.success(`${ids.length} licença(s) ativada(s)`); setSelected(new Set()); fetchData(); }
    setBulkLoading(false);
  };

  const copyKey = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const getAppName = (appId: string) => apps.find((a) => a.id === appId)?.name || "—";

  // Filter by app tab + search + status
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

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.id)));
  };

  // Stats per app tab
  const appCounts = apps.map((app) => ({
    ...app,
    count: licenses.filter((l) => l.application_id === app.id).length,
  }));

  const InfoRow = ({ label, value, copyable, mono }: { label: string; value: string | null | undefined; copyable?: boolean; mono?: boolean }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-xs text-foreground ${mono ? "font-mono" : ""} max-w-[220px] truncate`}>{value || "—"}</span>
        {copyable && value && (
          <button onClick={() => copyKey(value)} className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Licenças</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas license keys</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={apps.length === 0} size="sm"><Plus className="mr-2 h-3.5 w-3.5" />Gerar Licenças</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Gerar Licenças</DialogTitle></DialogHeader>
            <form onSubmit={createLicenses} className="space-y-4">
              <div className="space-y-2">
                <Label>Aplicação</Label>
                <Select value={selectedApp} onValueChange={setSelectedApp}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{apps.map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Quantidade</Label><Input type="number" min="1" max="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
              <div className="space-y-2"><Label>Expiração (dias)</Label><Input type="number" min="1" value={expDays} onChange={(e) => setExpDays(e.target.value)} placeholder="Vazio = sem expiração" /></div>
              <div className="space-y-2"><Label>Nota (opcional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota interna..." /></div>
              <Button type="submit" className="w-full" disabled={loading || !selectedApp}>{loading ? "Gerando..." : "Gerar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* App tabs */}
      {apps.length > 1 && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => { setFilterApp("all"); setSelected(new Set()); }}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all whitespace-nowrap"
            style={{
              background: filterApp === "all" ? "rgba(255,255,255,0.06)" : "transparent",
              color: filterApp === "all" ? "hsl(210 20% 85%)" : "hsl(210 12% 38%)",
              border: filterApp === "all" ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
            }}
          >
            Todas ({licenses.length})
          </button>
          {appCounts.map((app) => (
            <button
              key={app.id}
              onClick={() => { setFilterApp(app.id); setSelected(new Set()); }}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all whitespace-nowrap"
              style={{
                background: filterApp === app.id ? "rgba(255,255,255,0.06)" : "transparent",
                color: filterApp === app.id ? "hsl(210 20% 85%)" : "hsl(210 12% 38%)",
                border: filterApp === app.id ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
              }}
            >
              {app.name} ({app.count})
            </button>
          ))}
        </div>
      )}

      {/* Filters + bulk actions bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por key ou usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          className="mb-3 flex items-center gap-2 rounded-lg px-4 py-2.5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-[12px] font-medium mr-2" style={{ color: "hsl(210 20% 70%)" }}>
            {selected.size} selecionada(s)
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-destructive" disabled={bulkLoading}>
                <Trash2 className="h-3 w-3" />Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir {selected.size} licença(s)?</AlertDialogTitle>
                <AlertDialogDescription>Essa ação não pode ser desfeita. Os usuários associados também serão removidos.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={bulkDelete} className="bg-red-500 hover:bg-red-600">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 text-muted-foreground" onClick={bulkResetHwid} disabled={bulkLoading}>
            <RotateCcw className="h-3 w-3" />Resetar HWID
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 text-muted-foreground" onClick={bulkBan} disabled={bulkLoading}>
            <Ban className="h-3 w-3" />Banir
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 text-muted-foreground" onClick={bulkActivate} disabled={bulkLoading}>
            <CheckCircle2 className="h-3 w-3" />Ativar
          </Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            Limpar seleção
          </button>
        </div>
      )}

      {apps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)" }}><Key className="h-10 w-10 text-muted-foreground" /></div>
            <p className="text-foreground font-medium">Crie uma aplicação primeiro</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)" }}><Key className="h-10 w-10 text-muted-foreground" /></div>
            <p className="text-foreground font-medium">{search || filterStatus !== "all" ? "Nenhuma licença encontrada" : "Nenhuma licença gerada"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {/* Select all header */}
          <div className="flex items-center gap-3 px-4 py-2">
            <Checkbox
              checked={selected.size === filtered.length && filtered.length > 0}
              onCheckedChange={toggleAll}
              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className="text-[11px] text-muted-foreground">Selecionar todas</span>
          </div>

          {filtered.map((lic) => {
            const su = softwareUsers[lic.id];
            const isSelected = selected.has(lic.id);
            return (
              <div
                key={lic.id}
                className="flex items-center gap-3 rounded-lg px-4 py-3 transition-all cursor-pointer"
                style={{
                  background: isSelected ? "rgba(255,255,255,0.04)" : "rgba(12, 14, 20, 0.5)",
                  border: `1px solid ${isSelected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)"}`,
                }}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelect(lic.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary flex-shrink-0"
                />
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => { setSelectedLicense(lic); setShowPassword(false); }}
                >
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-[11px]" style={{ color: "hsl(210 20% 65%)" }}>
                      {lic.license_key.substring(0, 24)}...
                    </code>
                    <Badge variant="outline" className={`${statusColors[lic.status] || ""} text-[9px] px-1.5 py-0`}>{lic.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {filterApp === "all" && <span className="text-[10px] text-muted-foreground">{getAppName(lic.application_id)}</span>}
                    {lic.hwid ? (
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: "hsl(142 40% 45%)" }}>
                        <Monitor className="h-2.5 w-2.5" />Locked
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Monitor className="h-2.5 w-2.5" />—
                      </span>
                    )}
                    {su && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <User className="h-2.5 w-2.5" />{su.username}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />{formatDate(lic.created_at)}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary flex-shrink-0" onClick={(e) => { e.stopPropagation(); copyKey(lic.license_key); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* License detail modal */}
      <Dialog open={!!selectedLicense} onOpenChange={(o) => { if (!o) { setSelectedLicense(null); setShowPassword(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              Detalhes da Licença
              {selectedLicense && <Badge variant="outline" className={`${statusColors[selectedLicense.status]} text-[10px]`}>{selectedLicense.status}</Badge>}
            </DialogTitle>
          </DialogHeader>

          {selectedLicense && (() => {
            const su = softwareUsers[selectedLicense.id];
            return (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Chave</p>
                  <InfoRow label="License Key" value={selectedLicense.license_key} copyable mono />
                  <InfoRow label="App" value={getAppName(selectedLicense.application_id)} />
                  <InfoRow label="Nota" value={selectedLicense.note} />
                </div>

                <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Usuário Registrado</p>
                  {su ? (
                    <>
                      <InfoRow label="Username" value={su.username} copyable mono />
                      <div className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
                        <span className="text-xs text-muted-foreground">Senha</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-foreground font-mono max-w-[180px] truncate">
                            {showPassword ? (su.password_plain || "N/A") : "••••••••••••••••"}
                          </span>
                          <button onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                            {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                          {su.password_plain && (
                            <button onClick={() => copyKey(su.password_plain!)} className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                              <Copy className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 py-2">Nenhum usuário registrado</p>
                  )}
                </div>

                <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Dispositivo</p>
                  <InfoRow label="Status" value={selectedLicense.status} />
                  <InfoRow label="Usado por" value={selectedLicense.claimed_by} />
                  <InfoRow label="HWID" value={selectedLicense.hwid} copyable mono />
                </div>

                <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Datas</p>
                  <InfoRow label="Criada em" value={formatDate(selectedLicense.created_at)} />
                  <InfoRow label="Ativada em" value={selectedLicense.activated_at ? formatDate(selectedLicense.activated_at) : null} />
                  <InfoRow label="Expira em" value={selectedLicense.expires_at ? formatDate(selectedLicense.expires_at) : "Sem expiração"} />
                </div>

                <div className="space-y-2">
                  {selectedLicense.hwid && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10" size="sm">
                          <RotateCcw className="mr-2 h-3.5 w-3.5" />Resetar HWID
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Resetar HWID</AlertDialogTitle>
                          <AlertDialogDescription>O HWID será travado novamente no próximo login.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => resetHwid(selectedLicense.id)} className="bg-yellow-600 hover:bg-yellow-700">Resetar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full" size="sm">
                        <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir Licença
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir licença</AlertDialogTitle>
                        <AlertDialogDescription>A licença e o usuário associado serão removidos permanentemente.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteLicense(selectedLicense.id)} className="bg-red-500 hover:bg-red-600">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
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
