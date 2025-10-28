import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { QuotedService } from "@/components/QuoteServiceFormDialog";
import { PaymentMethod } from "@/components/PaymentMethodFormDialog";
import { formatPhoneNumber } from '@/lib/utils';
import { addDays } from 'date-fns'; // Adicionar importação
import { Client } from '@/types/clients'; // Adicionado importação do tipo Client

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  document_number: string | null;
  address: string | null;
  address_number: string | null;
  zip_code: string | null;
  phone_number: string | null;
  avatar_url: string | null;
}

interface QuoteData {
  client_name: string;
  vehicle: string;
  quote_date: string;
  selectedServices: QuotedService[];
  finalPrice: number;
  calculatedDiscount: number;
  currentPaymentMethod: PaymentMethod | undefined;
  selectedInstallments: number | null;
  observations: string;
  profile: Profile | undefined;
  clientDetails: { phoneNumber: string | null; address: string | null };
  clientId?: string;
  selectedVehicleId?: string; // Adicionado
  selectedClient: Client | undefined; // Adicionado para resolver erros TS
}

// Função auxiliar para obter a URL da imagem como Data URL (base64)
const getImageDataUrl = async (url: string | null): Promise<string | null> => {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Erro ao buscar ou converter imagem para Data URL:", error);
    return null;
  }
};

// Função para gerar o PDF como um Blob
const createQuotePdfBlob = async ({
  client_name,
  vehicle,
  quote_date,
  selectedServices,
  finalPrice,
  calculatedDiscount,
  currentPaymentMethod,
  selectedInstallments,
  observations,
  profile,
  clientDetails,
}: QuoteData): Promise<Blob> => {
  const doc = new jsPDF();
  let yPosition = 20;

  // Cabeçalho
  doc.setFillColor(255, 204, 0); // Amarelo dourado
  doc.rect(0, 0, 210, 40, 'F');
  
  // Imagem de perfil do usuário (avatar)
  const avatarDataUrl = await getImageDataUrl(profile?.avatar_url);
  if (avatarDataUrl) {
    const imgWidth = 25;
    const imgHeight = 25;
    const x = 210 - 15 - imgWidth; // 15mm da direita
    doc.addImage(avatarDataUrl, 'JPEG', x, 10, imgWidth, imgHeight);
  }
  
  doc.setTextColor(0, 0, 0); // Definir cor do texto para preto
  doc.setFontSize(24);
  doc.text("ORÇAMENTO", 15, 25);
  
  doc.setFontSize(10);
  const [yearStr, monthStr, dayStr] = quote_date.split('-');
  const displayDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr));
  doc.text(`Data: ${displayDate.toLocaleDateString('pt-BR')}`, 15, 35);

  // Nome da Empresa
  if (profile?.company_name) {
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(profile.company_name, 15, 15);
  }

  yPosition = 55;
  doc.setTextColor(0, 0, 0);

  // Dados do Cliente
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text("Dados do Cliente", 15, yPosition);
  yPosition += 8;

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text(`Cliente: ${client_name}`, 15, yPosition);
  yPosition += 6;
  doc.text(`Veículo: ${vehicle}`, 15, yPosition);
  yPosition += 6;

  if (clientDetails.phoneNumber) {
    doc.text(`Telefone: ${formatPhoneNumber(clientDetails.phoneNumber)}`, 15, yPosition);
    yPosition += 6;
  }

  if (clientDetails.address) {
    doc.text(`Endereço: ${clientDetails.address}`, 15, yPosition);
    yPosition += 6;
  }

  yPosition += 6;

  // Serviços Selecionados
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text("Serviços Contratados", 15, yPosition);
  yPosition += 8;

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  
  // Cabeçalho da tabela
  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPosition - 5, 180, 8, 'F');
  doc.text("Serviço", 20, yPosition);
  doc.text("Tempo", 120, yPosition);
  doc.text("Valor", 160, yPosition);
  yPosition += 10;

  const servicesSummaryForPdf = selectedServices.map(service => ({
    name: service.name,
    price: service.quote_price ?? service.price,
    execution_time_minutes: service.quote_execution_time_minutes ?? service.execution_time_minutes,
  }));

  servicesSummaryForPdf.forEach((service, index) => {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.text(service.name, 20, yPosition);
    doc.text(`${service.execution_time_minutes} min`, 120, yPosition);
    doc.text(`R$ ${service.price.toFixed(2)}`, 160, yPosition);
    
    if (index < servicesSummaryForPdf.length - 1) {
      doc.setDrawColor(220, 220, 220);
      doc.line(15, yPosition + 5, 195, yPosition + 5);
      yPosition += 12;
    } else {
      yPosition += 7;
    }
  });

  yPosition += 8;

  // Seção de Desconto
  if (calculatedDiscount > 0) {
    if (yPosition > 270) { doc.addPage(); yPosition = 20; }
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("Desconto Aplicado:", 15, yPosition);
    doc.setFont(undefined, 'normal');
    doc.text(`- R$ ${calculatedDiscount.toFixed(2)}`, 160, yPosition, { align: 'right' });
    yPosition += 10;
  }

  // Seção de Forma de Pagamento
  if (currentPaymentMethod) {
    if (yPosition > 270) { doc.addPage(); yPosition = 20; }
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("Forma de Pagamento:", 15, yPosition);
    doc.setFont(undefined, 'normal');
    let paymentMethodText = currentPaymentMethod.name;

    if (currentPaymentMethod.type === 'credit_card' && selectedInstallments) {
      const installmentDetails = currentPaymentMethod.installments?.find(inst => inst.installments === selectedInstallments);
      if (installmentDetails) {
        paymentMethodText = `Cartão de Crédito em até ${selectedInstallments}x `;
        if (installmentDetails.rate === 0) {
          paymentMethodText += "(sem juros)";
        }
      }
    }
    doc.text(paymentMethodText, 160, yPosition, { align: 'right' });
    yPosition += 10;
  }

  // Total
  doc.setFillColor(255, 204, 0);
  doc.rect(15, yPosition - 5, 180, 12, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`VALOR TOTAL: R$ ${finalPrice.toFixed(2)}`, 20, yPosition + 3);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  yPosition += 20;

  // Observações
  if (observations) {
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("Observações:", 15, yPosition);
    yPosition += 7;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const splitObs = doc.splitTextToSize(observations, 180);
    doc.text(splitObs, 15, yPosition);
    yPosition += splitObs.length * 5 + 10;
  }

  // Rodapé
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const footerY = 280;
  doc.text("Agradecemos pela preferência! Qualquer dúvida, estamos à disposição.", 105, footerY, { align: 'center' });

  return doc.output('blob');
};

export const useQuoteActions = (profile: Profile | undefined) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Determina o domínio base para links públicos
  const getBaseUrl = () => {
    // Em ambientes de desenvolvimento (localhost), use a variável de ambiente VITE_PUBLIC_URL
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return import.meta.env.VITE_PUBLIC_URL || window.location.origin;
    }
    // Em produção, use o domínio atual
    return window.location.origin;
  };

  const getServicesSummaryForDb = (selectedServices: QuotedService[]) => selectedServices.map(service => ({
    name: service.name,
    price: service.quote_price ?? service.price,
    execution_time_minutes: service.quote_execution_time_minutes ?? service.execution_time_minutes,
  }));

  const saveQuoteMutation = useMutation({
    mutationFn: async (quoteData: {
      client_name: string;
      vehicle: string;
      total_price: number;
      quote_date: string;
      services_summary: any[];
      pdf_url?: string;
      client_id?: string;
      vehicle_id?: string;
      status?: 'pending' | 'confirmed' | 'rejected';
      client_document?: string; // Adicionado
      client_phone?: string; // Adicionado
      client_email?: string; // Adicionado
      client_address?: string; // Adicionado
      client_city?: string; // Adicionado
      client_state?: string; // Adicionado
      client_zip_code?: string; // Adicionado
      notes?: string; // Adicionado
      valid_until: string; // Adicionado
    }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      const { data, error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          client_name: quoteData.client_name,
          vehicle: quoteData.vehicle,
          total_price: quoteData.total_price,
          quote_date: quoteData.quote_date,
          services_summary: quoteData.services_summary,
          pdf_url: quoteData.pdf_url,
          client_id: quoteData.client_id,
          vehicle_id: quoteData.vehicle_id,
          status: quoteData.status || 'pending',
          client_document: quoteData.client_document,
          client_phone: quoteData.client_phone,
          client_email: quoteData.client_email,
          client_address: quoteData.client_address,
          client_city: quoteData.client_city,
          client_state: quoteData.client_state,
          client_zip_code: quoteData.client_zip_code,
          notes: quoteData.notes,
          valid_until: quoteData.valid_until,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotesCalendar', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['quotesCount', user?.id] });
    },
    onError: (err) => {
      toast({
        title: "Erro ao salvar orçamento",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const uploadPdfMutation = useMutation({
    mutationFn: async ({ pdfBlob, fileName }: { pdfBlob: Blob; fileName: string }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      const filePath = `${user.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('quotes')
        .upload(filePath, pdfBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'application/pdf',
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('quotes')
        .getPublicUrl(filePath);
      return publicUrlData.publicUrl;
    },
    onError: (err) => {
      toast({
        title: "Erro ao fazer upload do PDF",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const saveQuoteAndGetId = async (quoteData: QuoteData) => {
    // Calcular valid_until (7 dias após a data do orçamento)
    const quoteDateObj = new Date(quoteData.quote_date);
    const validUntilDate = addDays(quoteDateObj, 7);
    const validUntilString = validUntilDate.toISOString().split('T')[0];

    return await saveQuoteMutation.mutateAsync({
      client_name: quoteData.client_name,
      vehicle: quoteData.vehicle,
      total_price: quoteData.finalPrice,
      quote_date: quoteData.quote_date,
      services_summary: getServicesSummaryForDb(quoteData.selectedServices),
      client_id: quoteData.clientId,
      vehicle_id: quoteData.selectedVehicleId,
      status: 'pending',
      client_document: quoteData.selectedClient?.document_number,
      client_phone: quoteData.selectedClient?.phone_number,
      client_email: quoteData.selectedClient?.email,
      client_address: quoteData.selectedClient?.address,
      client_city: quoteData.selectedClient?.city,
      client_state: quoteData.selectedClient?.state,
      client_zip_code: quoteData.selectedClient?.zip_code,
      notes: quoteData.observations,
      valid_until: validUntilString,
    });
  };

  const handleGenerateAndDownloadPDF = async (quoteData: QuoteData) => {
    try {
      const pdfBlob = await createQuotePdfBlob(quoteData);

      const fileName = `orcamento_${quoteData.client_name.replace(/\s+/g, '_')}_${quoteData.quote_date}.pdf`;
      
      // Salvar orçamento no banco de dados (sem URL do PDF por enquanto)
      await saveQuoteAndGetId(quoteData);

      // Download do PDF
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
      console.error("Erro ao gerar ou salvar PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: error.message || "Não foi possível gerar o PDF do orçamento.",
        variant: "destructive",
      });
    }
  };

  const handleSendViaWhatsApp = async (quoteData: QuoteData) => {
    if (!quoteData.clientDetails.phoneNumber?.trim()) {
      toast({
        title: "Número de telefone ausente",
        description: "Por favor, insira o telefone do cliente para enviar via WhatsApp.",
        variant: "destructive",
      });
      return;
    }

    try {
      // 1. Salvar o orçamento no banco de dados para obter o ID
      const savedQuote = await saveQuoteAndGetId(quoteData);

      // 2. Gerar o link de visualização usando o domínio base correto
      const baseUrl = getBaseUrl();
      const quoteViewLink = `${baseUrl}/quote/view/${savedQuote.id}`;

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
    try {
      // 1. Salvar o orçamento no banco de dados para obter o ID
      const savedQuote = await saveQuoteAndGetId(quoteData);

      // 2. Gerar o link de visualização usando o domínio base correto
      const baseUrl = getBaseUrl();
      const quoteViewLink = `${baseUrl}/quote/view/${savedQuote.id}`;

      // 3. Copiar para a área de transferência
      await navigator.clipboard.writeText(quoteViewLink);

      // 4. Abrir em nova aba
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

  const isGeneratingOrSaving = saveQuoteMutation.isPending;
  const isSendingWhatsApp = saveQuoteMutation.isPending;

  return {
    handleGenerateAndDownloadPDF,
    handleSendViaWhatsApp,
    handleGenerateLink, // Exportar a nova função
    isGeneratingOrSaving,
    isSendingWhatsApp,
  };
};