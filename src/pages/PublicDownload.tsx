import { useState, useEffect, useRef } from "react";
import { Download, KeyRound, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PublicDownload = () => {
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; download?: any } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    for (let i = 0; i < 60; i++) {
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

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("download-with-license", {
        body: { license_key: licenseKey.trim() },
      });

      if (error) {
        setResult({ success: false, message: "Erro ao verificar licença" });
      } else if (data?.success) {
        setResult({ success: true, download: data.download });
        // Auto-start download
        window.open(data.download.url, "_blank");
      } else {
        setResult({ success: false, message: data?.message || "Licença inválida" });
      }
    } catch {
      setResult({ success: false, message: "Erro de conexão" });
    }

    setLoading(false);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-transparent p-4">
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />
      <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, hsl(250 85% 63%), transparent 70%)" }} />
      <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, hsl(250 85% 63%), transparent 70%)" }} />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-heading font-bold tracking-tight text-foreground">
            Elevate<span className="text-primary">Auth</span>
          </h1>
          <p className="mt-2 text-lg font-medium text-foreground/80">Download Loader</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border/80 bg-card/80 p-6 backdrop-blur-xl">
          <form onSubmit={handleDownload} className="space-y-4">
            <div className="space-y-1.5">
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <input
                  placeholder="Enter License Key"
                  value={licenseKey}
                  onChange={(e) => { setLicenseKey(e.target.value); setResult(null); }}
                  required
                  className="w-full h-12 pl-10 pr-3 rounded-lg text-sm bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !licenseKey.trim()}
              className="w-full h-12 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </span>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download Loader
                </>
              )}
            </button>
          </form>

          {/* Result feedback */}
          {result && (
            <div className={`mt-4 rounded-lg p-3 text-sm flex items-start gap-2 ${
              result.success
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-destructive/10 border border-destructive/20 text-destructive"
            }`}>
              {result.success ? (
                <>
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Download iniciado!</p>
                    <p className="text-xs opacity-80 mt-0.5">
                      {result.download?.app_name} {result.download?.version ? `v${result.download.version}` : ""} · {formatSize(result.download?.file_size || 0)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>{result.message}</p>
                </>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/40">
          Elevate Auth · Secure Downloads
        </p>
      </div>
    </div>
  );
};

export default PublicDownload;
