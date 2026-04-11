import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, Users, Search, Eye, EyeOff } from "lucide-react";

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

const PanelUsersPage = () => {
  const { user } = useAuth();
  const [panelUsers, setPanelUsers] = useState<PanelUser[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [userApps, setUserApps] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // Form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newDays, setNewDays] = useState("30");
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

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

  useEffect(() => { fetchData(); }, [user]);

  const handleCreate = async () => {
    if (!user || !newUsername || !newPassword) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (newPassword.length < 4) {
      toast.error("Senha deve ter pelo menos 4 caracteres");
      return;
    }
    if (selectedApps.length === 0) {
      toast.error("Selecione pelo menos uma aplicação");
      return;
    }
    setCreating(true);

    // Hash password
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

    if (error) {
      toast.error(error.message.includes("duplicate") ? "Usuário já existe" : error.message);
      setCreating(false);
      return;
    }

    // Insert app associations
    if (data) {
      const appInserts = selectedApps.map(appId => ({
        panel_user_id: data.id,
        application_id: appId,
      }));
      await supabase.from("panel_user_applications").insert(appInserts);
    }

    toast.success("Usuário criado!");
    setOpen(false);
    setNewUsername("");
    setNewPassword("");
    setNewDays("30");
    setSelectedApps([]);
    setCreating(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("panel_users").delete().eq("id", id);
    toast.success("Usuário removido");
    fetchData();
  };

  const toggleActive = async (pu: PanelUser) => {
    await supabase.from("panel_users").update({ is_active: !pu.is_active }).eq("id", pu.id);
    toast.success(pu.is_active ? "Desativado" : "Ativado");
    fetchData();
  };

  const filtered = panelUsers.filter(pu =>
    pu.username.toLowerCase().includes(search.toLowerCase())
  );

  const getAppNames = (puId: string) => {
    const appIds = userApps[puId] || [];
    return appIds.map(id => apps.find(a => a.id === id)?.name || "?").join(", ");
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Usuários do Painel</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie sub-usuários com acesso limitado</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo Usuário</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Usuário do Painel</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input placeholder="nome_do_usuario" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
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
                      <Checkbox
                        checked={selectedApps.includes(app.id)}
                        onCheckedChange={(checked) => {
                          setSelectedApps(prev =>
                            checked ? [...prev, app.id] : prev.filter(id => id !== app.id)
                          );
                        }}
                      />
                      <span className="text-sm text-foreground">{app.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button className="w-full" disabled={creating} onClick={handleCreate}>
                {creating ? "Criando..." : "Criar Usuário"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
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
                {filtered.map(pu => (
                  <tr key={pu.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{pu.username}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{getAppNames(pu.id) || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(pu.expires_at).toLocaleDateString("pt-BR")}
                    </td>
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
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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
    </DashboardLayout>
  );
};

export default PanelUsersPage;
