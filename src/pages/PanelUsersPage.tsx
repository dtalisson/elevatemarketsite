import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, Users, Search, Eye, EyeOff, Key, Copy, RotateCcw, Ban, CheckCircle2, Settings, ShieldCheck } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type License = Tables<"licenses">;

interface PanelUser {
  id: string;
  username: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
}

interface Application {
  id: string;
  name: string;
}

interface SoftwareUser {
  id: string;
  username: string;
  hwid: string | null;
  license_id: string;
}

function getEffectiveStatus(lic: { status: string; expires_at: string | null }): string {
  if (lic.status === "active" && lic.expires_at && new Date(lic.expires_at) < new Date()) return "expired";
  return lic.status;
}

const statusColors: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  unused: "bg-muted text-muted-foreground",
  expired: "bg-warning/10 text-warning",
  banned: "bg-destructive/10 text-destructive",
};

const PanelUsersPage = () => {
  const { user } = useAuth();
  const [panelUsers, setPanelUsers] = useState<PanelUser[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [userApps, setUserApps] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // Create form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newDays, setNewDays] = useState("30");
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Services tab
  const [selectedPanelUser, setSelectedPanelUser] = useState<string>("all");
  const [panelLicenses, setPanelLicenses] = useState<License[]>([]);
  const [softwareUsers, setSoftwareUsers] = useState<Record<string, SoftwareUser>>({});
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesSearch, setServicesSearch] = useState("");
  const [servicesFilterStatus, setServicesFilterStatus] = useState("all");
  const [servicesSelected, setServicesSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [puRes, appsRes, puaRes] = await Promise.all([
      supabase.from("panel_users").select("*").order("created_at", { ascending: false }),
      supabase.from("applications").select("id, name").eq("owner_id", user.id),
      supabase.from("panel_user_applications").select("*"),
    ]);
    if (puRes.data) setPanelUsers(puRes.data as PanelUser[]);
    if (appsRes.data) setApps(appsRes.data);
    if (puaRes.data) {
      const m: Record<string, string[]> = {};
      puaRes.data.forEach((pua: any) => {
        if (!m[pua.panel_user_id]) m[pua.panel_user_id] = [];
        m[pua.panel_user_id].push(pua.application_id);
      });
      setUserApps(m);
    }
    setLoading(false);
  };

  const fetchPanelLicenses = async () => {
    if (!user) return;
    setServicesLoading(true);
    const query = supabase.from("licenses").select("*").not("panel_user_id", "is", null).order("created_at", { ascending: false });
    if (selectedPanelUser !== "all") {
      query.eq("panel_user_id", selectedPanelUser);
    }
    const [licRes, usersRes] = await Promise.all([
      query,
      supabase.from("software_users_safe").select("id, username, hwid, license_id"),
    ]);
    if (licRes.data) setPanelLicenses(licRes.data as License[]);
    if (usersRes.data) {
      const userMap: Record<string, SoftwareUser> = {};
      (usersRes.data as SoftwareUser[]).forEach((u) => (userMap[u.license_id] = u));
      setSoftwareUsers(userMap);
    }
    setServicesLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);
  useEffect(() => { if (user) fetchPanelLicenses(); }, [user, selectedPanelUser]);

  const handleCreate = async () => {
    if (!user || !newUsername || !newPassword) { toast.error("Preencha todos os campos"); return; }
    if (newPassword.length < 4) { toast.error("Senha deve ter pelo menos 4 caracteres"); return; }
    if (selectedApps.length === 0) { toast.error("Selecione pelo menos uma aplicação"); return; }
    setCreating(true);
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(newPassword));
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(newDays || "30"));
    const { data, error } = await supabase.from("panel_users").insert({
      username: newUsername.toLowerCase(),
      password_hash: hashHex,
      created_by: user.id,
      expires_at: expiresAt.toISOString(),
    }).select().single();
    if (error) { toast.error(error.message.includes("duplicate") ? "Usuário já existe" : error.message); setCreating(false); return; }
    if (data) {
      const appInserts = selectedApps.map(appId => ({ panel_user_id: data.id, application_id: appId }));
      await supabase.from("panel_user_applications").insert(appInserts);
    }
    toast.success("Usuário criado!");
    setOpen(false); setNewUsername(""); setNewPassword(""); setNewDays("30"); setSelectedApps([]); setCreating(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("panel_users").delete().eq("id", id);
    toast.success("Usuário removido"); fetchData();
  };

  const toggleActive = async (pu: PanelUser) => {
    await supabase.from("panel_users").update({ is_active: !pu.is_active }).eq("id", pu.id);
    toast.success(pu.is_active ? "Desativado" : "Ativado"); fetchData();
  };

  const getAppNames = (puId: string) => {
    const appIds = userApps[puId] || [];
    return appIds.map(id => apps.find(a => a.id === id)?.name || "?").join(", ");
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  const filteredUsers = panelUsers.filter(pu => pu.username.toLowerCase().includes(search.toLowerCase()));

  // Services helpers
  const copyKey = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };
  const formatDate = (date: string) => new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const getAppName = (appId: string) => apps.find(a => a.id === appId)?.name || "—";
  const getPanelUserName = (id: string | null) => panelUsers.find(pu => pu.id === id)?.username || "—";

  const filteredLicenses = panelLicenses.filter((lic) => {
    if (servicesSearch) {
      const s = servicesSearch.toLowerCase();
      const su = softwareUsers[lic.id];
      if (!lic.license_key.toLowerCase().includes(s) && !lic.claimed_by?.toLowerCase().includes(s) && !su?.username.toLowerCase().includes(s)) return false;
    }
    if (servicesFilterStatus !== "all" && getEffectiveStatus(lic) !== servicesFilterStatus) return false;
    return true;
  });

  const resetHwid = async (licenseId: string) => {
    await supabase.from("licenses").update({ hwid: null }).eq("id", licenseId);
    const su = softwareUsers[licenseId];
    if (su) await supabase.from("software_users").update({ hwid: null }).eq("id", su.id);
    toast.success("HWID resetado!"); fetchPanelLicenses();
  };

  const deactivateLicense = async (licenseId: string) => {
    const lic = panelLicenses.find(l => l.id === licenseId);
    if (!lic) return;
    const updates: any = { status: "banned", ban_reason: "Desativado pelo admin" };
    if (lic.expires_at) updates.remaining_seconds = Math.max(0, Math.floor((new Date(lic.expires_at).getTime() - Date.now()) / 1000));
    await supabase.from("licenses").update(updates).eq("id", licenseId);
    toast.success("Licença desativada"); fetchPanelLicenses();
  };

  const activateLicense = async (licenseId: string) => {
    const lic = panelLicenses.find(l => l.id === licenseId);
    if (!lic) return;
    const updates: any = { status: "active", ban_reason: null };
    if (lic.remaining_seconds && lic.remaining_seconds > 0) {
      updates.expires_at = new Date(Date.now() + lic.remaining_seconds * 1000).toISOString();
      updates.remaining_seconds = null;
    }
    await supabase.from("licenses").update(updates).eq("id", licenseId);
    toast.success("Licença ativada"); fetchPanelLicenses();
  };

  const deleteLicense = async (id: string) => {
    await supabase.from("licenses").delete().eq("id", id);
    toast.success("Licença removida"); fetchPanelLicenses();
  };

  const toggleServiceSelect = (id: string) => setServicesSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAllServices = () => { if (servicesSelected.size === filteredLicenses.length) setServicesSelected(new Set()); else setServicesSelected(new Set(filteredLicenses.map(l => l.id))); };

  const bulkDeleteLicenses = async () => {
    setBulkLoading(true);
    await supabase.from("licenses").delete().in("id", Array.from(servicesSelected));
    toast.success(`${servicesSelected.size} excluída(s)`); setServicesSelected(new Set()); fetchPanelLicenses(); setBulkLoading(false);
  };

  const bulkBanLicenses = async () => {
    setBulkLoading(true);
    for (const id of servicesSelected) await deactivateLicense(id);
    setServicesSelected(new Set()); fetchPanelLicenses(); setBulkLoading(false);
  };

  const bulkActivateLicenses = async () => {
    setBulkLoading(true);
    for (const id of servicesSelected) await activateLicense(id);
    setServicesSelected(new Set()); fetchPanelLicenses(); setBulkLoading(false);
  };

  const bulkResetHwid = async () => {
    setBulkLoading(true);
    for (const id of servicesSelected) await resetHwid(id);
    setServicesSelected(new Set()); fetchPanelLicenses(); setBulkLoading(false);
  };

  // Stats for reseller tab
  const totalKeys = panelLicenses.length;
  const activeKeys = panelLicenses.filter(l => getEffectiveStatus(l) === "active").length;
  const bannedKeys = panelLicenses.filter(l => getEffectiveStatus(l) === "banned").length;
  const unusedKeys = panelLicenses.filter(l => getEffectiveStatus(l) === "unused").length;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Painel de Revendedores</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie revendedores, usuários e serviços</p>
      </div>

      <Tabs defaultValue="reseller" className="space-y-4">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="reseller" className="gap-1.5 text-xs"><ShieldCheck className="h-3.5 w-3.5" />Reseller</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" />Painel Users</TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5 text-xs"><Settings className="h-3.5 w-3.5" />Painel Services</TabsTrigger>
        </TabsList>

        {/* ── Tab: Reseller (Overview) ── */}
        <TabsContent value="reseller">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Revendedores</p>
              <p className="text-2xl font-bold text-foreground mt-1">{panelUsers.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Keys Criadas</p>
              <p className="text-2xl font-bold text-foreground mt-1">{totalKeys}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Keys Ativas</p>
              <p className="text-2xl font-bold text-primary mt-1">{activeKeys}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Keys Banidas</p>
              <p className="text-2xl font-bold text-destructive mt-1">{bannedKeys}</p>
            </div>
          </div>

          {/* Per-reseller summary */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Revendedor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Aplicações</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Keys</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Ativas</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Expira em</th>
                </tr>
              </thead>
              <tbody>
                {panelUsers.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">Nenhum revendedor</td></tr>
                ) : panelUsers.map(pu => {
                  const puKeys = panelLicenses.filter(l => l.panel_user_id === pu.id);
                  const puActive = puKeys.filter(l => getEffectiveStatus(l) === "active").length;
                  return (
                    <tr key={pu.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{pu.username}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{getAppNames(pu.id) || "—"}</td>
                      <td className="px-4 py-3 text-center text-foreground">{puKeys.length}</td>
                      <td className="px-4 py-3 text-center text-primary">{puActive}</td>
                      <td className="px-4 py-3 text-center">
                        {isExpired(pu.expires_at) ? (
                          <Badge variant="destructive" className="text-[10px]">Expirado</Badge>
                        ) : pu.is_active ? (
                          <Badge className="bg-primary/10 text-primary text-[10px]">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Desativado</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(pu.expires_at).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Tab: Painel Users ── */}
        <TabsContent value="users">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo Usuário</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Criar Usuário do Painel</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>Usuário</Label>
                    <Input placeholder="nome_do_usuario" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Dias de acesso</Label>
                    <Input type="number" min="1" max="9999" value={newDays} onChange={e => setNewDays(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Aplicações autorizadas</Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border border-border p-3">
                      {apps.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma aplicação encontrada</p>}
                      {apps.map(app => (
                        <div key={app.id} className="flex items-center gap-2">
                          <Checkbox checked={selectedApps.includes(app.id)} onCheckedChange={(checked) => setSelectedApps(prev => checked ? [...prev, app.id] : prev.filter(id => id !== app.id))} />
                          <span className="text-sm text-foreground">{app.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full" disabled={creating} onClick={handleCreate}>{creating ? "Criando..." : "Criar Usuário"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum usuário do painel</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Usuário</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Aplicações</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Expira em</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(pu => (
                      <tr key={pu.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{pu.username}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{getAppNames(pu.id) || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(pu.expires_at).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3">
                          {isExpired(pu.expires_at) ? (
                            <Badge variant="destructive" className="text-[10px]">Expirado</Badge>
                          ) : pu.is_active ? (
                            <Badge className="bg-primary/10 text-primary text-[10px]">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Desativado</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleActive(pu)}>
                              {pu.is_active ? "Desativar" : "Ativar"}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover {pu.username}?</AlertDialogTitle>
                                  <AlertDialogDescription>As licenças criadas por este usuário serão mantidas.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(pu.id)}>Remover</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Painel Services ── */}
        <TabsContent value="services">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Select value={selectedPanelUser} onValueChange={(v) => { setSelectedPanelUser(v); setServicesSelected(new Set()); }}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Revendedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Revendedores</SelectItem>
                {panelUsers.map(pu => <SelectItem key={pu.id} value={pu.id}>{pu.username}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar key ou usuário..." value={servicesSearch} onChange={e => setServicesSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={servicesFilterStatus} onValueChange={setServicesFilterStatus}>
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

          {servicesSelected.size > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
              <span className="text-xs font-medium text-foreground mr-2">{servicesSelected.size} selecionada(s)</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-destructive" disabled={bulkLoading}><Trash2 className="h-3 w-3" />Excluir</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {servicesSelected.size} licença(s)?</AlertDialogTitle>
                    <AlertDialogDescription>Irreversível.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={bulkDeleteLicenses} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 text-muted-foreground" onClick={bulkResetHwid} disabled={bulkLoading}><RotateCcw className="h-3 w-3" />HWID</Button>
              <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 text-muted-foreground" onClick={bulkBanLicenses} disabled={bulkLoading}><Ban className="h-3 w-3" />Banir</Button>
              <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5 text-muted-foreground" onClick={bulkActivateLicenses} disabled={bulkLoading}><CheckCircle2 className="h-3 w-3" />Ativar</Button>
              <button onClick={() => setServicesSelected(new Set())} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors">Limpar</button>
            </div>
          )}

          {servicesLoading ? (
            <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : filteredLicenses.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <Key className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma licença de revendedor encontrada</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-3 px-4 py-2">
                <Checkbox checked={servicesSelected.size === filteredLicenses.length && filteredLicenses.length > 0} onCheckedChange={toggleAllServices} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                <span className="text-[11px] text-muted-foreground">Selecionar todas</span>
              </div>

              {filteredLicenses.map(lic => {
                const su = softwareUsers[lic.id];
                const isSelected = servicesSelected.has(lic.id);
                const effectiveStatus = getEffectiveStatus(lic);
                return (
                  <div key={lic.id} className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${isSelected ? "border-primary/30 bg-primary/5" : "border-border bg-card hover:border-primary/20"}`}>
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleServiceSelect(lic.id)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs font-mono text-foreground truncate max-w-[180px]">{lic.license_key}</code>
                        <button onClick={() => copyKey(lic.license_key)} className="text-muted-foreground hover:text-primary"><Copy className="h-3 w-3" /></button>
                        <Badge className={`${statusColors[effectiveStatus] || statusColors.unused} text-[10px]`}>{effectiveStatus}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>Revendedor: <span className="text-foreground">{getPanelUserName(lic.panel_user_id)}</span></span>
                        <span>App: <span className="text-foreground">{getAppName(lic.application_id)}</span></span>
                        {su && <span>Usuário: <span className="text-foreground">{su.username}</span></span>}
                        {lic.expires_at && <span>Exp: {formatDate(lic.expires_at)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => resetHwid(lic.id)} title="Reset HWID"><RotateCcw className="h-3 w-3" /></Button>
                      {effectiveStatus === "banned" ? (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-primary" onClick={() => activateLicense(lic.id)} title="Ativar"><CheckCircle2 className="h-3 w-3" /></Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deactivateLicense(lic.id)} title="Banir"><Ban className="h-3 w-3" /></Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir licença?</AlertDialogTitle>
                            <AlertDialogDescription>Irreversível.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteLicense(lic.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default PanelUsersPage;
