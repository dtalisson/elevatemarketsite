import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Lock, User } from "lucide-react";
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
    <div className="dark flex min-h-screen items-center justify-center p-4 relative overflow-hidden" style={{ background: "#050508" }}>
      <ParticleBackground />

      {/* Subtle center glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, hsl(210 60% 50%) 0%, transparent 70%)" }} />

      <div className="w-full max-w-sm relative z-10">
        {/* Title */}
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-medium tracking-[0.2em] uppercase" style={{ color: "hsl(210 20% 75%)", fontFamily: "'Inter', sans-serif", letterSpacing: "0.25em" }}>
            Elevate Auth
          </h1>
          <div className="mt-3 mx-auto w-12 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(210 50% 40%), transparent)" }} />
        </div>

        {/* Login card */}
        <div className="rounded-xl border p-6" style={{ background: "rgba(12, 14, 20, 0.7)", borderColor: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-[11px] uppercase tracking-[0.15em] font-medium" style={{ color: "hsl(210 15% 45%)" }}>
                Usuário
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "hsl(210 15% 30%)" }} />
                <input
                  id="username"
                  placeholder="seu_usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-lg text-sm outline-none transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    color: "hsl(210 20% 85%)",
                    fontFamily: "'Inter', sans-serif",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(100,140,200,0.3)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.07)"}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[11px] uppercase tracking-[0.15em] font-medium" style={{ color: "hsl(210 15% 45%)" }}>
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "hsl(210 15% 30%)" }} />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-lg text-sm outline-none transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    color: "hsl(210 20% 85%)",
                    fontFamily: "'Inter', sans-serif",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(100,140,200,0.3)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.07)"}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg text-sm font-medium tracking-wide uppercase transition-all duration-300 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, hsl(210 40% 25%) 0%, hsl(210 50% 18%) 100%)",
                border: "1px solid rgba(100,140,200,0.15)",
                color: "hsl(210 30% 80%)",
                letterSpacing: "0.1em",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, hsl(210 45% 30%) 0%, hsl(210 50% 22%) 100%)";
                e.currentTarget.style.borderColor = "rgba(100,140,200,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, hsl(210 40% 25%) 0%, hsl(210 50% 18%) 100%)";
                e.currentTarget.style.borderColor = "rgba(100,140,200,0.15)";
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                  Entrando...
                </span>
              ) : "Entrar"}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.2em]" style={{ color: "hsl(210 10% 25%)" }}>
          Acesso restrito
        </p>
      </div>
    </div>
  );
};

export default Login;
