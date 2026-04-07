import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock, User, ArrowRight } from "lucide-react";
import ParticleBackground from "@/components/ParticleBackground";

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
    <div className="dark flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-background">
      <ParticleBackground />

      {/* Large ambient glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, hsl(210 70% 45% / 0.06) 0%, transparent 65%)" }}
      />

      <div className="w-full max-w-[380px] relative z-10">
        {/* Logo */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 mb-5">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-[22px] font-heading font-semibold tracking-tight text-foreground">
            Elevate Auth
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Painel de controle
          </p>
        </div>

        {/* Login card */}
        <div
          className="rounded-2xl p-7 glass"
          style={{ boxShadow: "0 8px 32px -8px rgba(0,0,0,0.4)" }}
        >
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="username" className="block text-[12px] font-medium text-muted-foreground">
                Usuário
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <input
                  id="username"
                  placeholder="seu_usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full h-11 pl-11 pr-4 rounded-xl text-sm outline-none transition-all duration-200 bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-[12px] font-medium text-muted-foreground">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-11 pl-11 pr-4 rounded-xl text-sm outline-none transition-all duration-200 bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-medium transition-all duration-300 disabled:opacity-50 bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2 glow-sm hover:glow-md"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Entrando...
                </span>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-[11px] text-muted-foreground/50">
          Acesso restrito · Elevate Auth
        </p>
      </div>
    </div>
  );
};

export default Login;
