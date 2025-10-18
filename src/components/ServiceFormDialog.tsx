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
import { LoadHourlyCostButton } from './LoadHourlyCostButton'; // Importar o novo componente

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  labor_cost_per_hour: number;
  execution_time_minutes: number;
  other_costs: number; // Novo campo
  user_id: string;
  products?: { 
    id: string; 
    name: string; 
    size: number; // em litros
    price: number; // em R$
    type: 'diluted' | 'ready-to-use';
    dilution_ratio: number; 
    usage_per_vehicle: number;
    container_size: number; // Adicionado container_size
  }[]; // Adicionado detalhes completos do produto
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
  const [price, setPrice] = useState(service?.price.toFixed(2) || '');
  const [laborCostPerHour, setLaborCostPerHour] = useState(service?.labor_cost_per_hour.toFixed(2) || '');
  const [executionTimeHHMM, setExecutionTimeHHMM] = useState(formatMinutesToHHMM(service?.execution_time_minutes || 0));
  const [otherCosts, setOtherCosts] = useState(service?.other_costs.toFixed(2) || ''); // Novo estado

  useEffect(() => {
    if (service) {
      setName(service.name);
      setDescription(service.description || '');
      setPrice(service.price.toFixed(2));
      setLaborCostPerHour(service.labor_cost_per_hour.toFixed(2));
      setExecutionTimeHHMM(formatMinutesToHHMM(service.execution_time_minutes));
      setOtherCosts(service.other_costs.toFixed(2)); // Definir valor para edição
    } else {
      setName('');
      setDescription('');
      setPrice('');
      setLaborCostPerHour('');
      setExecutionTimeHHMM('00:00');
      setOtherCosts(''); // Limpar valor para novo serviço
    }
  }, [service, isOpen]);

  const upsertServiceMutation = useMutation({
    mutationFn: async (newService: Omit<Service, 'id' | 'created_at' | 'products'> & { id?: string }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      const finalExecutionTimeMinutes = newService.execution_time_minutes;

      let serviceData;
      if (newService.id) {
        // Update existing service
        const { data, error } = await supabase
          .from('services')
          .update({ 
            name: newService.name, 
            description: newService.description, 
            price: newService.price,
            labor_cost_per_hour: newService.labor_cost_per_hour,
            execution_time_minutes: finalExecutionTimeMinutes,
            other_costs: newService.other_costs, // Incluir outros custos
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
            labor_cost_per_hour: newService.labor_cost_per_hour,
            execution_time_minutes: finalExecutionTimeMinutes,
            other_costs: newService.other_costs, // Incluir outros custos
            user_id: user.id 
          })
          .select()
          .single();
        if (error) throw error;
        serviceData = data;
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
    // Validação para Outros Custos
    if (otherCosts && (isNaN(parseFloat(otherCosts)) || parseFloat(otherCosts) < 0)) {
      toast({
        title: "Outros Custos inválidos",
        description: "O valor de 'Outros Custos' deve ser um número positivo.",
        variant: "destructive",
      });
      return;
    }

    upsertServiceMutation.mutate({
      id: service?.id,
      name,
      description,
      price: parseFloat(price),
      labor_cost_per_hour: parseFloat(laborCostPerHour),
      execution_time_minutes: parsedExecutionTime,
      other_costs: parseFloat(otherCosts) || 0, // Usar 0 se vazio
      user_id: user!.id,
    });
  };

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
            <div className="flex"> {/* Adicionado flex container */}
              <Input 
                id="labor-cost-per-hour" 
                type="number" 
                step="0.01" 
                value={laborCostPerHour} 
                onChange={(e) => setLaborCostPerHour(e.target.value)} 
                className="flex-1 bg-background rounded-r-none border-r-0" /* Estilo para input anexado */
              />
              <LoadHourlyCostButton onLoad={(cost) => setLaborCostPerHour(cost.toFixed(2))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="execution-time">Tempo de Execução do Serviço (HH:MM) *</Label>
            <Input 
              id="execution-time" 
              type="text"
              placeholder="Ex: 01:30 (1 hora e 30 minutos)"
              value={executionTimeHHMM} 
              onChange={(e) => setExecutionTimeHHMM(e.target.value)} 
              className="bg-background" 
            />
          </div>
          <div className="space-y-2"> {/* Novo campo para Outros Custos */}
            <Label htmlFor="other-costs">Outros Custos (R$)</Label>
            <Input 
              id="other-costs" 
              type="number" 
              step="0.01" 
              value={otherCosts} 
              onChange={(e) => setOtherCosts(e.target.value)} 
              className="bg-background" 
              placeholder="Ex: 15.00 (custos adicionais)"
            />
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