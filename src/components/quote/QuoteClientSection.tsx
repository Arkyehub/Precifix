import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { Client } from '@/types/clients';
import { ClientFormDialog } from '../ClientFormDialog';
import { formatPhoneNumber } from '@/lib/utils';
import { ClientAutocomplete } from './ClientAutocomplete'; // Importar o novo componente

interface QuoteClientSectionProps {
  selectedClient: Client | undefined;
  onClientSelect: (clientId: string | null) => void;
  onClientSaved: (client: Client) => void;
  clientNameInput: string;
  setClientNameInput: (name: string) => void;
  quoteDate: string;
  setQuoteDate: (date: string) => void;
  vehicle: string;
  setVehicle: (vehicle: string) => void;
  rawPhoneNumber: string;
  setRawPhoneNumber: (phone: string) => void;
  address: string;
  setAddress: (address: string) => void;
  observations: string;
  setObservations: (obs: string) => void;
}

export const QuoteClientSection = ({
  selectedClient,
  onClientSelect,
  onClientSaved,
  clientNameInput,
  setClientNameInput,
  quoteDate,
  setQuoteDate,
  vehicle,
  setVehicle,
  rawPhoneNumber,
  setRawPhoneNumber,
  address,
  setAddress,
  observations,
  setObservations,
}: QuoteClientSectionProps) => {
  const [isClientFormDialogOpen, setIsClientFormDialogOpen] = useState(false);

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setRawPhoneNumber(value);
  };

  const handleClientSelectFromAutocomplete = (client: Client) => {
    onClientSelect(client.id); // Seleciona o ID no componente pai
  };

  const handleClientDeselect = () => {
    onClientSelect(null); // Desseleciona o ID no componente pai
  };

  const handleAddClientClick = () => {
    setIsClientFormDialogOpen(true);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2 md:col-span-2 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-primary" />
          <Label className="text-sm font-medium">Dados do Cliente</Label>
        </div>
      </div>

      <div className="md:col-span-2">
        <ClientAutocomplete
          selectedClient={selectedClient}
          onClientSelect={handleClientSelectFromAutocomplete}
          onClientDeselect={handleClientDeselect}
          clientNameInput={clientNameInput}
          setClientNameInput={setClientNameInput}
          onAddClientClick={handleAddClientClick}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="quoteDate">Data do Orçamento</Label>
        <Input
          id="quoteDate"
          type="date"
          value={quoteDate}
          onChange={(e) => setQuoteDate(e.target.value)}
          className="bg-background/50"
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="vehicle">Veículo (Marca/Modelo) *</Label>
        <Input
          id="vehicle"
          value={vehicle}
          onChange={(e) => setVehicle(e.target.value)}
          placeholder="Ex: Honda Civic 2020"
          className="bg-background/50"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Telefone</Label>
        <Input 
          id="phoneNumber" 
          value={formatPhoneNumber(rawPhoneNumber)}
          onChange={handlePhoneNumberChange} 
          placeholder="(XX) XXXXX-XXXX"
          maxLength={15}
          className="bg-background/50 placeholder:text-gray-300" 
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Endereço</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Rua, Número, Cidade"
          className="bg-background/50"
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="observations">Observações Adicionais</Label>
        <Textarea
          id="observations"
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="Informações extras, condições de pagamento, garantia, etc."
          className="bg-background/50 min-h-[100px]"
        />
      </div>

      <ClientFormDialog
        isOpen={isClientFormDialogOpen}
        onClose={() => setIsClientFormDialogOpen(false)}
        onClientSaved={onClientSaved}
      />
    </div>
  );
};