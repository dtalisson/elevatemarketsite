import { useState, useEffect, useRef, useCallback } from "react";
import { usePanelUser } from "@/contexts/PanelUserContext";
import { toast } from "sonner";
import { Key, Trash2, RotateCcw, LogOut, Plus, Users, Search, Copy, Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LicenseDetailModal } from "@/components/LicenseDetailModal";

interface App { id: string; name: string; }
interface License { id: string; license_key: string; status: string; remaining_seconds: number | null; note: string | null; created_at: string; application_id: string; expires_at?: string | null; hwid?: string | null; claimed_by?: string | null; activated_at?: string | null; ban_reason?: string | null; }
interface SoftwareUser { id: string; username: string; hwid: string | null; ip_address: string | null; last_login_at: string | null; created_at: string; application_id: string; license_id: string; }

const PanelUserDashboard = () => {
  const { panelUser, logoutPanelUser, secureApiCall } = usePanelUser();
  const [apps, setApps] = useState<App[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [users, setUsers] = useState<SoftwareUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState("");
  const [search, setSearch] = useState("");

  // Create license form
  const [createOpen, setCreateOpen] = useState(false);
  const [createAppId, setCreateAppId] = useState("");
  const [createPlan, setCreatePlan] = useState("monthly");
  const [createQty, setCreateQty] = useState("1");
  const [createNote, setCreateNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedLicenseDetail, setSelectedLicenseDetail] = useState<License | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const apiCall = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    return secureApiCall("/panel-user-actions", {
      method: "POST",
      body: JSON.stringify({ action, ...extra }),
    });
  }, [secureApiCall]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [appsRes, licensesRes, usersRes] = await Promise.all([
        apiCall("get-apps"),
        apiCall("list-licenses"),
        apiCall("list-users"),
      ]);

      if (appsRes.success) setApps(appsRes.apps || []);
      if (licensesRes.success) setLicenses(licensesRes.licenses || []);
      if (usersRes.success) setUsers(usersRes.users || []);

      if ([appsRes, licensesRes, usersRes].some((res) => res?.rate_limited)) {
        toast.error("Muitas requisições. Aguarde alguns segundos.");
      }
    } catch {
      toast.error("Erro ao carregar dados do painel");
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    if (panelUser?.id) {
      fetchData();
    }
  }, [panelUser?.id, fetchData]);

  // Particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animationId: number;
    const particles: { x: number; y: number; r: number; speed: number; opacity: number; drift: number }[] = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 40; i++) {
      particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 1.5 + 0.5, speed: Math.random() * 0.3 + 0.1, opacity: Math.random() * 0.1 + 0.02, drift: (Math.random() - 0.5) * 0.2 });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.y += p.speed; p.x += p.drift;
        if (p.y > canvas.height + 5) { p.y = -5; p.x = Math.random() * canvas.width; }
        if (p.x < -5) p.x = canvas.width + 5;
        if (p.x > canvas.width + 5) p.x = -5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.opacity})`; ctx.fill();
      }
      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animationId); window.removeEventListener("resize", resize); };
  }, []);

  const handleCreateLicense = async () => {
    if (!createAppId) { toast.error("Selecione uma aplicação"); return; }
    setCreating(true);
    const res = await apiCall("create-license", {
      application_id: createAppId, plan: createPlan, quantity: parseInt(createQty), note: createNote,
    });
    if (res.success) {
      toast.success(res.message);
      if (res.licenses?.length === 1) {
        navigator.clipboard.writeText(res.licenses[0].key);
        toast.info("Key copiada!");
      }
      setCreateOpen(false);
      setCreateNote("");
      fetchData();
    } else {
      toast.error(res.message);
    }
    setCreating(false);
  };

  const handleDeleteLicense = async (licenseId: string) => {
    const res = await apiCall("delete-license", { license_id: licenseId });
    if (res.success) { toast.success("Licença deletada"); fetchData(); }
    else toast.error(res.message);
  };

  const handleDeleteUser = async (userId: string) => {
    const res = await apiCall("delete-user", { user_id: userId });
    if (res.success) { toast.success("Usuário deletado"); fetchData(); }
    else toast.error(res.message);
  };

  const handleResetHwid = async (userId: string) => {
    const res = await apiCall("reset-hwid", { user_id: userId });
    if (res.success) { toast.success("HWID resetado"); fetchData(); }
    else toast.error(res.message);
  };

  const daysLeft = panelUser ? Math.max(0, Math.ceil((new Date(panelUser.expires_at).getTime() - Date.now()) / 86400000)) : 0;

  const filteredLicenses = licenses.filter(l => (!selectedApp || l.application_id === selectedApp) && (!search || l.license_key.toLowerCase().includes(search.toLowerCase())));
  const filteredUsers = users.filter(u => (!selectedApp || u.application_id === selectedApp) && (!search || u.username.toLowerCase().includes(search.toLowerCase())));

  const getAppName = (appId: string) => apps.find(a => a.id === appId)?.name || "?";

  const plans = [
    { key: "1day", label: "1 Dia" },
    { key: "trial", label: "Trial (3 Dias)" },
    { key: "weekly", label: "Semanal (7 Dias)" },
    { key: "monthly", label: "Mensal (30 Dias)" },
    { key: "lifetime", label: "Lifetime" },
  ];

  return (
    <div className="dark relative min-h-screen bg-transparent">
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-border/80 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <span className="text-xl font-heading font-bold text-foreground">
            Elevate<span className="text-primary">Auth</span>
          </span>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-medium text-foreground">{panelUser?.username}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {daysLeft} dias restantes
              </p>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
              {(panelUser?.username || "U")[0].toUpperCase()}
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive" onClick={logoutPanelUser}>
              <LogOut className="h-3.5 w-3.5" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-8">
        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card/80 backdrop-blur p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Licenças Criadas</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{licenses.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card/80 backdrop-blur p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Usuários</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{users.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card/80 backdrop-blur p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Aplicações</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{apps.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card/80 backdrop-blur p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dias Restantes</p>
            <p className={`mt-1 text-2xl font-bold ${daysLeft <= 3 ? "text-destructive" : "text-foreground"}`}>{daysLeft}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Select value={selectedApp} onValueChange={setSelectedApp}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="Todas as apps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {apps.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 w-[200px] text-xs" />
            </div>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Criar Licença</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Criar Licença</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Aplicação</Label>
                  <Select value={createAppId} onValueChange={setCreateAppId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {apps.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select value={createPlan} onValueChange={setCreatePlan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {plans.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input type="number" min="1" max="50" value={createQty} onChange={e => setCreateQty(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nota (opcional)</Label>
                  <Input value={createNote} onChange={e => setCreateNote(e.target.value)} placeholder="Ex: Cliente João" />
                </div>
                <Button className="w-full" disabled={creating} onClick={handleCreateLicense}>
                  {creating ? "Criando..." : "Criar Licença"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <Tabs defaultValue="licenses">
            <TabsList className="mb-4">
              <TabsTrigger value="licenses" className="gap-1.5"><Key className="h-3.5 w-3.5" /> Licenças ({filteredLicenses.length})</TabsTrigger>
              <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Usuários ({filteredUsers.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="licenses">
              {filteredLicenses.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/80 p-12 text-center">
                  <Key className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma licença criada</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Key</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">App</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Nota</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Criada</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLicenses.map(l => (
                          <tr key={l.id} className="border-b border-border/50 hover:bg-muted/10">
                            <td className="px-4 py-3">
                              <button className="flex items-center gap-1.5 font-mono text-xs text-foreground hover:text-primary transition-colors" onClick={() => { navigator.clipboard.writeText(l.license_key); toast.success("Copiada!"); }}>
                                <Copy className="h-3 w-3" /> {l.license_key}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{getAppName(l.application_id)}</td>
                            <td className="px-4 py-3">
                              <Badge variant={l.status === "active" ? "default" : "secondary"} className="text-[10px]">{l.status}</Badge>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{l.note || "—"}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString("pt-BR")}</td>
                            <td className="px-4 py-3 text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir licença?</AlertDialogTitle>
                                    <AlertDialogDescription>A licença e usuários associados serão removidos permanentemente.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteLicense(l.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="users">
              {filteredUsers.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/80 p-12 text-center">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum usuário encontrado</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Usuário</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">App</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">HWID</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="border-b border-border/50 hover:bg-muted/10">
                            <td className="px-4 py-3 font-medium text-foreground text-xs">{u.username}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{getAppName(u.application_id)}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{u.hwid ? u.hwid.slice(0, 12) + "..." : "—"}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => handleResetHwid(u.id)}>
                                  <RotateCcw className="h-3 w-3" /> HWID
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Deletar {u.username}?</AlertDialogTitle>
                                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteUser(u.id)}>Deletar</AlertDialogAction>
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
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default PanelUserDashboard;
