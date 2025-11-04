import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, ArrowLeft, ArrowRight, Search, Loader2, Info, FileText, Clock, Car, DollarSign, Link as LinkIcon, Trash2, Pencil, CheckCheck, X } from 'lucide-react'; // Importado X
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { format, subDays, addDays, startOfDay, endOfDay, isSameDay, isToday, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom'; // Importar useNavigate
import { ConfirmPaymentDialog } from '@/components/agenda/ConfirmPaymentDialog'; // Importar o novo diálogo
import { useQuoteActions } from '@/hooks/use-quote-actions'; // Importar useQuoteActions
import { SaleDetailsDrawer } from '@/components/sales/SaleDetailsDrawer'; // Importar o Drawer de Detalhes
import { useSaleProfitDetails } from '@/hooks/use-sale-profit-details'; // Importar o hook de detalhes de lucro

interface Quote {
  id: string;
  client_name: string;
  vehicle: string;
  total_price: number;
  status: 'pending' | 'accepted' | 'rejected' | 'closed'; // Adicionado 'closed'
  service_date: string | null;
  service_time: string | null;
  notes: string | null;
}

interface AgendaViewProps {
  initialDate: Date;
}

const statusColors = {
  accepted: { text: 'Aceito', color: 'text-success', bg: 'bg-success/10', border: 'border-success/50' },
  pending: { text: 'Pendente', color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/50' },
  rejected: { text: 'Cancelados', color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/50' }, // Nomenclatura atualizada
  closed: { text: 'Concluído', color: 'text-info', bg: 'bg-info/10', border: 'border-info/50' }, // Novo status
};

// Helper function to parse YYYY-MM-DD string into a local Date object
const parseDateString = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  // Month is 0-indexed in Date constructor
  return new Date(year, month - 1, day);
};

export const AgendaView = ({ initialDate }: AgendaViewProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { handleCloseSale } = useQuoteActions(undefined, true); // Usar o hook de ações

  // Usar initialDate como estado inicial
  const [selectedDate, setSelectedDate] = useState(initialDate);
  
  // Estados para o Drawer de Detalhes
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Hook para buscar detalhes de lucro da cotação selecionada
  const { saleDetails, profitDetails, isLoadingDetails } = useSaleProfitDetails(selectedQuoteId);

  // Sincronizar o estado se a prop initialDate mudar (ex: se o usuário navegar de volta do calendário)
  useEffect(() => {
    setSelectedDate(initialDate);
  }, [initialDate]);

  const [searchTerm, setSearchTerm] = useState('');
  const [quoteIdToDelete, setQuoteIdToDelete] = useState<string | null>(null);
  
  // Estados para o diálogo de pagamento
  const [isConfirmPaymentDialogOpen, setIsConfirmPaymentDialogOpen] = useState(false);
  const [quoteToClose, setQuoteToClose] = useState<Quote | null>(null);

  // Fetch all quotes that have a service_date defined
  const { data: quotes, isLoading, error } = useQuery<Quote[]>({
    queryKey: ['scheduledQuotes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('id, client_name, vehicle, total_price, status, service_date, service_time, notes')
        .eq('user_id', user.id)
        .not('service_date', 'is', null) // Filter only quotes with a scheduled date
        .order('service_date', { ascending: true })
        .order('service_time', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      console.log('Tentando excluir orçamento:', quoteId);
      if (!user) throw new Error("Usuário não autenticado.");
      
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledQuotes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['quotesCount', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['quotesCalendar', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['monthlyScheduledQuotes', user?.id] }); // Invalida o novo calendário mensal
      toast({
        title: "Orçamento excluído!",
        description: "O orçamento e seu link foram removidos.",
      });
      setQuoteIdToDelete(null);
    },
    onError: (err) => {
      console.error("Erro ao excluir orçamento:", err);
      toast({
        title: "Erro ao excluir orçamento",
        description: err.message,
        variant: "destructive",
      });
      setQuoteIdToDelete(null);
    },
  });

  // Nova mutação para marcar como Não Realizado (status: rejected)
  const markAsNotRealizedMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      if (!user) throw new Error("Usuário não autenticado.");
      
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'rejected' })
        .eq('id', quoteId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: (data, quoteId) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledQuotes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['monthlyScheduledQuotes', user?.id] });
      toast({
        title: "Agendamento marcado como Cancelado!",
        description: "O status do agendamento foi atualizado para Cancelado.",
      });
    },
    onError: (err) => {
      console.error("Erro ao marcar como Cancelado:", err);
      toast({
        title: "Erro ao atualizar status",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleCopyLink = (quoteId: string) => {
    const baseUrl = window.location.origin;
    const quoteViewLink = `${baseUrl}/quote/view/${quoteId}`;
    navigator.clipboard.writeText(quoteViewLink)
      .then(() => {
        toast({
          title: "Link copiado!",
          description: "O link de visualização foi copiado para a área de transferência.",
        });
      })
      .catch(err => {
        console.error("Erro ao copiar link:", err);
        toast({
          title: "Erro ao copiar link",
          description: "Não foi possível copiar o link. Tente novamente.",
          variant: "destructive",
        });
      });
  };

  const handleEditQuote = (quoteId: string) => {
    // Redireciona para a página de geração de orçamento com o ID do orçamento na URL
    navigate(`/generate-quote?quoteId=${quoteId}`);
  };

  const handleOpenCloseSaleDialog = (quote: Quote) => {
    setQuoteToClose(quote);
    setIsConfirmPaymentDialogOpen(true);
  };

  const handleConfirmPayment = async (paymentMethodId: string, installments: number | null) => {
    if (!quoteToClose) return;

    try {
      await handleCloseSale.mutateAsync({
        quoteId: quoteToClose.id,
        paymentMethodId,
        installments,
      });
      
      toast({
        title: "Tarefa Concluída!",
        description: `A venda para ${quoteToClose.client_name} foi registrada com sucesso.`,
      });
      
    } catch (error: any) {
      toast({
        title: "Erro ao finalizar venda",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsConfirmPaymentDialogOpen(false);
      setQuoteToClose(null);
    }
  };

  const handleOpenDetailsDrawer = (quoteId: string) => {
    console.log(`Abrindo drawer para quoteId: ${quoteId}`); // LOG DE DEBUG
    setSelectedQuoteId(quoteId);
    setIsDetailsDrawerOpen(true);
  };

  const filteredQuotes = useMemo(() => {
    if (!quotes) return [];

    const dateFiltered = quotes.filter(quote => {
      if (!quote.service_date) return false;
      // Usar a função de parse para garantir que a data seja tratada como local
      const quoteServiceDate = startOfDay(parseDateString(quote.service_date));
      return isSameDay(quoteServiceDate, selectedDate);
    });

    if (!searchTerm) {
      return dateFiltered;
    }

    const lowerCaseSearch = searchTerm.toLowerCase();
    return dateFiltered.filter(quote => 
      quote.client_name.toLowerCase().includes(lowerCaseSearch) ||
      quote.vehicle.toLowerCase().includes(lowerCaseSearch) ||
      quote.notes?.toLowerCase().includes(lowerCaseSearch)
    );
  }, [quotes, selectedDate, searchTerm]);

  const summary = useMemo(() => {
    // O resumo agora é calculado APENAS com base nos orçamentos filtrados para o dia
    const quotesForSummary = filteredQuotes; 

    const result = {
      total: 0,
      accepted: 0,
      pending: 0,
      rejected: 0,
      closed: 0, // Adicionado closed
      totalValue: 0,
      acceptedValue: 0,
      pendingValue: 0,
      rejectedValue: 0,
      closedValue: 0, // Adicionado closedValue
    };

    quotesForSummary.forEach(quote => {
      result.total++;
      result.totalValue += quote.total_price;

      if (quote.status === 'accepted') {
        result.accepted++;
        result.acceptedValue += quote.total_price;
      } else if (quote.status === 'pending') {
        result.pending++;
        result.pendingValue += quote.total_price;
      } else if (quote.status === 'rejected') {
        result.rejected++;
        result.rejectedValue += quote.total_price;
      } else if (quote.status === 'closed') { // Novo status
        result.closed++;
        result.closedValue += quote.total_price;
      }
    });

    return result;
  }, [filteredQuotes]); // Depende apenas de filteredQuotes

  const handleDateChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setSelectedDate(subDays(selectedDate, 1));
    } else {
      setSelectedDate(addDays(selectedDate, 1));
    }
  };

  const handleTodayClick = () => {
    setSelectedDate(startOfDay(new Date()));
  };

  const formattedDate = format(selectedDate, 'EEEE, dd \'de\' MMMM \'de\' yyyy', { locale: ptBR });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Carregando agenda...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-8 w-8 text-foreground" />
          <div>
            <h2 className="text-xl font-bold text-foreground">Agendamentos do dia</h2>
            <p className="text-sm text-muted-foreground">
              {filteredQuotes.length > 0 ? `${filteredQuotes.length} agendamento(s) encontrado(s)` : 'Nenhum agendamento cadastrado para esta data'}
            </p>
          </div>
        </div>
        <Button onClick={handleTodayClick} variant="outline" size="sm">
          Hoje
        </Button>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border/50">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => handleDateChange('prev')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold text-foreground min-w-[200px] text-center">
            {formattedDate}
          </h3>
          <Button variant="outline" size="icon" onClick={() => handleDateChange('next')}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative flex-1 w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por agendamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background w-full"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-foreground">Resumo da Agenda (Dia)</h4> {/* Alterado o título */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard 
            title="Total" 
            count={summary.total} 
            value={summary.totalValue} 
            color="text-foreground" 
            valueColor="text-primary-strong"
          />
          {/* Concluídos movido para a esquerda dos Aceitos */}
          <SummaryCard 
            title="Concluídos" 
            count={summary.closed} 
            value={summary.closedValue} 
            color="text-info" 
            valueColor="text-info"
          />
          <SummaryCard 
            title="Aceitos" 
            count={summary.accepted} 
            value={summary.acceptedValue} 
            color="text-success" 
            valueColor="text-success"
          />
          <SummaryCard 
            title="Pendentes" 
            count={summary.pending} 
            value={summary.pendingValue} 
            color="text-accent" 
            valueColor="text-accent"
          />
          {/* Rejeitados removido daqui, pois o layout é 4 colunas */}
        </div>
        {/* Adicionando Rejeitados separadamente se o layout for 4 colunas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard 
            title="Cancelados" // Nomenclatura atualizada
            count={summary.rejected} 
            value={summary.rejectedValue} 
            color="text-destructive" 
            valueColor="text-destructive"
          />
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-border/50">
        <h4 className="text-lg font-semibold text-foreground">Agendamentos para {format(selectedDate, 'dd/MM/yyyy')}</h4>
        {filteredQuotes.length > 0 ? (
          <div className="space-y-3">
            {filteredQuotes.map(quote => {
              const status = statusColors[quote.status];
              const isDeletingThisQuote = deleteQuoteMutation.isPending && quoteIdToDelete === quote.id;

              return (
                <div 
                  key={quote.id} 
                  className={cn(
                    "p-4 rounded-lg border-l-4 shadow-sm transition-shadow hover:shadow-md",
                    status.border,
                    status.bg
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <p className="font-bold text-foreground">{quote.client_name}</p>
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", status.color, status.bg)}>
                          {status.text}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 ml-6">
                        <Car className="h-4 w-4" />
                        {quote.vehicle}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 ml-6">
                        <Clock className="h-4 w-4" />
                        {quote.service_time || 'Hora a combinar'}
                      </p>
                      <p className="text-lg font-bold flex items-center gap-1 ml-6" style={{ color: status.color }}>
                        <DollarSign className="h-5 w-5" />
                        R$ {quote.total_price.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex gap-1 items-center">
                      
                      {/* Botão de Tarefa Concluída (Apenas para Aceito) */}
                      {quote.status === 'accepted' && (
                        <>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleOpenCloseSaleDialog(quote)}
                                  className="text-success hover:bg-success/10"
                                  title="Marcar como Concluído (Lançar Venda)"
                                  disabled={handleCloseSale.isPending}
                                >
                                  <CheckCheck className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Marcar como Concluído</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          {/* NOVO Botão Não Realizados (agora Cancelados) */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => markAsNotRealizedMutation.mutate(quote.id)}
                                  className="text-destructive hover:bg-destructive/10"
                                  title="Marcar como Cancelado"
                                  disabled={markAsNotRealizedMutation.isPending}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Marcar como Cancelado</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}

                      {/* Botões de Ação para Pendente */}
                      {quote.status === 'pending' && (
                        <>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleCopyLink(quote.id)}
                                  className="text-primary hover:bg-primary/10"
                                  title="Copiar Link do Orçamento"
                                >
                                  <LinkIcon className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copiar Link</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleEditQuote(quote.id)}
                                  className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  title="Editar Orçamento"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar Orçamento</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}

                      {/* Botão de Info (para todos os status) */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-muted-foreground hover:bg-background"
                              onClick={() => handleOpenDetailsDrawer(quote.id)} // Abre o Drawer
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-card text-foreground border border-border/50 p-3 rounded-lg shadow-md max-w-xs">
                            <p className="font-semibold mb-1">Ver Detalhes</p>
                            <p className="text-sm">Clique para ver os detalhes completos do orçamento e a análise de lucro.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {/* Botão de Excluir (Apenas para Pendente) */}
                      {quote.status === 'pending' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:bg-destructive/10"
                              title="Excluir Orçamento"
                              onClick={() => setQuoteIdToDelete(quote.id)}
                              disabled={deleteQuoteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação excluirá permanentemente o orçamento de "{quote.client_name}" e seu link de visualização.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isDeletingThisQuote}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => {
                                  if (quoteIdToDelete) {
                                    deleteQuoteMutation.mutate(quoteIdToDelete);
                                  }
                                }} 
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={isDeletingThisQuote}
                              >
                                {isDeletingThisQuote ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center italic py-8">
            Nenhum agendamento encontrado para esta data.
          </p>
        )}
      </div>
      
      {/* Diálogo de Confirmação de Pagamento */}
      {quoteToClose && (
        <ConfirmPaymentDialog
          isOpen={isConfirmPaymentDialogOpen}
          onClose={() => setIsConfirmPaymentDialogOpen(false)}
          quote={quoteToClose}
          onConfirm={handleConfirmPayment}
          isProcessing={handleCloseSale.isPending}
        />
      )}

      {/* Drawer de Detalhes do Agendamento/Venda */}
      <SaleDetailsDrawer
        isOpen={isDetailsDrawerOpen}
        onClose={() => {
          setIsDetailsDrawerOpen(false);
          setSelectedQuoteId(null); // Limpa o ID ao fechar
        }}
        sale={saleDetails || null}
        profitDetails={profitDetails}
        isLoadingDetails={isLoadingDetails}
      />
    </div>
  );
};

interface SummaryCardProps {
  title: string;
  count: number;
  value: number;
  color: string;
  valueColor: string;
}

const SummaryCard = ({ title, count, value, color, valueColor }: SummaryCardProps) => (
  <Card className="p-4 bg-background border-border/50 shadow-sm">
    <div className="flex items-center justify-between">
      <h5 className={cn("text-sm font-medium", color)}>{title} ({count})</h5>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
          </TooltipTrigger>
          <TooltipContent className="bg-card text-foreground border border-border/50 p-2 rounded-lg shadow-md">
            <p className="text-xs">Total de orçamentos com data de serviço agendada.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
    <p className={cn("text-xl font-bold mt-1", valueColor)}>R$ {value.toFixed(2)}</p>
  </Card>
);