import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, Send } from "lucide-react";
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
  // Novos props para veículos (passados do pai se necessário)
  selectedVehicleId?: string | null;
  setSelectedVehicleId?: (id: string | null) => void;
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

  // ... (efeitos existentes)

  const { 
    handleGenerateAndDownloadPDF, 
    handleSendViaWhatsApp, 
    isGeneratingOrSaving, 
    isSendingWhatsApp 
  } = useQuoteActions(profile);

  // ... (validações existentes, adicionar selectedVehicleId se obrigatório)

  const quoteData = {
    client_name: clientNameInput,
    vehicle, // Manter para compatibilidade, mas usar detalhes do veículo selecionado no PDF
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
  };

  // ... (handlers existentes)

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

        {/* ... resto do componente inalterado */}
      </CardContent>
    </Card>
  );
};