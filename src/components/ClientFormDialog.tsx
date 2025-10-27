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
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [newVehicle, setNewVehicle] = useState<NewVehicle>({ brand: '', model: '', plate: '', year: new Date().getFullYear() });
  const [showAddVehicle, setShowAddVehicle] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (client) {
        setName(client.name);
        setRawDocumentNumber(client.document_number || '');
        setRawPhoneNumber(client.phone_number || '');
        setEmail(client.email || '');
        setAddress(client.address || '');
        setCity(client.city || '');
        setState(client.state || '');
        if (client.id) {
          fetchClientVehicles(client.id);
        }
      } else {
        // Reset form for new client
        setName('');
        setRawDocumentNumber('');
        setRawPhoneNumber('');
        setEmail('');
        setAddress('');
        setCity('');
        setState('');
        setVehicles([]);
        setNewVehicle({ brand: '', model: '', plate: '', year: new Date().getFullYear() });
        setShowAddVehicle(false);
      }
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
    }
  };

  const handleDocumentNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRawDocumentNumber(e.target.value.replace(/\D/g, ''));
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRawPhoneNumber(e.target.value.replace(/\D/g, ''));
  };

  const handleAddVehicleChange = (field: keyof NewVehicle, value: string | number) => {
    setNewVehicle(prev => ({ ...prev, [field]: value }));
  };

  const addVehicleToList = () => {
    if (!newVehicle.brand || !newVehicle.model || newVehicle.year < 1900 || newVehicle.year > new Date().getFullYear() + 1) {
      toast({
        title: "Dados inválidos",
        description: "Preencha marca, modelo e ano válido (1900 a atual +1).",
        variant: "destructive",
      });
      return;
    }
    const vehicleWithId: Vehicle = {
      ...newVehicle,
      id: `temp-${Date.now()}`,
      client_id: client?.id || '',
      created_at: new Date().toISOString(),
    };
    setVehicles(prev => [vehicleWithId, ...prev]);
    setNewVehicle({ brand: '', model: '', plate: '', year: new Date().getFullYear() });
    setShowAddVehicle(false);
    toast({ title: "Veículo adicionado!", description: `${newVehicle.brand} ${newVehicle.model} foi adicionado à lista.` });
  };

  const removeVehicleFromList = (id: string) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
  };

  const upsertClientMutation = useMutation({
    mutationFn: async (clientPayload: {
      id?: string;
      name: string;
      document_number: string;
      phone_number: string;
      email: string;
      address: string;
      city: string;
      state: string;
      vehicles: Vehicle[];
    }) => {
      if (!user || !user.id) {
        throw new Error("Usuário não autenticado ou ID do usuário ausente.");
      }

      const { vehicles: clientVehicles, ...clientDetails } = clientPayload;

      const clientData = {
        name: clientDetails.name,
        user_id: user.id,
        document_number: clientDetails.document_number || null,
        phone_number: clientDetails.phone_number || null,
        email: clientDetails.email || null,
        address: clientDetails.address || null,
        city: clientDetails.city || null,
        state: clientDetails.state || null,
      };

      let savedClient: Client;

      if (clientPayload.id) {
        // --- UPDATE existing client ---
        const { data, error: clientError } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', clientPayload.id)
          .select()
          .single();

        if (clientError) {
          console.error("Supabase client update error:", clientError);
          throw new Error(`Erro ao atualizar cliente: ${clientError.message}`);
        }
        savedClient = data;

        // Delete old vehicles before inserting new ones
        const { error: vehiclesDeleteError } = await supabase
          .from('client_vehicles')
          .delete()
          .eq('client_id', savedClient.id);

        if (vehiclesDeleteError) {
          console.error("Supabase vehicle delete error:", vehiclesDeleteError);
          throw new Error(`Erro ao limpar veículos antigos: ${vehiclesDeleteError.message}`);
        }
      } else {
        // --- CREATE new client ---
        const { data, error: clientError } = await supabase
          .from('clients')
          .insert(clientData)
          .select()
          .single();

        if (clientError) {
          console.error("Supabase client insert error:", clientError);
          throw new Error(`Erro ao adicionar cliente: ${clientError.message}`);
        }
        savedClient = data;
      }

      // --- INSERT vehicles for both new and updated clients ---
      if (clientVehicles && clientVehicles.length > 0) {
        const vehiclesToInsert = clientVehicles.map(v => ({
          client_id: savedClient.id,
          brand: v.brand,
          model: v.model,
          plate: v.plate || null,
          year: v.year,
        }));

        // Insert one by one to avoid potential bulk insert issues with RLS
        for (const vehicle of vehiclesToInsert) {
          const { error: vehiclesInsertError } = await supabase
            .from('client_vehicles')
            .insert(vehicle);

          if (vehiclesInsertError) {
            console.error("Supabase vehicle insert error:", vehiclesInsertError);
            // If a vehicle fails, we should ideally roll back the client creation,
            // but for now, we'll throw an error to notify the user.
            throw new Error(`Erro ao salvar o veículo ${vehicle.brand} ${vehicle.model}: ${vehiclesInsertError.message}`);
          }
        }
      }

      return savedClient;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['clientsWithVehicles', user?.id] });
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
      address,
      city,
      state,
      vehicles: vehicles,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-card">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
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
              <Input id="state" value={state} onChange={(e) => setState(e.target.value.toUpperCase())} className="bg-background" maxLength={2} />
            </div>
          </div>

          <Collapsible className="space-y-2">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                Veículos Cadastrados ({vehicles.length})
                <ChevronDown className="h-4 w-4 transition-transform" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {vehicles.length > 0 && (
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
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                <Button
                  variant="ghost"
                  onClick={() => setShowAddVehicle(!showAddVehicle)}
                  className="w-full justify-start h-auto p-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {showAddVehicle ? 'Cancelar' : 'Adicionar Novo Veículo'}
                </Button>
                {showAddVehicle && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="vehicle-brand">Marca *</Label>
                      <Input id="vehicle-brand" value={newVehicle.brand} onChange={(e) => handleAddVehicleChange('brand', e.target.value)} placeholder="Ex: Honda" className="bg-background" />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="vehicle-model">Modelo *</Label>
                      <Input id="vehicle-model" value={newVehicle.model} onChange={(e) => handleAddVehicleChange('model', e.target.value)} placeholder="Ex: Civic" className="bg-background" />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="vehicle-plate">Placa</Label>
                      <Input id="vehicle-plate" value={newVehicle.plate} onChange={(e) => handleAddVehicleChange('plate', e.target.value.toUpperCase())} placeholder="Ex: ABC1D23" maxLength={7} className="bg-background" />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="vehicle-year">Ano *</Label>
                      <Input id="vehicle-year" type="number" value={newVehicle.year} onChange={(e) => handleAddVehicleChange('year', parseInt(e.target.value) || 0)} min={1900} max={new Date().getFullYear() + 1} className="bg-background" />
                    </div>
                    <Button onClick={addVehicleToList} className="md:col-span-4">
                      Adicionar Veículo à Lista
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
            {upsertClientMutation.isPending ? "Salvando..." : (client ? "Salvar Alterações" : "Adicionar Cliente")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};