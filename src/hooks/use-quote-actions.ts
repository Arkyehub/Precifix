import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  QuoteData, 
  QuotePayload, 
  prepareQuotePayload, 
  createQuotePdfBlob 
} from '@/lib/quote-utils'; // Importando utilitários

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  document_number: string | null;
  phone_number: string | null;
  email: string | null;
  address: string | null;
  address_number: string | null;
  zip_code: string | null;
  avatar_url: string | null;
}

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

    if (checkError) throw checkError;

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

const uploadPdfToStorage = async (pdfBlob: Blob, fileName: string, userId: string, toast: any) => {
  const filePath = `${userId}/${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from('quotes')
    .upload(filePath, pdfBlob, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'application/pdf',
    });

  if (uploadError) {
    toast({
      title: "Erro ao fazer upload do PDF",
      description: uploadError.message,
      variant: "destructive",
    });
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from('quotes')
    .getPublicUrl(filePath);
  return publicUrlData.publicUrl;
};

// --- HOOK PRINCIPAL ---

export const useQuoteActions = (profile: Profile | undefined, isSale: boolean = false) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate(); 
  const [searchParams] = useSearchParams();

  const getBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return import.meta.env.VITE_PUBLIC_URL || window.location.origin;
    }
    return window.location.origin;
  };

  const saveQuoteMutation = useMutation({
    mutationFn: async (quoteData: QuotePayload) => {
      if (!user) throw new Error("Usuário não autenticado.");

      await checkDuplicity(quoteData, user);

      // Se for uma venda (is_sale: true), gera o sale_number sequencial
      let saleNumber = quoteData.is_sale ? (await supabase.rpc('get_next_sale_number')).data : null;

      const { data, error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          ...quoteData,
          sale_number: saleNumber, // Usar o número sequencial gerado
        })
        .select()
        .single();
      if (error) throw error;
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
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotesCalendar', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['quotesCount', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduledQuotes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['monthlyScheduledQuotes', user?.id] });
      
      if (data.is_sale) {
        queryClient.invalidateQueries({ queryKey: ['closedSales', user?.id] });
        navigate('/agenda/daily?date=' + data.service_date);
      } else {
        navigate('/agenda');
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

  const handleCloseSale = useMutation({
    mutationFn: async ({ quoteId, paymentMethodId, installments }: { quoteId: string; paymentMethodId: string; installments: number | null }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      // 1. Gerar sale_number sequencial (se ainda não tiver)
      const { data: existingQuote } = await supabase
        .from('quotes')
        .select('sale_number')
        .eq('id', quoteId)
        .single();
      
      let saleNumber = existingQuote?.sale_number;
      if (!saleNumber) {
        const { data: newSaleNumber, error: saleNumberError } = await supabase.rpc('get_next_sale_number');
        if (saleNumberError) throw saleNumberError;
        saleNumber = newSaleNumber;
      }

      // 2. Atualizar o orçamento para status 'closed', is_sale: true, e adicionar dados de pagamento
      const { data, error } = await supabase
        .from('quotes')
        .update({
          status: 'closed', // Status 'Atendida'
          is_sale: true,
          sale_number: saleNumber,
          payment_method_id: paymentMethodId,
          installments: installments,
        })
        .eq('id', quoteId)
        .eq('user_id', user.id)
        .select('service_date')
        .single();
      
      if (error) throw error;
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

  const saveQuoteAndGetId = async (quoteData: QuoteData) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const payload = prepareQuotePayload(quoteData, 'pending', false);
    return await saveQuoteMutation.mutateAsync(payload);
  };

  const handleSaveSale = async (quoteData: QuoteData) => {
    if (!user) throw new Error("Usuário não autenticado.");
    // Ao salvar uma venda rápida, o status inicial é 'closed' (Atendida)
    const payload = prepareQuotePayload(quoteData, 'closed', true); 
    return await saveQuoteMutation.mutateAsync(payload);
  };

  const handleUpdateQuote = async (quoteId: string, quoteData: QuoteData) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const payload = prepareQuotePayload(quoteData, 'pending', false); 
    try {
      await updateQuoteMutation.mutateAsync({ quoteId, quoteData: payload });
    } catch (error: any) {
      console.error("Erro ao atualizar orçamento:", error);
    }
  };

  const handleGenerateAndDownloadPDF = async (quoteData: QuoteData) => {
    if (!user) {
      toast({ title: "Erro de autenticação", description: "Por favor, faça login novamente.", variant: "destructive" });
      return;
    }
    try {
      const pdfBlob = await createQuotePdfBlob(quoteData);
      
      let savedQuoteId: string;
      let savedQuoteNumber: string;
      const quoteIdFromParams = searchParams.get('quoteId');

      if (quoteIdFromParams) {
        const payload = prepareQuotePayload(quoteData, 'pending', false);
        const updatedQuote = await updateQuoteMutation.mutateAsync({ quoteId: quoteIdFromParams, quoteData: payload });
        savedQuoteId = updatedQuote.id;
        savedQuoteNumber = updatedQuote.id.substring(0, 8);
      } else {
        const savedQuote = await saveQuoteAndGetId(quoteData);
        savedQuoteId = savedQuote.id;
        savedQuoteNumber = savedQuote.id.substring(0, 8);
      }

      const fileName = `orcamento_${savedQuoteNumber}_${quoteData.client_name.replace(/\s+/g, '_')}_${quoteData.quote_date}.pdf`;
      const publicUrl = await uploadPdfToStorage(pdfBlob, `${savedQuoteId}/${fileName}`, user.id, toast);

      await supabase
        .from('quotes')
        .update({ pdf_url: publicUrl })
        .eq('id', savedQuoteId);

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "PDF gerado e salvo!",
        description: "O orçamento foi baixado para seu dispositivo e salvo no sistema.",
      });
    } catch (error: any) {
      // Erro já tratado nas mutações/uploadPdfToStorage
    }
  };

  const handleSendViaWhatsApp = async (quoteData: QuoteData) => {
    if (!user) {
      toast({ title: "Erro de autenticação", description: "Por favor, faça login novamente.", variant: "destructive" });
      return;
    }
    if (!quoteData.clientDetails.phoneNumber?.trim()) {
      toast({
        title: "Número de telefone ausente",
        description: "Por favor, insira o telefone do cliente para enviar via WhatsApp.",
        variant: "destructive",
      });
      return;
    }

    try {
      let savedQuoteId: string;
      const quoteIdFromParams = searchParams.get('quoteId');

      if (quoteIdFromParams) {
        const payload = prepareQuotePayload(quoteData, 'pending', false);
        const updatedQuote = await updateQuoteMutation.mutateAsync({ quoteId: quoteIdFromParams, quoteData: payload });
        savedQuoteId = updatedQuote.id;
      } else {
        const savedQuote = await saveQuoteAndGetId(quoteData);
        savedQuoteId = savedQuote.id;
      }

      const baseUrl = getBaseUrl();
      const quoteViewLink = `${baseUrl}/quote/view/${savedQuoteId}`;
      const companyName = profile?.company_name || 'Precifix';
      const whatsappMessage = encodeURIComponent(
        `Olá! 😄\nAqui está o seu orçamento personalizado para os cuidados do seu veículo 🚗✨\n\n${quoteViewLink}\n\nSe quiser fazer algum ajuste ou agendar o serviço, é só me chamar aqui no WhatsApp!\n\n${companyName}`
      );
      const whatsappLink = `https://wa.me/55${quoteData.clientDetails.phoneNumber.replace(/\D/g, '')}?text=${whatsappMessage}`;
      window.open(whatsappLink, '_blank');
      toast({
        title: "Link de Orçamento enviado via WhatsApp!",
        description: "O link de visualização foi enviado para o cliente.",
      });
    } catch (error: any) {
      console.error("Erro ao enviar via WhatsApp:", error);
      toast({
        title: "Erro ao enviar via WhatsApp",
        description: error.message || "Não foi possível enviar o orçamento via WhatsApp.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateLink = async (quoteData: QuoteData) => {
    if (!user) {
      toast({ title: "Erro de autenticação", description: "Por favor, faça login novamente.", variant: "destructive" });
      return null;
    }
    try {
      let savedQuoteId: string;
      const quoteIdFromParams = searchParams.get('quoteId');

      if (quoteIdFromParams) {
        const payload = prepareQuotePayload(quoteData, 'pending', false);
        const updatedQuote = await updateQuoteMutation.mutateAsync({ quoteId: quoteIdFromParams, quoteData: payload });
        savedQuoteId = updatedQuote.id;
      } else {
        const savedQuote = await saveQuoteAndGetId(quoteData);
        savedQuoteId = savedQuote.id;
      }

      const baseUrl = getBaseUrl();
      const quoteViewLink = `${baseUrl}/quote/view/${savedQuoteId}`;
      await navigator.clipboard.writeText(quoteViewLink);
      window.open(quoteViewLink, '_blank');
      toast({
        title: "Link gerado e copiado!",
        description: "O link de visualização foi copiado para a área de transferência e aberto em uma nova aba.",
      });
      return quoteViewLink;
    } catch (error: any) {
      console.error("Erro ao gerar link:", error);
      toast({
        title: "Erro ao gerar link",
        description: error.message || "Não foi possível gerar o link de visualização.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleGenerateLocalLink = async (quoteData: QuoteData) => {
    if (!user) {
      toast({ title: "Erro de autenticação", description: "Por favor, faça login novamente.", variant: "destructive" });
      return null;
    }
    try {
      let savedQuoteId: string;
      const quoteIdFromParams = searchParams.get('quoteId');

      if (quoteIdFromParams) {
        const payload = prepareQuotePayload(quoteData, 'pending', false);
        const updatedQuote = await updateQuoteMutation.mutateAsync({ quoteId: quoteIdFromParams, quoteData: payload });
        savedQuoteId = updatedQuote.id;
      } else {
        const savedQuote = await saveQuoteAndGetId(quoteData);
        savedQuoteId = savedQuote.id;
      }

      const baseUrl = window.location.origin;
      const quoteViewLink = `${baseUrl}/quote/view/${savedQuoteId}`;
      await navigator.clipboard.writeText(quoteViewLink);
      window.open(quoteViewLink, '_blank');
      toast({
        title: "Link de Teste gerado e copiado!",
        description: "O link de visualização (Localhost) foi copiado e aberto em uma nova aba.",
      });
      return quoteViewLink;
    } catch (error: any) {
      console.error("Erro ao gerar link de teste:", error);
      toast({
        title: "Erro ao gerar link de teste",
        description: error.message || "Não foi possível gerar o link de visualização de teste.",
        variant: "destructive",
      });
      return null;
    }
  };

  const isGeneratingOrSaving = saveQuoteMutation.isPending || updateQuoteMutation.isPending;
  const isSendingWhatsApp = saveQuoteMutation.isPending || updateQuoteMutation.isPending;

  return {
    handleGenerateAndDownloadPDF,
    handleSendViaWhatsApp,
    handleGenerateLink,
    handleGenerateLocalLink,
    handleUpdateQuote,
    handleSaveSale,
    handleCloseSale,
    isGeneratingOrSaving,
    isSendingWhatsApp,
  };
};