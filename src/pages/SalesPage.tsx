import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SaleDetailsDrawer } from '@/components/sales/SaleDetailsDrawer';
import { useSaleProfitDetails } from '@/hooks/use-sale-profit-details';
import { ConfirmPaymentDialog } from '@/components/agenda/ConfirmPaymentDialog';
import { useQuoteActions } from '@/hooks/use-quote-actions';
import { DateRange } from 'react-day-picker';

// Importar os novos hooks e componentes
import { useSalesData, QuoteStatus, Sale, ActiveTextFilter } from '@/hooks/use-sales-data';
import { useSalesMutations } from '@/hooks/use-sales-mutations';
import { SalesSummaryCards } from '@/components/sales/SalesSummaryCards';
import { SalesFilterBar } from '@/components/sales/SalesFilterBar';
import { SalesListTable } from '@/components/sales/SalesListTable';

const SalesPage = () => {
  const navigate = useNavigate();
  const { handleCloseSale } = useQuoteActions(undefined, true);

  // --- State for Filters ---
  const [activeTextFilters, setActiveTextFilters] = useState<ActiveTextFilter[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // --- State for Drawer and Dialogs ---
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [isConfirmPaymentDialogOpen, setIsConfirmPaymentDialogOpen] = useState(false);
  const [saleToEditPayment, setSaleToEditPayment] = useState<Sale | null>(null);

  // --- Hooks for Data and Mutations ---
  const { sales, isLoadingSales, paymentMethods } = useSalesData(activeTextFilters, dateRange);
  const { updateSaleStatusMutation, deleteSaleMutation } = useSalesMutations();
  const { saleDetails, profitDetails, isLoadingDetails, paymentMethodDetails } = useSaleProfitDetails(selectedSaleId);

  // --- Handlers for FilterBar ---
  const handleApplyFilters = (filters: { activeTextFilters: ActiveTextFilter[], dateRange: DateRange | undefined }) => {
    setActiveTextFilters(filters.activeTextFilters);
    setDateRange(filters.dateRange);
  };

  const handleClearAllFilters = () => {
    setActiveTextFilters([]);
    setDateRange(undefined);
  };

  // --- Handlers for SalesListTable ---
  const handleOpenDetails = (saleId: string) => {
    setSelectedSaleId(saleId);
    setIsDrawerOpen(true);
  };

  const handleStatusChange = (id: string, newStatus: QuoteStatus) => {
    updateSaleStatusMutation.mutate({ id, newStatus });
  };

  const handleEditSale = (saleId: string) => {
    navigate(`/sales/new?quoteId=${saleId}`);
  };

  const handleOpenPaymentDialog = (sale: Sale) => {
    setSaleToEditPayment(sale);
    setIsConfirmPaymentDialogOpen(true);
  };

  const handleDeleteSale = (saleId: string) => {
    deleteSaleMutation.mutate(saleId);
  };

  // --- Handler for ConfirmPaymentDialog ---
  const handleConfirmPayment = async (paymentMethodId: string, installments: number | null) => {
    if (!saleToEditPayment) return;

    try {
      await handleCloseSale.mutateAsync({
        quoteId: saleToEditPayment.id,
        paymentMethodId,
        installments,
      });
    } catch (error: any) {
      // Error handled in useQuoteActions
    } finally {
      setIsConfirmPaymentDialogOpen(false);
      setSaleToEditPayment(null);
    }
  };

  // --- Handlers for SaleDetailsDrawer ---
  const handleCloseDetailsDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedSaleId(null);
  };

  // --- Summary Calculation ---
  const summary = useMemo(() => {
    const totalSales = sales?.length || 0;
    const attendedSales = sales?.filter(s => s.status === 'closed') || [];
    const awaitingPaymentSales = sales?.filter(s => s.status === 'awaiting_payment') || [];
    const openSales = sales?.filter(s => s.status === 'pending') || [];
    const acceptedSales = sales?.filter(s => s.status === 'accepted') || [];
    const canceledSales = sales?.filter(s => s.status === 'rejected') || [];

    const totalRevenue = attendedSales.reduce((sum, s) => sum + s.total_price, 0);
    const awaitingPaymentValue = awaitingPaymentSales.reduce((sum, s) => sum + s.total_price, 0);
    const openValue = openSales.reduce((sum, s) => sum + s.total_price, 0);
    const acceptedValue = acceptedSales.reduce((sum, s) => sum + s.total_price, 0);
    
    return {
      totalSales,
      attendedCount: attendedSales.length,
      totalRevenue,
      awaitingPaymentCount: awaitingPaymentSales.length,
      awaitingPaymentValue,
      openSalesCount: openSales.length,
      openValue,
      acceptedSalesCount: acceptedSales.length,
      acceptedValue,
      canceledCount: canceledSales.length,
      ticketMedio: attendedSales.length > 0 ? totalRevenue / attendedSales.length : 0,
    };
  }, [sales]);

  if (isLoadingSales) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Carregando vendas...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-foreground">Gerenciar Vendas</CardTitle>
                <CardDescription>
                  Visualize e acompanhe todas as vendas finalizadas.
                </CardDescription>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/sales/new')}
              className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
            >
              Lançar Venda
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filtros e Busca */}
          <SalesFilterBar
            allSalesForSuggestions={sales || []}
            paymentMethods={paymentMethods}
            activeTextFilters={activeTextFilters}
            dateRange={dateRange}
            onApplyFilters={handleApplyFilters}
            onClearAllFilters={handleClearAllFilters}
          />

          {/* Resumo do Período */}
          <SalesSummaryCards summary={summary} />

          {/* Tabela de Vendas */}
          <SalesListTable
            sales={sales || []}
            isLoadingMutations={handleCloseSale.isPending || updateSaleStatusMutation.isPending || deleteSaleMutation.isPending}
            updateSaleStatusMutation={updateSaleStatusMutation}
            deleteSaleMutation={deleteSaleMutation}
            onOpenDetails={handleOpenDetails}
            onStatusChange={handleStatusChange}
            onEditSale={handleEditSale}
            onOpenPaymentDialog={handleOpenPaymentDialog}
            onDeleteSale={handleDeleteSale}
          />
        </CardContent>
      </Card>
      
      {/* Drawer de Detalhes da Venda */}
      <SaleDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDetailsDrawer}
        sale={saleDetails || null}
        profitDetails={profitDetails}
        isLoadingDetails={isLoadingDetails}
        paymentMethodDetails={paymentMethodDetails}
      />

      {/* Diálogo de Confirmação de Pagamento (Reutilizado para Alterar Pagamento) */}
      {saleToEditPayment && (
        <ConfirmPaymentDialog
          isOpen={isConfirmPaymentDialogOpen}
          onClose={() => setIsConfirmPaymentDialogOpen(false)}
          quote={saleToEditPayment}
          onConfirm={handleConfirmPayment}
          isProcessing={handleCloseSale.isPending}
        />
      )}
    </div>
  );
};

export default SalesPage;