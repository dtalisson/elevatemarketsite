import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const SettingsPage = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setDisplayName(data.display_name || "");
    });
  }, [user]);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado!");
    setLoading(false);
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie seu perfil e preferências</p>
      </div>

      <div className="max-w-lg space-y-6">
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={updateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled className="opacity-60" />
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
