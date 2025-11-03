import jsPDF from "jspdf";
import { addDays } from 'date-fns';
import { formatPhoneNumber } from '@/lib/utils';
import { QuotedService } from "@/components/QuoteServiceFormDialog";
import { PaymentMethod } from "@/components/PaymentMethodFormDialog";
import { Client } from '@/types/clients';

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

export interface QuoteData {
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
  serviceDate: string;
  serviceTime: string;
  isClientRequired: boolean;
}

export interface QuotePayload {
  client_name: string;
  vehicle: string;
  total_price: number;
  quote_date: string;
  services_summary: any[];
  pdf_url?: string;
  client_id?: string;
  vehicle_id?: string;
  status?: 'pending' | 'accepted' | 'rejected' | 'closed';
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
  is_sale: boolean;
  sale_number?: string;
  payment_method_id?: string;
  installments?: number;
}

// --- UTILS DE IMAGEM ---

export const getImageDataUrl = async (url: string | null): Promise<string | null> => {
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

// --- PREPARAÇÃO DE DADOS ---

const getServicesSummaryForDb = (selectedServices: QuotedService[]) => selectedServices.map(service => ({
  name: service.name,
  price: service.quote_price ?? service.price,
  execution_time_minutes: service.quote_execution_time_minutes ?? service.execution_time_minutes,
  id: service.id, 
}));

export const prepareQuotePayload = (quoteData: QuoteData, status: 'pending' | 'accepted' | 'rejected' | 'closed' = 'pending', isSale: boolean = false): QuotePayload => {
  const quoteDateObj = new Date(quoteData.quote_date);
  const validUntilDate = addDays(quoteDateObj, 7);
  const validUntilString = validUntilDate.toISOString().split('T')[0];

  // Valores padrão para cliente/veículo
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
    // Se for venda rápida (sem cliente obrigatório), usamos os dados do input manual
    finalClientName = quoteData.client_name || "Consumidor Final";
    finalClientId = undefined;
    finalVehicle = quoteData.vehicle || "N/A"; // Usa o veículo digitado manualmente
    finalVehicleId = undefined;
    finalClientDocument = undefined;
    finalClientPhone = undefined;
    finalClientEmail = undefined;
    finalClientAddress = undefined;
    finalClientCity = undefined;
    finalClientState = undefined;
    finalClientZipCode = undefined;
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
    // sale_number, payment_method_id, installments são adicionados na mutação
  };
};

// --- GERAÇÃO DE PDF ---

export const createQuotePdfBlob = async ({
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

  // Seção de Agendamento no PDF
  if (serviceDate) {
    yPosition += 6;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("Agendamento do Serviço", 15, yPosition);
    yPosition += 8;
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    const [sYear, sMonth, sDay] = serviceDate.split('-');
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