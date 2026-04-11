import { usePanelUser } from "@/contexts/PanelUserContext";
import { Navigate } from "react-router-dom";
import { useEffect, useRef } from "react";

const REVALIDATE_INTERVAL = 60_000; // Re-check session every 60s

export const PanelProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { panelUser, loading, secureApiCall, logoutPanelUser } = usePanelUser();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Periodic session revalidation — catches deactivated/expired accounts
  useEffect(() => {
    if (!panelUser) return;

    const revalidate = async () => {
      try {
        const data = await secureApiCall("/panel-user-auth");
        if (!data.valid) {
          logoutPanelUser();
        }
      } catch {
        // Network error — don't logout, just skip
      }
    };

    intervalRef.current = setInterval(revalidate, REVALIDATE_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [panelUser, secureApiCall, logoutPanelUser]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!panelUser) return <Navigate to="/panel/login" replace />;

  return <>{children}</>;
};
