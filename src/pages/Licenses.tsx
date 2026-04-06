import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Key } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type License = Tables<"licenses">;

interface Application {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  unused: "bg-muted text-muted-foreground border-border",
  expired: "bg-destructive/10 text-destructive border-destructive/20",
  banned: "bg-destructive/10 text-destructive border-destructive/20",
};

const Licenses = () => {
  const { user } = useAuth();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [expDays, setExpDays] = useState("");
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchData = async () => {
    const [licRes, appRes] = await Promise.all([
      supabase.from("licenses").select("*").order("created_at", { ascending: false }),
      supabase.from("applications").select("id, name"),
    ]);
    if (licRes.data) setLicenses(licRes.data);
    if (appRes.data) setApps(appRes.data);
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
      max_uses: parseInt(maxUses) || 1,
      expires_at: expiresAt,
      note: note || null,
    }));

    const { error } = await supabase.from("licenses").insert(inserts);
    if (error) toast.error(error.message);
    else {
      toast.success(`${qty} licença(s) criada(s)!`);
      setOpen(false);
      setNote("");
      setExpDays("");
      setQuantity("1");
      fetchData();
    }
    setLoading(false);
  };

  const deleteLicense = async (id: string) => {
    const { error } = await supabase.from("licenses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Licença removida"); fetchData(); }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Chave copiada!");
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Licenças</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas license keys</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={apps.length === 0}>
              <Plus className="mr-2 h-4 w-4" />Gerar Licenças
            </Button>
          </DialogTrigger>
          <DialogContent className="dark">
            <DialogHeader>
              <DialogTitle>Gerar Licenças</DialogTitle>
            </DialogHeader>
            <form onSubmit={createLicenses} className="space-y-4">
              <div className="space-y-2">
                <Label>Aplicação</Label>
                <Select value={selectedApp} onValueChange={setSelectedApp}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {apps.map((app) => (
                      <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input type="number" min="1" max="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Max Usos</Label>
                  <Input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Expiração (dias, vazio = sem expiração)</Label>
                <Input type="number" min="1" value={expDays} onChange={(e) => setExpDays(e.target.value)} placeholder="Ex: 30" />
              </div>
              <div className="space-y-2">
                <Label>Nota (opcional)</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota interna..." />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !selectedApp}>
                {loading ? "Gerando..." : "Gerar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {apps.length === 0 ? (
        <Card className="border-border/50 bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Key className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Crie uma aplicação primeiro</p>
          </CardContent>
        </Card>
      ) : licenses.length === 0 ? (
        <Card className="border-border/50 bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Key className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma licença gerada</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>License Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licenses.map((lic) => (
                  <TableRow key={lic.id} className="border-border/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                          {lic.license_key.substring(0, 16)}...
                        </code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyKey(lic.license_key)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[lic.status] || ""}>
                        {lic.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{lic.current_uses}/{lic.max_uses}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {lic.expires_at ? new Date(lic.expires_at).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="max-w-32 truncate text-xs text-muted-foreground">{lic.note || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteLicense(lic.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
};

export default Licenses;
