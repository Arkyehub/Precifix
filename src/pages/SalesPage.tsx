import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Search, Info, Loader2, Filter, ListOrdered, BarChart } from 'lucide-react';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Sale {
  id: string;
  sale_number: string | null; // Novo campo
  client_name: string;
  total_price: number;
  created_at: string;
  services_summary: any[];
  status: 'closed' | 'canceled'; // Status simplificado para vendas
}

const SalesPage = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all closed sales (quotes with status 'accepted' or a new 'closed' status)
  // Buscamos apenas registros onde is_sale é TRUE
  const { data: sales, isLoading, error } = useQuery<Sale[]>({
    queryKey: ['closedSales', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('id, sale_number, client_name, total_price, created_at, services_summary, status')
        .eq('user_id', user.id)
        .eq('is_sale', true) // Filtrar apenas vendas
        .in('status', ['accepted', 'closed']) // Incluir 'closed' se for implementado no futuro
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      // Mapear para a interface Sale (usando 'accepted' como 'closed' por enquanto)
      return data.map(q => ({
        ...q,
        status: q.status === 'accepted' ? 'closed' : 'canceled',
      })) as Sale[];
    },
    enabled: !!user,
  });

  const filteredSales = sales?.filter(sale => 
    sale.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sale.sale_number && sale.sale_number.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const summary = React.useMemo(() => {
    const totalSales = filteredSales.length;
    const closedSales = filteredSales.filter(s => s.status === 'closed');
    const totalRevenue = closedSales.reduce((sum, s) => sum + s.total_price, 0);
    
    // Placeholder para métricas futuras
    const openSalesCount = filteredSales.filter(s => s.status !== 'closed').length;
    const openValue = filteredSales.filter(s => s.status !== 'closed').reduce((sum, s) => sum + s.total_price, 0);
    
    return {
      totalSales,
      closedCount: closedSales.length,
      totalRevenue,
      openSalesCount,
      openValue,
      ticketMedio: closedSales.length > 0 ? totalRevenue / closedSales.length : 0,
      taxasMaquinha: 0.00, // Placeholder
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
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <SummaryItem 
                title="Total Vendas" 
                count={summary.totalSales}
                value={`R$ ${summary.totalRevenue.toFixed(2)}`} 
                color="text-primary-strong"
                tooltip="Valor total de todas as vendas no período."
              />
              <SummaryItem 
                title="Fechadas" 
                count={summary.closedCount}
                value={`R$ ${summary.totalRevenue.toFixed(2)}`} 
                color="text-success"
                tooltip="Vendas concluídas e pagas."
              />
              <SummaryItem 
                title="Em aberto" 
                count={summary.openSalesCount}
                value={`R$ ${summary.openValue.toFixed(2)}`} 
                color="text-accent"
                tooltip="Vendas lançadas, mas ainda não finalizadas (aguardando pagamento)."
              />
              <SummaryItem 
                title="Valor pendente" 
                value={`R$ ${summary.openValue.toFixed(2)}`} 
                color="text-accent"
                tooltip="Valor total das vendas em aberto."
              />
              <SummaryItem 
                title="Ticket médio" 
                value={`R$ ${summary.ticketMedio.toFixed(2)}`} 
                color="text-info"
                tooltip="Valor médio por venda fechada."
              />
              <SummaryItem 
                title="Taxas" 
                value={`${summary.taxasMaquinha.toFixed(2)}%`} 
                color="text-destructive"
                tooltip="Média das taxas de pagamento aplicadas."
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
                  <TableHead>NFSe emitida</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px] text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length > 0 ? (
                  filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium text-muted-foreground">
                        #{sale.sale_number || sale.id.substring(0, 8)}
                      </TableCell>
                      <TableCell className="font-medium">{sale.client_name}</TableCell>
                      <TableCell>{sale.services_summary.length} serviço(s)</TableCell>
                      <TableCell className="text-right font-bold">R$ {sale.total_price.toFixed(2)}</TableCell>
                      <TableCell className="text-destructive font-semibold">Não</TableCell>
                      <TableCell>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-semibold",
                          sale.status === 'closed' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                        )}>
                          {sale.status === 'closed' ? 'Fechada' : 'Cancelada'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/sales/${sale.id}`)}>
                          <Info className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nenhuma venda encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesPage;