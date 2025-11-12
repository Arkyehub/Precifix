import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ServicesPage from "./pages/ServicesPage";
import ProductCatalogPage from "./pages/ProductCatalogPage";
import ManageCostsPage from "./pages/ManageCostsPage";
import QuoteGenerationPage from "./pages/QuoteGenerationPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import PaymentMethodsPage from "./pages/PaymentMethodsPage";
import BillingPage from "./pages/BillingPage";
import ClientsPage from "./pages/ClientsPage";
import QuoteViewPage from "./pages/QuoteViewPage";
import CalendarPage from "./pages/CalendarPage";
import DailyAgendaPage from "./pages/DailyAgendaPage";
import SalesPage from "./pages/SalesPage"; // Importar SalesPage
import NewSalePage from "./pages/NewSalePage"; // Importar NewSalePage
import AccountsPayablePage from "./pages/AccountsPayablePage"; // Importar AccountsPayablePage
import { SessionContextProvider } from "./components/SessionContextProvider";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { useExpenseNotifications } from './hooks/use-expense-notifications'; // Importar o novo hook

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionContextProvider>
          <AppContent />
        </SessionContextProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function AppContent() {
  useExpenseNotifications(); // Chamar o hook aqui

  return (
    <>
      <Routes>
        {/* Rota Pública para Visualização de Orçamento */}
        <Route path="/quote/view/:quoteId" element={<QuoteViewPage />} />
        
        <Route path="/login" element={<Login />} />
        <Route 
          path="/" 
          element={
            <DashboardLayout>
              <Dashboard />
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
          path="/clients"
          element={
            <DashboardLayout>
              <ClientsPage />
            </DashboardLayout>
          } 
        />
        <Route 
          path="/agenda" 
          element={
            <DashboardLayout>
              <CalendarPage />
            </DashboardLayout>
          } 
        />
        <Route 
          path="/agenda/daily" 
          element={
            <DashboardLayout>
              <DailyAgendaPage />
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
        {/* Novas Rotas de Vendas */}
        <Route 
          path="/sales" 
          element={
            <DashboardLayout>
              <SalesPage />
            </DashboardLayout>
          } 
        />
        <Route 
          path="/sales/new" 
          element={
            <DashboardLayout>
              <NewSalePage />
            </DashboardLayout>
          } 
        />
        {/* Nova Rota de Contas a Pagar */}
        <Route 
          path="/accounts-payable" 
          element={
            <DashboardLayout>
              <AccountsPayablePage />
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
        <Route 
          path="/billing"
          element={
            <DashboardLayout>
              <BillingPage />
            </DashboardLayout>
          }
        />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;