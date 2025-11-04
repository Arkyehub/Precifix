import React, { useState, useMemo, useEffect } from 'react';
import { CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { format, subDays, addDays, startOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ConfirmPaymentDialog } from '@/components/agenda/ConfirmPaymentDialog';
import { useQuoteActions } from '@/hooks/use-quote-actions';
import { SaleDetailsDrawer } from '@/components/sales/SaleDetailsDrawer';
import { useSaleProfitDetails } from '@/hooks/use-sale-profit-details';
import { AgendaHeader } from '@/components/agenda/AgendaHeader';
import { AgendaSummary } from '@/components/agenda/AgendaSummary';
import { QuoteListItem } from '@/components/agenda/QuoteListItem'; // Importação correta

interface Quote {
  id: string;
  client_name: string;
  vehicle: string;
  total_price: number;
  status: 'pending' | 'accepted' | 'rejected' | 'closed';
  service_date: string | null;
  service_time: string | null;
  notes: string | null;
}

interface AgendaViewProps {
  initialDate: Date;
}

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
  const { handleCloseSale } = useQuoteActions(undefined, true);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const { saleDetails, profitDetails, isLoadingDetails } = useSaleProfitDetails(selectedQuoteId);

  useEffect(() => {
    setSelectedDate(initialDate);
  }, [initialDate]);

  const [searchTerm, setSearchTerm] = useState('');
  const [quoteIdToDelete, setQuoteIdToDelete] = useState<string | null>(null);
  
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
        .not('service_date', 'is', null)
        .order('service_date', { ascending: true })
        .order('service_time', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
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
      queryClient.invalidateQueries({ queryKey: ['monthlyScheduledQuotes', user?.id] });
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
    onSuccess: () => {
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

  // --- Action Handlers ---

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
    setSelectedQuoteId(quoteId);
    setIsDetailsDrawerOpen(true);
  };

  const handleCloseDetailsDrawer = () => {
    setIsDetailsDrawerOpen(false);
    setSelectedQuoteId(null);
  };

  const handleDeleteQuote = (quoteId: string) => {
    setQuoteIdToDelete(quoteId);
    deleteQuoteMutation.mutate(quoteId);
  };

  const handleMarkAsNotRealized = (quoteId: string) => {
    markAsNotRealizedMutation.mutate(quoteId);
  };

  // --- Memoization ---

  const filteredQuotes = useMemo(() => {
    if (!quotes) return [];

    const dateFiltered = quotes.filter(quote => {
      if (!quote.service_date) return false;
      const quoteServiceDate = startOfDay(parseDateString(quote.service_date));
      return format(quoteServiceDate, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
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
    const quotesForSummary = filteredQuotes; 

    const result = {
      total: 0,
      accepted: 0,
      pending: 0,
      rejected: 0,
      closed: 0,
      totalValue: 0,
      acceptedValue: 0,
      pendingValue: 0,
      rejectedValue: 0,
      closedValue: 0,
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
      } else if (quote.status === 'closed') {
        result.closed++;
        result.closedValue += quote.total_price;
      }
    });

    return result;
  }, [filteredQuotes]);

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
      
      {/* 1. Header e Navegação */}
      <AgendaHeader
        selectedDate={selectedDate}
        searchTerm={searchTerm}
        formattedDate={formattedDate}
        onDateChange={handleDateChange}
        onSearchChange={setSearchTerm}
        onTodayClick={handleTodayClick}
        quoteCount={filteredQuotes.length}
      />

      {/* 2. Resumo do Dia */}
      <AgendaSummary summary={summary} />

      {/* 3. Lista de Agendamentos */}
      <div className="space-y-4 pt-4 border-t border-border/50">
        <h4 className="text-lg font-semibold text-foreground">Agendamentos para {format(selectedDate, 'dd/MM/yyyy')}</h4>
        {filteredQuotes.length > 0 ? (
          <div className="space-y-3">
            {filteredQuotes.map(quote => (
              <QuoteListItem
                key={quote.id}
                quote={quote}
                isDeleting={deleteQuoteMutation.isPending && quoteIdToDelete === quote.id}
                isMarkingNotRealized={markAsNotRealizedMutation.isPending}
                isClosingSale={handleCloseSale.isPending}
                onCopyLink={handleCopyLink}
                onEditQuote={handleEditQuote}
                onOpenCloseSaleDialog={handleOpenCloseSaleDialog}
                onMarkAsNotRealized={handleMarkAsNotRealized}
                onOpenDetailsDrawer={handleOpenDetailsDrawer}
                onDeleteQuote={handleDeleteQuote}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center italic py-8">
            Nenhum agendamento encontrado para esta data.
          </p>
        )}
      </div>
      
      {/* 4. Diálogos e Drawers */}
      {quoteToClose && (
        <ConfirmPaymentDialog
          isOpen={isConfirmPaymentDialogOpen}
          onClose={() => setIsConfirmPaymentDialogOpen(false)}
          quote={quoteToClose}
          onConfirm={handleConfirmPayment}
          isProcessing={handleCloseSale.isPending}
        />
      )}

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