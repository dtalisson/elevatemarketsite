import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Settings2, Save } from "lucide-react";

interface Application {
  id: string; name: string; description: string | null; secret_key: string; enabled: boolean;
  current_version: string | null; min_version: string | null; msg_outdated: string | null;
  msg_disabled: string | null; msg_maintenance: string | null; created_at: string;
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
  const [editMsgOutdated, setEditMsgOutdated] = useState("");
  const [editMsgDisabled, setEditMsgDisabled] = useState("");
  const [editMsgMaintenance, setEditMsgMaintenance] = useState("");
  const [editName, setEditName] = useState("");
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
    const { error } = await supabase.from("applications").insert({ name, description: description || null, owner_id: user.id });
    if (error) toast.error(error.message);
    else { toast.success("Aplicação criada!"); setName(""); setDescription(""); setOpen(false); fetchApps(); }
    setLoading(false);
  };

  const deleteApp = async (id: string) => {
    const { error } = await supabase.from("applications").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Aplicação removida"); fetchApps(); }
  };

  const toggleEnabled = async (id: string, currentEnabled: boolean) => {
    const { error } = await supabase.from("applications").update({ enabled: !currentEnabled }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(!currentEnabled ? "Ativada!" : "Desativada!"); fetchApps(); }
  };

  const openSettings = (app: Application) => {
    setSettingsAppId(app.id);
    setEditVersion(app.current_version || "");
    setEditMinVersion(app.min_version || "");
    setEditMsgOutdated(app.msg_outdated || "");
    setEditMsgDisabled(app.msg_disabled || "");
    setEditMsgMaintenance(app.msg_maintenance || "");
  };

  const saveVersions = async () => {
    if (!settingsAppId) return;
    setSaving(true);
    const { error } = await supabase.from("applications").update({
      current_version: editVersion || null, min_version: editMinVersion || null,
      msg_outdated: editMsgOutdated || null, msg_disabled: editMsgDisabled || null, msg_maintenance: editMsgMaintenance || null,
    }).eq("id", settingsAppId);
    if (error) toast.error(error.message);
    else { toast.success("Atualizado!"); setSettingsAppId(null); fetchApps(); }
    setSaving(false);
  };

  const copyKey = (key: string) => { navigator.clipboard.writeText(key); toast.success("Copiado!"); };
  const settingsApp = apps.find(a => a.id === settingsAppId);

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Aplicações</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie suas aplicações</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Nova</Button>
          </DialogTrigger>
          <DialogContent className="dark">
            <DialogHeader><DialogTitle className="font-heading">Criar Aplicação</DialogTitle></DialogHeader>
            <form onSubmit={createApp} className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Minha Aplicação" required /></div>
              <div className="space-y-2"><Label>Descrição (opcional)</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição..." /></div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Criando..." : "Criar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!settingsAppId} onOpenChange={(v) => !v && setSettingsAppId(null)}>
        <DialogContent className="dark">
          <DialogHeader><DialogTitle className="font-heading">Configurações — {settingsApp?.name}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Status</p>
                <p className="text-xs text-muted-foreground">{settingsApp?.enabled ? "Ativa" : "Desativada"}</p>
              </div>
              <Switch checked={settingsApp?.enabled ?? false} onCheckedChange={() => settingsApp && toggleEnabled(settingsApp.id, settingsApp.enabled)} />
            </div>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Versão Atual</Label><Input value={editVersion} onChange={(e) => setEditVersion(e.target.value)} placeholder="ex: 1.1.0" /></div>
              <div className="space-y-2"><Label>Versão Mínima</Label><Input value={editMinVersion} onChange={(e) => setEditMinVersion(e.target.value)} placeholder="ex: 1.0.0" /></div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Mensagens</p>
              <div className="space-y-2"><Label>Desatualizada</Label><Input value={editMsgOutdated} onChange={(e) => setEditMsgOutdated(e.target.value)} placeholder="Versão desatualizada." /></div>
              <div className="space-y-2"><Label>Desativada</Label><Input value={editMsgDisabled} onChange={(e) => setEditMsgDisabled(e.target.value)} placeholder="Indisponível." /></div>
              <div className="space-y-2"><Label>Manutenção</Label><Input value={editMsgMaintenance} onChange={(e) => setEditMsgMaintenance(e.target.value)} placeholder="Em manutenção." /></div>
            </div>
            <Button onClick={saveVersions} className="w-full gap-2" disabled={saving}><Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {apps.length === 0 ? (
        <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-16">
          <p className="text-foreground font-heading font-medium">Nenhuma aplicação criada</p>
          <p className="text-sm text-muted-foreground mt-1">Crie sua primeira aplicação para começar</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <div key={app.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-heading font-semibold text-foreground">{app.name}</h3>
                  {app.description && <p className="mt-0.5 text-xs text-muted-foreground">{app.description}</p>}
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${app.enabled ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                  {app.enabled ? "Ativo" : "Off"}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Secret Key</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md bg-muted px-3 py-1.5 font-mono text-[11px] text-foreground/80">{app.secret_key}</code>
                  <button onClick={() => copyKey(app.secret_key)} className="text-muted-foreground hover:text-primary transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {(app.current_version || app.min_version) && (
                <div className="flex gap-4 text-xs mb-3">
                  {app.current_version && <span className="text-muted-foreground">v<span className="font-mono text-primary">{app.current_version}</span></span>}
                  {app.min_version && <span className="text-muted-foreground">min <span className="font-mono text-accent">{app.min_version}</span></span>}
                </div>
              )}

              <div className="flex justify-end gap-1 pt-2 border-t border-border">
                <button onClick={() => openSettings(app)} className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"><Settings2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => deleteApp(app.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default Applications;
