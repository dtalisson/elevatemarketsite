import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface PanelUser {
  id: string;
  username: string;
  expires_at: string;
}

interface PanelUserContextType {
  panelUser: PanelUser | null;
  panelToken: string | null;
  allowedApps: string[];
  loading: boolean;
  loginPanelUser: (username: string, password: string) => Promise<boolean>;
  logoutPanelUser: () => void;
}

const PanelUserContext = createContext<PanelUserContextType>({
  panelUser: null,
  panelToken: null,
  allowedApps: [],
  loading: true,
  loginPanelUser: async () => false,
  logoutPanelUser: () => {},
});

export const usePanelUser = () => useContext(PanelUserContext);

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export const PanelUserProvider = ({ children }: { children: ReactNode }) => {
  const [panelUser, setPanelUser] = useState<PanelUser | null>(null);
  const [panelToken, setPanelToken] = useState<string | null>(null);
  const [allowedApps, setAllowedApps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem("panel_token");
    if (!token) { setLoading(false); return; }

    fetch(`${API_BASE}/panel-user-auth`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setPanelUser(data.user);
          setPanelToken(token);
          setAllowedApps(data.allowed_apps || []);
        } else {
          localStorage.removeItem("panel_token");
        }
      })
      .catch(() => localStorage.removeItem("panel_token"))
      .finally(() => setLoading(false));
  }, []);

  const loginPanelUser = async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/panel-user-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.success) {
      setPanelUser(data.user);
      setPanelToken(data.token);
      setAllowedApps(data.allowed_apps || []);
      localStorage.setItem("panel_token", data.token);
      return true;
    }
    return false;
  };

  const logoutPanelUser = () => {
    setPanelUser(null);
    setPanelToken(null);
    setAllowedApps([]);
    localStorage.removeItem("panel_token");
  };

  return (
    <PanelUserContext.Provider value={{ panelUser, panelToken, allowedApps, loading, loginPanelUser, logoutPanelUser }}>
      {children}
    </PanelUserContext.Provider>
  );
};
