import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface OperationalCost {
  id: string;
  description: string;
  value: number;
  type: 'fixed' | 'variable';
  user_id: string;
  created_at: string;
}

interface CostFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cost?: OperationalCost; // Opcional para edição
}

export const CostFormDialog = ({ isOpen, onClose, cost }: CostFormDialogProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [description, setDescription] = useState(cost?.description || '');
  const [value, setValue] = useState(cost?.value.toString() || '');
  const [type, setType] = useState<'fixed' | 'variable'>(cost?.type || 'fixed');

  useEffect(() => {
    if (cost) {
      setDescription(cost.description);
      setValue(cost.value.toString());
      setType(cost.type);
    } else {
      setDescription('');
      setValue('');
      setType('fixed');
    }
  }, [cost, isOpen]);

  const upsertCostMutation = useMutation({
    mutationFn: async (newCost: Omit<OperationalCost, 'id' | 'created_at'> & { id?: string }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      let costData;
      if (newCost.id) {
        // Update existing cost
        const { data, error } = await supabase
          .from('operational_costs')
          .update({ 
            description: newCost.description, 
            value: newCost.value, 
            type: newCost.type,
          })
          .eq('id', newCost.id)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        costData = data;
      } else {
        // Insert new cost
        const { data, error } = await supabase
          .from('operational_costs')
          .insert({ 
            description: newCost.description, 
            value: newCost.value, 
            type: newCost.type,
            user_id: user.id 
          })
          .select()
          .single();
        if (error) throw error;
        costData = data;
      }
      return costData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['operationalCosts', user?.id] });
      toast({
        title: cost ? "Custo atualizado!" : "Custo adicionado!",
        description: `${data.description} foi ${cost ? 'atualizado' : 'adicionado'} com sucesso.`,
      });
      onClose();
    },
    onError: (err) => {
      toast({
        title: cost ? "Erro ao atualizar custo" : "Erro ao adicionar custo",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!description || !value) {
      toast({
        title: "Campos obrigatórios",
        description: "Descrição e Valor do custo são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    if (isNaN(parseFloat(value)) || parseFloat(value) < 0) {
      toast({
        title: "Valor inválido",
        description: "O valor deve ser um número positivo.",
        variant: "destructive",
      });
      return;
    }

    upsertCostMutation.mutate({
      id: cost?.id,
      description,
      value: parseFloat(value),
      type,
      user_id: user!.id,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card">
        <DialogHeader>
          <DialogTitle>{cost ? 'Editar Custo' : 'Adicionar Novo Custo'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="value">Valor (R$) *</Label>
            <Input id="value" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost-type" className="text-sm">Tipo de Custo</Label>
            <Select value={type} onValueChange={(value: 'fixed' | 'variable') => setType(value)}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixo</SelectItem>
                <SelectItem value="variable">Variável</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={upsertCostMutation.isPending}>
            {upsertCostMutation.isPending ? (cost ? "Salvando..." : "Adicionando...") : (cost ? "Salvar Alterações" : "Adicionar Custo")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};