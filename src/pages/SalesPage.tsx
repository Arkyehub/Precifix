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
import { format } from 'date-fns';

// Importar os novos hooks e componentes
import { useSalesData, QuoteStatus, Sale, ActiveTextFilter, SortConfig } from '@/hooks/use-sales-data';
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
  
  // --- State for Sorting ---
  // Initial sort state set to service_date descending
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'service_date', direction: 'desc' });

  // --- State for Drawer and Dialogs ---
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [isConfirmPaymentDialogOpen, setIsConfirmPaymentDialogOpen] = useState(false);
  const [saleToEditPayment, setSaleToEditPayment] = useState<Sale | null>(null);

  // --- Hooks for Data and Mutations ---
  const { sales, isLoadingSales, paymentMethods } = useSalesData(activeTextFilters, dateRange, sortConfig);
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

  const handleRemoveTextFilter = (indexToRemove: number) => {
    const updatedFilters = activeTextFilters.filter((_, index) => index !== indexToRemove);
    setActiveTextFilters(updatedFilters);
  };

  const handleClearDateRange = () => {
    setDateRange(undefined);
  };

  // --- Handler for Sorting ---
  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        // Toggle direction
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      // Default to descending for new sort (as per user request for Number)
      return { key, direction: 'desc' };
    });
  };

  // Mapeamento para exibir os nomes amigáveis dos status
  const statusDisplayLabels: Record<QuoteStatus, string> = {
    closed: 'Atendida',
    rejected: 'Cancelada',
    accepted: 'Aceita',
    pending: 'Em Aberto',
    awaiting_payment: 'Aguardando Pagamento',
    deleted: 'Excluída',
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
    // Filtrar vendas excluídas para que não entrem no cálculo, mesmo que estejam na lista (ex: filtro ativo)
    const activeSales = sales?.filter(s => s.status !== 'deleted') || [];

    const totalSales = activeSales.length;
    const attendedSales = activeSales.filter(s => s.status === 'closed');
    const awaitingPaymentSales = activeSales.filter(s => s.status === 'awaiting_payment');
    const openSales = activeSales.filter(s => s.status === 'pending');
    const acceptedSales = activeSales.filter(s => s.status === 'accepted');
    const canceledSales = activeSales.filter(s => s.status === 'rejected');

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

          {/* Exibição dos Filtros Ativos */}
          {(activeTextFilters.length > 0 || dateRange?.from) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-2">
              <span className="font-semibold">Filtros Ativos:</span>
              {activeTextFilters.map((filter, index) => (
                <span key={index} className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-primary-strong">
                  {filter.type === 'client' ? 'Cliente' :
                   filter.type === 'saleNumber' ? 'Nº Venda' :
                   filter.type === 'status' ? 'Status' :
                   filter.type === 'service' ? 'Serviço' :
                   filter.type === 'paymentMethod' ? 'Forma Pagamento' :
                   filter.type === 'vehicle' ? 'Veículo' : 'Busca'}: "
                  {filter.type === 'status'
                    ? statusDisplayLabels[filter.value as QuoteStatus]
                    : filter.type === 'paymentMethod'
                      ? paymentMethods?.find(pm => pm.id === filter.value)?.name || filter.value
                      : filter.value}
                  "
                  <button 
                    onClick={() => handleRemoveTextFilter(index)} 
                    className="ml-0.5 text-primary-strong/70 hover:text-primary-strong"
                    title="Remover busca"
                  >
                    &times;
                  </button>
                </span>
              ))}
              {dateRange?.from && (
                <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-primary-strong">
                  Período: {format(dateRange.from, "dd/MM/yyyy")}
                  {dateRange.to && ` - ${format(dateRange.to, "dd/MM/yyyy")}`}
                  <button 
                    onClick={handleClearDateRange} 
                    className="ml-0.5 text-primary-strong/70 hover:text-primary-strong"
                    title="Remover filtro de data"
                  >
                    &times;
                  </button>
                </span>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearAllFilters}
                className="text-muted-foreground hover:text-foreground h-auto px-2 py-0.5 text-xs"
              >
                Limpar Todos
              </Button>
            </div>
          )}

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
            sortConfig={sortConfig}
            onSort={handleSort}
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