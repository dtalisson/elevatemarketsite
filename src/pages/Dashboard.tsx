import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
    { title: "Aplicações", value: stats.apps, color: "text-primary" },
    { title: "Total de Licenças", value: stats.licenses, color: "text-foreground" },
    { title: "Ativas", value: stats.active, color: "text-success" },
    { title: "Expiradas", value: stats.expired, color: "text-destructive" },
  ];

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do sistema</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded-lg border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-3">{card.title}</p>
            <p className={`text-3xl font-heading font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-heading font-semibold text-foreground mb-4">Atividade Recente</h2>
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
            <p className="text-xs text-muted-foreground/60 mt-1">As validações aparecerão aqui</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-heading font-semibold text-foreground mb-4">Início Rápido</h2>
          <div className="space-y-2">
            {[
              { step: "1", text: "Crie uma Aplicação para começar" },
              { step: "2", text: "Gere Licenças para seus usuários" },
              { step: "3", text: "Use a API para validar no seu software" },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-3 rounded-md bg-muted/50 px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold text-primary bg-primary/10">
                  {item.step}
                </span>
                <p className="text-sm text-foreground/80">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
