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
  Wifi,
  ShieldAlert,
  ShieldX,
  Lock,
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
    <div className="dark flex min-h-screen relative bg-background">
      <ParticleBackground />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          background: "hsl(220 20% 5% / 0.92)",
          borderRight: "1px solid hsl(220 13% 12%)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-5 border-b border-border/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Lock className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <span className="text-[13px] font-heading font-semibold text-foreground tracking-tight">
              Elevate Auth
            </span>
          </div>
          <button className="ml-auto lg:hidden text-muted-foreground hover:text-foreground transition-colors" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 mt-5">
          <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.12em] font-medium text-muted-foreground/60">
            Menu
          </p>
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                  active
                    ? "bg-primary/10 text-foreground border border-primary/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                )}
              >
                <item.icon className={cn("h-4 w-4 transition-colors", active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="px-3 pb-4 pt-3 border-t border-border/50">
          <div className="mb-2 flex items-center gap-3 px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary border border-primary/15">
              {(user?.user_metadata?.username || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-[12px] font-medium text-foreground">
                {user?.user_metadata?.username || user?.email}
              </p>
              <p className="text-[10px] text-muted-foreground">Administrador</p>
            </div>
          </div>
          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-medium text-muted-foreground transition-all duration-200 hover:text-destructive hover:bg-destructive/5 border border-transparent"
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col relative z-10">
        <header className="flex h-16 items-center gap-4 px-6 lg:hidden border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-primary" />
            <span className="text-[13px] font-heading font-semibold text-foreground">Elevate Auth</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};
