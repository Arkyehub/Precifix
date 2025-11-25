import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from 'react-router-dom';
import { QuotePayload } from '@/lib/quote-utils';

// --- UTILS DE BANCO DE DADOS ---

const checkDuplicity = async (payload: QuotePayload, user: any, excludeId?: string) => {
  if (!user) throw new Error("Usuário não autenticado.");
  
  if (payload.client_id && payload.service_date) {
    let query = supabase
      .from('quotes')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('client_id', payload.client_id)
      .eq('service_date', payload.service_date);

    if (payload.service_time) {
      query = query.eq('service_time', payload.service_time);
    } else {
      query = query.is('service_time', null);
    }

    if (excludeId) {
      query = query.not('id', 'eq', excludeId);
    }

    const { data: existingQuotes, error: checkError } = await query;

    if (checkError) {
      throw new Error(`Erro ao verificar duplicidade: ${checkError.message}`);
    }

    if (existingQuotes && existingQuotes.length > 0) {
      const existingStatus = existingQuotes[0].status;
      let statusText = existingStatus === 'accepted' ? 'aprovado' : existingStatus === 'rejected' ? 'rejeitado' : 'pendente';
      const timeText = payload.service_time ? ` às ${payload.service_time}` : '';
      
      throw new Error(
        `Já existe um orçamento ${statusText} para este cliente na data ${payload.service_date.split('-').reverse().join('/')}${timeText}.`
      );
    }
  }
};

// --- HOOK PRINCIPAL ---

export const useQuoteMutations = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const saveQuoteMutation = useMutation({
    mutationFn: async (quoteData: QuotePayload) => {
      if (!user) throw new Error("Usuário não autenticado.");

      await checkDuplicity(quoteData, user);

      let saleNumber = null;
      if (quoteData.is_sale) {
        const { data: newSaleNumber, error: saleNumberError } = await supabase.rpc('get_next_user_sale_number', {
          p_user_id: user.id
        });
        
        if (saleNumberError) {
          throw new Error(`Erro ao gerar número de venda: ${saleNumberError.message}`);
        }
        saleNumber = newSaleNumber;
      }

      const { data, error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          ...quoteData,
          sale_number: saleNumber,
        })
        .select()
        .single();
      if (error) {
        throw new Error(`Erro ao salvar orçamento/venda: ${error.message}`);
      }
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotesCalendar', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['quotesCount', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledQuotes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['monthlyScheduledQuotes', user?.id] });
      
      if (variables.is_sale) {
        queryClient.invalidateQueries({ queryKey: ['closedSales', user?.id] });
        toast({
          title: "Venda registrada!",
          description: `Venda ${data.sale_number} registrada com sucesso.`,
        });
        navigate('/sales');
      } else {
        navigate(`/agenda/daily?date=${data.service_date}`);
        toast({
          title: "Orçamento salvo!",
          description: `Orçamento #${data.id.substring(0, 8)} foi salvo com sucesso.`,
        });
      }
    },
    onError: (err) => {
      toast({
        title: "Erro ao salvar orçamento/venda",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const updateQuoteMutation = useMutation({
    mutationFn: async ({ quoteId, quoteData }: { quoteId: string; quoteData: QuotePayload }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      await checkDuplicity(quoteData, user, quoteId);

      const { data, error } = await supabase
        .from('quotes')
        .update(quoteData)
        .eq('id', quoteId)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) {
        throw new Error(`Erro ao atualizar orçamento: ${error.message}`);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotesCalendar', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['quotesCount', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledQuotes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['monthlyScheduledQuotes', user?.id] });
      
      if (data.is_sale) {
        queryClient.invalidateQueries({ queryKey: ['closedSales', user?.id] });
        navigate('/sales');
      } else {
        navigate(`/agenda/daily?date=${data.service_date}`);
      }
      
      toast({
        title: "Orçamento atualizado!",
        description: `Orçamento #${data.id.substring(0, 8)} foi salvo com sucesso.`,
      });
    },
    onError: (err) => {
      toast({
        title: "Erro ao atualizar orçamento",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleCloseSaleMutation = useMutation({
    mutationFn: async ({ quoteId, paymentMethodId, installments }: { quoteId: string; paymentMethodId: string; installments: number | null }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      const { data: existingQuote } = await supabase
        .from('quotes')
        .select('sale_number')
        .eq('id', quoteId)
        .single();
      
      let saleNumber = existingQuote?.sale_number;
      if (!saleNumber) {
        const { data: newSaleNumber, error: saleNumberError } = await supabase.rpc('get_next_user_sale_number', {
          p_user_id: user.id
        });
        
        if (saleNumberError) {
          throw new Error(`Erro ao gerar número de venda: ${saleNumberError.message}`);
        }
        saleNumber = newSaleNumber;
        if (!saleNumber) throw new Error("Não foi possível gerar um número de venda.");
      }

      const { data, error } = await supabase
        .from('quotes')
        .update({
          status: 'closed',
          is_sale: true,
          sale_number: saleNumber,
          payment_method_id: paymentMethodId,
          installments: installments,
        })
        .eq('id', quoteId)
        .eq('user_id', user.id)
        .select('service_date')
        .single();
      
      if (error) {
        throw new Error(`Erro ao finalizar venda: ${error.message}`);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledQuotes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['closedSales', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['monthlyScheduledQuotes', user?.id] });
      
      if (data.service_date) {
        navigate(`/agenda/daily?date=${data.service_date}`);
      }
    },
    onError: (err) => {
      toast({
        title: "Erro ao finalizar venda",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return {
    saveQuoteMutation,
    updateQuoteMutation,
    handleCloseSaleMutation,
    isSavingQuote: saveQuoteMutation.isPending,
    isUpdatingQuote: updateQuoteMutation.isPending,
    isClosingSale: handleCloseSaleMutation.isPending,
  };
};