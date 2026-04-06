import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

const UsersPage = () => {
  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
        <p className="text-sm text-muted-foreground">Gerencie os usuários das suas licenças</p>
      </div>

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-base">Usuários Licenciados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Os usuários aparecerão aqui quando ativarem licenças via API</p>
          <p className="text-sm text-muted-foreground mt-1">Use o endpoint /validate para que seus usuários ativem suas licenças</p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default UsersPage;
