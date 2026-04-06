import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Shield,
  LayoutDashboard,
  ScrollText,
  Key,
  AppWindow,
  Users,
  Settings,
  LogOut,
  Code,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Aplicações", icon: AppWindow, href: "/dashboard/applications" },
  { label: "Licenças", icon: Key, href: "/dashboard/licenses" },
  { label: "Usuários", icon: Users, href: "/dashboard/users" },
  { label: "Logs", icon: ScrollText, href: "/dashboard/logs" },
  { label: "API", icon: Code, href: "/dashboard/api" },
  { label: "Configurações", icon: Settings, href: "/dashboard/settings" },
];

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="dark flex min-h-screen bg-background bg-grid bg-radial-glow">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 glow-sm">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <span className="text-sm font-bold text-foreground tracking-tight">Elevate Auth</span>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Licensing System</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-3 mt-2">
          {navItems.map((item, i) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary/10 text-primary glow-sm border border-primary/20"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground border border-transparent"
                )}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <item.icon className={cn("h-4 w-4 transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                {item.label}
                {active && <ChevronRight className="ml-auto h-3 w-3 text-primary/60" />}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {(user?.user_metadata?.username || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{user?.user_metadata?.username || user?.email}</p>
              <p className="text-[10px] text-muted-foreground">Administrador</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-4 border-b border-border bg-card/30 backdrop-blur-lg px-6 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="hover:bg-muted rounded-lg p-1.5 transition-colors">
            <Menu className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-foreground text-sm">Elevate Auth</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 animate-fade-in">{children}</main>
      </div>
    </div>
  );
};
