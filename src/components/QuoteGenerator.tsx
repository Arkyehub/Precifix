import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, Send, Link as LinkIcon } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery } from "@tanstack/react-query";
import { QuotedService } from "./QuoteServiceFormDialog";
import { PaymentMethod } from "./PaymentMethodFormDialog";
import { Client } from '@/types/clients';
import { Vehicle } from '@/types/vehicles'; // Nova importação
import { QuoteClientSection } from '@/components/quote/QuoteClientSection';
import { useQuoteActions } from '@/hooks/use-quote-actions';
import { supabase } from "@/integrations/supabase/client";

// ... (interfaces existentes)

interface QuoteGeneratorProps {
  selectedServices: QuotedService[];
  totalCost: number;
  finalPrice: number;
  executionTime: number;
  calculatedDiscount: number;
  currentPaymentMethod: PaymentMethod | undefined;
  selectedInstallments: number | null;
  selectedClient: Client | undefined;
  onClientSelect: (clientId: string | null) => void;
  onClientSaved: (client: Client) => void;
  // Novos props para veículos (agora obrigatórios)
  selectedVehicleId: string | null;
  setSelectedVehicleId: (id: string | null) => void;
}

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const QuoteGenerator = ({ 
  selectedServices, 
  totalCost, 
  finalPrice,
  executionTime,
  calculatedDiscount,
  currentPaymentMethod,
  selectedInstallments,
  selectedClient,
  onClientSelect,
  onClientSaved,
  // Novos
  selectedVehicleId,
  setSelectedVehicleId,
}: QuoteGeneratorProps) => {
  const { user } = useSession();

  // Fetch profile
  const { data: profile } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated.");
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

  const [clientNameInput, setClientNameInput] = useState(selectedClient?.name || "");
  const [quoteDate, setQuoteDate] = useState(getTodayDateString());
  const [vehicle, setVehicle] = useState(""); // Pode ser usado como fallback se não houver selectedVehicleId
  const [observations, setObservations] = useState("");
  const [rawPhoneNumber, setRawPhoneNumber] = useState(selectedClient?.phone_number || '');
  const [address, setAddress] = useState(selectedClient?.address || '');

  // Efeito para sincronizar o nome do cliente e detalhes de contato quando selectedClient muda
  useEffect(() => {
    if (selectedClient) {
      setClientNameInput(selectedClient.name);
      setRawPhoneNumber(selectedClient.phone_number || '');
      setAddress(selectedClient.address || '');
    } else {
      // Se o cliente for deselecionado, mas o input de nome não estiver vazio, não limpe
      if (!clientNameInput) {
        setRawPhoneNumber('');
        setAddress('');
      }
    }
  }, [selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const { 
    handleGenerateAndDownloadPDF, 
    handleSendViaWhatsApp, 
    handleGenerateLink, // Nova função
    isGeneratingOrSaving, 
    isSendingWhatsApp 
  } = useQuoteActions(profile);

  // Fetch vehicle details if selectedVehicleId is set
  const { data: vehicleDetails } = useQuery<Vehicle | null>({
    queryKey: ['vehicleDetails', selectedVehicleId],
    queryFn: async () => {
      if (!selectedVehicleId) return null;
      const { data, error } = await supabase
        .from('client_vehicles')
        .select('*')
        .eq('id', selectedVehicleId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVehicleId,
  });

  // Atualiza o campo 'vehicle' com o modelo do veículo selecionado
  useEffect(() => {
    if (vehicleDetails) {
      setVehicle(`${vehicleDetails.brand} ${vehicleDetails.model} (${vehicleDetails.plate || 'N/A'})`);
    } else {
      setVehicle("");
    }
  }, [vehicleDetails]);

  const quoteData = {
    client_name: clientNameInput,
    vehicle, 
    quote_date: quoteDate,
    selectedServices,
    finalPrice,
    calculatedDiscount,
    currentPaymentMethod,
    selectedInstallments,
    observations,
    profile,
    clientDetails: { phoneNumber: rawPhoneNumber, address: address },
    clientId: selectedClient?.id,
    // Novos dados para veículo
    selectedVehicleId,
    selectedClient, // Adicionado para resolver o erro TS2345
  };

  // 1. Validação principal: Serviços, Cliente, Preço FINAL e VEÍCULO
  const isQuoteValid = selectedServices.length > 0 
    && clientNameInput.trim() !== '' 
    && finalPrice > 0
    && !!selectedVehicleId; // Requer que o veículo esteja selecionado

  // 2. Validação específica para WhatsApp: Telefone preenchido (além da validade geral)
  const isWhatsAppDisabled = !isQuoteValid || isSendingWhatsApp || rawPhoneNumber.replace(/\D/g, '').length < 8;

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-foreground">Gerar Orçamento para Cliente</CardTitle>
            <CardDescription>
              Preencha os dados abaixo para gerar um orçamento profissional.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <QuoteClientSection
          selectedClient={selectedClient}
          onClientSelect={onClientSelect}
          onClientSaved={onClientSaved}
          clientNameInput={clientNameInput}
          setClientNameInput={setClientNameInput}
          quoteDate={quoteDate}
          setQuoteDate={setQuoteDate}
          rawPhoneNumber={rawPhoneNumber}
          setRawPhoneNumber={setRawPhoneNumber}
          address={address}
          setAddress={setAddress}
          observations={observations}
          setObservations={setObservations}
          // Novos props
          selectedVehicleId={selectedVehicleId}
          setSelectedVehicleId={setSelectedVehicleId}
        />

        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border/50">
          <Button
            onClick={() => handleGenerateAndDownloadPDF(quoteData)}
            disabled={!isQuoteValid || isGeneratingOrSaving}
            className="flex-1 bg-primary hover:bg-primary-glow"
          >
            {isGeneratingOrSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Gerar e Baixar PDF
          </Button>
          
          <Button
            onClick={() => handleGenerateLink(quoteData)}
            disabled={!isQuoteValid || isGeneratingOrSaving}
            variant="outline"
            className="flex-1 border-primary/30 hover:bg-primary/10 hover:border-primary"
          >
            {isGeneratingOrSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LinkIcon className="mr-2 h-4 w-4" />
            )}
            Link do Orçamento
          </Button>

          <Button
            onClick={() => handleSendViaWhatsApp(quoteData)}
            disabled={isWhatsAppDisabled}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white"
          >
            {isSendingWhatsApp ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Enviar via WhatsApp
          </Button>
        </div>
        {!isQuoteValid && (
          <p className="text-sm text-destructive text-center">
            Selecione pelo menos um serviço, informe o nome do cliente, **selecione o veículo** e garanta que o preço final seja maior que zero.
          </p>
        )}
      </CardContent>
    </Card>
  );
};