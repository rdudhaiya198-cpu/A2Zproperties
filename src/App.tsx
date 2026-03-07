import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import AddEditProperty from "./pages/AddEditProperty";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import MyBookings from "./pages/MyBookings";
import Inquiry from "./pages/Inquiry";
import NotFound from "./pages/NotFound";
import BookSlot from "./pages/BookSlot";
import About from "./pages/About";

const queryClient = new QueryClient();

const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, loading, refreshRole } = useAuth();
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const ensure = async () => {
      if (!user) {
        if (mounted) setChecking(false);
        return;
      }
      try {
        await refreshRole();
      } catch (err) {
        // ignore
      } finally {
        if (mounted) setChecking(false);
      }
    };
    ensure();
    return () => {
      mounted = false;
    };
  }, [user, refreshRole]);

  if (loading || checking) return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-body">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-body">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/property/:id" element={<PropertyDetail />} />
            <Route path="/inquiry" element={<Inquiry />} />
            <Route path="/about" element={<About />} />
            <Route path="/book" element={<BookSlot />} />
            <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
            <Route path="/add-property" element={<ProtectedAdminRoute><AddEditProperty /></ProtectedAdminRoute>} />
            <Route path="/edit-property/:id" element={<ProtectedAdminRoute><AddEditProperty /></ProtectedAdminRoute>} />
            <Route path="/dashboard" element={<ProtectedAdminRoute><Dashboard /></ProtectedAdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
