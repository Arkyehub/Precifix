import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Client } from '@/types/clients';
import { Vehicle } from '@/types/vehicles';
import { formatCpfCnpj, formatPhoneNumber, formatCep } from '@/lib/utils';
import {
  // Removido Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import { ChevronDown, Plus, Trash2, Pencil, Loader2, X } from 'lucide-react';

interface ClientFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client;
  onClientSaved?: (client: Client) => void;
}

interface NewVehicle {
  brand: string;
  model: string;
  plate: string;
  year: number;
}

export const ClientFormDialog = ({ isOpen, onClose, client, onClientSaved }: ClientFormDialogProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [rawDocumentNumber, setRawDocumentNumber] = useState('');
  const [rawPhoneNumber, setRawPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [rawZipCode, setRawZipCode] = useState(''); // Novo estado para CEP
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState(''); // NOVO ESTADO PARA NÚMERO
  const [complement, setComplement] = useState(''); // Novo estado para Complemento
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [newVehicle, setNewVehicle] = useState<NewVehicle>({ brand: '', model: '', plate: '', year: new Date().getFullYear() });
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [initialVehicles, setInitialVehicles] = useState<Vehicle[]>([]);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (client) {
        setName(client.name);
        setRawDocumentNumber(client.document_number || '');
        setRawPhoneNumber(client.phone_number || '');
        setEmail(client.email || '');
        setRawZipCode(client.zip_code || ''); // Carregar CEP
        setAddress(client.address || '');
        setComplement(client.complement || ''); // Carregar Complemento
        setCity(client.city || '');
        setState(client.state || '');
        // @ts-ignore - Carregar address_number
        setAddressNumber(client.address_number || ''); 
        
        if (client.id) {
          fetchClientVehicles(client.id);
        }
      } else {
        // Reset form for new client
        setName('');
        setRawDocumentNumber('');
        setRawPhoneNumber('');
        setEmail('');
        setRawZipCode('');
        setAddress('');
        setAddressNumber(''); // Resetar Número
        setComplement('');
        setCity('');
        setState('');
        setVehicles([]);
        setInitialVehicles([]);
      }
      // Reset vehicle form states
      setNewVehicle({ brand: '', model: '', plate: '', year: new Date().getFullYear() });
      setShowAddVehicle(false);
      setEditingVehicle(null);
    }
  }, [client, isOpen]);

  const fetchClientVehicles = async (clientId: string) => {
    const { data, error } = await supabase
      .from('client_vehicles')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Erro ao buscar veículos:', error);
      toast({ title: "Erro", description: "Não foi possível carregar os veículos do cliente.", variant: "destructive" });
    } else {
      setVehicles(data || []);
      setInitialVehicles(data || []); // Salva a lista inicial
    }
  };

  const fetchAddressByZipCode = async (cep: string) => {
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length !== 8) return;

    setIsFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP e tente novamente.",
          variant: "destructive",
        });
        setAddress('');
        setCity('');
        setState('');
        setComplement('');
        return;
      }

      setAddress(data.logradouro || '');
      setComplement(data.complemento || '');
      setCity(data.localidade || '');
      setState(data.uf || '');
      
      if (data.logradouro) {
        toast({
          title: "Endereço preenchido!",
          description: "O endereço foi preenchido automaticamente com base no CEP.",
        });
      }
    } catch (err: any) {
      console.error("Error fetching address by CEP:", err);
      toast({
        title: "Erro ao buscar CEP",
        description: "Não foi possível buscar o endereço. Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setRawZipCode(value);
  };

  const handleZipCodeBlur = () => {
    if (rawZipCode.length === 8) {
      fetchAddressByZipCode(rawZipCode);
    }
  };

  const handleDocumentNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRawDocumentNumber(e.target.value.replace(/\D/g, ''));
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRawPhoneNumber(e.target.value.replace(/\D/g, ''));
  };

  const handleAddVehicleChange = (field: keyof NewVehicle, value: string | number) => {
    if (editingVehicle) {
      setEditingVehicle(prev => prev ? { ...prev, [field]: value } : null);
    } else {
      setNewVehicle(prev => ({ ...prev, [field]: value }));
    }
  };

  const resetVehicleForm = () => {
    setNewVehicle({ brand: '', model: '', plate: '', year: new Date().getFullYear() });
    setEditingVehicle(null);
    setShowAddVehicle(false);
  };

  const addVehicleToList = () => {
    const vehicleData = editingVehicle || newVehicle;
    
    if (!vehicleData.brand || !vehicleData.model || vehicleData.year < 1900 || vehicleData.year > new Date().getFullYear() + 1) {
      toast({
        title: "Dados inválidos",
        description: "Preencha marca, modelo e ano válido (1900 a atual +1).",
        variant: "destructive",
      });
      return;
    }

    if (editingVehicle) {
      // Save edited vehicle
      setVehicles(prev => prev.map(v => v.id === editingVehicle.id ? editingVehicle : v));
      toast({ title: "Veículo atualizado!", description: `${editingVehicle.brand} ${editingVehicle.model} foi atualizado.` });
    } else {
      // Add new vehicle
      const vehicleWithId: Vehicle = {
        ...newVehicle,
        id: `temp-${Date.now()}`, // ID temporário para novos veículos
        client_id: client?.id || '',
        created_at: new Date().toISOString(),
      };
      setVehicles(prev => [vehicleWithId, ...prev]);
      toast({ title: "Veículo adicionado!", description: `${newVehicle.brand} ${newVehicle.model} foi adicionado à lista.` });
    }
    
    resetVehicleForm();
  };

  const startEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setShowAddVehicle(true);
  };

  const removeVehicleFromList = (id: string) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
    if (editingVehicle?.id === id) {
      resetVehicleForm();
    }
  };

  const upsertClientMutation = useMutation({
    mutationFn: async (clientPayload: {
      id?: string;
      name: string;
      document_number: string;
      phone_number: string;
      email: string;
      zip_code: string;
      address: string;
      address_number: string; // NOVO CAMPO
      complement: string;
      city: string;
      state: string;
      vehicles: Vehicle[];
    }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      const { vehicles: currentVehicles, ...clientDetails } = clientPayload;
      const clientData = {
        name: clientDetails.name,
        user_id: user.id,
        document_number: clientDetails.document_number || null,
        phone_number: clientDetails.phone_number || null,
        email: clientDetails.email || null,
        zip_code: clientDetails.zip_code || null,
        address: clientDetails.address || null,
        address_number: clientDetails.address_number || null, // NOVO CAMPO
        complement: clientDetails.complement || null,
        city: clientDetails.city || null,
        state: clientDetails.state || null,
      };

      let savedClient: Client;

      // Step 1: Upsert the client
      if (clientPayload.id) {
        const { data, error } = await supabase.from('clients').update(clientData).eq('id', clientPayload.id).select().single();
        if (error) throw new Error(`Erro ao atualizar cliente: ${error.message}`);
        savedClient = data;
      } else {
        const { data, error } = await supabase.from('clients').insert(clientData).select().single();
        if (error) throw new Error(`Erro ao adicionar cliente: ${error.message}`);
        savedClient = data;
      }

      // Step 2: Handle Vehicle Synchronization
      const vehiclesToUpsert = currentVehicles
        .filter(v => !v.id.startsWith('temp-')) // Apenas veículos com ID real ou que serão inseridos
        .map(vehicle => ({
          id: vehicle.id.startsWith('temp-') ? undefined : vehicle.id, // Usar undefined para novos inserts
          client_id: savedClient.id,
          brand: vehicle.brand,
          model: vehicle.model,
          plate: vehicle.plate || null,
          year: vehicle.year,
        }));

      const vehiclesToInsert = currentVehicles
        .filter(v => v.id.startsWith('temp-')) // Apenas novos veículos (com ID temporário)
        .map(vehicle => ({
          client_id: savedClient.id,
          brand: vehicle.brand,
          model: vehicle.model,
          plate: vehicle.plate || null,
          year: vehicle.year,
        }));

      // Upsert existing/updated vehicles
      if (vehiclesToUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from('client_vehicles')
          .upsert(vehiclesToUpsert, { onConflict: 'id' });
        if (upsertError) throw new Error(`Erro ao atualizar veículos: ${upsertError.message}`);
      }

      // Insert new vehicles
      if (vehiclesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('client_vehicles')
          .insert(vehiclesToInsert);
        if (insertError) throw new Error(`Erro ao inserir novos veículos: ${insertError.message}`);
      }

      // Identify vehicles to delete (those in initialVehicles but not in currentVehicles, and have a real ID)
      const currentRealIds = new Set(currentVehicles.filter(v => !v.id.startsWith('temp-')).map(v => v.id));
      const idsToDelete = initialVehicles
        .filter(v => !currentRealIds.has(v.id))
        .map(v => v.id);

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('client_vehicles')
          .delete()
          .in('id', idsToDelete);
        if (deleteError && deleteError.code !== '23503') { 
            throw new Error(`Erro ao limpar veículos antigos: ${deleteError.message}`);
        }
      }

      return savedClient;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['clientsWithVehicles', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['clientVehicles', data.id] });
      toast({
        title: client ? "Cliente atualizado!" : "Cliente adicionado!",
        description: `${data.name} foi ${client ? 'atualizado' : 'adicionado'} com sucesso.`,
      });
      onClose();
      onClientSaved?.(data);
    },
    onError: (err: Error) => {
      toast({
        title: client ? "Erro ao atualizar cliente" : "Erro ao adicionar cliente",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!name) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do cliente é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    upsertClientMutation.mutate({
      id: client?.id,
      name,
      document_number: rawDocumentNumber,
      phone_number: rawPhoneNumber,
      email,
      zip_code: rawZipCode,
      address,
      address_number: addressNumber, // NOVO CAMPO
      complement,
      city,
      state,
      vehicles: vehicles,
    });
  };

  const currentVehicleData = editingVehicle || newVehicle;
  const isEditingVehicle = !!editingVehicle;

  // Função para alternar a exibição do formulário de adição/edição de veículo
  const toggleAddVehicleForm = () => {
    if (showAddVehicle) {
      resetVehicleForm(); // Limpa o formulário se estiver fechando
    } else {
      setShowAddVehicle(true);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-card">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
          
          {/* Nome/Razão Social (Largura total) */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome/Razão Social *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
          </div>
          
          {/* CPF/CNPJ e Telefone (50/50) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="document-number">CPF/CNPJ</Label>
              <Input 
                id="document-number" 
                value={formatCpfCnpj(rawDocumentNumber)}
                onChange={handleDocumentNumberChange} 
                maxLength={18}
                className="bg-background" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-number">Telefone</Label>
              <Input 
                id="phone-number" 
                value={formatPhoneNumber(rawPhoneNumber)}
                onChange={handlePhoneNumberChange} 
                maxLength={15}
                className="bg-background" 
              />
            </div>
          </div>
          
          {/* CEP e E-mail (50/50) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="zip-code">CEP</Label>
              <div className="relative">
                <Input 
                  id="zip-code" 
                  value={formatCep(rawZipCode)}
                  onChange={handleZipCodeChange} 
                  onBlur={handleZipCodeBlur}
                  maxLength={9}
                  className="bg-background" 
                  placeholder="Ex: 00000-000"
                  disabled={isFetchingCep}
                />
                {isFetchingCep && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-background" />
            </div>
          </div>

          {/* Endereço e Número (Largura total, mas com divisão interna 3/4 e 1/4) */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2 col-span-3">
              <Label htmlFor="address">Endereço (Rua, Bairro)</Label>
              <Input 
                id="address" 
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
                className="bg-background"
              />
            </div>
            <div className="space-y-2 col-span-1">
              <Label htmlFor="address-number">Número</Label>
              <Input 
                id="address-number" 
                value={addressNumber} 
                onChange={(e) => setAddressNumber(e.target.value)} 
                className="bg-background" 
              />
            </div>
          </div>

          {/* Complemento (Largura total) */}
          <div className="space-y-2">
            <Label htmlFor="complement">Complemento</Label>
            <Input id="complement" value={complement} onChange={(e) => setComplement(e.target.value)} className="bg-background" />
          </div>

          {/* Cidade e Estado (50/50) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado (UF)</Label>
              <Input id="state" value={state} onChange={(e) => setState(e.target.value.toUpperCase())} className="bg-background" maxLength={2} />
            </div>
          </div>

          {/* Seção de Veículos - Título e Botão de Ação (REESTRUTURADO) */}
          <div className="flex items-center justify-between w-full mt-4">
            <h4 className="text-sm font-medium text-foreground">
              Veículos Cadastrados ({vehicles.length})
            </h4>
            <Button 
              type="button"
              size="icon" 
              onClick={toggleAddVehicleForm}
              className={showAddVehicle ? 
                "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : 
                "bg-primary hover:bg-primary-glow text-primary-foreground"
              }
              title={showAddVehicle ? "Cancelar Adição" : "Adicionar Novo Veículo"}
            >
              {showAddVehicle ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>

          {/* Conteúdo dos Veículos (Lista e Formulário) */}
          <div className="space-y-2">
            {vehicles.length > 0 && (
              <div className="space-y-2 mb-4">
                {vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                    <div>
                      <p className="font-medium">{vehicle.brand} {vehicle.model}</p>
                      <p className="text-sm text-muted-foreground">Placa: {vehicle.plate || 'N/A'} | Ano: {vehicle.year}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditVehicle(vehicle)}
                        className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                        title="Editar veículo"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeVehicleFromList(vehicle.id)}
                        className="text-destructive hover:bg-destructive/10"
                        title="Excluir veículo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(showAddVehicle || isEditingVehicle) && (
              <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                <h4 className="font-semibold text-foreground">
                  {isEditingVehicle ? `Editando Veículo: ${editingVehicle.brand} ${editingVehicle.model}` : 'Adicionar Novo Veículo'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="vehicle-brand">Marca *</Label>
                    <Input 
                      id="vehicle-brand" 
                      value={currentVehicleData.brand} 
                      onChange={(e) => handleAddVehicleChange('brand', e.target.value)} 
                      placeholder="Ex: Honda" 
                      className="bg-background" 
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="vehicle-model">Modelo *</Label>
                    <Input 
                      id="vehicle-model" 
                      value={currentVehicleData.model} 
                      onChange={(e) => handleAddVehicleChange('model', e.target.value)} 
                      placeholder="Ex: Civic" 
                      className="bg-background" 
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="vehicle-plate">Placa</Label>
                    <Input 
                      id="vehicle-plate" 
                      value={currentVehicleData.plate} 
                      onChange={(e) => handleAddVehicleChange('plate', e.target.value.toUpperCase())} 
                      placeholder="Ex: ABC1D23" 
                      maxLength={7} 
                      className="bg-background" 
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="vehicle-year">Ano *</Label>
                    <Input 
                      id="vehicle-year" 
                      type="number" 
                      value={currentVehicleData.year} 
                      onChange={(e) => handleAddVehicleChange('year', parseInt(e.target.value) || 0)} 
                      min={1900} 
                      max={new Date().getFullYear() + 1} 
                      className="bg-background" 
                    />
                  </div>
                  <Button onClick={addVehicleToList} className="md:col-span-4">
                    {isEditingVehicle ? 'Salvar Alterações do Veículo' : 'Adicionar Veículo à Lista'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={upsertClientMutation.isPending}>
            {upsertClientMutation.isPending ? "Salvando..." : (client ? "Salvar Alterações" : "Adicionar Cliente")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};