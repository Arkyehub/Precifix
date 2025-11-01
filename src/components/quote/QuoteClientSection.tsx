import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Users, Car, Loader2, Calendar, Clock, Pencil } from "lucide-react"; // Adicionado Pencil
import { Client } from '@/types/clients';
import { Vehicle } from '@/types/vehicles';
import { ClientFormDialog } from '../ClientFormDialog';
import { formatPhoneNumber } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClientAutocomplete } from './ClientAutocomplete';
import { useSession } from '@/components/SessionContextProvider';
import { Checkbox } from '@/components/ui/checkbox';

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
  selectedVehicleId: string | null;
  setSelectedVehicleId: (id: string | null) => void;
  // Novos props para agendamento
  serviceDate: string;
  setServiceDate: (date: string) => void;
  isTimeDefined: boolean;
  setIsTimeDefined: (defined: boolean) => void;
  serviceTime: string;
  setServiceTime: (time: string) => void;
  // Novo prop para controle de obrigatoriedade
  isSale?: boolean;
  isClientRequired: boolean;
  setIsClientRequired: (required: boolean) => void;
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
  selectedVehicleId,
  setSelectedVehicleId,
  // Novos
  serviceDate,
  setServiceDate,
  isTimeDefined,
  setIsTimeDefined,
  serviceTime,
  setServiceTime,
  // Novo
  isSale = false,
  isClientRequired,
  setIsClientRequired,
}: QuoteClientSectionProps) => {
  const { user } = useSession();
  const [isClientFormDialogOpen, setIsClientFormDialogOpen] = useState(false);
  const [showVehicleDetails, setShowVehicleDetails] = useState(false);

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
    enabled: !!selectedClient?.id && !!user && isClientRequired, // Habilitar apenas se o cliente for necessário
  });

  useEffect(() => {
    if (selectedClient) {
      // Se o cliente está selecionado, os campos de texto devem refletir os dados do cliente
      // Mas no modo venda, o QuoteCalculator está controlando o nome/telefone/endereço
      // para que não sejam alterados diretamente se o cliente for selecionado.
      // Aqui, apenas garantimos que o estado local do componente seja limpo se o cliente for deselecionado.
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

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setRawPhoneNumber(value);
  };

  const handleClientSelectFromAutocomplete = (client: Client) => {
    onClientSelect(client.id);
  };

  const handleClientDeselect = () => {
    onClientSelect(null);
    setSelectedVehicleId(null);
  };

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setShowVehicleDetails(true);
  };

  const handleAddClientClick = () => {
    setIsClientFormDialogOpen(true);
  };

  const handleEditClientClick = () => {
    if (selectedClient) {
      setIsClientFormDialogOpen(true);
    }
  };

  const formatPlate = (plate: string | null) => plate ? plate.toUpperCase() : 'N/A';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      
      {/* Seção de Agendamento (Movida para o Topo) */}
      <div className="md:col-span-2 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-primary" />
          <Label className="text-sm font-medium">Data e Hora do Serviço *</Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="serviceDate">Data do Serviço</Label>
        <Input
          id="serviceDate"
          type="date"
          value={serviceDate}
          onChange={(e) => setServiceDate(e.target.value)}
          className="bg-background/50"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="serviceTime">Hora do Serviço</Label>
        <div className="flex items-center gap-2">
          <Checkbox
            id="define-time"
            checked={isTimeDefined}
            onCheckedChange={(checked) => setIsTimeDefined(checked as boolean)}
          />
          <Label htmlFor="define-time" className="text-sm text-muted-foreground">Definir hora</Label>
          <Input
            id="serviceTime"
            type="time"
            value={serviceTime}
            onChange={(e) => setServiceTime(e.target.value)}
            className="bg-background/50"
            disabled={!isTimeDefined}
          />
        </div>
      </div>

      {/* Seção de Cliente */}
      <div className="md:col-span-2 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Dados do Cliente</Label>
            {selectedClient && isClientRequired && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleEditClientClick}
                className="h-6 w-6 text-muted-foreground hover:text-primary"
                title="Editar Cliente"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
          {isSale && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="client-required"
                checked={isClientRequired}
                onCheckedChange={(checked) => {
                  setIsClientRequired(checked as boolean);
                  if (!checked) {
                    // Limpar dados do cliente se não for obrigatório
                    handleClientDeselect();
                    setClientNameInput('');
                  }
                }}
              />
              <Label htmlFor="client-required" className="text-sm text-muted-foreground">
                Informar Cliente
              </Label>
            </div>
          )}
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
          disabled={!isClientRequired} // Desabilitar se não for obrigatório
        />
      </div>

      <div className="space-y-2" style={{ opacity: isClientRequired ? 1 : 0.5 }}>
        <Label htmlFor="phoneNumber">Telefone</Label>
        <Input 
          id="phoneNumber" 
          value={formatPhoneNumber(rawPhoneNumber)}
          onChange={(e) => setRawPhoneNumber(e.target.value.replace(/\D/g, ''))} 
          placeholder="(XX) XXXXX-XXXX"
          maxLength={15}
          className="bg-background/50 placeholder:text-gray-300" 
          disabled={!isClientRequired}
        />
      </div>

      <div className="space-y-2 md:col-span-2" style={{ opacity: isClientRequired ? 1 : 0.5 }}>
        <Label htmlFor="address">Endereço</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Rua, Número, Cidade"
          className="bg-background/50"
          disabled={!isClientRequired}
        />
      </div>

      <div className="md:col-span-2 pt-4 border-t border-border/50" style={{ opacity: isClientRequired ? 1 : 0.5 }}>
        <div className="flex items-center gap-2 mb-2">
          <Car className="h-4 w-4 text-primary" />
          <Label className="text-sm font-medium">Veículo do Cliente</Label>
        </div>
      </div>

      <div className="space-y-2 md:col-span-2" style={{ opacity: isClientRequired ? 1 : 0.5 }}>
        {selectedClient ? (
          <Select 
            value={selectedVehicleId || ''} 
            onValueChange={handleVehicleSelect} 
            disabled={isLoadingVehicles || clientVehicles?.length === 0 || !isClientRequired}
          >
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
            placeholder="Selecione um cliente primeiro para ver veículos"
            className="bg-background/50"
            disabled={!isClientRequired}
          />
        )}
      </div>

      {/* Observações (Movidas para o final do QuoteCalculator) */}
      <ClientFormDialog
        isOpen={isClientFormDialogOpen}
        onClose={() => setIsClientFormDialogOpen(false)}
        client={selectedClient} // Passa o cliente selecionado para edição
        onClientSaved={onClientSaved}
      />
    </div>
  );
};