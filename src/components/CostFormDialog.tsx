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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface OperationalCost {
  id: string;
  description: string;
  value: number;
  type: 'fixed' | 'variable';
  user_id: string;
  created_at: string;
  expense_date?: string; // Data da despesa
  is_recurring?: boolean; // Se é recorrente
  recurrence_frequency?: 'none' | 'daily' | 'weekly' | 'monthly'; // Frequência da recorrência
  recurrence_end_date?: string; // Data final da recorrência
}

interface CostFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cost?: OperationalCost; // Opcional para edição
  defaultDescription?: string; // Nova prop para descrição padrão
  defaultType?: 'fixed' | 'variable'; // Nova prop para tipo padrão
  onCostSaved?: (savedCost: OperationalCost) => void; // Nova prop para callback
}

export const CostFormDialog = ({ isOpen, onClose, cost, defaultDescription, defaultType, onCostSaved }: CostFormDialogProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [description, setDescription] = useState(cost?.description || defaultDescription || '');
  const [value, setValue] = useState(cost?.value.toFixed(2) || '');
  const [type, setType] = useState<'fixed' | 'variable'>(cost?.type || defaultType || 'fixed');
  const [expenseDate, setExpenseDate] = useState<Date | undefined>(cost?.expense_date ? new Date(cost.expense_date) : undefined);
  const [isRecurring, setIsRecurring] = useState(cost?.is_recurring || false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'none' | 'daily' | 'weekly' | 'monthly'>(cost?.recurrence_frequency || 'none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(cost?.recurrence_end_date ? new Date(cost.recurrence_end_date) : undefined);

  // Determina se o custo é o "Produtos Gastos no Mês"
  const isProductsCost = description === 'Produtos Gastos no Mês';

  useEffect(() => {
    if (cost) {
      setDescription(cost.description);
      setValue(cost.value.toFixed(2));
      setType(cost.type);
      setExpenseDate(cost.expense_date ? new Date(cost.expense_date) : undefined);
      setIsRecurring(cost.is_recurring || false);
      setRecurrenceFrequency(cost.recurrence_frequency || 'none');
      setRecurrenceEndDate(cost.recurrence_end_date ? new Date(cost.recurrence_end_date) : undefined);
    } else {
      // Se não estiver editando, use os defaults ou valores vazios
      setDescription(defaultDescription || '');
      setValue('');
      setType(defaultType || 'fixed');
      setExpenseDate(undefined);
      setIsRecurring(false);
      setRecurrenceFrequency('none');
      setRecurrenceEndDate(undefined);
    }
  }, [cost, isOpen, defaultDescription, defaultType]);

  const upsertCostMutation = useMutation({
    mutationFn: async (newCost: Omit<OperationalCost, 'id' | 'created_at'> & { id?: string }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      let costData;
      const payload = {
        description: newCost.description,
        value: newCost.value,
        type: newCost.type,
        expense_date: newCost.expense_date,
        is_recurring: newCost.is_recurring,
        recurrence_frequency: newCost.recurrence_frequency,
        recurrence_end_date: newCost.recurrence_end_date,
      };

      if (newCost.id) {
        // Update existing cost
        const { data, error } = await supabase
          .from('operational_costs')
          .update(payload)
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
            ...payload,
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
      queryClient.invalidateQueries({ queryKey: ['productsMonthlyCostItem', user?.id] }); // Invalidate this specific query
      toast({
        title: cost ? "Custo atualizado!" : "Custo adicionado!",
        description: `${data.description} foi ${cost ? 'atualizado' : 'adicionado'} com sucesso.`,
      });
      onClose();
      onCostSaved?.(data); // Chamar o callback com os dados do custo salvo
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
    if (!expenseDate) {
      toast({
        title: "Data da Despesa Obrigatória",
        description: "Por favor, selecione a data da despesa.",
        variant: "destructive",
      });
      return;
    }
    if (isRecurring && recurrenceFrequency === 'none') {
      toast({
        title: "Frequência de Recorrência Obrigatória",
        description: "Por favor, selecione a frequência da recorrência.",
        variant: "destructive",
      });
      return;
    }
    if (isRecurring && recurrenceFrequency !== 'none' && !recurrenceEndDate) {
      toast({
        title: "Data Final da Recorrência Obrigatória",
        description: "Por favor, selecione a data final da recorrência.",
        variant: "destructive",
      });
      return;
    }

    // Forçar o tipo para 'variable' se for "Produtos Gastos no Mês"
    const finalType = isProductsCost ? 'variable' : type;

    upsertCostMutation.mutate({
      id: cost?.id,
      description,
      value: parseFloat(value),
      type: finalType,
      user_id: user!.id,
      expense_date: expenseDate.toISOString().split('T')[0], // Formato YYYY-MM-DD
      is_recurring: isRecurring,
      recurrence_frequency: isRecurring ? recurrenceFrequency : undefined,
      recurrence_end_date: isRecurring && recurrenceEndDate ? recurrenceEndDate.toISOString().split('T')[0] : undefined,
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
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background"
              readOnly={isProductsCost || !!defaultDescription} // Desabilitar se for "Produtos Gastos no Mês" ou se houver defaultDescription
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="value">Valor (R$) *</Label>
            <Input id="value" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost-type" className="text-sm">Tipo de Custo</Label>
            <Select
              value={type}
              onValueChange={(value: 'fixed' | 'variable') => setType(value)}
              disabled={isProductsCost || !!defaultType} // Desabilitar se for "Produtos Gastos no Mês" ou se houver defaultType
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixo</SelectItem>
                <SelectItem value="variable">Variável</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campo de Data da Despesa */}
          <div className="space-y-2">
            <Label htmlFor="expense-date">Data da Despesa *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal bg-background",
                    !expenseDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expenseDate ? format(expenseDate, "PPP") : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={expenseDate}
                  onSelect={setExpenseDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Checkbox de Frequência */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-recurring"
              checked={isRecurring}
              onCheckedChange={(checked) => setIsRecurring(checked as boolean)}
            />
            <Label htmlFor="is-recurring">Frequência</Label>
          </div>

          {/* Opções de Recorrência (condicional) */}
          {isRecurring && (
            <>
              <div className="space-y-2">
                <Label htmlFor="recurrence-frequency">Frequência da Recorrência</Label>
                <Select
                  value={recurrenceFrequency}
                  onValueChange={(value: 'none' | 'daily' | 'weekly' | 'monthly') => setRecurrenceFrequency(value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione a frequência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não repetir</SelectItem>
                    <SelectItem value="daily">Diária</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recurrenceFrequency !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="recurrence-end-date">Data Final da Recorrência *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal bg-background",
                          !recurrenceEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {recurrenceEndDate ? format(recurrenceEndDate, "PPP") : <span>Selecione uma data</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={recurrenceEndDate}
                        onSelect={setRecurrenceEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </>
          )}
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