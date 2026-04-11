import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from "react";

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
  secureApiCall: (path: string, options?: RequestInit & { body?: string }) => Promise<any>;
}

const PanelUserContext = createContext<PanelUserContextType>({
  panelUser: null,
  panelToken: null,
  allowedApps: [],
  loading: true,
  loginPanelUser: async () => false,
  logoutPanelUser: () => {},
  secureApiCall: async () => ({}),
});

export const usePanelUser = () => useContext(PanelUserContext);

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

// ── Client fingerprint (stable per browser session) ──
function getFingerprint(): string {
  const nav = navigator;
  const raw = [
    nav.userAgent,
    nav.language,
    screen.width + "x" + screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    nav.hardwareConcurrency,
  ].join("|");
  // Simple hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ── Security headers builder ──
function buildSecurityHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-timestamp": Date.now().toString(),
    "x-request-nonce": crypto.randomUUID(),
    "x-client-fingerprint": getFingerprint(),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export const PanelUserProvider = ({ children }: { children: ReactNode }) => {
  const [panelUser, setPanelUser] = useState<PanelUser | null>(null);
  const [panelToken, setPanelToken] = useState<string | null>(null);
  const [allowedApps, setAllowedApps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  // Keep ref in sync
  useEffect(() => { tokenRef.current = panelToken; }, [panelToken]);

  const updateToken = useCallback((newToken: string) => {
    tokenRef.current = newToken;
    setPanelToken(newToken);
    localStorage.setItem("panel_token", newToken);
  }, []);

  // ── Secure API call with auto token rotation ──
  const secureApiCall = useCallback(async (path: string, options: RequestInit & { body?: string } = {}) => {
    const currentToken = tokenRef.current;
    const headers = buildSecurityHeaders(currentToken);
    
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });
    const data = await res.json();
    
    // Token rotation — always use the new token from response
    if (data.token) {
      updateToken(data.token);
    }
    
    // If unauthorized, logout
    if (res.status === 401) {
      setPanelUser(null);
      setPanelToken(null);
      setAllowedApps([]);
      localStorage.removeItem("panel_token");
    }
    
    return data;
  }, [updateToken]);

  // Restore session
  useEffect(() => {
    const token = localStorage.getItem("panel_token");
    if (!token) { setLoading(false); return; }

    const headers = buildSecurityHeaders(token);
    fetch(`${API_BASE}/panel-user-auth`, { headers })
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setPanelUser(data.user);
          setAllowedApps(data.allowed_apps || []);
          // Use rotated token if available
          const newToken = data.token || token;
          setPanelToken(newToken);
          tokenRef.current = newToken;
          localStorage.setItem("panel_token", newToken);
        } else {
          localStorage.removeItem("panel_token");
        }
      })
      .catch(() => localStorage.removeItem("panel_token"))
      .finally(() => setLoading(false));
  }, []);

  const loginPanelUser = async (username: string, password: string) => {
    const headers = buildSecurityHeaders();
    const res = await fetch(`${API_BASE}/panel-user-auth`, {
      method: "POST",
      headers,
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.success) {
      setPanelUser(data.user);
      setPanelToken(data.token);
      tokenRef.current = data.token;
      setAllowedApps(data.allowed_apps || []);
      localStorage.setItem("panel_token", data.token);
      return true;
    }
    return false;
  };

  const logoutPanelUser = () => {
    setPanelUser(null);
    setPanelToken(null);
    tokenRef.current = null;
    setAllowedApps([]);
    localStorage.removeItem("panel_token");
  };

  return (
    <PanelUserContext.Provider value={{ panelUser, panelToken, allowedApps, loading, loginPanelUser, logoutPanelUser, secureApiCall }}>
      {children}
    </PanelUserContext.Provider>
  );
};
