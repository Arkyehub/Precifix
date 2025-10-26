import React, { useState, useEffect, useRef } from 'react';
import { Check, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // Reintroduzido PopoverTrigger
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Client } from '@/types/clients';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { cn } from '@/lib/utils';

interface ClientAutocompleteProps {
  selectedClient: Client | undefined;
  onClientSelect: (client: Client) => void;
  onClientDeselect: () => void;
  clientNameInput: string;
  setClientNameInput: (name: string) => void;
  onAddClientClick: () => void;
}

// Hook para debounce
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

export const ClientAutocomplete = ({
  selectedClient,
  onClientSelect,
  onClientDeselect,
  clientNameInput,
  setClientNameInput,
  onAddClientClick,
}: ClientAutocompleteProps) => {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const debouncedSearchTerm = useDebounce(clientNameInput, 300);

  // Query para buscar clientes com base no termo de busca
  const { data: clients, isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: ['clientsSearch', user?.id, debouncedSearchTerm],
    queryFn: async () => {
      if (!user || debouncedSearchTerm.length < 2) return [];
      
      const searchTerm = `%${debouncedSearchTerm.toLowerCase()}%`;
      
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone_number, address, city, state, document_number, email')
        .eq('user_id', user.id)
        .ilike('name', searchTerm) // Busca por nome
        .limit(10);
        
      if (error) throw error;
      return data;
    },
    enabled: !!user && debouncedSearchTerm.length >= 2,
  });

  // Efeito para controlar a abertura do Popover
  useEffect(() => {
    const shouldOpen = debouncedSearchTerm.length >= 2 && (clients?.length > 0 || isLoadingClients);
    setOpen(shouldOpen);
  }, [debouncedSearchTerm, clients, isLoadingClients]);

  const handleSelectClient = (client: Client) => {
    onClientSelect(client);
    setClientNameInput(client.name);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setClientNameInput(newName);
    if (selectedClient && selectedClient.name !== newName) {
      onClientDeselect();
    }
    // O useEffect cuidará de abrir/fechar baseado no debouncedSearchTerm
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="clientName">Nome do Cliente *</Label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="flex-1 relative">
              <Input
                id="clientName"
                value={clientNameInput}
                onChange={handleInputChange}
                placeholder="Ex: João Silva (comece a digitar para buscar)"
                className="bg-background/50 w-full"
                autoComplete="off"
              />
            </div>
          </PopoverTrigger>
          <PopoverContent 
            className="w-[calc(100%-1rem)] p-0" 
            align="start"
            // Adicionamos onOpenAutoFocus para evitar que o Popover roube o foco do Input
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command>
              <CommandList>
                {isLoadingClients && (
                  <CommandEmpty className="py-6 text-center">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Buscando clientes...
                  </CommandEmpty>
                )}
                {!isLoadingClients && clients && clients.length > 0 ? (
                  <CommandGroup>
                    {clients.map((client) => (
                      <CommandItem
                        key={client.id}
                        value={client.name}
                        onSelect={() => handleSelectClient(client)}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedClient?.id === client.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {client.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : (
                  debouncedSearchTerm.length >= 2 && !isLoadingClients && (
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                  )
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button 
          type="button" 
          variant="outline" 
          size="icon"
          onClick={onAddClientClick}
          title="Adicionar Novo Cliente"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};