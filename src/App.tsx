import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ServicesPage from "./pages/ServicesPage";
import ProductCatalogPage from "./pages/ProductCatalogPage";
import ManageCostsPage from "./pages/ManageCostsPage";
import QuoteGenerationPage from "./pages/QuoteGenerationPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import PaymentMethodsPage from "./pages/PaymentMethodsPage"; // Importar a nova página
import { SessionContextProvider } from "./components/SessionContextProvider";
import { Layout } from "./components/Layout";

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
                <Layout>
                  <Index />
                </Layout>
              } 
            />
            <Route 
              path="/manage-costs"
              element={
                <Layout>
                  <ManageCostsPage />
                </Layout>
              } 
            />
            <Route 
              path="/products"
              element={
                <Layout>
                  <ProductCatalogPage />
                </Layout>
              } 
            />
            <Route 
              path="/services" 
              element={
                <Layout>
                  <ServicesPage />
                </Layout>
              } 
            />
            <Route 
              path="/payment-methods" // Nova rota
              element={
                <Layout>
                  <PaymentMethodsPage />
                </Layout>
              } 
            />
            <Route 
              path="/generate-quote" 
              element={
                <Layout>
                  <QuoteGenerationPage />
                </Layout>
              } 
            />
            <Route 
              path="/profile"
              element={
                <Layout>
                  <ProfilePage />
                </Layout>
              } 
            />
            <Route 
              path="/settings"
              element={
                <Layout>
                  <SettingsPage />
                </Layout>
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