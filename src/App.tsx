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
import ManageCostsPage from "./pages/ManageCostsPage"; // Importar a nova página de custos
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
              path="/manage-costs" // Nova rota para gerenciar custos
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;