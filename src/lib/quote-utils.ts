import { jsPDF } from 'jspdf';
import { addDays, format } from 'date-fns';
import { QuotedService as OriginalQuotedService } from '@/components/QuoteServiceFormDialog'; // Renomeado para evitar conflito
import { Client } from '@/types/clients';
import { PaymentMethod as OriginalPaymentMethod } from '@/components/PaymentMethodFormDialog'; // Renomeado para evitar conflito

// Define Profile interface here if not already in a shared types file
export interface Profile {
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
  city?: string | null; // Adicionado
  state?: string | null; // Adicionado
}

// Re-exportando QuotedService e PaymentMethod para uso consistente
export type QuotedService = OriginalQuotedService;
export type PaymentMethod = OriginalPaymentMethod;

// Interfaces para os dados do orçamento
export interface QuoteData {
  id?: string; // Adicionado para identificar orçamentos existentes
  quote_date: string;
  client_name: string;
  clientId?: string | null;
  vehicle: string;
  selectedVehicleId?: string | null;
  selectedClient?: Client;
  clientDetails: {
    phoneNumber?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
  };
  serviceTime: string;
  finalPrice: number;
  selectedServices: QuotedService[];
  observations: string;
  serviceDate: string;
  isClientRequired: boolean;
  calculatedCommission: number;
  commissionType: 'amount' | 'percentage';
  currentPaymentMethod?: PaymentMethod;
  selectedInstallments?: number | null;
  profile?: Profile; // Adicionado profile aqui
}

export interface QuotePayload {
  client_name: string;
  vehicle: string;
  total_price: number;
  quote_date: string;
  services_summary: any; // JSONB type in DB
  client_id?: string | null;
  vehicle_id?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'closed' | 'awaiting_payment';
  client_document?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  client_address?: string | null;
  client_address_number?: string | null;
  client_complement?: string | null;
  client_city?: string | null;
  client_state?: string | null;
  client_zip_code?: string | null;
  notes?: string | null;
  valid_until: string;
  service_date?: string | null;
  service_time?: string | null;
  is_sale: boolean;
  commission_value?: number | null;
  commission_type?: 'amount' | 'percentage' | null;
  payment_method_id?: string | null;
  installments?: number | null;
}

export const getServicesSummaryForDb = (services: QuotedService[]) => {
  return services.map(s => ({
    id: s.original_service_id, // Use original_service_id for database reference
    name: s.name,
    price: s.quote_price ?? s.price,
    execution_time_minutes: s.quote_execution_time_minutes ?? s.execution_time_minutes,
    products: s.quote_products?.map(p => ({
      id: p.original_product_id || p.id,
      name: p.name,
      usage_per_vehicle: p.usage_per_vehicle,
      dilution_ratio: p.dilution_ratio,
      container_size: p.container_size,
      price: p.price,
      type: p.type,
      size: p.size,
    })) || s.products?.map(p => ({
      id: p.original_product_id || p.id,
      name: p.name,
      usage_per_vehicle: p.usage_per_vehicle,
      dilution_ratio: p.dilution_ratio,
      container_size: p.container_size,
      price: p.price,
      type: p.type,
      size: p.size,
    })),
  }));
};

export const prepareQuotePayload = (quoteData: QuoteData, status: 'pending' | 'accepted' | 'rejected' | 'closed' | 'awaiting_payment' = 'pending', isSale: boolean = false): QuotePayload => {
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
  
  // Usar os dados do cliente selecionado ou os dados editáveis do QuoteClientSection
  let finalClientAddress = quoteData.selectedClient?.address || quoteData.clientDetails.address;
  let finalClientAddressNumber = quoteData.selectedClient?.address_number || quoteData.clientDetails.addressNumber;
  let finalClientComplement = quoteData.selectedClient?.complement || quoteData.clientDetails.complement;
  
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
    finalClientAddressNumber = undefined;
    finalClientComplement = undefined;
    finalClientCity = undefined;
    finalClientState = undefined;
    finalClientZipCode = undefined;
  }
  
  // CORREÇÃO: Converte string vazia para null para o Supabase
  const finalServiceTime = quoteData.serviceTime.trim() === '' ? null : quoteData.serviceTime;

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
    client_address_number: finalClientAddressNumber, // NOVO
    client_complement: finalClientComplement, // NOVO
    client_city: finalClientCity,
    client_state: finalClientState,
    client_zip_code: finalClientZipCode,
    notes: quoteData.observations,
    valid_until: validUntilString,
    service_date: quoteData.serviceDate,
    service_time: finalServiceTime, // Usando o valor corrigido
    is_sale: isSale,
    commission_value: quoteData.calculatedCommission, // NOVO
    commission_type: quoteData.commissionType, // NOVO
    payment_method_id: quoteData.currentPaymentMethod?.id, // Adicionado
    installments: quoteData.selectedInstallments, // Adicionado
  };
};

// --- GERAÇÃO DE PDF ---

export const createQuotePdfBlob = async (quoteData: QuoteData): Promise<Blob> => {
  const doc = new jsPDF();

  const primaryColor = '#FFD700'; // Yellow from the image
  const textColor = '#000000'; // Black
  const lightGray = '#F0F0F0'; // Light gray for table header

  let yPos = 10;
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- Header ---
  doc.setFillColor(primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F'); // Yellow background for header

  doc.setFontSize(10);
  doc.setTextColor(textColor);
  doc.text(quoteData.profile?.company_name || 'Sua Empresa', margin, yPos + 5);

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO', margin, yPos + 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const formattedDate = format(new Date(quoteData.quote_date), 'dd/MM/yyyy');
  doc.text(`Data: ${formattedDate}`, margin, yPos + 25);

  // Placeholder for image (if profile.avatar_url is available and valid, could fetch and embed)
  // For now, just a rectangle or a text placeholder
  // doc.rect(pageWidth - margin - 20, yPos + 5, 20, 20); // Placeholder rectangle for image
  // doc.text('Logo', pageWidth - margin - 15, yPos + 15);

  yPos = 50; // Start content below header

  // --- Client Details ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Dados do Cliente', margin, yPos);
  yPos += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${quoteData.client_name}`, margin, yPos);
  yPos += 5;
  doc.text(`Veículo: ${quoteData.vehicle}`, margin, yPos);
  yPos += 5;
  if (quoteData.clientDetails.phoneNumber) {
    doc.text(`Telefone: ${quoteData.clientDetails.phoneNumber}`, margin, yPos);
    yPos += 5;
  }
  let addressLine = '';
  if (quoteData.clientDetails.address) {
    addressLine += `Endereço: ${quoteData.clientDetails.address}`;
    if (quoteData.clientDetails.addressNumber) {
      addressLine += `, ${quoteData.clientDetails.addressNumber}`;
    }
    if (quoteData.clientDetails.complement) {
      addressLine += ` - ${quoteData.clientDetails.complement}`;
    }
    doc.text(addressLine, margin, yPos);
    yPos += 5;
  }
  yPos += 10; // Extra space

  // --- Services Contracted ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Serviços Contratados', margin, yPos);
  yPos += 7;

  // Table Header
  const tableStartX = margin;
  const tableCol1Width = 100;
  const tableCol2Width = 30;
  const tableCol3Width = 40;
  const rowHeight = 7;

  doc.setFillColor(lightGray);
  doc.rect(tableStartX, yPos, tableCol1Width + tableCol2Width + tableCol3Width, rowHeight, 'F');
  doc.setTextColor(textColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Serviço', tableStartX + 2, yPos + rowHeight - 2);
  doc.text('Tempo', tableStartX + tableCol1Width + 2, yPos + rowHeight - 2);
  doc.text('Valor', tableStartX + tableCol1Width + tableCol2Width + 2, yPos + rowHeight - 2);
  yPos += rowHeight;

  // Table Rows
  doc.setFont('helvetica', 'normal');
  quoteData.selectedServices.forEach(service => {
    doc.text(service.name, tableStartX + 2, yPos + rowHeight - 2);
    doc.text(`${service.quote_execution_time_minutes || service.execution_time_minutes} min`, tableStartX + tableCol1Width + 2, yPos + rowHeight - 2);
    doc.text(`R$ ${service.quote_price?.toFixed(2) || service.price.toFixed(2)}`, tableStartX + tableCol1Width + tableCol2Width + 2, yPos + rowHeight - 2);
    yPos += rowHeight;
  });
  yPos += 10; // Extra space

  // --- Payment Method ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Forma de Pagamento:', margin, yPos);
  yPos += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let paymentMethodText = quoteData.currentPaymentMethod?.name || 'Não especificado';
  if (quoteData.selectedInstallments && quoteData.selectedInstallments > 1) {
    paymentMethodText += ` em até ${quoteData.selectedInstallments}x`;
  }
  doc.text(paymentMethodText, margin, yPos);
  yPos += 10; // Extra space

  // --- Total Value ---
  doc.setFillColor(primaryColor);
  doc.rect(margin, yPos, pageWidth - (2 * margin), 15, 'F'); // Yellow background for total
  doc.setTextColor(textColor);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`VALOR TOTAL: R$ ${quoteData.finalPrice.toFixed(2)}`, margin + 5, yPos + 10);

  return doc.output('blob');
};