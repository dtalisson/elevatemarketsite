import { usePanelUser } from "@/contexts/PanelUserContext";
import { Navigate } from "react-router-dom";

export const PanelProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { panelUser, loading } = usePanelUser();

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
