import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Key, AppWindow, Users, Activity } from "lucide-react";

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ apps: 0, licenses: 0, active: 0, expired: 0 });

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const [appsRes, licensesRes] = await Promise.all([
        supabase.from("applications").select("id", { count: "exact", head: true }),
        supabase.from("licenses").select("id, status"),
      ]);

      const licenses = licensesRes.data || [];
      setStats({
        apps: appsRes.count || 0,
        licenses: licenses.length,
        active: licenses.filter((l) => l.status === "active").length,
        expired: licenses.filter((l) => l.status === "expired").length,
      });
    };

    fetchStats();
  }, [user]);

  const cards = [
    { title: "Aplicações", value: stats.apps, icon: AppWindow, color: "text-primary" },
    { title: "Total de Licenças", value: stats.licenses, icon: Key, color: "text-primary" },
    { title: "Licenças Ativas", value: stats.active, icon: Activity, color: "text-success" },
    { title: "Expiradas", value: stats.expired, icon: Users, color: "text-destructive" },
  ];

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu sistema de licenciamento</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="border-border/50 bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">Início Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              1. Crie uma <strong>Aplicação</strong> para começar
            </p>
            <p className="text-sm text-muted-foreground">
              2. Gere <strong>Licenças</strong> para seus usuários
            </p>
            <p className="text-sm text-muted-foreground">
              3. Use a <strong>API</strong> para validar licenças no seu software
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
