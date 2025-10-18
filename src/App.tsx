import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard"; // Alterado de Index para Dashboard
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ServicesPage from "./pages/ServicesPage";
import ProductCatalogPage from "./pages/ProductCatalogPage";
import ManageCostsPage from "./pages/ManageCostsPage";
import QuoteGenerationPage from "./pages/QuoteGenerationPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import PaymentMethodsPage from "./pages/PaymentMethodsPage";
import { SessionContextProvider } from "./components/SessionContextProvider";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/" 
              element={
                <DashboardLayout>
                  <Dashboard /> {/* Usar o novo Dashboard */}
                </DashboardLayout>
              } 
            />
            <Route 
              path="/manage-costs"
              element={
                <DashboardLayout>
                  <ManageCostsPage />
                </DashboardLayout>
              } 
            />
            <Route 
              path="/products"
              element={
                <DashboardLayout>
                  <ProductCatalogPage />
                </DashboardLayout>
              } 
            />
            <Route 
              path="/services" 
              element={
                <DashboardLayout>
                  <ServicesPage />
                </DashboardLayout>
              } 
            />
            <Route 
              path="/payment-methods" 
              element={
                <DashboardLayout>
                  <PaymentMethodsPage />
                </DashboardLayout>
              } 
            />
            <Route 
              path="/generate-quote" 
              element={
                <DashboardLayout>
                  <QuoteGenerationPage />
                </DashboardLayout>
              } 
            />
            <Route 
              path="/profile"
              element={
                <DashboardLayout>
                  <ProfilePage />
                </DashboardLayout>
              } 
            />
            <Route 
              path="/settings"
              element={
                <DashboardLayout>
                  <SettingsPage />
                </DashboardLayout>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;