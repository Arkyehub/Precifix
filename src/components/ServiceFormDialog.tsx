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
import { MultiSelect } from './ui/multi-select';

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  labor_cost_per_hour: number; // Novo campo
  execution_time_minutes: number; // Novo campo
  user_id: string;
  products?: { id: string; name: string }[];
}

interface ServiceFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  service?: Service;
}

// Utility function to format minutes to HH:MM
const formatMinutesToHHMM = (totalMinutes: number): string => {
  if (isNaN(totalMinutes) || totalMinutes < 0) return "00:00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Utility function to parse HH:MM to minutes
const parseHHMMToMinutes = (hhmm: string): number => {
  const parts = hhmm.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || minutes < 0 || minutes >= 60) return 0;
  return hours * 60 + minutes;
};

export const ServiceFormDialog = ({ isOpen, onClose, service }: ServiceFormDialogProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState(service?.name || '');
  const [description, setDescription] = useState(service?.description || '');
  const [price, setPrice] = useState(service?.price.toString() || '');
  const [laborCostPerHour, setLaborCostPerHour] = useState(service?.labor_cost_per_hour.toString() || ''); // Novo estado
  const [executionTimeHHMM, setExecutionTimeHHMM] = useState(formatMinutesToHHMM(service?.execution_time_minutes || 0)); // Novo estado formatado
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(service?.products?.map(p => p.id) || []);

  useEffect(() => {
    if (service) {
      setName(service.name);
      setDescription(service.description || '');
      setPrice(service.price.toString());
      setLaborCostPerHour(service.labor_cost_per_hour.toString()); // Inicializa o novo estado
      setExecutionTimeHHMM(formatMinutesToHHMM(service.execution_time_minutes)); // Inicializa o novo estado formatado
      setSelectedProductIds(service.products?.map(p => p.id) || []);
    } else {
      setName('');
      setDescription('');
      setPrice('');
      setLaborCostPerHour(''); // Limpa o novo estado
      setExecutionTimeHHMM('00:00'); // Limpa o novo estado
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

      const executionTimeMinutes = parseHHMMToMinutes(newService.execution_time_minutes as any); // Parse HH:MM to minutes

      let serviceData;
      if (newService.id) {
        // Update existing service
        const { data, error } = await supabase
          .from('services')
          .update({ 
            name: newService.name, 
            description: newService.description, 
            price: newService.price,
            labor_cost_per_hour: newService.labor_cost_per_hour, // Inclui o novo campo
            execution_time_minutes: executionTimeMinutes, // Inclui o novo campo
          })
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
          .insert({ 
            name: newService.name, 
            description: newService.description, 
            price: newService.price, 
            labor_cost_per_hour: newService.labor_cost_per_hour, // Inclui o novo campo
            execution_time_minutes: executionTimeMinutes, // Inclui o novo campo
            user_id: user.id 
          })
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
    if (!name || !price || !laborCostPerHour || !executionTimeHHMM) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome do serviço, Valor Cobrado, Custo da Hora de Trabalho e Tempo de Execução são obrigatórios.",
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
    if (isNaN(parseFloat(laborCostPerHour)) || parseFloat(laborCostPerHour) < 0) {
      toast({
        title: "Custo da hora de trabalho inválido",
        description: "O custo da hora de trabalho deve ser um número positivo.",
        variant: "destructive",
      });
      return;
    }
    const parsedExecutionTime = parseHHMMToMinutes(executionTimeHHMM);
    if (isNaN(parsedExecutionTime) || parsedExecutionTime < 0) {
      toast({
        title: "Tempo de execução inválido",
        description: "O tempo de execução deve estar no formato HH:MM e ser um valor positivo.",
        variant: "destructive",
      });
      return;
    }

    upsertServiceMutation.mutate({
      id: service?.id,
      name,
      description,
      price: parseFloat(price),
      labor_cost_per_hour: parseFloat(laborCostPerHour), // Envia o novo campo
      execution_time_minutes: parsedExecutionTime, // Envia o novo campo (já convertido para minutos)
      user_id: user!.id,
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
            <Label htmlFor="labor-cost-per-hour">Custo da Hora de Trabalho (R$) *</Label>
            <Input 
              id="labor-cost-per-hour" 
              type="number" 
              step="0.01" 
              value={laborCostPerHour} 
              onChange={(e) => setLaborCostPerHour(e.target.value)} 
              className="bg-background" 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="execution-time">Tempo de Execução do Serviço (HH:MM) *</Label>
            <Input 
              id="execution-time" 
              type="text" // Changed to text to allow HH:MM format
              placeholder="Ex: 01:30 (1 hora e 30 minutos)"
              value={executionTimeHHMM} 
              onChange={(e) => setExecutionTimeHHMM(e.target.value)} 
              className="bg-background" 
            />
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