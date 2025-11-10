import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Search, Info, Loader2, Filter, Calendar as CalendarIcon, CreditCard, MoreVertical, Pencil, Trash2 } from 'lucide-react';
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
import { ConfirmPaymentDialog } from '@/components/agenda/ConfirmPaymentDialog'; // Importar o diálogo de pagamento
import { useQuoteActions } from '@/hooks/use-quote-actions'; // Importar useQuoteActions
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"; // IMPORT CORRIGIDO
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, addDays, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList, CommandItem } from "@/components/ui/command"; // Importar componentes do Command

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
  payment_method_id: string | null; // Adicionado
  installments: number | null; // Adicionado
  vehicle: string | null; // Adicionado para resolver o erro de compilação
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
  accepted: { label: 'Em Aberto', color: 'bg-primary/20 text-primary-strong' },
  pending: { label: 'Em Aberto', color: 'bg-primary/20 text-primary-strong' },
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
  const { handleCloseSale } = useQuoteActions(undefined, true); // Reutilizar a mutação de fechar venda
  const [searchTerm, setSearchTerm] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  
  const [isConfirmPaymentDialogOpen, setIsConfirmPaymentDialogOpen] = useState(false);
  const [saleToEditPayment, setSaleToEditPayment] = useState<Sale | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined); // Estado real do filtro
  const [openCalendar, setOpenCalendar] = useState(false); // Estado para controlar o Popover
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(undefined); // Estado temporário para seleção no calendário
  const [searchFilterType, setSearchFilterType] = useState<'client' | 'saleNumber' | 'status' | 'service' | 'paymentMethod' | 'vehicle'>('client'); // Novo estado para o tipo de filtro de busca
  const [tempSearchTerm, setTempSearchTerm] = useState(''); // Estado temporário para o input de busca
  const [activeTextFilters, setActiveTextFilters] = useState<Array<{ type: 'client' | 'saleNumber' | 'status' | 'service' | 'paymentMethod' | 'vehicle', value: string }>>([]); // Novo estado para múltiplos filtros de texto
  const [openCombobox, setOpenCombobox] = useState(false); // Estado para controlar a abertura do combobox

  // Hook para buscar detalhes e calcular lucro da venda selecionada
  const { saleDetails, profitDetails, isLoadingDetails, paymentMethodDetails } = useSaleProfitDetails(selectedSaleId);

  // Fetch all sales (quotes with is_sale: true)
  const { data: sales, isLoading, error } = useQuery<Sale[]>({
    queryKey: ['closedSales', user?.id, JSON.stringify(activeTextFilters), dateRange], // queryKey agora depende de activeTextFilters
    queryFn: async () => {
      if (!user) return [];
      let query = supabase
        .from('quotes')
        .select('id, sale_number, client_name, total_price, created_at, services_summary, status, payment_method_id, installments, vehicle') // Adicionado vehicle
        .eq('user_id', user.id)
        .eq('is_sale', true); // Filtrar apenas vendas

      if (dateRange?.from) {
        const start = startOfDay(dateRange.from).toISOString();
        query = query.gte('created_at', start);
      }
      if (dateRange?.to) {
        const end = endOfDay(dateRange.to).toISOString();
        query = query.lte('created_at', end);
      }

      // Aplicar filtros de texto do activeTextFilters (server-side)
      const clientFilters = activeTextFilters.filter(f => f.type === 'client');
      const saleNumberFilters = activeTextFilters.filter(f => f.type === 'saleNumber'); // NOVO: Filtro por número da venda
      const statusFilters = activeTextFilters.filter(f => f.type === 'status');
      const vehicleFilters = activeTextFilters.filter(f => f.type === 'vehicle');

      if (clientFilters.length > 0) {
        const clientOrConditions = clientFilters.map(f => `client_name.ilike.%${f.value}%`).join(','); // MODIFICADO: Apenas client_name
        query = query.or(clientOrConditions);
      }
      if (saleNumberFilters.length > 0) { // NOVO: Lógica para número da venda
        const saleNumberOrConditions = saleNumberFilters.map(f => `sale_number.ilike.%${f.value}%`).join(',');
        query = query.or(saleNumberOrConditions);
      }
      if (statusFilters.length > 0) {
        const statusOrConditions = statusFilters.map(f => {
          const statusKey = Object.keys(statusLabels).find(key =>
            statusLabels[key as QuoteStatus].label.toString().toLowerCase().includes(f.value.toLowerCase())
          );
          return statusKey ? `status.eq.${statusKey}` : '';
        }).filter(Boolean).join(',');
        if (statusOrConditions) query = query.or(statusOrConditions);
      }
      if (vehicleFilters.length > 0) {
        const vehicleOrConditions = vehicleFilters.map(f => `vehicle.ilike.%${f.value}%`).join(',');
        query = query.or(vehicleOrConditions);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      
      let currentSales = data as Sale[];

      // Aplicar filtros de texto do activeTextFilters (client-side)
      const serviceFilters = activeTextFilters.filter(f => f.type === 'service');
      const paymentMethodFilters = activeTextFilters.filter(f => f.type === 'paymentMethod');

      if (serviceFilters.length > 0) {
        currentSales = currentSales.filter(sale =>
          serviceFilters.some(filter =>
            sale.services_summary.some((service: any) =>
              service.name.toLowerCase().includes(filter.value.toLowerCase())
            )
          )
        );
      }

      if (paymentMethodFilters.length > 0) {
        if (paymentMethods) { // Garante que paymentMethods esteja carregado
          currentSales = currentSales.filter(sale =>
            paymentMethodFilters.some(filter => {
              if (!sale.payment_method_id) return false;
              const method = paymentMethods.find(pm => pm.id === sale.payment_method_id);
              return method?.name.toLowerCase().includes(filter.value.toLowerCase());
            })
          );
        }
      }

      return currentSales;
    },
    enabled: !!user,
  });

  // Fetch payment methods for client-side filtering
  const { data: paymentMethods } = useQuery({
    queryKey: ['paymentMethods', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, name');
      if (error) throw error;
      return data;
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

  // Mutation para deletar a venda
  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      if (!user) throw new Error("Usuário não autenticado.");
      
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', saleId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closedSales', user?.id] });
      // Invalida outras queries relacionadas a orçamentos/agenda
      queryClient.invalidateQueries({ queryKey: ['scheduledQuotes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['quotesCount', user?.id] });
    },
    onError: (err) => {
      console.error("Erro ao excluir venda:", err);
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

  const handleEditSale = (saleId: string) => {
    // Redireciona para a página de lançamento de venda com o ID para edição
    navigate(`/sales/new?quoteId=${saleId}`);
  };

  const handleOpenPaymentDialog = (sale: Sale) => {
    setSaleToEditPayment(sale);
    setIsConfirmPaymentDialogOpen(true);
  };

  const handleConfirmPayment = async (paymentMethodId: string, installments: number | null) => {
    if (!saleToEditPayment) return;

    try {
      await handleCloseSale.mutateAsync({
        quoteId: saleToEditPayment.id,
        paymentMethodId,
        installments,
      });
      
      // O onSuccess da mutação já invalida as queries
      
    } catch (error: any) {
      // O erro já é tratado no useQuoteActions
    } finally {
      setIsConfirmPaymentDialogOpen(false);
      setSaleToEditPayment(null);
    }
  };

  const handleDeleteSale = (saleId: string) => {
    deleteSaleMutation.mutate(saleId);
  };

  // Função para adicionar um filtro de texto
  const handleApplySearch = (selectedValue?: string) => {
    const valueToApply = selectedValue || tempSearchTerm;
    if (valueToApply.trim()) {
      // Evita adicionar filtros duplicados
      const existingFilterIndex = activeTextFilters.findIndex(
        f => f.type === searchFilterType && f.value.toLowerCase() === valueToApply.toLowerCase()
      );

      if (existingFilterIndex === -1) {
        setActiveTextFilters(prev => [...prev, { type: searchFilterType, value: valueToApply.trim() }]);
      }
      setTempSearchTerm(''); // Limpa o input após aplicar o filtro
    }
  };

  // Função para remover um filtro de texto específico
  const handleRemoveTextFilter = (indexToRemove: number) => {
    setActiveTextFilters(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // Função para limpar todos os filtros
  const handleClearAllFilters = () => {
    setActiveTextFilters([]);
    setDateRange(undefined);
    setTempSearchTerm('');
  };

  // Gerar sugestões para o combobox
  const suggestions = React.useMemo(() => {
    const uniqueValues = new Set<string>();
    const currentSuggestions: { value: string; label: string }[] = [];

    if (!sales) return [];

    if (searchFilterType === 'status') {
      return selectableStatuses.map(s => ({ value: s.key, label: s.label.toString() }));
    } else if (searchFilterType === 'paymentMethod') {
      return paymentMethods?.map((pm: any) => ({ value: pm.name, label: pm.name })) || [];
    } else if (searchFilterType === 'client') {
      sales.forEach(sale => {
        if (sale.client_name) uniqueValues.add(sale.client_name);
      });
    } else if (searchFilterType === 'saleNumber') { // NOVO: Sugestões para número da venda
      sales.forEach(sale => {
        if (sale.sale_number) uniqueValues.add(sale.sale_number);
      });
    } else if (searchFilterType === 'service') {
      sales.forEach(sale => {
        sale.services_summary?.forEach((service: any) => {
          if (service.name) uniqueValues.add(service.name);
        });
      });
    } else if (searchFilterType === 'vehicle') {
      sales.forEach(sale => {
        if (sale.vehicle) uniqueValues.add(sale.vehicle);
      });
    }

    Array.from(uniqueValues).sort().forEach(value => {
      currentSuggestions.push({ value, label: value });
    });

    return currentSuggestions;
  }, [sales, searchFilterType, paymentMethods]);

  const summary = React.useMemo(() => {
    const totalSales = sales?.length || 0; // Use sales diretamente, pois a filtragem agora é na queryFn
    const attendedSales = sales?.filter(s => s.status === 'closed') || [];
    const awaitingPaymentSales = sales?.filter(s => s.status === 'awaiting_payment') || [];
    const openSales = sales?.filter(s => s.status === 'accepted' || s.status === 'pending') || [];
    const canceledSales = sales?.filter(s => s.status === 'rejected') || [];

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
  }, [sales]); // Depende apenas de sales, pois a filtragem já ocorreu na queryFn

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
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Dropdown de Filtro por Tipo */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 bg-card">
                <DropdownMenuLabel>Filtrar por:</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSearchFilterType('client')}>
                  Cliente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSearchFilterType('saleNumber')}> {/* NOVO ITEM */}
                  Nº Venda
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSearchFilterType('status')}>
                  Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSearchFilterType('service')}>
                  Serviço
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSearchFilterType('paymentMethod')}>
                  Forma de Pagamento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSearchFilterType('vehicle')}>
                  Veículo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full justify-between text-left font-normal"
                >
                  {
                    searchFilterType === 'client' ? 'Buscar por cliente' :
                    searchFilterType === 'saleNumber' ? 'Buscar por número da venda' :
                    searchFilterType === 'status' ? 'Buscar por status (Ex: Atendida)' :
                    searchFilterType === 'service' ? 'Buscar por serviço (Ex: Polimento)' :
                    searchFilterType === 'paymentMethod' ? 'Buscar por forma de pagamento' :
                    searchFilterType === 'vehicle' ? 'Buscar por veículo (Ex: Gol)' :
                    'Buscar...'
                  }
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput
                    placeholder={
                      searchFilterType === 'client' ? 'Buscar por cliente' :
                      searchFilterType === 'saleNumber' ? 'Buscar por número da venda' :
                      searchFilterType === 'status' ? 'Buscar por status (Ex: Atendida)' :
                      searchFilterType === 'service' ? 'Buscar por serviço (Ex: Polimento)' :
                      searchFilterType === 'paymentMethod' ? 'Buscar por forma de pagamento' :
                      searchFilterType === 'vehicle' ? 'Buscar por veículo (Ex: Gol)' :
                      'Buscar...'
                    }
                    value={tempSearchTerm}
                    onValueChange={setTempSearchTerm}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleApplySearch();
                        setOpenCombobox(false);
                      }
                    }}
                    autoFocus
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                    <CommandGroup>
                      {suggestions
                        .filter(suggestion =>
                          suggestion.label.toLowerCase().includes(tempSearchTerm.toLowerCase())
                        )
                        .map((suggestion) => (
                          <CommandItem
                            key={suggestion.value}
                            value={suggestion.label}
                            onSelect={() => {
                              setTempSearchTerm(suggestion.label);
                              handleApplySearch(suggestion.value);
                              setOpenCombobox(false);
                            }}
                          >
                            {suggestion.label}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            
            {/* Botão de Filtro por Data */}
            <Popover open={openCalendar} onOpenChange={setOpenCalendar}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-full sm:w-[300px] justify-start text-left font-normal",
                            !dateRange && "text-muted-foreground"
                        )}
                        onClick={() => {
                          setOpenCalendar(true);
                          setTempDateRange(dateRange); // Inicializa o tempDateRange com o valor atual ao abrir
                        }}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                            dateRange.to ? (
                                <>
                                    {format(dateRange.from, "dd/MM/yyyy")} -{" "}
                                    {format(dateRange.to, "dd/MM/yyyy")}
                                </>
                            ) : (
                                format(dateRange.from, "dd/MM/yyyy")
                            )
                        ) : (
                            <span>Filtrar por data</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={tempDateRange?.from || new Date()} // Usa tempDateRange para o mês padrão
                        selected={tempDateRange} // O calendário exibe a seleção temporária
                        onSelect={(newRange) => {
                            setTempDateRange(newRange);
                            // Não fecha o popover automaticamente aqui
                        }}
                        numberOfMonths={2}
                    />
                    <div className="flex justify-end gap-2 p-2 border-t">
                        <Button 
                            variant="outline" 
                            onClick={() => {
                                setDateRange(undefined);
                                setTempDateRange(undefined);
                                setOpenCalendar(false);
                            }}
                        >
                            Limpar
                        </Button>
                        <Button 
                            onClick={() => {
                                setDateRange(tempDateRange);
                                setOpenCalendar(false);
                            }}
                            disabled={!tempDateRange?.from} // Desabilita se nenhuma data foi selecionada
                        >
                            Confirmar
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
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
                color="text-primary-strong"
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

          {/* Exibição de Filtros Ativos */}
          {(activeTextFilters.length > 0 || dateRange?.from) && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-semibold">Filtros Ativos:</span>
              {activeTextFilters.map((filter, index) => (
                <span key={index} className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-primary-strong">
                  {filter.type === 'client' ? 'Cliente' : // MODIFICADO
                   filter.type === 'saleNumber' ? 'Nº Venda' : // NOVO
                   filter.type === 'status' ? 'Status' :
                   filter.type === 'service' ? 'Serviço' :
                   filter.type === 'paymentMethod' ? 'Forma Pagamento' :
                   filter.type === 'vehicle' ? 'Veículo' : 'Busca'}: "{filter.value}"
                  <button 
                    onClick={() => handleRemoveTextFilter(index)} 
                    className="ml-1 text-primary-strong/70 hover:text-primary-strong"
                    title="Remover busca"
                  >
                    &times;
                  </button>
                </span>
              ))}
              {dateRange?.from && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-primary-strong">
                  Período: {format(dateRange.from, "dd/MM/yyyy")}
                  {dateRange.to && ` - ${format(dateRange.to, "dd/MM/yyyy")}`}
                  <button 
                    onClick={() => setDateRange(undefined)} 
                    className="ml-1 text-primary-strong/70 hover:text-primary-strong"
                    title="Remover filtro de data"
                  >
                    &times;
                  </button>
                </span>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearAllFilters} // Chama a função para limpar todos os filtros
                className="text-muted-foreground hover:text-foreground"
              >
                Limpar Todos
              </Button>
            </div>
          )}

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
                {sales && sales.length > 0 ? (
                  sales.map((sale) => {
                    const statusInfo = statusLabels[sale.status] || statusLabels.pending;
                    const isUpdating = updateSaleStatusMutation.isPending;
                    const isDeleting = deleteSaleMutation.isPending && deleteSaleMutation.variables === sale.id;

                    // Lógica de desabilitação
                    const canEdit = sale.status === 'pending' || sale.status === 'accepted';
                    const canChangePayment = sale.status === 'closed' || sale.status === 'awaiting_payment';

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
                          
                          {/* Dropdown de Ações */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-muted-foreground hover:bg-background"
                                title="Mais ações"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 bg-card" align="end">
                              
                              {/* 1. Alterar Forma de Pagamento */}
                              <DropdownMenuItem 
                                onClick={() => canChangePayment && handleOpenPaymentDialog(sale)}
                                disabled={!canChangePayment || handleCloseSale.isPending}
                                className={cn("cursor-pointer", !canChangePayment && "opacity-50 cursor-not-allowed")}
                              >
                                {handleCloseSale.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4 text-info" />}
                                Alterar Forma de Pagamento
                              </DropdownMenuItem>

                              {/* 2. Editar */}
                              <DropdownMenuItem 
                                onClick={() => canEdit && handleEditSale(sale.id)}
                                disabled={!canEdit}
                                className={cn("cursor-pointer", !canEdit && "opacity-50 cursor-not-allowed")}
                              >
                                <Pencil className="mr-2 h-4 w-4 text-primary" />
                                Editar
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              {/* 3. Excluir (com AlertDialog) */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem 
                                    onSelect={(e) => e.preventDefault()}
                                    disabled={isDeleting}
                                    className={cn("cursor-pointer text-destructive focus:text-destructive", isDeleting && "opacity-50 cursor-not-allowed")}
                                  >
                                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                    Excluir
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-card">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação excluirá permanentemente a venda "{sale.sale_number || `#${sale.id.substring(0, 8)}`}" e todos os seus registros associados.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteSale(sale.id)} 
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      disabled={isDeleting}
                                    >
                                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
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