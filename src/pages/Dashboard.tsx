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
      iconColor: "text-primary",
      iconBg: "bg-primary/10 border-primary/15",
    },
    {
      title: "Total de Licenças",
      value: stats.licenses,
      icon: Key,
      iconColor: "text-accent",
      iconBg: "bg-accent/10 border-accent/15",
    },
    {
      title: "Licenças Ativas",
      value: stats.active,
      icon: Activity,
      iconColor: "text-success",
      iconBg: "bg-success/10 border-success/15",
    },
    {
      title: "Expiradas",
      value: stats.expired,
      icon: ShieldOff,
      iconColor: "text-destructive",
      iconBg: "bg-destructive/10 border-destructive/15",
    },
  ];

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Dashboard</h1>
          <span className="flex h-2 w-2 rounded-full bg-success animate-glow-pulse" />
        </div>
        <p className="text-sm text-muted-foreground">Visão geral do seu sistema de licenciamento</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <Card
            key={card.title}
            className="glass glass-hover overflow-hidden animate-fade-in-up relative"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
          >
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{card.title}</CardTitle>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${card.iconBg}`}>
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-heading font-bold text-foreground animate-count-up">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="glass glass-hover animate-fade-in-up" style={{ animationDelay: "320ms", animationFillMode: "backwards" }}>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-heading font-semibold">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 rounded-xl bg-muted/50 border border-border/50 p-3.5">
                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade recente</p>
              <p className="text-xs text-muted-foreground/60 mt-1">As validações de licença aparecerão aqui</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass glass-hover animate-fade-in-up" style={{ animationDelay: "400ms", animationFillMode: "backwards" }}>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 border border-accent/15">
              <Zap className="h-4 w-4 text-accent" />
            </div>
            <CardTitle className="text-base font-heading font-semibold">Início Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { step: "1", text: "Crie uma Aplicação para começar", color: "bg-primary/10 text-primary border-primary/15" },
              { step: "2", text: "Gere Licenças para seus usuários", color: "bg-accent/10 text-accent border-accent/15" },
              { step: "3", text: "Use a API para validar no seu software", color: "bg-success/10 text-success border-success/15" },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-3 rounded-xl bg-muted/30 border border-border/50 px-4 py-3.5 transition-colors hover:bg-muted/50">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold border ${item.color}`}>
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
