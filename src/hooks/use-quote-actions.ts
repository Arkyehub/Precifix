import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { QuotedService } from "@/components/QuoteServiceFormDialog";
import { PaymentMethod } from "@/components/PaymentMethodFormDialog";
import { formatPhoneNumber } from '@/lib/utils';
import { addDays } from 'date-fns';
import { Client } from '@/types/clients';
import { useNavigate, useSearchParams } from 'react-router-dom'; // Importar useNavigate e useSearchParams

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
  selectedVehicleId?: string;
  selectedClient: Client | undefined;
  // Novos campos de agendamento
  serviceDate: string;
  serviceTime: string;
  isClientRequired: boolean; // Adicionado para verificar se o cliente é obrigatório
}

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
  serviceDate,
  serviceTime,
}: QuoteData): Promise<Blob> => {
  const doc = new jsPDF();
  let yPosition = 20;

  doc.setFillColor(255, 204, 0);
  doc.rect(0, 0, 210, 40, 'F');
  
  const avatarDataUrl = await getImageDataUrl(profile?.avatar_url);
  if (avatarDataUrl) {
    const imgWidth = 25;
    const imgHeight = 25;
    const x = 210 - 15 - imgWidth;
    doc.addImage(avatarDataUrl, 'JPEG', x, 10, imgWidth, imgHeight);
  }
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(24);
  doc.text("ORÇAMENTO", 15, 25);
  
  doc.setFontSize(10);
  const [yearStr, monthStr, dayStr] = quote_date.split('-');
  // CORREÇÃO: Criar data localmente
  const displayDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr));
  doc.text(`Data: ${displayDate.toLocaleDateString('pt-BR')}`, 15, 35);

  if (profile?.company_name) {
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(profile.company_name, 15, 15);
  }

  yPosition = 55;
  doc.setTextColor(0, 0, 0);

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

  // Nova seção de Agendamento no PDF
  if (serviceDate) {
    yPosition += 6;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("Agendamento do Serviço", 15, yPosition);
    yPosition += 8;
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    const [sYear, sMonth, sDay] = serviceDate.split('-');
    // CORREÇÃO: Criar data localmente
    const displayServiceDate = new Date(parseInt(sYear), parseInt(sMonth) - 1, parseInt(sDay));
    doc.text(`Data: ${displayServiceDate.toLocaleDateString('pt-BR')}`, 15, yPosition);
    if (serviceTime) {
      doc.text(`Hora: ${serviceTime}`, 60, yPosition);
    } else {
      doc.text(`Hora: A combinar`, 60, yPosition);
    }
    yPosition += 6;
  }

  yPosition += 6;

  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text("Serviços Contratados", 15, yPosition);
  yPosition += 8;

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  
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

  if (calculatedDiscount > 0) {
    if (yPosition > 270) { doc.addPage(); yPosition = 20; }
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("Desconto Aplicado:", 15, yPosition);
    doc.setFont(undefined, 'normal');
    doc.text(`- R$ ${calculatedDiscount.toFixed(2)}`, 160, yPosition, { align: 'right' });
    yPosition += 10;
  }

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

  doc.setFillColor(255, 204, 0);
  doc.rect(15, yPosition - 5, 180, 12, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`VALOR TOTAL: R$ ${finalPrice.toFixed(2)}`, 20, yPosition + 3);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  yPosition += 20;

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

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const footerY = 280;
  doc.text("Agradecemos pela preferência! Qualquer dúvida, estamos à disposição.", 105, footerY, { align: 'center' });

  return doc.output('blob');
};

export const useQuoteActions = (profile: Profile | undefined, isSale: boolean = false) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate(); 
  const [searchParams] = useSearchParams(); // Inicializar useSearchParams

  const getBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return import.meta.env.VITE_PUBLIC_URL || window.location.origin;
    }
    return window.location.origin;
  };

  const getServicesSummaryForDb = (selectedServices: QuotedService[]) => selectedServices.map(service => ({
    name: service.name,
    price: service.quote_price ?? service.price,
    execution_time_minutes: service.quote_execution_time_minutes ?? service.execution_time_minutes,
    // Adicionar ID do serviço para rastreamento
    id: service.id, 
  }));

  interface QuotePayload {
    client_name: string;
    vehicle: string;
    total_price: number;
    quote_date: string;
    services_summary: any[];
    pdf_url?: string;
    client_id?: string;
    vehicle_id?: string;
    status?: 'pending' | 'accepted' | 'rejected' | 'closed'; // Adicionado 'closed'
    client_document?: string;
    client_phone?: string;
    client_email?: string;
    client_address?: string;
    client_city?: string;
    client_state?: string;
    client_zip_code?: string;
    notes?: string;
    valid_until: string;
    service_date: string;
    service_time: string;
    is_sale: boolean; // Novo campo
    sale_number?: string; // Novo campo
    // Novos campos para registrar a forma de pagamento da venda
    payment_method_id?: string;
    installments?: number;
  }

  // Função de verificação de duplicidade (reutilizada)
  const checkDuplicity = async (payload: QuotePayload, excludeId?: string) => {
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

  const prepareQuotePayload = (quoteData: QuoteData, status: 'pending' | 'accepted' | 'rejected' | 'closed' = 'pending', isSale: boolean = false): QuotePayload => {
    const quoteDateObj = new Date(quoteData.quote_date);
    const validUntilDate = addDays(quoteDateObj, 7);
    const validUntilString = validUntilDate.toISOString().split('T')[0];

    // Lógica para Consumidor Final
    let finalClientName = quoteData.client_name;
    let finalClientId = quoteData.clientId;
    let finalVehicle = quoteData.vehicle;
    let finalVehicleId = quoteData.selectedVehicleId;
    let finalClientDocument = quoteData.selectedClient?.document_number;
    let finalClientPhone = quoteData.selectedClient?.phone_number;
    let finalClientEmail = quoteData.selectedClient?.email;
    let finalClientAddress = quoteData.selectedClient?.address;
    let finalClientCity = quoteData.selectedClient?.city;
    let finalClientState = quoteData.selectedClient?.state;
    let finalClientZipCode = quoteData.selectedClient?.zip_code;

    if (isSale && !quoteData.isClientRequired) {
      finalClientName = "Consumidor Final";
      finalClientId = undefined;
      finalVehicle = "N/A";
      finalVehicleId = undefined;
      finalClientDocument = undefined;
      finalClientPhone = undefined;
      finalClientEmail = undefined;
      finalClientAddress = undefined;
      finalClientCity = undefined;
      finalClientState = undefined;
      finalClientZipCode = undefined;
    }

    // Gerar sale_number apenas se for venda
    let saleNumber = undefined;
    if (isSale) {
      // Gera um UUID e pega os primeiros 8 caracteres, prefixando com 'V'
      saleNumber = `V${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
    }

    return {
      client_name: finalClientName,
      vehicle: finalVehicle,
      total_price: quoteData.finalPrice,
      quote_date: quoteData.quote_date,
      services_summary: getServicesSummaryForDb(quoteData.selectedServices),
      client_id: finalClientId,
      vehicle_id: finalVehicleId,
      status: status,
      client_document: finalClientDocument,
      client_phone: finalClientPhone,
      client_email: finalClientEmail,
      client_address: finalClientAddress,
      client_city: finalClientCity,
      client_state: finalClientState,
      client_zip_code: finalClientZipCode,
      notes: quoteData.observations,
      valid_until: validUntilString,
      service_date: quoteData.serviceDate,
      service_time: quoteData.serviceTime,
      is_sale: isSale,
      sale_number: saleNumber,
    };
  };

  const saveQuoteMutation = useMutation({
    mutationFn: async (quoteData: QuotePayload) => {
      if (!user) throw new Error("Usuário não autenticado.");

      // --- VERIFICAÇÃO DE DUPLICIDADE ---
      if (quoteData.client_id) {
        await checkDuplicity(quoteData);
      }
      // --- FIM DA VERIFICAÇÃO DE DUPLICIDADE ---

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
          service_date: quoteData.service_date || null,
          service_time: quoteData.service_time || null,
          is_sale: quoteData.is_sale, // Novo campo
          sale_number: quoteData.sale_number || null, // Novo campo
          payment_method_id: quoteData.payment_method_id || null, // Novo campo
          installments: quoteData.installments || null, // Novo campo
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
        // Se for uma venda, invalida a lista de vendas
        queryClient.invalidateQueries({ queryKey: ['closedSales', user?.id] });
        toast({
          title: "Venda registrada!",
          description: `Venda #${data.sale_number} registrada com sucesso.`,
        });
        navigate('/sales'); // Redireciona para a página de vendas
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

      // --- VERIFICAÇÃO DE DUPLICIDADE (excluindo o próprio orçamento) ---
      if (quoteData.client_id) {
        await checkDuplicity(quoteData, quoteId);
      }
      // --- FIM DA VERIFICAÇÃO DE DUPLICIDADE ---

      const { data, error } = await supabase
        .from('quotes')
        .update({
          client_name: quoteData.client_name,
          vehicle: quoteData.vehicle,
          total_price: quoteData.total_price,
          quote_date: quoteData.quote_date,
          services_summary: quoteData.services_summary,
          client_id: quoteData.client_id,
          vehicle_id: quoteData.vehicle_id,
          client_document: quoteData.client_document,
          client_phone: quoteData.client_phone,
          client_email: quoteData.client_email,
          client_address: quoteData.client_address,
          client_city: quoteData.client_city,
          client_state: quoteData.client_state,
          client_zip_code: quoteData.client_zip_code,
          notes: quoteData.notes,
          valid_until: quoteData.valid_until,
          service_date: quoteData.service_date || null,
          service_time: quoteData.service_time || null,
          status: quoteData.status, // Permitir atualização de status
          is_sale: quoteData.is_sale, // Permitir atualização de is_sale
          sale_number: quoteData.sale_number || null, // Permitir atualização de sale_number
          payment_method_id: quoteData.payment_method_id || null, // Novo campo
          installments: quoteData.installments || null, // Novo campo
        })
        .eq('id', quoteId)
        .eq('user_id', user.id)
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
      
      if (data.is_sale) {
        queryClient.invalidateQueries({ queryKey: ['closedSales', user?.id] });
        // Se for uma venda fechada, redireciona para a agenda (não para a lista de vendas)
        navigate('/agenda/daily?date=' + data.service_date);
      } else {
        // Se for apenas um update de orçamento, redireciona para a agenda
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
    if (!user) throw new Error("Usuário não autenticado.");
    const payload = prepareQuotePayload(quoteData, 'pending', false);
    return await saveQuoteMutation.mutateAsync(payload);
  };

  const handleSaveSale = async (quoteData: QuoteData) => {
    if (!user) throw new Error("Usuário não autenticado.");
    // Salva com status 'accepted' e is_sale=true
    const payload = prepareQuotePayload(quoteData, 'accepted', true); 
    return await saveQuoteMutation.mutateAsync(payload);
  };

  const handleUpdateQuote = async (quoteId: string, quoteData: QuoteData) => {
    if (!user) throw new Error("Usuário não autenticado.");
    // Para updates de orçamento, is_sale é false
    const payload = prepareQuotePayload(quoteData, 'pending', false); 
    try {
      await updateQuoteMutation.mutateAsync({ quoteId, quoteData: payload });
    } catch (error: any) {
      console.error("Erro ao atualizar orçamento:", error);
      // O toast de erro já é tratado na mutação
    }
  };

  // NOVA FUNÇÃO: Fechar Venda a partir da Agenda
  const handleCloseSale = useMutation({
    mutationFn: async ({ quoteId, paymentMethodId, installments }: { quoteId: string; paymentMethodId: string; installments: number | null }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      // 1. Gerar sale_number
      const saleNumber = `V${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

      // 2. Atualizar o orçamento para status 'closed', is_sale: true, e adicionar dados de pagamento
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
        .select('service_date') // Selecionar service_date para redirecionamento
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduledQuotes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['closedSales', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['monthlyScheduledQuotes', user?.id] });
      
      // Redireciona para a agenda do dia da venda
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

  const handleGenerateAndDownloadPDF = async (quoteData: QuoteData) => {
    if (!user) {
      toast({ title: "Erro de autenticação", description: "Por favor, faça login novamente.", variant: "destructive" });
      return;
    }
    try {
      const pdfBlob = await createQuotePdfBlob(quoteData);
      
      // 1. Salvar/Atualizar o orçamento no DB
      let savedQuoteId: string;
      let savedQuoteNumber: string;
      const quoteIdFromParams = searchParams.get('quoteId');

      if (quoteIdFromParams) {
        // Se estiver editando, atualiza o registro existente
        const payload = prepareQuotePayload(quoteData, 'pending', false);
        const updatedQuote = await updateQuoteMutation.mutateAsync({ quoteId: quoteIdFromParams, quoteData: payload });
        savedQuoteId = updatedQuote.id;
        savedQuoteNumber = updatedQuote.id.substring(0, 8);
      } else {
        // Se for novo, salva
        const savedQuote = await saveQuoteAndGetId(quoteData);
        savedQuoteId = savedQuote.id;
        savedQuoteNumber = savedQuote.id.substring(0, 8);
      }

      // 2. Fazer upload do PDF
      const fileName = `orcamento_${savedQuoteNumber}_${quoteData.client_name.replace(/\s+/g, '_')}_${quoteData.quote_date}.pdf`;
      const publicUrl = await uploadPdfMutation.mutateAsync({ pdfBlob, fileName: `${savedQuoteId}/${fileName}` });

      // 3. Atualizar o registro do orçamento com a URL do PDF (se for um novo save ou se a URL mudou)
      await supabase
        .from('quotes')
        .update({ pdf_url: publicUrl })
        .eq('id', savedQuoteId);

      // 4. Baixar o PDF
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

      const baseUrl = window.location.origin; // Usa o domínio atual (localhost)
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
    handleSaveSale, // Exportar a nova função
    handleCloseSale, // Exportar a nova função de fechar venda
    isGeneratingOrSaving,
    isSendingWhatsApp,
  };
};