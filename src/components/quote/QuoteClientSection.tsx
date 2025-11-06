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
import { cn } from '@/lib/utils'; // Importar cn para classes dinâmicas

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
  addressNumber: string; // NOVO
  setAddressNumber: (number: string) => void; // NOVO
  complement: string; // NOVO
  setComplement: (complement: string) => void; // NOVO
  observations: string;
  setObservations: (obs: string) => void;
  selectedVehicleId: string | null;
  setSelectedVehicleId: (id: string | null) => void;
  manualVehicleInput: string; // NOVO: Input manual para veículo
  setManualVehicleInput: (vehicle: string) => void; // NOVO: Setter para input manual
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
  addressNumber, // NOVO
  setAddressNumber, // NOVO
  complement, // NOVO
  setComplement, // NOVO
  observations,
  setObservations,
  selectedVehicleId,
  setSelectedVehicleId,
  manualVehicleInput, // NOVO
  setManualVehicleInput, // NOVO
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

  // Estado local para telefone e endereço, que serão preenchidos pelo selectedClient
  const [localRawPhoneNumber, setLocalRawPhoneNumber] = useState(rawPhoneNumber);
  const [localAddress, setLocalAddress] = useState(address);
  const [localAddressNumber, setLocalAddressNumber] = useState(addressNumber);
  const [localComplement, setLocalComplement] = useState(complement);

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
      // Atualiza os estados locais e os estados do pai (QuoteCalculator)
      setLocalRawPhoneNumber(selectedClient.phone_number || '');
      setLocalAddress(selectedClient.address || '');
      setLocalAddressNumber(selectedClient.address_number || '');
      setLocalComplement(selectedClient.complement || '');

      setRawPhoneNumber(selectedClient.phone_number || ''); // Atualiza o estado do pai
      setAddress(selectedClient.address || ''); // Atualiza o estado do pai
      setAddressNumber(selectedClient.address_number || ''); // Atualiza o estado do pai
      setComplement(selectedClient.complement || ''); // Atualiza o estado do pai
    } else {
      // Se o cliente for deselecionado, limpa os campos
      if (isClientRequired) {
        setLocalRawPhoneNumber('');
        setLocalAddress('');
        setLocalAddressNumber('');
        setLocalComplement('');

        setRawPhoneNumber('');
        setAddress('');
        setAddressNumber('');
        setComplement('');
      }
      if (typeof setSelectedVehicleId === 'function') {
        setSelectedVehicleId(null);
      }
    }
  }, [selectedClient, isClientRequired]); // Depende de selectedClient e isClientRequired

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

  // Determina se os campos de telefone e endereço devem ser editáveis
  const isContactInfoEditable = !selectedClient && isClientRequired;

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
            onCheckedChange={(checked) => {
              const isChecked = checked as boolean;
              setIsTimeDefined(isChecked);
              if (!isChecked) {
                setServiceTime(''); // Limpa o tempo se desmarcado
              }
            }}
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

      {/* Seção de Cliente - Cabeçalho e Checkbox */}
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
                  const required = checked as boolean;
                  setIsClientRequired(required);
                  if (!required) {
                    // Limpar dados do cliente se não for obrigatório
                    handleClientDeselect();
                    setClientNameInput('Consumidor Final'); // Define nome padrão para venda rápida
                    setManualVehicleInput(''); // Limpa veículo manual
                  } else {
                    setClientNameInput(''); // Limpa nome se voltar a ser obrigatório
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

      {/* Conteúdo do Cliente (Condicional) */}
      {isClientRequired ? (
        <>
          <div className="md:col-span-2">
            <ClientAutocomplete
              selectedClient={selectedClient}
              onClientSelect={handleClientSelectFromAutocomplete}
              onClientDeselect={handleClientDeselect}
              clientNameInput={clientNameInput}
              setClientNameInput={setClientNameInput}
              onAddClientClick={handleAddClientClick}
              disabled={!isClientRequired}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Telefone</Label>
            <Input 
              id="phoneNumber" 
              value={formatPhoneNumber(localRawPhoneNumber)}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setLocalRawPhoneNumber(value);
                setRawPhoneNumber(value); // Atualiza o estado do pai
              }} 
              placeholder="(XX) XXXXX-XXXX"
              maxLength={15}
              className="bg-background/50 placeholder:text-gray-300" 
              disabled={!isContactInfoEditable} // Desabilitar se o cliente estiver selecionado
            />
          </div>

          {/* NOVO LAYOUT DE ENDEREÇO: Grid de 10 colunas (5/1/4) */}
          <div className="md:col-span-2 grid grid-cols-10 gap-4">
            {/* Endereço (50% -> col-span-5) */}
            <div className="space-y-2 col-span-5">
              <Label htmlFor="address">Endereço (Rua, Bairro)</Label>
              <Input
                id="address"
                value={localAddress}
                onChange={(e) => {
                  setLocalAddress(e.target.value);
                  setAddress(e.target.value); // Atualiza o estado do pai
                }}
                placeholder="Rua, Bairro, Cidade"
                className="bg-background/50"
                disabled={!isContactInfoEditable}
              />
            </div>

            {/* Número (10% -> col-span-1) */}
            <div className="space-y-2 col-span-1">
              <Label htmlFor="addressNumber">Nº</Label>
              <Input
                id="addressNumber"
                value={localAddressNumber}
                onChange={(e) => {
                  setLocalAddressNumber(e.target.value);
                  setAddressNumber(e.target.value); // Atualiza o estado do pai
                }}
                placeholder="S/N"
                className="bg-background/50"
                disabled={!isContactInfoEditable}
              />
            </div>

            {/* Complemento (40% -> col-span-4) */}
            <div className="space-y-2 col-span-4">
              <Label htmlFor="complement">Complemento</Label>
              <Input
                id="complement"
                value={localComplement}
                onChange={(e) => {
                  setLocalComplement(e.target.value);
                  setComplement(e.target.value); // Atualiza o estado do pai
                }}
                placeholder="Apto, Bloco, etc."
                className="bg-background/50"
                disabled={!isContactInfoEditable}
              />
            </div>
          </div>
          {/* FIM NOVO LAYOUT DE ENDEREÇO */}

          <div className="md:col-span-2 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Car className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Veículo do Cliente</Label>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
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
        </>
      ) : (
        // Modo Venda Rápida (isClientRequired = false)
        <>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="clientName">Nome do Cliente</Label>
            <Input
              id="clientName"
              value={clientNameInput}
              onChange={(e) => setClientNameInput(e.target.value)}
              placeholder="Consumidor Final"
              className="bg-background/50"
              disabled={true} // Desabilitar o input, pois é preenchido automaticamente
            />
          </div>
          
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Car className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Veículo (Venda Rápida) *</Label>
            </div>
            <Input
              id="manualVehicle"
              value={manualVehicleInput}
              onChange={(e) => setManualVehicleInput(e.target.value)}
              placeholder="Ex: Carro Pequeno, Moto, etc."
              className="bg-background/50"
            />
          </div>
        </>
      )}

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