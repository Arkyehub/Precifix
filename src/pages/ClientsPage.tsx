import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Search, Pencil, Trash2, Loader2, Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Client } from '@/types/clients';
import { ClientFormDialog } from '@/components/ClientFormDialog';
import { formatCpfCnpj, formatPhoneNumber } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Import adicionado

const ClientsPage = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch clients with vehicle count
  const { data: clientsWithVehicles, isLoading, error } = useQuery<{ client: Client; vehicleCount: number; firstVehicle?: string }[]>({
    queryKey: ['clientsWithVehicles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (clientsError) throw clientsError;

      const clientsWithInfo = await Promise.all(clientsData.map(async (client) => {
        const { count: vehicleCount, error: vehiclesError } = await supabase
          .from('client_vehicles')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client.id);
        if (vehiclesError) {
          console.error('Erro ao contar veículos:', vehiclesError);
          return { client, vehicleCount: 0 };
        }

        let firstVehicle = 'Nenhum';
        if (vehicleCount && vehicleCount > 0) {
          const { data: vehiclesData } = await supabase
            .from('client_vehicles')
            .select('brand, model, plate, year')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (vehiclesData) {
            firstVehicle = `${vehiclesData.brand} ${vehiclesData.model} - ${vehiclesData.plate || 'N/A'} (${vehiclesData.year})`;
          }
        }

        return { client, vehicleCount: vehicleCount || 0, firstVehicle };
      }));

      return clientsWithInfo;
    },
    enabled: !!user,
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['clientsWithVehicles', user?.id] }); // Invalidar nova query
      toast({
        title: "Cliente removido",
        description: "O cliente foi excluído com sucesso.",
      });
    },
    onError: (err) => {
      console.error("Error deleting client:", err);
      toast({
        title: "Erro ao remover cliente",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleAddClient = () => {
    setEditingClient(undefined);
    setIsFormDialogOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsFormDialogOpen(true);
  };

  const handleDeleteClient = (id: string) => {
    deleteClientMutation.mutate(id);
  };

  const filteredClients = clientsWithVehicles?.filter(({ client }) => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.document_number && client.document_number.includes(searchTerm.replace(/\D/g, ''))) ||
    (client.phone_number && client.phone_number.includes(searchTerm.replace(/\D/g, ''))) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Carregando clientes...</p>
      </div>
    );
  }
  if (error) return <p className="text-destructive">Erro ao carregar clientes: {error.message}</p>;

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-foreground">Gerenciar Clientes</CardTitle>
              <CardDescription>
                Cadastre e gerencie seus clientes para agilizar a emissão de orçamentos.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, CPF/CNPJ, telefone, e-mail ou veículo"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>
            <Button 
              onClick={handleAddClient}
              className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Cliente
            </Button>
          </div>

          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Veículos</TableHead> {/* Nova coluna para veículos */}
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="w-[80px] text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length > 0 ? (
                  filteredClients.map(({ client, vehicleCount, firstVehicle }, index) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {clientsWithVehicles!.length - index}
                      </TableCell>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        {vehicleCount > 0 ? (
                          <div className="flex items-center gap-1">
                            <Car className="h-4 w-4 text-primary" />
                            <span className="text-sm">{vehicleCount} veículo(s)</span>
                            {firstVehicle && firstVehicle !== 'Nenhum' && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs text-primary underline cursor-pointer hover:opacity-80">
                                      {firstVehicle}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-sm">Primeiro veículo: {firstVehicle}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Nenhum</span>
                        )}
                      </TableCell>
                      <TableCell>{client.document_number ? formatCpfCnpj(client.document_number) : 'N/A'}</TableCell>
                      <TableCell>{client.city || 'N/A'}</TableCell>
                      <TableCell>{client.phone_number ? formatPhoneNumber(client.phone_number) : 'N/A'}</TableCell>
                      <TableCell className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClient(client)} className="text-muted-foreground hover:text-primary hover:bg-white">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-white">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Isso excluirá permanentemente o cliente "{client.name}" e todos os seus veículos associados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteClient(client.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {searchTerm ? "Nenhum cliente encontrado com o termo de busca." : "Nenhum cliente cadastrado ainda."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ClientFormDialog
        isOpen={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
        client={editingClient}
      />
    </div>
  );
};

export default ClientsPage;