import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Copy, Trash2, AppWindow } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Application {
  id: string;
  name: string;
  description: string | null;
  secret_key: string;
  enabled: boolean;
  created_at: string;
}

const Applications = () => {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchApps = async () => {
    const { data } = await supabase.from("applications").select("*").order("created_at", { ascending: false });
    if (data) setApps(data);
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

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Chave copiada!");
  };

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
                <Badge variant={app.enabled ? "default" : "secondary"}>
                  {app.enabled ? "Ativo" : "Inativo"}
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
                <div className="flex justify-end">
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
