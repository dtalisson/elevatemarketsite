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

const AdminRoutes = () => (
  <AuthProvider>
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
      <Route path="licenses" element={<ProtectedRoute><Licenses /></ProtectedRoute>} />
      <Route path="users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
      <Route path="logs" element={<ProtectedRoute><LogsPage /></ProtectedRoute>} />
      <Route path="hwid-logs" element={<ProtectedRoute><HwidLogsPage /></ProtectedRoute>} />
      <Route path="online" element={<ProtectedRoute><OnlinePage /></ProtectedRoute>} />
      <Route path="security-logs" element={<ProtectedRoute><SecurityLogsPage /></ProtectedRoute>} />
      <Route path="downloads" element={<ProtectedRoute><DownloadsPage /></ProtectedRoute>} />
      <Route path="blacklist" element={<ProtectedRoute><BlacklistPage /></ProtectedRoute>} />
      <Route path="docs" element={<ProtectedRoute><ApiDocs /></ProtectedRoute>} />
      <Route path="site-security" element={<ProtectedRoute><SiteSecurityPage /></ProtectedRoute>} />
    </Routes>
  </AuthProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicDownload />} />
          <Route path="/dashboard/*" element={<AdminRoutes />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
