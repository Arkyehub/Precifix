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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Importar Tooltip
import { useNavigate } from 'react-router-dom'; // Importar useNavigate

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
  manualVehicleInput: string; // NOVO: Input manual para veículo
  // Novos props para agendamento
  serviceDate: string;
  serviceTime: string;
  quoteIdToEdit: string | null; // Novo prop para ID de edição
  observations: string; // Receber observações
  setObservations: (obs: string) => void; // Receber setter de observações
  isSale?: boolean; // Nova prop
  isClientRequired: boolean; // Nova prop
  addressNumber: string; // NOVO: Prop para número do endereço
  complement: string; // NOVO: Prop para complemento
  calculatedCommission: number; // NOVO
  commissionType: 'amount' | 'percentage'; // NOVO
  commissionValueInput: string; // NOVO
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
  manualVehicleInput, // NOVO
  // Novos
  serviceDate,
  serviceTime,
  quoteIdToEdit, // Usar o novo prop
  observations,
  setObservations,
  isSale = false, // Default para false
  isClientRequired, // Usar a nova prop
  addressNumber, // NOVO
  complement, // NOVO
  calculatedCommission, // NOVO
  commissionType, // NOVO
  commissionValueInput, // NOVO
}: QuoteGeneratorProps) => {
  const { user } = useSession();
  const [searchParams] = useSearchParams(); // Inicializar useSearchParams
  const navigate = useNavigate(); // Inicializar useNavigate

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
    handleUpdateQuote,
    handleSaveSale, // Nova função para salvar venda
    handleSaveQuote, // Adicionado
    isGeneratingOrSaving, 
    isSendingWhatsApp,
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
    if (isClientRequired) {
      // Se o cliente é obrigatório, o veículo vem do cadastro
      if (vehicleDetails) {
        setVehicle(`${vehicleDetails.brand} ${vehicleDetails.model} (${vehicleDetails.plate || 'N/A'})`);
      } else {
        setVehicle("");
      }
    } else {
      // Se o cliente NÃO é obrigatório (venda rápida), o veículo vem do input manual
      setVehicle(manualVehicleInput || "N/A");
    }
  }, [vehicleDetails, isClientRequired, manualVehicleInput]);

  // Lógica para garantir "Consumidor Final" se o nome estiver vazio e não for obrigatório
  const effectiveClientName = (!isClientRequired && (!clientNameInput || clientNameInput.trim() === '')) 
    ? "Consumidor Final" 
    : clientNameInput;

  const quoteData = {
    client_name: effectiveClientName,
    vehicle, 
    quote_date: quoteDate,
    selectedServices,
    finalPrice,
    calculatedDiscount,
    currentPaymentMethod,
    selectedInstallments,
    observations,
    profile,
    clientDetails: { 
      phoneNumber: rawPhoneNumber, 
      address: address,
      addressNumber: addressNumber, // NOVO: Adicionado
      complement: complement, // NOVO: Adicionado
    },
    clientId: selectedClient?.id, // Passando o ID do cliente
    selectedVehicleId: isClientRequired ? selectedVehicleId : undefined, // Só passa vehicleId se o cliente for obrigatório
    selectedClient,
    serviceDate: localServiceDate,
    serviceTime: isTimeDefined ? localServiceTime : '',
    isClientRequired,
    calculatedCommission, // NOVO
    commissionType, // NOVO
    commissionValueInput, // NOVO
  };

  // Lógica de validação ajustada:
  const isBaseValid = selectedServices.length > 0 
    && finalPrice > 0.01 
    && !!localServiceDate;

  // Validação para cliente obrigatório
  const isClientDataValid = isClientRequired 
    ? (clientNameInput.trim() !== '' && !!selectedClient?.id && !!selectedVehicleId)
    : true; // Se não for obrigatório, esta parte é sempre true

  // Validação para venda rápida (cliente não obrigatório)
  // A única validação necessária aqui é o veículo manual
  const isQuickSaleValid = isSale && !isClientRequired 
    ? (manualVehicleInput.trim() !== '')
    : true; // Se não for venda rápida ou se for obrigatório, esta parte é sempre true

  // A validação final combina a base, a validação de cliente obrigatório E a validação de venda rápida
  const isQuoteValid = isBaseValid && isClientDataValid && isQuickSaleValid;

  const isWhatsAppDisabled = !isQuoteValid || isSendingWhatsApp || rawPhoneNumber.replace(/\D/g, '').length < 8 || !isClientRequired;

  const handleSaveOrUpdate = () => {
    if (!isQuoteValid) return;

    if (quoteIdToEdit) {
      handleUpdateQuote(quoteIdToEdit, quoteData);
    } else {
      handleSaveQuote(quoteData); // Chama a função para salvar o orçamento
    }
  };

  // Função para gerar a mensagem de erro detalhada
  const getValidationMessage = () => {
    const errors: string[] = [];
    if (selectedServices.length === 0) {
      errors.push("Selecione pelo menos um serviço.");
    }
    if (finalPrice <= 0.01) {
      errors.push("O preço final do orçamento deve ser maior que zero. (Verifique o 'Valor Cobrado' nos serviços selecionados).");
    }
    if (!localServiceDate) {
      errors.push("Defina a data do serviço.");
    }

    if (isClientRequired) {
      if (clientNameInput.trim() === '') {
        errors.push("Informe o nome do cliente.");
      }
      if (!selectedClient?.id) {
        errors.push("Selecione um cliente cadastrado (use a busca ou adicione um novo).");
      }
      if (!selectedVehicleId) {
        errors.push("Selecione o veículo do cliente.");
      }
    } else {
      // Venda Rápida (Cliente não obrigatório)
      // Removemos a verificação do clientNameInput aqui, pois ele é preenchido automaticamente.
      if (manualVehicleInput.trim() === '') {
        errors.push("Informe o veículo (Ex: 'Carro Pequeno').");
      }
    }

    return errors.join(' | ');
  };

  const validationMessage = getValidationMessage();

  // Componente auxiliar para envolver os botões em Tooltip
  const ActionButtonWrapper = ({ children, disabled, actionType }: { children: React.ReactNode, disabled: boolean, actionType: 'save' | 'generate' | 'whatsapp' }) => {
    if (!disabled) {
      return <>{children}</>;
    }

    let tooltipContent = validationMessage;
    if (actionType === 'whatsapp' && !isWhatsAppDisabled && rawPhoneNumber.replace(/\D/g, '').length < 8) {
      tooltipContent = "O número de telefone do cliente é necessário para enviar via WhatsApp.";
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Envolve o botão desabilitado em um span para que o Tooltip funcione */}
            <span className="flex-1">
              {children}
            </span>
          </TooltipTrigger>
          <TooltipContent className="bg-destructive text-destructive-foreground border border-destructive/50 p-3 rounded-lg shadow-md max-w-xs">
            <p className="font-bold mb-1">Ação Bloqueada:</p>
            <p>{tooltipContent}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
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
              {isSale ? 'Finalizar Venda' : (quoteIdToEdit ? `Atualizar Orçamento #${quoteIdToEdit.substring(0, 8)}` : 'Gerar Orçamento para Cliente')}
            </CardTitle>
            <CardDescription>
              Preencha os dados abaixo para {isSale ? 'registrar a venda' : (quoteIdToEdit ? 'atualizar' : 'gerar')} o documento.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* A seção de cliente foi movida para o QuoteCalculator, mas os dados de entrada ainda são necessários aqui */}
        {/* ... (QuoteClientSection foi removido daqui, mas os dados de entrada são passados via props) */}

        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border/50">
          {isSale ? (
            <ActionButtonWrapper disabled={!isQuoteValid || isGeneratingOrSaving} actionType="save">
              <Button
                onClick={handleSaveOrUpdate}
                disabled={!isQuoteValid || isGeneratingOrSaving}
                className="w-full bg-success hover:bg-success/90"
              >
                {isGeneratingOrSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="mr-2 h-4 w-4" />
                )}
                Registrar Venda Finalizada
              </Button>
            </ActionButtonWrapper>
          ) : (
            <>
              <Button
                onClick={() => navigate('/agenda')} // Botão Cancelar
                variant="outline"
                className="w-full border-destructive/30 hover:bg-destructive/10 hover:border-destructive"
              >
                Cancelar
              </Button>
              <ActionButtonWrapper disabled={!isQuoteValid || isGeneratingOrSaving} actionType="save">
                <Button
                  onClick={handleSaveOrUpdate}
                  disabled={!isQuoteValid || isGeneratingOrSaving}
                  className="w-full bg-primary hover:bg-primary-glow"
                >
                  {isGeneratingOrSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Pencil className="mr-2 h-4 w-4" />
                  )}
                  Salvar Orçamento
                </Button>
              </ActionButtonWrapper>
            </>
          )}
        </div>
        {!isQuoteValid && (
          <p className="text-sm text-destructive text-center">
            {validationMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
};