import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Users, Car, Loader2 } from "lucide-react"; // Adicionado Loader2
import { Client } from '@/types/clients';
import { Vehicle } from '@/types/vehicles'; // Nova importação
import { ClientFormDialog } from '../ClientFormDialog';
import { formatPhoneNumber } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClientAutocomplete } from './ClientAutocomplete';
import { useSession } from '@/components/SessionContextProvider'; // Import adicionado

interface QuoteClientSectionProps {
  selectedClient: Client | undefined;
  onClientSelect: (clientId: string | null) => void;
  onClientSaved: (client: Client) => void;
  clientNameInput: string;
  setClientNameInput: (name: string) => void;
  quoteDate: string;
  setQuoteDate: (date: string) => void;
  rawPhoneNumber: string;
  setRawPhoneNumber: (phone: string) => void;
  address: string;
  setAddress: (address: string) => void;
  observations: string;
  setObservations: (obs: string) => void;
  // Novos props para veículos
  selectedVehicleId: string | null;
  setSelectedVehicleId: (id: string | null) => void;
}

export const QuoteClientSection = ({
  selectedClient,
  onClientSelect,
  onClientSaved,
  clientNameInput,
  setClientNameInput,
  quoteDate,
  setQuoteDate,
  rawPhoneNumber,
  setRawPhoneNumber,
  address,
  setAddress,
  observations,
  setObservations,
  // Novos
  selectedVehicleId,
  setSelectedVehicleId,
}: QuoteClientSectionProps) => {
  const { user } = useSession(); // Import adicionado
  const [isClientFormDialogOpen, setIsClientFormDialogOpen] = useState(false);
  const [showVehicleDetails, setShowVehicleDetails] = useState(false); // Toggle para mostrar/esconder detalhes do veículo

  // Fetch veículos do cliente selecionado
  const { data: clientVehicles, isLoading: isLoadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ['clientVehicles', selectedClient?.id],
    queryFn: async () => {
      if (!selectedClient?.id || !user) return [];
      const { data, error } = await supabase
        .from('client_vehicles')
        .select('*')
        .eq('client_id', selectedClient.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Erro ao buscar veículos:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!selectedClient?.id && !!user,
  });

  // Efeito para sincronizar campos de input com o cliente selecionado
  useEffect(() => {
    if (selectedClient) {
      setClientNameInput(selectedClient.name);
      setRawPhoneNumber(selectedClient.phone_number || '');
      setAddress(selectedClient.address || '');
      // Não limpamos selectedVehicleId aqui, pois é independente
    } else {
      if (!clientNameInput) {
        setRawPhoneNumber('');
        setAddress('');
        setSelectedVehicleId(null); // Limpar veículo selecionado se cliente for deselecionado
      }
    }
  }, [selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setRawPhoneNumber(value);
  };

  const handleClientSelectFromAutocomplete = (client: Client) => {
    onClientSelect(client.id); // Seleciona o ID no componente pai
  };

  const handleClientDeselect = () => {
    onClientSelect(null); // Desseleciona o ID no componente pai
    setSelectedVehicleId(null); // Limpa veículo selecionado
  };

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    const vehicle = clientVehicles?.find(v => v.id === vehicleId);
    if (vehicle) {
      // Preencher campos manuais se necessário, mas como é seletor, os detalhes são mostrados abaixo
      setShowVehicleDetails(true);
    }
  };

  const handleAddClientClick = () => {
    setIsClientFormDialogOpen(true);
  };

  // Formatar placa para exibição (ex: ABC-1A23)
  const formatPlate = (plate: string | null) => plate ? plate.toUpperCase() : 'N/A';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2 pt-4 border-t border-border/50">
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

      {/* Novo Seletor de Veículo */}
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="vehicle-select">Selecionar Veículo do Cliente</Label>
        {selectedClient ? (
          <Select value={selectedVehicleId || ''} onValueChange={handleVehicleSelect} disabled={isLoadingVehicles || clientVehicles?.length === 0}>
            <SelectTrigger className="bg-background/50">
              <SelectValue placeholder={clientVehicles?.length > 0 ? "Escolha um veículo" : "Cliente sem veículos cadastrados"} />
            </SelectTrigger>
            <SelectContent>
              {isLoadingVehicles ? (
                <SelectItem value="loading" disabled>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Carregando veículos...
                </SelectItem>
              ) : clientVehicles && clientVehicles.length > 0 ? (
                clientVehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.brand} {vehicle.model} - {formatPlate(vehicle.plate)} ({vehicle.year})
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-vehicles" disabled>
                  Nenhum veículo cadastrado. Adicione no perfil do cliente.
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="vehicle-select"
            placeholder="Selecione um cliente primeiro para ver veículos"
            className="bg-background/50"
            disabled
          />
        )}
        {/* Caixa de Informações do Veículo Selecionado */}
        {selectedVehicleId && selectedClient && (
          <div className="mt-2 p-3 bg-primary/10 rounded-md border border-primary/30">
            <p className="text-sm font-medium text-foreground">Detalhes do Veículo:</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Marca:</span> {clientVehicles?.find(v => v.id === selectedVehicleId)?.brand || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Modelo:</span> {clientVehicles?.find(v => v.id === selectedVehicleId)?.model || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Placa:</span> {formatPlate(clientVehicles?.find(v => v.id === selectedVehicleId)?.plate)}
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Ano:</span> {clientVehicles?.find(v => v.id === selectedVehicleId)?.year || 'N/A'}
            </p>
          </div>
        )}
        {!selectedClient && (
          <p className="text-xs text-muted-foreground mt-1">
            Selecione um cliente para escolher um veículo cadastrado, ou adicione veículos no perfil do cliente.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Telefone</Label>
        <Input 
          id="phoneNumber" 
          value={formatPhoneNumber(rawPhoneNumber)}
          onChange={(e) => setRawPhoneNumber(e.target.value.replace(/\D/g, ''))} 
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