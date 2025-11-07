import { addDays } from 'date-fns';
import { QuotedService } from '@/components/QuoteServiceFormDialog';
import { Client } from '@/types/clients';
import { PaymentMethod } from '@/components/PaymentMethodFormDialog';

// Interfaces para os dados do orçamento
export interface QuoteData {
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

// Assuming createQuotePdfBlob is defined elsewhere in this file and needs to be exported
// If it's not defined, you'll need to provide its implementation.
export const createQuotePdfBlob = async (quoteData: QuoteData): Promise<Blob> => {
  // Placeholder implementation for createQuotePdfBlob
  // You would replace this with your actual PDF generation logic using jspdf
  console.warn("createQuotePdfBlob is a placeholder. Implement actual PDF generation.");
  const dummyPdfContent = `PDF for ${quoteData.client_name} on ${quoteData.quote_date}`;
  return new Blob([dummyPdfContent], { type: 'application/pdf' });
};