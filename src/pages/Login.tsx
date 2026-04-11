import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, ShieldAlert } from "lucide-react";

function generateFingerprint(): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillText("fp", 2, 2);
  }
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    canvas.toDataURL().slice(-32),
  ];
  // Simple hash
  let hash = 0;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    setLoading(true);

    try {
      const fingerprint = generateFingerprint();

      const { data, error } = await supabase.functions.invoke("admin-login", {
        body: { username: username.trim(), password, fingerprint },
      });

      if (error || !data?.success) {
        const msg = data?.message || "Credenciais inválidas";
        toast.error(msg);
        setAttempts((a) => a + 1);

        if (msg.includes("Muitas tentativas") || msg.includes("bloqueada")) {
          setBlocked(true);
          setTimeout(() => setBlocked(false), 60000);
        }
      } else if (data.session) {
        // Set session from returned tokens
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          toast.error("Erro ao iniciar sessão");
        } else {
          navigate("/dashboard");
        }
      }
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
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-transparent p-4">
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />
      <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, hsl(217 90% 58%), transparent 70%)" }} />
      <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, hsl(217 90% 58%), transparent 70%)" }} />

      <div className="relative z-10 w-full max-w-[360px]">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-heading font-bold tracking-tight text-foreground">
            Elevate<span className="text-primary">Auth</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Painel de controle</p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card/80 p-6 backdrop-blur-xl">
          {blocked ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <ShieldAlert className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive font-medium">Acesso temporariamente bloqueado</p>
              <p className="text-xs text-muted-foreground">Muitas tentativas. Aguarde antes de tentar novamente.</p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="username" className="block text-xs font-medium text-muted-foreground">Usuário</label>
                <input
                  id="username"
                  placeholder="seu_usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  maxLength={32}
                  autoComplete="off"
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
                  maxLength={128}
                  autoComplete="off"
                  className="w-full h-10 px-3 rounded-lg text-sm bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>

              {attempts >= 2 && (
                <p className="text-[11px] text-amber-400/80 text-center">
                  ⚠️ {5 - attempts > 0 ? `${5 - attempts} tentativas restantes` : "Última tentativa"}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Verificando...
                  </span>
                ) : (
                  <>Entrar <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/40">
          Acesso restrito · Elevate Auth
        </p>
      </div>
    </div>
  );
};

export default Login;
