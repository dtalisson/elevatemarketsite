import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Lock, User } from "lucide-react";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const email = `${username.toLowerCase()}@elevateauth.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error("Usuário ou senha incorretos");
    } else {
      navigate("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-background bg-grid bg-radial-glow p-4 relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="mb-8 text-center animate-fade-in-up" style={{ animationFillMode: "backwards" }}>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 glow-md animate-float">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="gradient-text">Elevate Auth</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Sistema de autenticação e licenciamento</p>
        </div>

        <Card className="glass glow-sm animate-fade-in-up" style={{ animationDelay: "100ms", animationFillMode: "backwards" }}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Entrar</CardTitle>
            <CardDescription>Acesse seu painel de controle</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs uppercase tracking-wider text-muted-foreground">Usuário</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="seu_usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="pl-10 bg-muted/50 border-border/50 focus:border-primary/50 focus:glow-sm transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 bg-muted/50 border-border/50 focus:border-primary/50 focus:glow-sm transition-all"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all duration-300 hover:glow-md"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Entrando...
                  </span>
                ) : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground/50 animate-fade-in" style={{ animationDelay: "300ms", animationFillMode: "backwards" }}>
          Acesso restrito — somente administradores
        </p>
      </div>
    </div>
  );
};

export default Login;
