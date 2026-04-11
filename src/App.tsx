import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import PublicDownload from "./pages/PublicDownload";

import Dashboard from "./pages/Dashboard";
import Applications from "./pages/Applications";
import Licenses from "./pages/Licenses";
import UsersPage from "./pages/UsersPage";
import LogsPage from "./pages/LogsPage";
import HwidLogsPage from "./pages/HwidLogsPage";
import SecurityLogsPage from "./pages/SecurityLogsPage";
import ApiDocs from "./pages/ApiDocs";
import OnlinePage from "./pages/OnlinePage";
import DownloadsPage from "./pages/DownloadsPage";
import BlacklistPage from "./pages/BlacklistPage";
import SiteSecurityPage from "./pages/SiteSecurityPage";

const queryClient = new QueryClient();

const ADMIN_BASE = "/sys-ctrl";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicDownload />} />
            
            {/* Admin routes - hidden path */}
            <Route path={`${ADMIN_BASE}/login`} element={<Login />} />
            <Route path={ADMIN_BASE} element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path={`${ADMIN_BASE}/applications`} element={<ProtectedRoute><Applications /></ProtectedRoute>} />
            <Route path={`${ADMIN_BASE}/licenses`} element={<ProtectedRoute><Licenses /></ProtectedRoute>} />
            <Route path={`${ADMIN_BASE}/users`} element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
            <Route path={`${ADMIN_BASE}/logs`} element={<ProtectedRoute><LogsPage /></ProtectedRoute>} />
            <Route path={`${ADMIN_BASE}/hwid-logs`} element={<ProtectedRoute><HwidLogsPage /></ProtectedRoute>} />
            <Route path={`${ADMIN_BASE}/online`} element={<ProtectedRoute><OnlinePage /></ProtectedRoute>} />
            <Route path={`${ADMIN_BASE}/security-logs`} element={<ProtectedRoute><SecurityLogsPage /></ProtectedRoute>} />
            <Route path={`${ADMIN_BASE}/downloads`} element={<ProtectedRoute><DownloadsPage /></ProtectedRoute>} />
            <Route path={`${ADMIN_BASE}/blacklist`} element={<ProtectedRoute><BlacklistPage /></ProtectedRoute>} />
            <Route path={`${ADMIN_BASE}/docs`} element={<ProtectedRoute><ApiDocs /></ProtectedRoute>} />
            <Route path={`${ADMIN_BASE}/site-security`} element={<ProtectedRoute><SiteSecurityPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
