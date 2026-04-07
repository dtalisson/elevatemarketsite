import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ParticleBackground from "@/components/ParticleBackground";
import {
  LayoutDashboard,
  ScrollText,
  Key,
  AppWindow,
  Users,
  LogOut,
  Code,
  Menu,
  X,
  ChevronRight,
  Wifi,
  ShieldAlert,
  ShieldX,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Aplicações", icon: AppWindow, href: "/dashboard/applications" },
  { label: "Licenças", icon: Key, href: "/dashboard/licenses" },
  { label: "Usuários", icon: Users, href: "/dashboard/users" },
  { label: "Online", icon: Wifi, href: "/dashboard/online" },
  { label: "Logs", icon: ScrollText, href: "/dashboard/logs" },
  { label: "HWID Logs", icon: ShieldAlert, href: "/dashboard/hwid-logs" },
  { label: "Segurança", icon: ShieldX, href: "/dashboard/security-logs" },
  { label: "Documentação", icon: Code, href: "/dashboard/docs" },
];

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="dark flex min-h-screen relative" style={{ background: "#050508" }}>
      <ParticleBackground />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          background: "rgba(8, 10, 16, 0.85)",
          borderRight: "1px solid rgba(255,255,255,0.04)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 px-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <span className="text-xs font-medium tracking-[0.2em] uppercase" style={{ color: "hsl(210 20% 65%)", fontFamily: "'Inter', sans-serif" }}>
            Elevate Auth
          </span>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" style={{ color: "hsl(210 15% 35%)" }} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 mt-4">
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className="group flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-all duration-200"
                style={{
                  color: active ? "hsl(210 20% 85%)" : "hsl(210 15% 40%)",
                  background: active ? "rgba(255,255,255,0.04)" : "transparent",
                  border: active ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
                }}
              >
                <item.icon className="h-4 w-4" style={{ color: active ? "hsl(210 40% 60%)" : "hsl(210 15% 30%)" }} />
                {item.label}
                {active && <ChevronRight className="ml-auto h-3 w-3" style={{ color: "hsl(210 30% 45%)" }} />}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="px-3 pb-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="mb-2 flex items-center gap-2 px-3 py-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ background: "rgba(100,140,200,0.12)", color: "hsl(210 40% 60%)" }}
            >
              {(user?.user_metadata?.username || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[11px] font-medium" style={{ color: "hsl(210 20% 70%)" }}>
                {user?.user_metadata?.username || user?.email}
              </p>
              <p className="text-[9px]" style={{ color: "hsl(210 10% 30%)" }}>Administrador</p>
            </div>
          </div>
          <button
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12px] font-medium transition-all duration-200"
            style={{ color: "hsl(210 15% 35%)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "hsl(0 60% 55%)"; e.currentTarget.style.background = "rgba(200,60,60,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "hsl(210 15% 35%)"; e.currentTarget.style.background = "transparent"; }}
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col relative z-10">
        <header
          className="flex h-14 items-center gap-4 px-6 lg:hidden"
          style={{ background: "rgba(8,10,16,0.7)", borderBottom: "1px solid rgba(255,255,255,0.04)", backdropFilter: "blur(20px)" }}
        >
          <button onClick={() => setSidebarOpen(true)} className="rounded-md p-1.5 transition-colors" style={{ color: "hsl(210 20% 70%)" }}>
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-xs font-medium tracking-[0.15em] uppercase" style={{ color: "hsl(210 20% 65%)" }}>Elevate Auth</span>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
};
