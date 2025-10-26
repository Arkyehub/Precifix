import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, Send } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery } from "@tanstack/react-query";
import { QuotedService } from "./QuoteServiceFormDialog";
import { PaymentMethod } from "./PaymentMethodFormDialog";
import { Client } from '@/types/clients';
import { QuoteClientSection } from '@/components/quote/QuoteClientSection';
import { useQuoteActions } from '@/hooks/use-quote-actions';

// Interface para os dados do perfil, para uso interno neste componente
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
}: QuoteGeneratorProps) => {
  const { user } = useSession();

  const [clientNameInput, setClientNameInput] = useState(selectedClient?.name || "");
  const [quoteDate, setQuoteDate] = useState(getTodayDateString());
  const [vehicle, setVehicle] = useState("");
  const [observations, setObservations] = useState("");
  const [rawPhoneNumber, setRawPhoneNumber] = useState(selectedClient?.phone_number || '');
  const [address, setAddress] = useState(selectedClient?.address || '');

  // Sincronizar campos de input com o cliente selecionado
  useEffect(() => {
    if (selectedClient) {
      setClientNameInput(selectedClient.name);
      setRawPhoneNumber(selectedClient.phone_number || '');
      setAddress(selectedClient.address || '');
    } else {
      // Se nenhum cliente estiver selecionado, mas o input de nome estiver vazio, limpa os outros campos
      if (!clientNameInput) {
        setRawPhoneNumber('');
        setAddress('');
      }
    }
  }, [selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery<Profile>({
    queryKey: ['userProfileForQuote', user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Usuário não autenticado.");
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

  const { 
    handleGenerateAndDownloadPDF, 
    handleSendViaWhatsApp, 
    isGeneratingOrSaving, 
    isSendingWhatsApp 
  } = useQuoteActions(profile);

  const validateInputs = () => {
    if (!clientNameInput || !vehicle) {
      return false;
    }
    if (profileError) {
      return false;
    }
    return true;
  };

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
  };

  const handleDownload = () => {
    if (!validateInputs()) return;
    handleGenerateAndDownloadPDF(quoteData);
  };

  const handleWhatsApp = () => {
    if (!validateInputs()) return;
    handleSendViaWhatsApp(quoteData);
  };

  const isWhatsAppButtonEnabled = rawPhoneNumber.trim().length > 0 && !isSendingWhatsApp;

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
              Preço justo, lucro certo — o sucesso começa na precificação.
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
          vehicle={vehicle}
          setVehicle={setVehicle}
          rawPhoneNumber={rawPhoneNumber}
          setRawPhoneNumber={setRawPhoneNumber}
          address={address}
          setAddress={setAddress}
          observations={observations}
          setObservations={setObservations}
        />

        <div className="pt-4 border-t border-border/50">
          <div className="bg-background rounded-lg p-4 mb-4 shadow-md">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Serviços Selecionados:</span>
              <span className="font-semibold text-foreground">{selectedServices.length}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-muted-foreground">Tempo Estimado:</span>
              <span className="font-semibold text-foreground">{executionTime} minutos</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-lg font-bold text-foreground">Valor Total:</span>
              <span className="text-2xl font-bold text-primary">R$ {finalPrice.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={handleDownload}
              className="flex-1 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
              disabled={isGeneratingOrSaving || !validateInputs()}
            >
              {isGeneratingOrSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isGeneratingOrSaving ? "Gerar PDF e Salvar Orçamento" : "Gerar PDF e Salvar Orçamento"}
            </Button>
            <Button 
              onClick={handleWhatsApp}
              className={`flex-1 ${isWhatsAppButtonEnabled ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-muted text-muted-foreground cursor-not-allowed'} transition-colors`}
              disabled={!isWhatsAppButtonEnabled || !validateInputs()}
            >
              {isSendingWhatsApp ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {isSendingWhatsApp ? "Enviando..." : "Enviar via WhatsApp"}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center italic">
          Seu orçamento está pronto para impressionar o cliente! 🚗✨
        </p>
      </CardContent>
    </Card>
  );
};