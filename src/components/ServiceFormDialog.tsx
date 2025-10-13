import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MultiSelect } from './ui/multi-select'; // Precisaremos criar este componente

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  user_id: string;
  products?: { id: string; name: string }[]; // Produtos associados ao serviço
}

interface ServiceFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  service?: Service; // Se for para editar, passa o serviço existente
}

export const ServiceFormDialog = ({ isOpen, onClose, service }: ServiceFormDialogProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState(service?.name || '');
  const [description, setDescription] = useState(service?.description || '');
  const [price, setPrice] = useState(service?.price.toString() || '');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(service?.products?.map(p => p.id) || []);

  useEffect(() => {
    if (service) {
      setName(service.name);
      setDescription(service.description || '');
      setPrice(service.price.toString());
      setSelectedProductIds(service.products?.map(p => p.id) || []);
    } else {
      setName('');
      setDescription('');
      setPrice('');
      setSelectedProductIds([]);
    }
  }, [service, isOpen]);

  const { data: catalogProducts, isLoading: isLoadingCatalog } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['productCatalogForSelect', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('product_catalog_items')
        .select('id, name')
        .eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const upsertServiceMutation = useMutation({
    mutationFn: async (newService: Omit<Service, 'id' | 'created_at' | 'products'> & { id?: string }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      let serviceData;
      if (newService.id) {
        // Update existing service
        const { data, error } = await supabase
          .from('services')
          .update({ name: newService.name, description: newService.description, price: newService.price })
          .eq('id', newService.id)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        serviceData = data;
      } else {
        // Insert new service
        const { data, error } = await supabase
          .from('services')
          .insert({ name: newService.name, description: newService.description, price: newService.price, user_id: user.id })
          .select()
          .single();
        if (error) throw error;
        serviceData = data;
      }

      // Update service_product_links
      if (serviceData) {
        // Delete existing links for this service
        const { error: deleteError } = await supabase
          .from('service_product_links')
          .delete()
          .eq('service_id', serviceData.id);
        if (deleteError) throw deleteError;

        // Insert new links
        if (selectedProductIds.length > 0) {
          const linksToInsert = selectedProductIds.map(productId => ({
            service_id: serviceData.id,
            product_id: productId,
          }));
          const { error: insertError } = await supabase
            .from('service_product_links')
            .insert(linksToInsert);
          if (insertError) throw insertError;
        }
      }
      return serviceData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['services', user?.id] });
      toast({
        title: service ? "Serviço atualizado!" : "Serviço adicionado!",
        description: `${data.name} foi ${service ? 'atualizado' : 'adicionado'} com sucesso.`,
      });
      onClose();
    },
    onError: (err) => {
      toast({
        title: service ? "Erro ao atualizar serviço" : "Erro ao adicionar serviço",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!name || !price) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome do serviço e Valor Cobrado são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      toast({
        title: "Valor inválido",
        description: "O valor cobrado deve ser um número positivo.",
        variant: "destructive",
      });
      return;
    }

    upsertServiceMutation.mutate({
      id: service?.id,
      name,
      description,
      price: parseFloat(price),
      user_id: user!.id, // user is guaranteed to exist by SessionContextProvider
    });
  };

  const productOptions = catalogProducts?.map(p => ({ label: p.name, value: p.id })) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card">
        <DialogHeader>
          <DialogTitle>{service ? 'Editar Serviço' : 'Adicionar Novo Serviço'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Serviço *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (Opcional)</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Valor Cobrado (R$) *</Label>
            <Input id="price" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="products">Adicionar Produtos do Catálogo</Label>
            {isLoadingCatalog ? (
              <p className="text-sm text-muted-foreground">Carregando produtos...</p>
            ) : (
              <MultiSelect
                options={productOptions}
                selected={selectedProductIds}
                onSelectChange={setSelectedProductIds}
                placeholder="Selecione os produtos"
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={upsertServiceMutation.isPending}>
            {upsertServiceMutation.isPending ? (service ? "Salvando..." : "Adicionando...") : (service ? "Salvar Alterações" : "Adicionar Serviço")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};