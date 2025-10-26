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
import { formatCpfCnpj, formatPhoneNumber } from '@/lib/utils';

interface ClientFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client; // Opcional para edição
  onClientSaved?: (client: Client) => void; // Callback após salvar
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

  useEffect(() => {
    if (client) {
      setName(client.name);
      setRawDocumentNumber(client.document_number || '');
      setRawPhoneNumber(client.phone_number || '');
      setEmail(client.email || '');
      setAddress(client.address || '');
      setCity(client.city || '');
      setState(client.state || '');
    } else {
      setName('');
      setRawDocumentNumber('');
      setRawPhoneNumber('');
      setEmail('');
      setAddress('');
      setCity('');
      setState('');
    }
  }, [client, isOpen]);

  const handleDocumentNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setRawDocumentNumber(value);
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setRawPhoneNumber(value);
  };

  const upsertClientMutation = useMutation({
    mutationFn: async (newClient: Omit<Client, 'created_at'> & { id?: string }) => {
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
          .single();
        if (error) throw error;
        savedClient = data;
      } else {
        // Insert new client
        const { data, error } = await supabase
          .from('clients')
          .insert(clientDataToSave)
          .select()
          .single();
        if (error) throw error;
        savedClient = data;
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
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-card">
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