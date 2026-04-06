import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Copy, Trash2, AppWindow, Settings2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Application {
  id: string;
  name: string;
  description: string | null;
  secret_key: string;
  enabled: boolean;
  current_version: string | null;
  min_version: string | null;
  created_at: string;
}

const Applications = () => {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [settingsAppId, setSettingsAppId] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState("");
  const [editMinVersion, setEditMinVersion] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchApps = async () => {
    const { data } = await supabase.from("applications").select("*").order("created_at", { ascending: false });
    if (data) setApps(data as Application[]);
  };

  useEffect(() => { if (user) fetchApps(); }, [user]);

  const createApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const { error } = await supabase.from("applications").insert({
      name,
      description: description || null,
      owner_id: user.id,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Aplicação criada!");
      setName("");
      setDescription("");
      setOpen(false);
      fetchApps();
    }
    setLoading(false);
  };

  const deleteApp = async (id: string) => {
    const { error } = await supabase.from("applications").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Aplicação removida"); fetchApps(); }
  };

  const toggleEnabled = async (id: string, currentEnabled: boolean) => {
    const { error } = await supabase
      .from("applications")
      .update({ enabled: !currentEnabled })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(!currentEnabled ? "Aplicação ativada!" : "Aplicação desativada!");
      fetchApps();
    }
  };

  const openSettings = (app: Application) => {
    setSettingsAppId(app.id);
    setEditVersion(app.current_version || "");
    setEditMinVersion(app.min_version || "");
  };

  const saveVersions = async () => {
    if (!settingsAppId) return;
    setSaving(true);

    const { error } = await supabase
      .from("applications")
      .update({
        current_version: editVersion || null,
        min_version: editMinVersion || null,
      })
      .eq("id", settingsAppId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Versões atualizadas!");
      setSettingsAppId(null);
      fetchApps();
    }
    setSaving(false);
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Chave copiada!");
  };

  const settingsApp = apps.find(a => a.id === settingsAppId);

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Aplicações</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas aplicações</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nova Aplicação</Button>
          </DialogTrigger>
          <DialogContent className="dark">
            <DialogHeader>
              <DialogTitle>Criar Aplicação</DialogTitle>
            </DialogHeader>
            <form onSubmit={createApp} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Minha Aplicação" required />
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição..." />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Criando..." : "Criar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Settings Dialog */}
      <Dialog open={!!settingsAppId} onOpenChange={(v) => !v && setSettingsAppId(null)}>
        <DialogContent className="dark">
          <DialogHeader>
            <DialogTitle>Configurações — {settingsApp?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Toggle Status */}
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Status da Aplicação</p>
                <p className="text-xs text-muted-foreground">
                  {settingsApp?.enabled
                    ? "Ativa — usuários podem usar normalmente"
                    : "Desativada — ninguém consegue usar"}
                </p>
              </div>
              <Switch
                checked={settingsApp?.enabled ?? false}
                onCheckedChange={() => settingsApp && toggleEnabled(settingsApp.id, settingsApp.enabled)}
              />
            </div>

            {/* Versions */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Versão Atual</Label>
                <Input
                  value={editVersion}
                  onChange={(e) => setEditVersion(e.target.value)}
                  placeholder="ex: 1.1.0"
                />
                <p className="text-xs text-muted-foreground">
                  Versão mais recente do programa. Exibida no login para o usuário saber se está atualizado.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Versão Mínima Aceita</Label>
                <Input
                  value={editMinVersion}
                  onChange={(e) => setEditMinVersion(e.target.value)}
                  placeholder="ex: 1.0.0"
                />
                <p className="text-xs text-muted-foreground">
                  Se o programa do cliente enviar uma versão abaixo dessa, será bloqueado e forçado a atualizar.
                </p>
              </div>
            </div>

            <Button onClick={saveVersions} className="w-full" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {apps.length === 0 ? (
        <Card className="border-border/50 bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AppWindow className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma aplicação criada</p>
            <p className="text-sm text-muted-foreground">Crie sua primeira aplicação para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Card key={app.id} className="border-border/50 bg-card">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base">{app.name}</CardTitle>
                  {app.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{app.description}</p>
                  )}
                </div>
                <Badge variant={app.enabled ? "default" : "destructive"}>
                  {app.enabled ? "Ativo" : "Desativado"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Secret Key</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
                      {app.secret_key}
                    </code>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyKey(app.secret_key)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Version info */}
                {(app.current_version || app.min_version) && (
                  <div className="flex gap-4 text-xs">
                    {app.current_version && (
                      <div>
                        <span className="text-muted-foreground">Versão: </span>
                        <span className="font-mono text-foreground">{app.current_version}</span>
                      </div>
                    )}
                    {app.min_version && (
                      <div>
                        <span className="text-muted-foreground">Mín: </span>
                        <span className="font-mono text-foreground">{app.min_version}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openSettings(app)}>
                    <Settings2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteApp(app.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default Applications;
