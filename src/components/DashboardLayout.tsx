import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, ScrollText, Key, AppWindow, Users, LogOut, Code, Menu, X, Wifi, ShieldAlert, ShieldX, Download, Ban, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

const B = "/dashboard";

const navSections = [
  {
    label: "PRINCIPAL",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: B },
      { label: "Aplicações", icon: AppWindow, href: `${B}/applications` },
      { label: "Licenças", icon: Key, href: `${B}/licenses` },
      { label: "Usuários", icon: Users, href: `${B}/users` },
      { label: "Online", icon: Wifi, href: `${B}/online` },
    ],
  },
  {
    label: "LOGS",
    items: [
      { label: "Autenticação", icon: ScrollText, href: `${B}/logs` },
      { label: "HWID", icon: ShieldAlert, href: `${B}/hwid-logs` },
    ],
  },
  {
    label: "SEGURANÇA",
    items: [
      { label: "Alertas", icon: ShieldX, href: `${B}/security-logs` },
      { label: "Blacklist", icon: Ban, href: `${B}/blacklist` },
      { label: "Site", icon: Globe, href: `${B}/site-security` },
    ],
  },
  {
    label: "FERRAMENTAS",
    items: [
      { label: "Downloads", icon: Download, href: `${B}/downloads` },
      { label: "API Docs", icon: Code, href: `${B}/docs` },
    ],
  },
];

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="dark flex min-h-screen bg-transparent">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col border-r border-border/80 bg-sidebar/80 backdrop-blur-xl transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border/80 px-5">
           <span className="text-xl font-heading font-bold text-foreground tracking-tight">
            Elevate<span className="text-primary">Auth</span>
          </span>
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
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
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
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

        <div className="border-t border-border/80 px-3 pb-3 pt-2">
          <div className="mb-1 flex items-center gap-2.5 px-3 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-[11px] font-bold text-primary">
              {(user?.user_metadata?.username || "U")[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {user?.user_metadata?.username || user?.email}
              </p>
              <p className="text-[10px] text-muted-foreground">Admin</p>
            </div>
          </div>
          <button
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b border-border/80 bg-background/70 px-6 backdrop-blur-xl lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-xl font-heading font-bold text-foreground">
            Elevate<span className="text-primary">Auth</span>
          </span>
        </header>
        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};
