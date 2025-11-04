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
  accepted: { label: 'Em Aberto', color: 'bg-primary-strong/20 text-primary-strong' }, // Alterado para primary-strong
  pending: { label: 'Em Aberto', color: 'bg-primary-strong/20 text-primary-strong' }, // Alterado para primary-strong
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<QuoteStatus | 'all'>('closed');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const { saleDetails, profitDetails, isLoadingDetails } = useSaleProfitDetails(selectedSaleId);

  // Fetch closed sales (is_sale = true)
  const { data: sales, isLoading, error } = useQuery<Sale[]>({
    queryKey: ['closedSales', user?.id, selectedStatus, sortOrder],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from('quotes')
        .select('id, sale_number, client_name, total_price, created_at, services_summary, status')
        .eq('user_id', user.id)
        .eq('is_sale', true); // Apenas registros marcados como venda

      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      query = query.order('created_at', { ascending: sortOrder === 'asc' });

      const { data, error } = await query;
      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!user,
  });

  const filteredSales = sales?.filter(sale => 
    sale.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sale.sale_number && sale.sale_number.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const handleOpenDetailsDrawer = (saleId: string) => {
    setSelectedSaleId(saleId);
    setIsDetailsDrawerOpen(true);
  };

  const handleCloseDetailsDrawer = () => {
    setIsDetailsDrawerOpen(false);
    setSelectedSaleId(null);
  };

  const handleEditSale = (saleId: string) => {
    navigate(`/generate-quote?quoteId=${saleId}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Carregando vendas...</p>
      </div>
    );
  }
  if (error) return <p className="text-destructive">Erro ao carregar vendas: {error.message}</p>;

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
                  Visualize e gerencie todas as vendas e orçamentos em aberto.
                </CardDescription>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/sales/new')}
              className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
            >
              <Plus className="mr-2 h-4 w-4" />
              Lançar Nova Venda
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por cliente ou número da venda"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Filter className="mr-2 h-4 w-4" />
                  Status: {selectableStatuses.find(s => s.key === selectedStatus)?.label || 'Todos'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filtrar por Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSelectedStatus('all')}>Todos</DropdownMenuItem>
                {selectableStatuses.map(status => (
                  <DropdownMenuItem key={status.key} onClick={() => setSelectedStatus(status.key)}>
                    {status.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <ListOrdered className="mr-2 h-4 w-4" />
                  Ordem: {sortOrder === 'desc' ? 'Mais Recente' : 'Mais Antiga'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Ordenar por Data</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSortOrder('desc')}>Mais Recente</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder('asc')}>Mais Antiga</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Venda/Orçamento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[80px] text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length > 0 ? (
                  filteredSales.map((sale) => {
                    const statusInfo = statusLabels[sale.status] || statusLabels.pending;
                    return (
                      <TableRow key={sale.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleOpenDetailsDrawer(sale.id)}>
                        <TableCell className="font-medium text-primary-strong">
                          {sale.sale_number || `#${sale.id.substring(0, 8)}`}
                        </TableCell>
                        <TableCell className="font-medium">{sale.client_name}</TableCell>
                        <TableCell className="text-right font-bold">R$ {sale.total_price.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <span className={cn("px-3 py-1 rounded-full text-xs font-semibold inline-block", statusInfo.color, statusInfo.color.replace('text-', 'bg-').replace('/20', '/10'))}>
                            {statusInfo.label}
                          </span>
                        </TableCell>
                        <TableCell className="flex justify-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditSale(sale.id); }} className="text-muted-foreground hover:text-primary hover:bg-white">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleOpenDetailsDrawer(sale.id); }} className="text-muted-foreground hover:text-info hover:bg-white">
                                  <Info className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver Detalhes</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Nenhuma venda ou orçamento encontrado com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SaleDetailsDrawer
        isOpen={isDetailsDrawerOpen}
        onClose={handleCloseDetailsDrawer}
        sale={saleDetails || null}
        profitDetails={profitDetails}
        isLoadingDetails={isLoadingDetails}
      />
    </div>
  );
};

export default SalesPage;