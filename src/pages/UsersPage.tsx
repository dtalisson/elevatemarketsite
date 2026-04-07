import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Trash2, Search, Key, Eye, EyeOff, Copy, Clock, Globe, Ban, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SoftwareUser {
  id: string; username: string; password_hash: string; password_plain: string | null;
  hwid: string | null; ip_address: string | null; last_ip: string | null;
  last_login_at: string | null; created_at: string; application_id: string; license_id: string;
}
interface LicenseInfo { id: string; license_key: string; status: string; expires_at: string | null; activated_at: string | null; }
interface AppInfo { id: string; name: string; }

const UsersPage = () => {
  const { user } = useAuth();
  const [softwareUsers, setSoftwareUsers] = useState<SoftwareUser[]>([]);
  const [licenses, setLicenses] = useState<Record<string, LicenseInfo>>({});
  const [apps, setApps] = useState<Record<string, AppInfo>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<SoftwareUser | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [usersRes, licensesRes, appsRes] = await Promise.all([
      supabase.from("software_users").select("*").order("created_at", { ascending: false }),
      supabase.from("licenses").select("id, license_key, status, expires_at, activated_at"),
      supabase.from("applications").select("id, name").eq("owner_id", user.id),
    ]);
    if (appsRes.data) { const m: Record<string, AppInfo> = {}; appsRes.data.forEach((a) => (m[a.id] = a)); setApps(m); }
    if (licensesRes.data) { const m: Record<string, LicenseInfo> = {}; licensesRes.data.forEach((l) => (m[l.id] = l)); setLicenses(m); }
    if (usersRes.data) setSoftwareUsers(usersRes.data as SoftwareUser[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleDelete = async (userId: string) => {
    const { error } = await supabase.from("software_users").delete().eq("id", userId);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Excluído"); setSelectedUser(null); fetchData(); }
  };

  const copyText = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };

  const getStatusBadge = (license?: LicenseInfo) => {
    if (!license) return <Badge variant="outline" className="text-[10px] text-muted-foreground">—</Badge>;
    const isExpired = license.expires_at && new Date(license.expires_at) < new Date();
    if (license.status === "banned") return <Badge className="bg-destructive/10 text-destructive text-[10px]">Banido</Badge>;
    if (isExpired || license.status === "expired") return <Badge className="bg-warning/10 text-warning text-[10px]">Expirado</Badge>;
    return <Badge className="bg-primary/10 text-primary text-[10px]">Ativo</Badge>;
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const filtered = softwareUsers.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()));

  const InfoRow = ({ label, value, copyable, mono }: { label: string; value: string | null | undefined; copyable?: boolean; mono?: boolean }) => (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-xs text-foreground ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
        {copyable && value && <button onClick={() => copyText(value)} className="text-muted-foreground hover:text-primary transition-colors"><Copy className="h-3 w-3" /></button>}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">Usuários registrados nas suas aplicações</p>
      </div>

      <div className="mb-4 max-w-sm relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por username..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg border border-border bg-card animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground font-heading font-medium">{search ? "Nenhum encontrado" : "Nenhum usuário registrado"}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{search ? "Tente outro nome" : "Aparecerão aqui quando se registrarem"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((su) => {
            const license = licenses[su.license_id];
            const app = apps[su.application_id];
            const showPw = showPasswords[su.id];
            return (
              <div
                key={su.id}
                className="rounded-lg border border-border bg-card p-4 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setSelectedUser(su)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-heading font-semibold text-foreground">{su.username}</span>
                      {getStatusBadge(license)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Key className="h-3 w-3" />
                        <code className="font-mono text-[10px]">{showPw ? (su.password_plain || "•••") : "••••••••"}</code>
                        <button onClick={(e) => { e.stopPropagation(); setShowPasswords(p => ({ ...p, [su.id]: !p[su.id] })); }} className="text-muted-foreground hover:text-primary transition-colors">
                          {showPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </span>
                      {app && <span className="text-xs text-muted-foreground">{app.name}</span>}
                      {su.last_ip && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Globe className="h-3 w-3" />{su.last_ip}</span>}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{formatDate(su.created_at)}</span>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={(e) => e.stopPropagation()}><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-heading">Excluir {su.username}?</AlertDialogTitle>
                        <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(su.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              {selectedUser?.username}
              {selectedUser && getStatusBadge(licenses[selectedUser.license_id])}
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (() => {
            const license = licenses[selectedUser.license_id];
            const app = apps[selectedUser.application_id];
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/50 p-3 space-y-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Credenciais</p>
                    <InfoRow label="Username" value={selectedUser.username} copyable mono />
                    <InfoRow label="Senha" value={selectedUser.password_plain || "N/A"} copyable mono />
                    <InfoRow label="Aplicação" value={app?.name} />
                    <InfoRow label="Registrado" value={formatDate(selectedUser.created_at)} />
                  </div>
                  <div className="rounded-lg border border-border/50 p-3 space-y-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Dispositivo</p>
                    <InfoRow label="HWID" value={selectedUser.hwid} copyable mono />
                    <InfoRow label="IP Registro" value={selectedUser.ip_address} copyable mono />
                    <InfoRow label="Último IP" value={selectedUser.last_ip} copyable mono />
                    <InfoRow label="Último Login" value={selectedUser.last_login_at ? formatDate(selectedUser.last_login_at) : null} />
                  </div>
                </div>

                {license && (
                  <div className="rounded-lg border border-border/50 p-3 space-y-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 font-semibold">Licença</p>
                    <div className="grid grid-cols-3 gap-x-4">
                      <InfoRow label="Key" value={license.license_key} copyable mono />
                      <InfoRow label="Status" value={license.status} />
                      <InfoRow label="Expira" value={license.expires_at ? formatDate(license.expires_at) : "Sem expiração"} />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {license && (license.status === "active" || license.status === "unused") ? (
                    <Button variant="outline" className="flex-1 text-warning border-warning/30 hover:bg-warning/10 gap-2" size="sm"
                      onClick={async () => {
                        const { error } = await supabase.from("licenses").update({ status: "banned" as const }).eq("id", selectedUser.license_id);
                        if (error) toast.error(error.message);
                        else { toast.success("Licença desativada"); fetchData(); }
                      }}><Ban className="h-3.5 w-3.5" />Desativar</Button>
                  ) : license ? (
                    <Button variant="outline" className="flex-1 text-primary border-primary/30 hover:bg-primary/10 gap-2" size="sm"
                      onClick={async () => {
                        const { error } = await supabase.from("licenses").update({ status: "active" as const }).eq("id", selectedUser.license_id);
                        if (error) toast.error(error.message);
                        else { toast.success("Licença ativada"); fetchData(); }
                      }}><CheckCircle2 className="h-3.5 w-3.5" />Ativar</Button>
                  ) : null}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex-1 gap-2" size="sm"><Trash2 className="h-3.5 w-3.5" />Excluir</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-heading">Excluir {selectedUser.username}?</AlertDialogTitle>
                        <AlertDialogDescription>Ação irreversível.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(selectedUser.id)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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

export default UsersPage;
