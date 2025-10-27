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
import { Vehicle } from '@/types/vehicles'; // Nova importação
import { formatCpfCnpj, formatPhoneNumber } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Plus, Trash2 } from 'lucide-react';

interface ClientFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client; // Opcional para edição
  onClientSaved?: (client: Client) => void; // Callback após salvar
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

  const [name, setName] = useState(client?.name || '');
  const [rawDocumentNumber, setRawDocumentNumber] = useState(client?.document_number || '');
  const [rawPhoneNumber, setRawPhoneNumber] = useState(client?.phone_number || '');
  const [email, setEmail] = useState(client?.email || '');
  const [address, setAddress] = useState(client?.address || '');
  const [city, setCity] = useState(client?.city || '');
  const [state, setState] = useState(client?.state || '');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]); // Lista de veículos existentes
  const [newVehicle, setNewVehicle] = useState<NewVehicle>({ brand: '', model: '', plate: '', year: new Date().getFullYear() }); // Novo veículo
  const [showAddVehicle, setShowAddVehicle] = useState(false); // Toggle para mostrar formulário de adicionar veículo

  useEffect(() => {
    if (client) {
      setName(client.name);
      setRawDocumentNumber(client.document_number || '');
      setRawPhoneNumber(client.phone_number || '');
      setEmail(client.email || '');
      setAddress(client.address || '');
      setCity(client.city || '');
      setState(client.state || '');
      // Fetch veículos do cliente se editando
      if (client.id) {
        fetchClientVehicles(client.id);
      }
    } else {
      setName('');
      setRawDocumentNumber('');
      setRawPhoneNumber('');
      setEmail('');
      setAddress('');
      setCity('');
      setState('');
      setVehicles([]); // Limpar veículos para novo cliente
      setNewVehicle({ brand: '', model: '', plate: '', year: new Date().getFullYear() });
      setShowAddVehicle(false);
    }
  }, [client, isOpen]);

  // Fetch veículos do cliente
  const fetchClientVehicles = async (clientId: string) => {
    const { data, error } = await supabase
      .from('client_vehicles')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Erro ao buscar veículos:', error);
    } else {
      setVehicles(data || []);
    }
  };

  const handleDocumentNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setRawDocumentNumber(value);
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setRawPhoneNumber(value);
  };

  // Handlers para novo veículo
  const handleAddVehicleChange = (field: keyof NewVehicle, value: string | number) => {
    setNewVehicle(prev => ({ ...prev, [field]: value }));
  };

  const addVehicleToList = () => {
    if (!newVehicle.brand || !newVehicle.model || !newVehicle.year || newVehicle.year < 1900 || newVehicle.year > new Date().getFullYear() + 1) {
      toast({
        title: "Dados inválidos",
        description: "Preencha marca, modelo e ano válido (1900 a atual +1).",
        variant: "destructive",
      });
      return;
    }
    const vehicleWithId = {
      ...newVehicle,
      id: `temp-${Date.now()}`, // ID temporário para UI
      client_id: client?.id || '', // Será sobrescrito no save
      created_at: new Date().toISOString(),
    } as Vehicle;
    setVehicles(prev => [...prev, vehicleWithId]);
    setNewVehicle({ brand: '', model: '', plate: '', year: new Date().getFullYear() });
    setShowAddVehicle(false);
    toast({ title: "Veículo adicionado!", description: `${newVehicle.brand} ${newVehicle.model} foi adicionado.` });
  };

  const removeVehicleFromList = (id: string) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
  };

  const upsertClientMutation = useMutation({
    mutationFn: async (newClient: Omit<Client, 'created_at'> & { id?: string; vehicles?: Vehicle[] }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      const clientDataToSave = {
        user_id: user.id,
        name: newClient.name,
        document_number: newClient.document_number || null,
        phone_number: newClient.phone_number || null,
        email: newClient.email || null,
        address: newClient.address || null,
        city: newClient.city || null,
        state: newClient.state || null,
      };

      let savedClient;
      if (newClient.id) {
        // Update existing client
        const { data, error } = await supabase
          .from('clients')
          .update(clientDataToSave)
          .eq('id', newClient.id)
          .eq('user_id', user.id)
          .select()
        if (error) throw error;
        if (data.length !== 1) {
          throw new Error(`Unexpected number of rows updated: ${data.length}`);
        }
        savedClient = data[0];
      } else {
        // Insert new client
        const { data, error } = await supabase
          .from('clients')
          .insert(clientDataToSave)
          .select()
        if (error) throw error;
        if (data.length !== 1) {
          throw new Error(`Unexpected number of rows inserted: ${data.length}`);
        }
        savedClient = data[0];
      }

      // Salvar/Atualizar veículos se fornecidos
      if (newClient.vehicles && newClient.vehicles.length > 0 && savedClient) {
        // Deletar veículos antigos se editando
        if (newClient.id) {
          const { error: vehiclesDeleteError } = await supabase.from('client_vehicles').delete().eq('client_id', newClient.id);
          if (vehiclesDeleteError) throw vehiclesDeleteError;
        }

        // Inserir novos veículos
        const vehiclesToInsert = newClient.vehicles.map(v => ({
          client_id: savedClient.id,
          brand: v.brand,
          model: v.model,
          plate: v.plate || null,
          year: v.year,
        }));
        const { error: vehiclesError } = await supabase.from('client_vehicles').insert(vehiclesToInsert);
        if (vehiclesError) throw vehiclesError;
      }

      return savedClient;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients', user?.id] });
      toast({
        title: client ? "Cliente atualizado!" : "Cliente adicionado!",
        description: `${data.name} foi ${client ? 'atualizado' : 'adicionado'} com sucesso.`,
      });
      onClose();
      onClientSaved?.(data);
    },
    onError: (err) => {
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
      user_id: user!.id,
      name,
      document_number: rawDocumentNumber,
      phone_number: rawPhoneNumber,
      email,
      address,
      city,
      state,
      vehicles: vehicles, // Passar veículos para salvar
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-card"> {/* Aumentado para caber veículos */}
        <DialogHeader>
          <DialogTitle>{client ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome/Razão Social *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
          </div>
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
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Endereço Completo</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="bg-background" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado (UF)</Label>
              <Input id="state" value={state} onChange={(e) => setState(e.target.value)} className="bg-background" maxLength={2} />
            </div>
          </div>

          {/* Nova Seção: Veículos */}
          <Collapsible className="space-y-2">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                Veículos Cadastrados ({vehicles.length})
                <ChevronDown className={`h-4 w-4 transition-transform ${showAddVehicle ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {vehicles.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                      <div>
                        <p className="font-medium">{vehicle.brand} {vehicle.model}</p>
                        <p className="text-sm text-muted-foreground">Placa: {vehicle.plate || 'N/A'} | Ano: {vehicle.year}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeVehicleFromList(vehicle.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhum veículo cadastrado.</p>
              )}
              {/* Formulário para adicionar novo veículo */}
              <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                <Button
                  variant="ghost"
                  onClick={() => setShowAddVehicle(!showAddVehicle)}
                  className="w-full justify-start h-auto p-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {showAddVehicle ? 'Cancelar Adicionar Veículo' : 'Adicionar Novo Veículo'}
                </Button>
                {showAddVehicle && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
                    <div className="space-y-1">
                      <Label htmlFor="vehicle-brand">Marca *</Label>
                      <Input
                        id="vehicle-brand"
                        value={newVehicle.brand}
                        onChange={(e) => handleAddVehicleChange('brand', e.target.value)}
                        placeholder="Ex: Honda"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="vehicle-model">Modelo *</Label>
                      <Input
                        id="vehicle-model"
                        value={newVehicle.model}
                        onChange={(e) => handleAddVehicleChange('model', e.target.value)}
                        placeholder="Ex: Civic"
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="vehicle-plate">Placa</Label>
                      <Input
                        id="vehicle-plate"
                        value={newVehicle.plate}
                        onChange={(e) => handleAddVehicleChange('plate', e.target.value.toUpperCase())}
                        placeholder="Ex: ABC-1234"
                        maxLength={8}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="vehicle-year">Ano *</Label>
                      <Input
                        id="vehicle-year"
                        type="number"
                        value={newVehicle.year}
                        onChange={(e) => handleAddVehicleChange('year', parseInt(e.target.value) || 0)}
                        min={1900}
                        max={new Date().getFullYear() + 1}
                        className="bg-background"
                      />
                    </div>
                    <Button
                      onClick={addVehicleToList}
                      className="md:col-span-4 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Adicionar Veículo
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={upsertClientMutation.isPending}>
            {upsertClientMutation.isPending ? (client ? "Salvando..." : "Adicionando...") : (client ? "Salvar Alterações" : "Adicionar Cliente")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};