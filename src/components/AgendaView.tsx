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
import { QuoteListItem } from '@/components/agenda/QuoteListItem';
import { QuotePayload, QuoteData, QuotedService, PaymentMethod } from '@/lib/quote-utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Profile } from '@/lib/quote-utils';

interface Quote {
  id: string;
  client_name: string;
  vehicle: string;
  total_price: number;
  status: QuotePayload['status'];
  service_date: string | null;
  service_time: string | null;
  notes: string | null;
  // Added fields for PDF/WhatsApp generation
  user_id: string; // Adicionado para o Client
  client_id: string | null;
  vehicle_id: string | null;
  services_summary: QuotedService[]; // JSONB array
  client_document: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_address: string | null;
  client_address_number: string | null;
  client_complement: string | null;
  client_city: string | null;
  client_state: string | null;
  client_zip_code: string | null;
  valid_until: string;
  created_at: string; // For quote_date
  commission_value: number | null;
  commission_type: 'amount' | 'percentage' | null;
  payment_method_id: string | null;
  installments: number | null;
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
  
  // Fetch user profile for useQuoteActions
  const { data: userProfile } = useQuery<Profile>({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { handleCloseSale, handleGenerateAndDownloadPDF, handleSendViaWhatsApp } = useQuoteActions(userProfile || undefined, true);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const { saleDetails, profitDetails, isLoadingDetails, paymentMethodDetails } = useSaleProfitDetails(selectedQuoteId); // Adicionado paymentMethodDetails

  useEffect(() => {
    setSelectedDate(initialDate);
  }, [initialDate]);

  const [searchTerm, setSearchTerm] = useState('');
  const [quoteIdToDelete, setQuoteIdToDelete] = useState<string | null>(null);
  
  const [isConfirmPaymentDialogOpen, setIsConfirmPaymentDialogOpen] = useState(false);
  const [quoteToClose, setQuoteToClose] = useState<Quote | null>(null);

  // Estados para o AlertDialog de mudança de status
  const [showStatusChangeWarning, setShowStatusChangeWarning] = useState(false);
  const [quoteToChangeStatus, setQuoteToChangeStatus] = useState<Quote | null>(null);
  const [newStatusForWarning, setNewStatusForWarning] = useState<QuotePayload['status'] | null>(null);

  // Fetch all quotes that have a service_date defined
  const { data: quotes, isLoading, error } = useQuery<Quote[]>({
    queryKey: ['scheduledQuotes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id, client_name, vehicle, total_price, status, service_date, service_time, notes,
          user_id, client_id, vehicle_id, services_summary, client_document, client_phone, client_email,
          client_address, client_address_number, client_complement, client_city, client_state, client_zip_code,
          valid_until, created_at, commission_value, commission_type, payment_method_id, installments
        `)
        .eq('user_id', user.id)
        .not('service_date', 'is', null)
        .order('service_date', { ascending: true })
        .order('service_time', { ascending: true });
      if (error) throw error;
      return data as Quote[];
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
      queryClient.invalidateQueries({ queryKey: ['closedSales', user?.id] });
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

  const updateQuoteStatusMutation = useMutation({
    mutationFn: async ({ quoteId, newStatus, oldStatus }: { quoteId: string; newStatus: QuotePayload['status']; oldStatus: QuotePayload['status'] }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      const updateData: { status: QuotePayload['status']; is_sale?: boolean } = { status: newStatus };

      // Se o status anterior era 'closed' e o novo não é 'closed', remove da lista de vendas
      if (oldStatus === 'closed' && newStatus !== 'closed') {
        updateData.is_sale = false;
      } else if (newStatus === 'closed' && oldStatus !== 'closed') {
        // Se o novo status é 'closed' e o anterior não era, marca como venda
        updateData.is_sale = true;
      }
      
      const { error } = await supabase
        .from('quotes')
        .update(updateData)
        .eq('id', quoteId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledQuotes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['monthlyScheduledQuotes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['closedSales', user?.id] });
      toast({
        title: "Status atualizado!",
        description: `O status do agendamento foi atualizado para ${variables.newStatus}.`,
      });
      setShowStatusChangeWarning(false); // Fecha o aviso se estiver aberto
      setQuoteToChangeStatus(null);
      setNewStatusForWarning(null);
    },
    onError: (err) => {
      console.error("Erro ao atualizar status:", err);
      toast({
        title: "Erro ao atualizar status",
        description: err.message,
        variant: "destructive",
      });
      setShowStatusChangeWarning(false); // Fecha o aviso se estiver aberto
      setQuoteToChangeStatus(null);
      setNewStatusForWarning(null);
    },
  });

  // Helper function to convert fetched Quote to QuoteData for useQuoteActions
  const convertQuoteToQuoteData = (quote: Quote): QuoteData => {
    return {
      id: quote.id, // Passando o ID do orçamento
      quote_date: format(new Date(quote.created_at), 'yyyy-MM-dd'),
      client_name: quote.client_name,
      clientId: quote.client_id,
      vehicle: quote.vehicle,
      selectedVehicleId: quote.vehicle_id,
      selectedClient: quote.client_id ? {
        id: quote.client_id,
        name: quote.client_name,
        document_number: quote.client_document,
        phone_number: quote.client_phone,
        email: quote.client_email,
        address: quote.client_address,
        address_number: quote.client_address_number,
        complement: quote.client_complement,
        city: quote.client_city,
        state: quote.client_state,
        zip_code: quote.client_zip_code,
        user_id: quote.user_id,
        created_at: quote.created_at,
      } : undefined,
      clientDetails: {
        phoneNumber: quote.client_phone || undefined,
        address: quote.client_address || undefined,
        addressNumber: quote.client_address_number || undefined,
        complement: quote.client_complement || undefined,
      },
      serviceTime: quote.service_time || '',
      finalPrice: quote.total_price,
      selectedServices: quote.services_summary,
      observations: quote.notes || '',
      serviceDate: quote.service_date || '',
      isClientRequired: !!quote.client_id,
      calculatedCommission: quote.commission_value || 0,
      commissionType: quote.commission_type || 'amount',
      currentPaymentMethod: quote.payment_method_id ? { id: quote.payment_method_id, name: '', type: 'cash', rate: 0, user_id: '', created_at: quote.created_at } : undefined,
      selectedInstallments: quote.installments,
      profile: userProfile || undefined,
    };
  };

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

  const handleGeneratePdfForQuote = (quote: Quote) => {
    const quoteData = convertQuoteToQuoteData(quote);
    handleGenerateAndDownloadPDF(quoteData);
  };

  const handleSendWhatsAppForQuote = (quote: Quote) => {
    const quoteData = convertQuoteToQuoteData(quote);
    handleSendViaWhatsApp(quoteData);
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

  const handleStatusChange = (quoteId: string, newStatus: QuotePayload['status'], oldStatus: QuotePayload['status']) => {
    if (oldStatus === 'closed' && newStatus !== 'closed') {
      // Se o status anterior era 'closed' e o novo não é, mostra o aviso
      const quote = quotes?.find(q => q.id === quoteId);
      if (quote) {
        setQuoteToChangeStatus(quote);
        setNewStatusForWarning(newStatus);
        setShowStatusChangeWarning(true);
      }
    } else {
      // Caso contrário, executa a mutação diretamente
      updateQuoteStatusMutation.mutate({ quoteId, newStatus, oldStatus });
    }
  };

  // Função para confirmar a mudança de status após o aviso
  const confirmStatusChangeFromWarning = () => {
    if (quoteToChangeStatus && newStatusForWarning) {
      updateQuoteStatusMutation.mutate({ 
        quoteId: quoteToChangeStatus.id, 
        newStatus: newStatusForWarning, 
        oldStatus: quoteToChangeStatus.status 
      });
    }
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
                isMarkingNotRealized={false}
                isClosingSale={handleCloseSale.isPending}
                isUpdatingStatus={updateQuoteStatusMutation.isPending && quoteToChangeStatus?.id === quote.id}
                onCopyLink={handleCopyLink}
                onEditQuote={handleEditQuote}
                onOpenCloseSaleDialog={handleOpenCloseSaleDialog}
                onMarkAsNotRealized={() => handleStatusChange(quote.id, 'rejected', quote.status)}
                onOpenDetailsDrawer={handleOpenDetailsDrawer}
                onDeleteQuote={handleDeleteQuote}
                onStatusChange={handleStatusChange}
                onGeneratePdf={handleGeneratePdfForQuote}
                onSendWhatsApp={handleSendWhatsAppForQuote}
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
        paymentMethodDetails={paymentMethodDetails}
      />

      {/* AlertDialog para aviso de mudança de status de 'Concluído' */}
      <AlertDialog open={showStatusChangeWarning} onOpenChange={setShowStatusChangeWarning}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Atenção: Alteração de Status!</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a alterar o status do agendamento de "{quoteToChangeStatus?.client_name}" de "Concluído" para "{newStatusForWarning}".
              <br /><br />
              **Esta ação removerá esta venda da sua lista de "Gerenciar Vendas".**
              <br /><br />
              Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateQuoteStatusMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmStatusChangeFromWarning} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={updateQuoteStatusMutation.isPending}
            >
              {updateQuoteStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar e Remover Venda"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};