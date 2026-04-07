import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, ScrollText, Key, AppWindow, Users, LogOut, Code, Menu, X, Wifi, ShieldAlert, ShieldX, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navSections = [
  {
    label: "PRINCIPAL",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { label: "Aplicações", icon: AppWindow, href: "/dashboard/applications" },
      { label: "Licenças", icon: Key, href: "/dashboard/licenses" },
      { label: "Usuários", icon: Users, href: "/dashboard/users" },
      { label: "Online", icon: Wifi, href: "/dashboard/online" },
    ],
  },
  {
    label: "LOGS",
    items: [
      { label: "Autenticação", icon: ScrollText, href: "/dashboard/logs" },
      { label: "HWID", icon: ShieldAlert, href: "/dashboard/hwid-logs" },
      { label: "Segurança", icon: ShieldX, href: "/dashboard/security-logs" },
    ],
  },
  {
    label: "FERRAMENTAS",
    items: [
      { label: "API Docs", icon: Code, href: "/dashboard/docs" },
      { label: "Configurações", icon: Settings, href: "/dashboard/settings" },
    ],
  },
];

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="dark flex min-h-screen bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col border-r border-border bg-sidebar transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between px-5 border-b border-border">
          <span className="text-sm font-heading font-bold text-foreground tracking-tight">
            Elevate<span className="text-primary">Auth</span>
          </span>
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/50">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 pb-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-[11px] font-bold text-primary">
              {(user?.user_metadata?.username || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {user?.user_metadata?.username || user?.email}
              </p>
              <p className="text-[10px] text-muted-foreground">Admin</p>
            </div>
          </div>
          <button
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 px-6 lg:hidden border-b border-border bg-background">
          <button onClick={() => setSidebarOpen(true)} className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-heading font-bold text-foreground">
            Elevate<span className="text-primary">Auth</span>
          </span>
        </header>
        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};
