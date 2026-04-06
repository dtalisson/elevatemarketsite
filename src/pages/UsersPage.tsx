import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Users, Trash2, Monitor, Clock, Shield, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SoftwareUser {
  id: string;
  username: string;
  hwid: string | null;
  created_at: string;
  application_id: string;
  license_id: string;
}

interface LicenseInfo {
  id: string;
  license_key: string;
  status: string;
  expires_at: string | null;
}

interface AppInfo {
  id: string;
  name: string;
}

const UsersPage = () => {
  const { user } = useAuth();
  const [softwareUsers, setSoftwareUsers] = useState<SoftwareUser[]>([]);
  const [licenses, setLicenses] = useState<Record<string, LicenseInfo>>({});
  const [apps, setApps] = useState<Record<string, AppInfo>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const [usersRes, licensesRes, appsRes] = await Promise.all([
      supabase.from("software_users").select("*").order("created_at", { ascending: false }),
      supabase.from("licenses").select("id, license_key, status, expires_at"),
      supabase.from("applications").select("id, name").eq("owner_id", user.id),
    ]);

    if (appsRes.data) {
      const appMap: Record<string, AppInfo> = {};
      appsRes.data.forEach((a) => (appMap[a.id] = a));
      setApps(appMap);
    }

    if (licensesRes.data) {
      const licMap: Record<string, LicenseInfo> = {};
      licensesRes.data.forEach((l) => (licMap[l.id] = l));
      setLicenses(licMap);
    }

    if (usersRes.data) {
      setSoftwareUsers(usersRes.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleDelete = async (userId: string) => {
    const { error } = await supabase.from("software_users").delete().eq("id", userId);
    if (error) {
      toast.error("Erro ao excluir usuário");
    } else {
      toast.success("Usuário excluído com sucesso");
      fetchData();
    }
  };

  const getStatusBadge = (license?: LicenseInfo) => {
    if (!license) return <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">Sem licença</Badge>;
    
    const isExpired = license.expires_at && new Date(license.expires_at) < new Date();
    
    if (license.status === "banned") {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Banido</Badge>;
    }
    if (isExpired || license.status === "expired") {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Expirado</Badge>;
    }
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Ativo</Badge>;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filtered = softwareUsers.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie os usuários registrados nas suas aplicações
        </p>
      </div>

      <div className="mb-4 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/50 border-border/50"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="glass border-border/30 animate-pulse">
              <CardContent className="p-4 h-20" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="glass border-border/30 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-2xl bg-primary/10 mb-4">
              <Users className="h-10 w-10 text-primary" />
            </div>
            <p className="text-muted-foreground font-medium">
              {search ? "Nenhum usuário encontrado" : "Nenhum usuário registrado"}
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {search
                ? "Tente buscar por outro nome"
                : "Os usuários aparecerão aqui quando se registrarem via API"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((su, index) => {
            const license = licenses[su.license_id];
            const app = apps[su.application_id];
            return (
              <Card
                key={su.id}
                className="glass border-border/30 hover:border-primary/30 transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${0.05 * (index + 1)}s` }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{su.username}</span>
                          {getStatusBadge(license)}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {app && (
                            <span className="flex items-center gap-1">
                              App: <span className="text-foreground/70">{app.name}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(su.created_at)}
                          </span>
                          {su.hwid && (
                            <span className="flex items-center gap-1">
                              <Monitor className="h-3 w-3" />
                              {su.hwid.substring(0, 12)}...
                            </span>
                          )}
                        </div>
                        {license && (
                          <div className="text-xs text-muted-foreground/60 mt-0.5">
                            Key: {license.license_key.substring(0, 16)}...
                            {license.expires_at && (
                              <> · Expira: {formatDate(license.expires_at)}</>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass border-border/30">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o usuário <strong>{su.username}</strong>? Essa ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(su.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
};

export default UsersPage;
