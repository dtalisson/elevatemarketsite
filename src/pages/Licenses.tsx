import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Key, Clock, User, Search, Eye } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type License = Tables<"licenses"> & { activated_at?: string | null };

interface Application {
  id: string;
  name: string;
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
  const [selectedApp, setSelectedApp] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [expDays, setExpDays] = useState("");
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);

  const fetchData = async () => {
    const [licRes, appRes] = await Promise.all([
      supabase.from("licenses").select("*").order("created_at", { ascending: false }),
      supabase.from("applications").select("id, name"),
    ]);
    if (licRes.data) setLicenses(licRes.data as License[]);
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
    else { toast.success("Licença removida"); setSelectedLicense(null); fetchData(); }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Chave copiada!");
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const getAppName = (appId: string) => apps.find((a) => a.id === appId)?.name || "—";

  const filtered = licenses.filter((lic) => {
    if (search && !lic.license_key.toLowerCase().includes(search.toLowerCase()) && !lic.claimed_by?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && lic.status !== filterStatus) return false;
    return true;
  });

  const InfoRow = ({ label, value, copyable, mono }: { label: string; value: string | null | undefined; copyable?: boolean; mono?: boolean }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-xs text-foreground ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
        {copyable && value && (
          <button onClick={() => copyKey(value)} className="text-muted-foreground hover:text-primary transition-colors">
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Licenças</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas license keys</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={apps.length === 0}><Plus className="mr-2 h-4 w-4" />Gerar Licenças</Button>
          </DialogTrigger>
          <DialogContent className="dark glass border-border/30">
            <DialogHeader><DialogTitle>Gerar Licenças</DialogTitle></DialogHeader>
            <form onSubmit={createLicenses} className="space-y-4">
              <div className="space-y-2">
                <Label>Aplicação</Label>
                <Select value={selectedApp} onValueChange={setSelectedApp}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{apps.map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Quantidade</Label><Input type="number" min="1" max="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
                <div className="space-y-2"><Label>Max Usos</Label><Input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Expiração (dias, vazio = sem expiração)</Label><Input type="number" min="1" value={expDays} onChange={(e) => setExpDays(e.target.value)} placeholder="Ex: 30" /></div>
              <div className="space-y-2"><Label>Nota (opcional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota interna..." /></div>
              <Button type="submit" className="w-full" disabled={loading || !selectedApp}>{loading ? "Gerando..." : "Gerar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por key ou claimed_by..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card/50 border-border/50" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 bg-card/50 border-border/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="unused">Unused</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {apps.length === 0 ? (
        <Card className="glass border-border/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 rounded-2xl bg-primary/10 p-4"><Key className="h-10 w-10 text-primary" /></div>
            <p className="text-foreground font-medium">Crie uma aplicação primeiro</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="glass border-border/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 rounded-2xl bg-primary/10 p-4"><Key className="h-10 w-10 text-primary" /></div>
            <p className="text-foreground font-medium">{search || filterStatus !== "all" ? "Nenhuma licença encontrada" : "Nenhuma licença gerada"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((lic, index) => (
            <Card
              key={lic.id}
              className="glass border-border/30 hover:border-primary/30 transition-all duration-200 cursor-pointer animate-fade-in-up"
              style={{ animationDelay: `${Math.min(0.03 * (index + 1), 0.5)}s` }}
              onClick={() => setSelectedLicense(lic)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
                      <Key className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-muted/50 px-2 py-0.5 font-mono text-xs text-foreground">
                          {lic.license_key.substring(0, 20)}...
                        </code>
                        <Badge variant="outline" className={`${statusColors[lic.status] || ""} text-[10px]`}>{lic.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">{getAppName(lic.application_id)}</span>
                        <span className="text-[11px] text-muted-foreground">{lic.current_uses}/{lic.max_uses} usos</span>
                        {lic.claimed_by && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <User className="h-2.5 w-2.5" />{lic.claimed_by}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />{formatDate(lic.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); copyKey(lic.license_key); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); deleteLicense(lic.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* License detail modal */}
      <Dialog open={!!selectedLicense} onOpenChange={(open) => !open && setSelectedLicense(null)}>
        <DialogContent className="glass border-border/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center"><Key className="h-4 w-4 text-primary" /></div>
              Detalhes da Licença
              {selectedLicense && <Badge variant="outline" className={`${statusColors[selectedLicense.status]} text-[10px]`}>{selectedLicense.status}</Badge>}
            </DialogTitle>
          </DialogHeader>

          {selectedLicense && (
            <div className="space-y-4">
              <div className="rounded-lg bg-background/50 border border-border/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Chave</p>
                <InfoRow label="License Key" value={selectedLicense.license_key} copyable mono />
                <InfoRow label="App" value={getAppName(selectedLicense.application_id)} />
                <InfoRow label="Nota" value={selectedLicense.note} />
              </div>

              <div className="rounded-lg bg-background/50 border border-border/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Uso</p>
                <InfoRow label="Status" value={selectedLicense.status} />
                <InfoRow label="Usos" value={`${selectedLicense.current_uses}/${selectedLicense.max_uses}`} />
                <InfoRow label="Usado por" value={selectedLicense.claimed_by} />
                <InfoRow label="HWID" value={selectedLicense.hwid} copyable mono />
              </div>

              <div className="rounded-lg bg-background/50 border border-border/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Datas</p>
                <InfoRow label="Criada em" value={formatDate(selectedLicense.created_at)} />
                <InfoRow label="Ativada em" value={selectedLicense.activated_at ? formatDate(selectedLicense.activated_at) : null} />
                <InfoRow label="Expira em" value={selectedLicense.expires_at ? formatDate(selectedLicense.expires_at) : "Sem expiração"} />
                <InfoRow label="Atualizada em" value={formatDate(selectedLicense.updated_at)} />
              </div>

              <Button variant="destructive" className="w-full" size="sm" onClick={() => selectedLicense && deleteLicense(selectedLicense.id)}>
                <Trash2 className="mr-2 h-3.5 w-3.5" />Excluir Licença
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Licenses;
