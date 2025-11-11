import { useQueryClient } from "@tanstack/react-query";
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
import { useQuoteMutations } from './use-quote-mutations'; // NOVO IMPORT

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
    throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from('quotes')
    .getPublicUrl(filePath);
  return publicUrlData.publicUrl;
};

// --- HOOK PRINCIPAL ---

export const useQuoteActions = (profile: Profile | undefined, isSale: boolean = false) => {
  const { user } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate(); 
  const [searchParams] = useSearchParams();

  const { 
    saveQuoteMutation, 
    updateQuoteMutation, 
    handleCloseSaleMutation,
    isSavingQuote,
    isUpdatingQuote,
    isClosingSale: isClosingSaleMutation, // Renomeado para evitar conflito
  } = useQuoteMutations();

  const getBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return import.meta.env.VITE_PUBLIC_URL || window.location.origin;
    }
    return window.location.origin;
  };

  // Helper para salvar um novo orçamento e retornar o payload completo
  const saveNewQuoteAndGetPayload = async (quoteData: QuoteData): Promise<QuotePayload & { id: string }> => {
    if (!user) throw new Error("Usuário não autenticado.");
    const payload = prepareQuotePayload(quoteData, 'pending', false);
    const savedQuote = await saveQuoteMutation.mutateAsync(payload);
    return savedQuote as QuotePayload & { id: string };
  };

  const handleSaveQuote = async (quoteData: QuoteData) => {
    if (!user) throw new Error("Usuário não autenticado.");
    const payload = prepareQuotePayload(quoteData, 'pending', false);
    return await saveQuoteMutation.mutateAsync(payload);
  };

  const handleSaveSale = async (quoteData: QuoteData) => {
    if (!user) throw new Error("Usuário não autenticado.");
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
      throw error;
    }
  };

  const handleGenerateAndDownloadPDF = async (quoteData: QuoteData) => {
    if (!user) {
      toast({ title: "Erro de autenticação", description: "Por favor, faça login novamente.", variant: "destructive" });
      return;
    }
    try {
      let currentQuoteId: string;
      let currentQuoteNumber: string;
      let finalQuotePayload: QuotePayload;

      if (quoteData.id) {
        currentQuoteId = quoteData.id;
        currentQuoteNumber = quoteData.id.substring(0, 8);
        finalQuotePayload = prepareQuotePayload(quoteData, 'pending', false); // Re-prepare payload for PDF content
      } else {
        const savedQuote = await saveNewQuoteAndGetPayload(quoteData);
        currentQuoteId = savedQuote.id;
        currentQuoteNumber = savedQuote.id.substring(0, 8);
        finalQuotePayload = savedQuote;
      }

      const pdfBlob = await createQuotePdfBlob({ ...quoteData, id: currentQuoteId }); // Pass ID to PDF generation

      const sanitizedClientName = finalQuotePayload.client_name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_.-]/g, "_")
        .replace(/__+/g, "_");

      const fileName = `orcamento_${currentQuoteNumber}_${sanitizedClientName}_${finalQuotePayload.quote_date}.pdf`;
      const publicUrl = await uploadPdfToStorage(pdfBlob, `${currentQuoteId}/${fileName}`, user.id, toast);

      await supabase
        .from('quotes')
        .update({ pdf_url: publicUrl })
        .eq('id', currentQuoteId);

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
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: error.message || "Não foi possível gerar o PDF do orçamento.",
        variant: "destructive",
      });
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
      let currentQuoteId: string;

      if (quoteData.id) {
        currentQuoteId = quoteData.id;
      } else {
        const savedQuote = await saveNewQuoteAndGetPayload(quoteData);
        currentQuoteId = savedQuote.id;
      }

      const baseUrl = getBaseUrl();
      const quoteViewLink = `${baseUrl}/quote/view/${currentQuoteId}`;
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
      } else if (quoteData.id) {
        savedQuoteId = quoteData.id;
      } else {
        const savedQuote = await saveNewQuoteAndGetPayload(quoteData);
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
      } else if (quoteData.id) {
        savedQuoteId = quoteData.id;
      } else {
        const savedQuote = await saveNewQuoteAndGetPayload(quoteData);
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

  const isGeneratingOrSaving = isSavingQuote || isUpdatingQuote;
  const isSendingWhatsApp = isSavingQuote || isUpdatingQuote; // Mantido para consistência, mas pode ser ajustado se houver um estado de envio específico

  return {
    handleGenerateAndDownloadPDF,
    handleSendViaWhatsApp,
    handleGenerateLink,
    handleGenerateLocalLink,
    handleUpdateQuote,
    handleSaveQuote,
    handleSaveSale,
    handleCloseSale: handleCloseSaleMutation, // Retorna a mutação diretamente
    isGeneratingOrSaving,
    isSendingWhatsApp,
    isClosingSale: isClosingSaleMutation, // Expondo o estado de carregamento da mutação de fechar venda
  };
};