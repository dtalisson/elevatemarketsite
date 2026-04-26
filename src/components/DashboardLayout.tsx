import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, ScrollText, Key, AppWindow, Users, LogOut, Code, Menu, X, Wifi, ShieldAlert, ShieldX, Download, Ban, UserCog, Shield, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navSections = [
  {
    label: "OVERVIEW",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    ],
  },
  {
    label: "PEOPLE",
    items: [
      { label: "Users", icon: Users, href: "/dashboard/users" },
      { label: "Panel Users", icon: UserCog, href: "/dashboard/panel-users" },
      { label: "Online", icon: Wifi, href: "/dashboard/online" },
    ],
  },
  {
    label: "COMMERCE",
    items: [
      { label: "Applications", icon: AppWindow, href: "/dashboard/applications" },
      { label: "Licenses", icon: Key, href: "/dashboard/licenses" },
    ],
  },
  {
    label: "SECURITY",
    items: [
      { label: "Auth Logs", icon: ScrollText, href: "/dashboard/logs" },
      { label: "HWID Logs", icon: ShieldAlert, href: "/dashboard/hwid-logs" },
      { label: "Alerts", icon: ShieldX, href: "/dashboard/security-logs" },
      { label: "Blacklist", icon: Ban, href: "/dashboard/blacklist" },
    ],
  },
  {
    label: "PLATFORM",
    items: [
      { label: "Downloads", icon: Download, href: "/dashboard/downloads" },
      { label: "API Docs", icon: Code, href: "/dashboard/docs" },
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
        <div className="flex h-16 items-center justify-between border-b border-border/60 px-5">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-primary" strokeWidth={2.2} />
            <span className="text-[15px] font-heading font-bold text-foreground tracking-tight">
              Admin Panel
            </span>
          </div>
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
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
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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

        <div className="border-t border-border/60 px-3 pb-3 pt-3 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to site
          </Link>
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
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
        <header className="flex h-14 items-center gap-4 border-b border-border/60 bg-background/70 px-6 backdrop-blur-xl lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-heading font-bold text-foreground">Admin Panel</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};
