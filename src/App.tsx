import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { PanelUserProvider } from "@/contexts/PanelUserContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";

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
import PublicDownload from "./pages/PublicDownload";
import PanelUsersPage from "./pages/PanelUsersPage";
import PanelUserDashboard from "./pages/PanelUserDashboard";
import { PanelProtectedRoute } from "@/components/PanelProtectedRoute";
import PanelUserLogin from "./pages/PanelUserLogin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PanelUserProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/download" element={<PublicDownload />} />
              
              {/* Panel user (sub-user/reseller) routes */}
              <Route path="/panel/login" element={<PanelUserLogin />} />
              <Route path="/panel" element={<PanelProtectedRoute><PanelUserDashboard /></PanelProtectedRoute>} />
              
              {/* Admin routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
              <Route path="/dashboard/licenses" element={<ProtectedRoute><Licenses /></ProtectedRoute>} />
              <Route path="/dashboard/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
              <Route path="/dashboard/panel-users" element={<ProtectedRoute><PanelUsersPage /></ProtectedRoute>} />
              <Route path="/dashboard/logs" element={<ProtectedRoute><LogsPage /></ProtectedRoute>} />
              <Route path="/dashboard/hwid-logs" element={<ProtectedRoute><HwidLogsPage /></ProtectedRoute>} />
              <Route path="/dashboard/online" element={<ProtectedRoute><OnlinePage /></ProtectedRoute>} />
              <Route path="/dashboard/security-logs" element={<ProtectedRoute><SecurityLogsPage /></ProtectedRoute>} />
              <Route path="/dashboard/downloads" element={<ProtectedRoute><DownloadsPage /></ProtectedRoute>} />
              <Route path="/dashboard/blacklist" element={<ProtectedRoute><BlacklistPage /></ProtectedRoute>} />
              <Route path="/dashboard/docs" element={<ProtectedRoute><ApiDocs /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </PanelUserProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
