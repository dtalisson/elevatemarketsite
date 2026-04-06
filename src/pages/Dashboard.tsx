import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Key, AppWindow, Activity, ShieldOff, TrendingUp, Zap } from "lucide-react";

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
    {
      title: "Aplicações",
      value: stats.apps,
      icon: AppWindow,
      gradient: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
    },
    {
      title: "Total de Licenças",
      value: stats.licenses,
      icon: Key,
      gradient: "from-accent/20 to-accent/5",
      iconBg: "bg-accent/15",
      iconColor: "text-accent",
      borderColor: "border-accent/20",
    },
    {
      title: "Licenças Ativas",
      value: stats.active,
      icon: Activity,
      gradient: "from-success/20 to-success/5",
      iconBg: "bg-success/15",
      iconColor: "text-success",
      borderColor: "border-success/20",
    },
    {
      title: "Expiradas",
      value: stats.expired,
      icon: ShieldOff,
      gradient: "from-destructive/20 to-destructive/5",
      iconBg: "bg-destructive/15",
      iconColor: "text-destructive",
      borderColor: "border-destructive/20",
    },
  ];

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Dashboard</h1>
          <span className="flex h-2 w-2 rounded-full bg-success animate-glow-pulse" />
        </div>
        <p className="text-sm text-muted-foreground">Visão geral do seu sistema de licenciamento</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <Card
            key={card.title}
            className={`glass glass-hover overflow-hidden animate-fade-in-up`}
            style={{ animationDelay: `${i * 100}ms`, animationFillMode: "backwards" }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-50`} />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{card.title}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconBg}`}>
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-4xl font-extrabold text-foreground animate-count-up">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="glass glass-hover animate-fade-in-up" style={{ animationDelay: "400ms", animationFillMode: "backwards" }}>
          <CardHeader className="flex flex-row items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 rounded-full bg-muted p-3">
                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
              <p className="text-xs text-muted-foreground/60 mt-1">As validações de licença aparecerão aqui</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass glass-hover animate-fade-in-up" style={{ animationDelay: "500ms", animationFillMode: "backwards" }}>
          <CardHeader className="flex flex-row items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
              <Zap className="h-4 w-4 text-accent" />
            </div>
            <CardTitle className="text-base">Início Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { step: "1", text: "Crie uma Aplicação para começar", color: "bg-primary/15 text-primary" },
              { step: "2", text: "Gere Licenças para seus usuários", color: "bg-accent/15 text-accent" },
              { step: "3", text: "Use a API para validar no seu software", color: "bg-success/15 text-success" },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-3 rounded-lg bg-muted/50 border border-border/50 px-4 py-3 transition-colors hover:bg-muted">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${item.color}`}>
                  {item.step}
                </div>
                <p className="text-sm text-foreground/80">{item.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
