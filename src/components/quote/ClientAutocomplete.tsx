import React, { useState, useEffect, useRef } from 'react';
import { Check, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  disabled?: boolean; // Nova prop
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
  disabled = false,
}: ClientAutocompleteProps) => {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedSearchTerm = useDebounce(clientNameInput, 300);
  const [popoverWidth, setPopoverWidth] = useState(0);

  // Query para buscar clientes com base no termo de busca
  const { data: clients, isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: ['clientsSearch', user?.id, debouncedSearchTerm],
    queryFn: async () => {
      if (!user || debouncedSearchTerm.length < 2) return [];
      
      const searchTerm = `%${debouncedSearchTerm.toLowerCase()}%`;
      
      const { data, error } = await supabase
        .from('clients')
        .select('*') // Alterado para selecionar todos os campos para satisfazer o tipo Client
        .eq('user_id', user.id)
        .ilike('name', searchTerm) // Busca por nome
        .limit(10);
        
      if (error) throw error;
      return data as Client[]; // Garantir que o retorno é Client[]
    },
    enabled: !!user && debouncedSearchTerm.length >= 2 && !disabled, // Desabilitar query se o componente estiver desabilitado
  });

  // Efeito para controlar a abertura do Popover
  useEffect(() => {
    // Usar Array.isArray(clients) para garantir que 'clients' é um array antes de acessar .length
    const shouldOpen = !disabled && debouncedSearchTerm.length >= 2 && (Array.isArray(clients) && clients.length > 0 || isLoadingClients);
    setOpen(shouldOpen);
  }, [debouncedSearchTerm, clients, isLoadingClients, disabled]);

  // Efeito para calcular a largura do input e definir a largura do popover
  useEffect(() => {
    if (inputRef.current) {
      setPopoverWidth(inputRef.current.offsetWidth);
    }
  }, [inputRef.current, open]);

  const handleSelectClient = (client: Client) => {
    onClientSelect(client);
    setClientNameInput(client.name);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setClientNameInput(newName);
    if (selectedClient && selectedClient.name !== newName) {
      onClientDeselect();
    }
  };

  const handleInputFocus = () => {
    if (clientNameInput.length >= 2 && !disabled) {
      setOpen(true);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="clientName">Nome do Cliente {disabled ? '' : '*'}</Label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="flex-1 relative">
              <Input
                id="clientName"
                ref={inputRef}
                value={clientNameInput}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                placeholder="Ex: João Silva (comece a digitar para buscar)"
                className="bg-background/50 w-full"
                autoComplete="off"
                disabled={disabled} // Aplicar disabled aqui
                onBlur={() => {
                  setTimeout(() => {
                    setOpen(false);
                  }, 150);
                }}
              />
            </div>
          </PopoverTrigger>
          <PopoverContent 
            style={{ width: popoverWidth }} // Define a largura do PopoverContent
            className="p-0" 
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Command>
              <CommandList>
                {isLoadingClients && (
                  <CommandEmpty className="py-6 text-center">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Buscando clientes...
                  </CommandEmpty>
                )}
                {!isLoadingClients && Array.isArray(clients) && clients.length > 0 ? (
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
                        <span className="font-bold">{client.name}</span>
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
          disabled={disabled} // Aplicar disabled aqui
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};