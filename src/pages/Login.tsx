import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePanelUser } from "@/contexts/PanelUserContext";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import loginBg from "@/assets/login-bg.mp4.asset.json";


const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

function getFingerprint(): string {
  const nav = navigator;
  const raw = [nav.userAgent, nav.language, screen.width + "x" + screen.height, screen.colorDepth, Intl.DateTimeFormat().resolvedOptions().timeZone, nav.hardwareConcurrency].join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash |= 0; }
  return Math.abs(hash).toString(36);
}

function buildSecurityHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-request-timestamp": Date.now().toString(),
    "x-request-nonce": crypto.randomUUID(),
    "x-client-fingerprint": getFingerprint(),
  };
}

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { loginPanelUser } = usePanelUser();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1) Tentar login como admin
      const res = await fetch(`${API_BASE}/admin-login`, {
        method: "POST",
        headers: buildSecurityHeaders(),
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.success) {
        // Admin login OK
        const { error } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (error) toast.error("Erro ao iniciar sessão");
        else navigate("/dashboard");
        setLoading(false);
        return;
      }

      // 2) Admin falhou → tentar como panel user (revendedor)
      const panelOk = await loginPanelUser(username, password);
      if (panelOk) {
        navigate("/panel");
        setLoading(false);
        return;
      }

      // Ambos falharam
      toast.error("Usuário ou senha incorretos");
    } catch {
      toast.error("Erro de conexão");
    }
    setLoading(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const particles: { x: number; y: number; r: number; speed: number; opacity: number; drift: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const count = 60;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 0.4 + 0.15,
        opacity: Math.random() * 0.15 + 0.03,
        drift: (Math.random() - 0.5) * 0.3,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.y += p.speed;
        p.x += p.drift;
        if (p.y > canvas.height + 5) { p.y = -5; p.x = Math.random() * canvas.width; }
        if (p.x < -5) p.x = canvas.width + 5;
        if (p.x > canvas.width + 5) p.x = -5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fill();
      }
      animationId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-4">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 z-0 h-full w-full object-cover pointer-events-none"
      >
        <source src="/login-bg.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 z-0 bg-black/60 pointer-events-none" />
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />


      <div className="relative z-10 w-full max-w-[360px]">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-heading font-bold tracking-tight text-foreground">
            Elevate<span className="text-primary">Services</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Painel de controle</p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card/80 p-6 backdrop-blur-xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-xs font-medium text-muted-foreground">Usuário</label>
              <input
                id="username"
                placeholder="seu_usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-lg text-sm bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-medium text-muted-foreground">Senha</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-lg text-sm bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Entrando...
                </span>
              ) : (
                <>Entrar <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/40">
          Acesso restrito · Elevate Services
        </p>
      </div>
    </div>
  );
};

export default Login;
