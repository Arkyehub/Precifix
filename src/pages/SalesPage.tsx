import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Search, Info, Loader2, Filter, ListOrdered, BarChart, Pencil } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SaleDetailsDrawer } from '@/components/sales/SaleDetailsDrawer'; // Importar o Drawer
import { useSaleProfitDetails } from '@/hooks/use-sale-profit-details'; // Importar o hook

// Mapeamento de status do DB para rótulos de Venda
type QuoteStatus = 'pending' | 'accepted' | 'rejected' | 'closed' | 'awaiting_payment';

interface Sale {
  id: string;
  sale_number: string | null;
  client_name: string;
  total_price: number;
  created_at: string;
  services_summary: any[];
  status: QuoteStatus;
}

// Componente para o rótulo de pagamento pendente
const AwaitingPaymentLabel = () => (
  <div className="flex flex-col items-center leading-none">
    <span>Aguardando</span>
    <span>Pagamento</span>
  </div>
);

const statusLabels: Record<QuoteStatus, { label: string | React.ReactNode; color: string }> = {
  closed: { label: 'Atendida', color: 'bg-success/20 text-success' },
  rejected: { label: 'Cancelada', color: 'bg-destructive/20 text-destructive' },
  accepted: { label: 'Em Aberto', color: 'bg-accent/20 text-accent' },
  pending: { label: 'Em Aberto', color: 'bg-accent/20 text-accent' }, // Mapear pending para Em Aberto também
  awaiting_payment: { label: <AwaitingPaymentLabel />, color: 'bg-info/20 text-info' },
};

// Status que o usuário pode selecionar no dropdown
const selectableStatuses: { key: QuoteStatus; label: string }[] = [
  { key: 'closed', label: 'Atendida' },
  { key: 'rejected', label: 'Cancelada' },
  { key: 'accepted', label: 'Em Aberto' },
  { key: 'awaiting_payment', label: 'Aguardando Pagamento' },
];

const SalesPage = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  // Hook para buscar detalhes e calcular lucro da venda selecionada
  const { saleDetails, profitDetails, isLoadingDetails } = useSaleProfitDetails(selectedSaleId);

  // Fetch all sales (quotes with is_sale: true)
  const { data: sales, isLoading, error } = useQuery<Sale[]>({
    queryKey: ['closedSales', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('id, sale_number, client_name, total_price, created_at, services_summary, status')
        .eq('user_id', user.id)
        .eq('is_sale', true) // Filtrar apenas vendas
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      // O status retornado é o status real do quote
      return data as Sale[];
    },
    enabled: !!user,
  });

  // Mutation para atualizar o status da venda
  const updateSaleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: QuoteStatus }) => {
      if (!user) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from('quotes')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closedSales', user?.id] });
    },
    onError: (err) => {
      console.error("Error updating sale status:", err);
      // Adicionar toast de erro se necessário
    },
  });

  const handleStatusChange = (id: string, newStatus: QuoteStatus) => {
    updateSaleStatusMutation.mutate({ id, newStatus });
  };

  const handleOpenDetails = (saleId: string) => {
    setSelectedSaleId(saleId);
    setIsDrawerOpen(true);
  };

  const handleCloseDetailsDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedSaleId(null); // Limpa o ID ao fechar
  };

  const filteredSales = sales?.filter(sale => 
    sale.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sale.sale_number && sale.sale_number.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const summary = React.useMemo(() => {
    const totalSales = filteredSales.length;
    const attendedSales = filteredSales.filter(s => s.status === 'closed');
    const awaitingPaymentSales = filteredSales.filter(s => s.status === 'awaiting_payment');
    const openSales = filteredSales.filter(s => s.status === 'accepted' || s.status === 'pending');
    const canceledSales = filteredSales.filter(s => s.status === 'rejected');

    const totalRevenue = attendedSales.reduce((sum, s) => sum + s.total_price, 0);
    const awaitingPaymentValue = awaitingPaymentSales.reduce((sum, s) => sum + s.total_price, 0);
    const openValue = openSales.reduce((sum, s) => sum + s.total_price, 0);
    
    return {
      totalSales,
      attendedCount: attendedSales.length,
      totalRevenue,
      awaitingPaymentCount: awaitingPaymentSales.length,
      awaitingPaymentValue,
      openSalesCount: openSales.length,
      openValue,
      canceledCount: canceledSales.length,
      ticketMedio: attendedSales.length > 0 ? totalRevenue / attendedSales.length : 0,
    };
  }, [filteredSales]);

  const SummaryItem = ({ title, value, count, color, tooltip }: { title: string, value: string, count?: number, color: string, tooltip: string }) => (
    <div className="p-4 rounded-lg border bg-background/50 shadow-sm">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          {title} {count !== undefined && `(${count})`}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent className="bg-card text-foreground border border-border/50 p-2 rounded-lg shadow-md">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h5>
      </div>
      <p className={cn("text-xl font-bold mt-1", color)}>{value}</p>
    </div>
  );

  if (isLoading) {
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
              <Plus className="mr-2 h-4 w-4" />
              Lançar Venda
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filtros e Busca */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou número da venda"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>
            <Button variant="outline" className="w-full sm:w-auto"><Filter className="h-4 w-4 mr-2" /> Filtrar</Button>
            <Button variant="outline" className="w-full sm:w-auto"><ListOrdered className="h-4 w-4 mr-2" /> Ordenar</Button>
            <Button variant="outline" className="w-full sm:w-auto"><BarChart className="h-4 w-4 mr-2" /> Gráficos</Button>
          </div>

          {/* Resumo do Período */}
          <div className="space-y-2">
            <h4 className="text-lg font-semibold text-foreground">Resumo do Período</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <SummaryItem 
                title="Total Vendas" 
                count={summary.totalSales}
                value={`R$ ${(summary.totalRevenue + summary.awaitingPaymentValue + summary.openValue).toFixed(2)}`} 
                color="text-primary-strong"
                tooltip="Valor total de todas as vendas (Atendidas + Aguardando Pagamento + Em Aberto) no período."
              />
              <SummaryItem 
                title="Atendidas" 
                count={summary.attendedCount}
                value={`R$ ${summary.totalRevenue.toFixed(2)}`} 
                color="text-success"
                tooltip="Vendas concluídas e pagas."
              />
              <SummaryItem 
                title="Aguardando Pagamento" 
                count={summary.awaitingPaymentCount}
                value={`R$ ${summary.awaitingPaymentValue.toFixed(2)}`} 
                color="text-info"
                tooltip="Vendas finalizadas, mas o pagamento ainda está pendente (ex: boleto, PIX agendado)."
              />
              <SummaryItem 
                title="Em Aberto" 
                count={summary.openSalesCount}
                value={`R$ ${summary.openValue.toFixed(2)}`} 
                color="text-accent"
                tooltip="Vendas lançadas, mas ainda não iniciadas ou em fase de negociação (status 'accepted' ou 'pending')."
              />
              <SummaryItem 
                title="Ticket médio" 
                value={`R$ ${summary.ticketMedio.toFixed(2)}`} 
                color="text-primary"
                tooltip="Valor médio por venda atendida."
              />
            </div>
          </div>

          {/* Tabela de Vendas */}
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviços/Produtos</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px] text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length > 0 ? (
                  filteredSales.map((sale) => {
                    const statusInfo = statusLabels[sale.status] || statusLabels.pending;
                    const isUpdating = updateSaleStatusMutation.isPending;

                    return (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium text-primary-strong">
                          {sale.sale_number || `#${sale.id.substring(0, 8)}`}
                        </TableCell>
                        <TableCell className="font-medium">{sale.client_name}</TableCell>
                        <TableCell>{sale.services_summary.length} serviço(s)</TableCell>
                        <TableCell className="text-right font-bold">R$ {sale.total_price.toFixed(2)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <span 
                                className={cn(
                                  "px-2 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors hover:opacity-80 inline-block text-center",
                                  statusInfo.color
                                )}
                                title="Clique para mudar o status"
                              >
                                {statusInfo.label}
                              </span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 bg-card">
                              <DropdownMenuLabel>Mudar Status da Venda</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {selectableStatuses.map(({ key, label }) => (
                                <DropdownMenuItem 
                                  key={key} 
                                  onClick={() => handleStatusChange(sale.id, key)}
                                  disabled={sale.status === key || isUpdating}
                                  className={cn(
                                    "cursor-pointer",
                                    sale.status === key && "bg-muted/50 font-bold"
                                  )}
                                >
                                  {label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell className="text-center flex justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleOpenDetails(sale.id)} 
                            title="Ver Detalhes e Lucratividade"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Nenhuma venda encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Drawer de Detalhes da Venda */}
      <SaleDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDetailsDrawer}
        sale={saleDetails || null}
        profitDetails={profitDetails}
        isLoadingDetails={isLoadingDetails}
      />
    </div>
  );
};

export default SalesPage;