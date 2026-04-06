import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield } from "lucide-react";

const Register = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) {
      toast.error("O usuário deve ter pelo menos 3 caracteres");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      toast.error("O usuário pode conter apenas letras, números e _");
      return;
    }
    setLoading(true);

    const email = `${username.toLowerCase()}@elevateauth.local`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.toLowerCase(), display_name: username },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      if (error.message.includes("already")) {
        toast.error("Este usuário já existe");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Conta criada com sucesso!");
      navigate("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Elevate Auth</h1>
          <p className="mt-1 text-sm text-muted-foreground">Crie sua conta para começar</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Criar Conta</CardTitle>
            <CardDescription>Preencha os dados abaixo</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  placeholder="seu_usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Criando..." : "Criar Conta"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
