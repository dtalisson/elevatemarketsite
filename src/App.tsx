import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
            <Route path="/dashboard/licenses" element={<ProtectedRoute><Licenses /></ProtectedRoute>} />
            <Route path="/dashboard/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
            <Route path="/dashboard/logs" element={<ProtectedRoute><LogsPage /></ProtectedRoute>} />
            <Route path="/dashboard/hwid-logs" element={<ProtectedRoute><HwidLogsPage /></ProtectedRoute>} />
            <Route path="/dashboard/online" element={<ProtectedRoute><OnlinePage /></ProtectedRoute>} />
            <Route path="/dashboard/security-logs" element={<ProtectedRoute><SecurityLogsPage /></ProtectedRoute>} />
            <Route path="/dashboard/downloads" element={<ProtectedRoute><DownloadsPage /></ProtectedRoute>} />
            <Route path="/dashboard/docs" element={<ProtectedRoute><ApiDocs /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
