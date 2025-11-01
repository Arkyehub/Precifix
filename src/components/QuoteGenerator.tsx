import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, Send, Link as LinkIcon, Pencil, ShoppingCart } from "lucide-react"; // Adicionado ShoppingCart
import { useSession } from "@/components/SessionContextProvider";
import { useQuery } from "@tanstack/react-query";
import { QuotedService } from "./QuoteServiceFormDialog";
import { PaymentMethod } from "./PaymentMethodFormDialog";
import { Client } from '@/types/clients';
import { Vehicle } from '@/types/vehicles';
import { QuoteClientSection } from '@/components/quote/QuoteClientSection';
import { useQuoteActions } from '@/hooks/use-quote-actions';
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from 'react-router-dom'; // Importar useSearchParams

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
  selectedVehicleId: string | null;
  setSelectedVehicleId: (id: string | null) => void;
  // Novos props para agendamento
  serviceDate: string;
  serviceTime: string;
  quoteIdToEdit: string | null; // Novo prop para ID de edição
  observations: string; // Receber observações
  setObservations: (obs: string) => void; // Receber setter de observações
  isSale?: boolean; // Nova prop
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
  selectedVehicleId,
  setSelectedVehicleId,
  // Novos
  serviceDate,
  serviceTime,
  quoteIdToEdit, // Usar o novo prop
  observations,
  setObservations,
  isSale = false, // Default para false
}: QuoteGeneratorProps) => {
  const { user } = useSession();
  const [searchParams] = useSearchParams(); // Inicializar useSearchParams

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
  const [vehicle, setVehicle] = useState("");
  const [rawPhoneNumber, setRawPhoneNumber] = useState(selectedClient?.phone_number || '');
  const [address, setAddress] = useState(selectedClient?.address || '');
  
  // Estados para agendamento movidos para o componente pai (QuoteCalculator)
  // mas precisamos de um estado local para o checkbox
  const [isTimeDefined, setIsTimeDefined] = useState(!!serviceTime);
  const [localServiceDate, setLocalServiceDate] = useState(serviceDate);
  const [localServiceTime, setLocalServiceTime] = useState(serviceTime);

  useEffect(() => {
    if (selectedClient) {
      setClientNameInput(selectedClient.name);
      setRawPhoneNumber(selectedClient.phone_number || '');
      setAddress(selectedClient.address || '');
    } else {
      if (!clientNameInput) {
        setRawPhoneNumber('');
        setAddress('');
        if (typeof setSelectedVehicleId === 'function') {
          setSelectedVehicleId(null);
        }
      }
    }
  }, [selectedClient]);

  useEffect(() => {
    setLocalServiceDate(serviceDate);
    setLocalServiceTime(serviceTime);
    setIsTimeDefined(!!serviceTime);
  }, [serviceDate, serviceTime]);

  const { 
    handleGenerateAndDownloadPDF, 
    handleSendViaWhatsApp, 
    handleGenerateLink,
    handleGenerateLocalLink,
    handleUpdateQuote,
    isGeneratingOrSaving, 
    isSendingWhatsApp,
    handleSaveSale, // Nova função para salvar venda
  } = useQuoteActions(profile, isSale); // Passar isSale para o hook

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
    clientId: selectedClient?.id, // Passando o ID do cliente
    selectedVehicleId,
    selectedClient,
    serviceDate: localServiceDate,
    serviceTime: isTimeDefined ? localServiceTime : '',
  };

  const isQuoteValid = selectedServices.length > 0 
    && clientNameInput.trim() !== '' 
    && finalPrice > 0
    && !!selectedVehicleId
    && !!selectedClient?.id // Cliente deve estar selecionado
    && !!localServiceDate; // Data de serviço deve estar definida para a verificação de duplicidade

  const isWhatsAppDisabled = !isQuoteValid || isSendingWhatsApp || rawPhoneNumber.replace(/\D/g, '').length < 8;

  const handleSaveOrUpdate = () => {
    if (!isQuoteValid) return;

    if (quoteIdToEdit) {
      handleUpdateQuote(quoteIdToEdit, quoteData);
    } else if (isSale) {
      handleSaveSale(quoteData); // Salva como venda
    } else {
      // Para novos orçamentos, o fluxo padrão é gerar link/pdf
      handleGenerateLink(quoteData);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
            {isSale ? <ShoppingCart className="h-5 w-5 text-primary-foreground" /> : <FileText className="h-5 w-5 text-primary-foreground" />}
          </div>
          <div>
            <CardTitle className="text-foreground">
              {isSale ? 'Finalizar Venda' : (quoteIdToEdit ? 'Atualizar Orçamento' : 'Gerar Orçamento para Cliente')}
            </CardTitle>
            <CardDescription>
              Preencha os dados abaixo para {isSale ? 'registrar a venda' : (quoteIdToEdit ? 'atualizar' : 'gerar')} o documento.
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
          selectedVehicleId={selectedVehicleId}
          setSelectedVehicleId={setSelectedVehicleId}
          // Passando os novos estados e setters
          serviceDate={localServiceDate}
          setServiceDate={setLocalServiceDate}
          isTimeDefined={isTimeDefined}
          setIsTimeDefined={setIsTimeDefined}
          serviceTime={localServiceTime}
          setServiceTime={setLocalServiceTime}
        />

        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border/50">
          {isSale ? (
            <Button
              onClick={handleSaveOrUpdate}
              disabled={!isQuoteValid || isGeneratingOrSaving}
              className="flex-1 bg-success hover:bg-success/90"
            >
              {isGeneratingOrSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="mr-2 h-4 w-4" />
              )}
              Registrar Venda Finalizada
            </Button>
          ) : quoteIdToEdit ? (
            <Button
              onClick={handleSaveOrUpdate}
              disabled={!isQuoteValid || isGeneratingOrSaving}
              className="flex-1 bg-success hover:bg-success/90"
            >
              {isGeneratingOrSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="mr-2 h-4 w-4" />
              )}
              Salvar Alterações
            </Button>
          ) : (
            <>
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
            </>
          )}
        </div>
        {!isQuoteValid && (
          <p className="text-sm text-destructive text-center">
            Selecione pelo menos um serviço, informe o nome do cliente, **selecione o veículo**, **selecione o cliente**, **defina a data do serviço** e garanta que o preço final seja maior que zero.
          </p>
        )}
      </CardContent>
    </Card>
  );
};