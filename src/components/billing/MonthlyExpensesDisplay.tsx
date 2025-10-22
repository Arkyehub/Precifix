import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCw, Pencil, Trash2, Loader2, Receipt } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MonthlyExpense, MonthlyBilling } from '@/pages/BillingPage';
import { OperationalCost } from '@/types/costs'; // Reutilizar a interface de custos operacionais
import { MonthlyExpenseFormDialog } from '@/components/billing/MonthlyExpenseFormDialog';

interface MonthlyExpensesDisplayProps {
  monthlyBillingId: string | undefined;
  month: number;
  year: number;
}

export const MonthlyExpensesDisplay = ({ monthlyBillingId, month, year }: MonthlyExpensesDisplayProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MonthlyExpense | undefined>(undefined);

  // Fetch monthly expenses for the selected month/year
  const { data: monthlyExpenses, isLoading: isLoadingMonthlyExpenses, error: monthlyExpensesError } = useQuery<MonthlyExpense[]>({
    queryKey: ['monthlyExpenses', monthlyBillingId],
    queryFn: async () => {
      if (!monthlyBillingId) return [];
      const { data, error } = await supabase
        .from('monthly_expenses')
        .select('*')
        .eq('monthly_billing_id', monthlyBillingId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!monthlyBillingId,
  });

  // Fetch global operational costs
  const { data: globalOperationalCosts, isLoading: isLoadingGlobalCosts } = useQuery<OperationalCost[]>({
    queryKey: ['globalOperationalCosts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('operational_costs')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Mutation to create a monthly billing record if it doesn't exist
  const createMonthlyBillingMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado.");
      const { data, error } = await supabase
        .from('monthly_billing')
        .insert({ user_id: user.id, month, year, billing_amount: 0 })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['monthlyBillingRecords', user?.id] });
      toast({
        title: "Registro de faturamento criado!",
        description: "Um novo registro para este mês foi criado automaticamente.",
      });
    },
    onError: (err) => {
      console.error("Error creating monthly billing record:", err);
      toast({
        title: "Erro ao criar registro de faturamento",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to pull/update global expenses
  const pullGlobalExpensesMutation = useMutation({
    mutationFn: async (billingId: string) => {
      if (!user) throw new Error("Usuário não autenticado.");
      if (!globalOperationalCosts) return;

      const existingGlobalMonthlyExpenses = monthlyExpenses?.filter(exp => exp.source === 'global') || [];
      const updates: Omit<MonthlyExpense, 'id' | 'created_at' | 'updated_at'>[] = [];
      const inserts: Omit<MonthlyExpense, 'id' | 'created_at' | 'updated_at'>[] = [];

      for (const globalCost of globalOperationalCosts) {
        const existing = existingGlobalMonthlyExpenses.find(
          exp => exp.operational_cost_id === globalCost.id
        );

        if (existing) {
          // Update if value or description changed
          if (existing.value !== globalCost.value || existing.description !== globalCost.description || existing.type !== globalCost.type) {
            updates.push({
              ...existing, // Keep existing ID for update
              monthly_billing_id: billingId,
              description: globalCost.description,
              value: globalCost.value,
              type: globalCost.type,
              source: 'global',
              operational_cost_id: globalCost.id,
            });
          }
        } else {
          // Insert new global cost
          inserts.push({
            monthly_billing_id: billingId,
            description: globalCost.description,
            value: globalCost.value,
            type: globalCost.type,
            source: 'global',
            operational_cost_id: globalCost.id,
          });
        }
      }

      // Perform updates
      if (updates.length > 0) {
        const { error: updateError } = await supabase
          .from('monthly_expenses')
          .upsert(updates, { onConflict: 'id' }); // Use upsert with onConflict: 'id' for updates
        if (updateError) throw updateError;
      }

      // Perform inserts
      if (inserts.length > 0) {
        const { error: insertError } = await supabase
          .from('monthly_expenses')
          .insert(inserts);
        if (insertError) throw insertError;
      }

      // Optionally, delete monthly_expenses with source 'global' if their operational_cost_id no longer exists in globalOperationalCosts
      const globalCostIds = new Set(globalOperationalCosts.map(cost => cost.id));
      const expensesToDelete = existingGlobalMonthlyExpenses.filter(
        exp => exp.operational_cost_id && !globalCostIds.has(exp.operational_cost_id)
      );

      if (expensesToDelete.length > 0) {
        const deleteIds = expensesToDelete.map(exp => exp.id);
        const { error: deleteError } = await supabase
          .from('monthly_expenses')
          .delete()
          .in('id', deleteIds);
        if (deleteError) console.error("Error deleting stale global monthly expenses:", deleteError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthlyExpenses', monthlyBillingId] });
      toast({
        title: "Despesas globais atualizadas!",
        description: "As despesas fixas e variáveis foram sincronizadas com seus custos operacionais.",
      });
    },
    onError: (err) => {
      console.error("Error pulling global expenses:", err);
      toast({
        title: "Erro ao atualizar despesas globais",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMonthlyExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from('monthly_expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthlyExpenses', monthlyBillingId] });
      toast({
        title: "Despesa removida!",
        description: "A despesa mensal foi excluída com sucesso.",
      });
    },
    onError: (err) => {
      console.error("Error deleting monthly expense:", err);
      toast({
        title: "Erro ao remover despesa",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handlePullGlobalExpenses = async () => {
    if (!monthlyBillingId) {
      // If no monthly billing record exists, create one first
      const newBillingRecord = await createMonthlyBillingMutation.mutateAsync();
      if (newBillingRecord) {
        pullGlobalExpensesMutation.mutate(newBillingRecord.id);
      }
    } else {
      pullGlobalExpensesMutation.mutate(monthlyBillingId);
    }
  };

  const handleAddMonthlyExpense = () => {
    if (!monthlyBillingId) {
      toast({
        title: "Selecione um mês",
        description: "Por favor, selecione um mês e ano para adicionar despesas.",
        variant: "destructive",
      });
      return;
    }
    setEditingExpense(undefined);
    setIsFormDialogOpen(true);
  };

  const handleEditMonthlyExpense = (expense: MonthlyExpense) => {
    setEditingExpense(expense);
    setIsFormDialogOpen(true);
  };

  const handleDeleteMonthlyExpense = (id: string) => {
    deleteMonthlyExpenseMutation.mutate(id);
  };

  const totalExpenses = monthlyExpenses?.reduce((sum, expense) => sum + expense.value, 0) || 0;

  if (isLoadingMonthlyExpenses || isLoadingGlobalCosts || pullGlobalExpensesMutation.isPending || createMonthlyBillingMutation.isPending) {
    return (
      <Card className="bg-background border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Despesas Mensais</CardTitle>
          </div>
          <CardDescription>
            Carregando despesas...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (monthlyExpensesError) {
    return <p className="text-destructive">Erro ao carregar despesas mensais: {monthlyExpensesError.message}</p>;
  }

  return (
    <Card className="bg-background border-border/50 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Despesas Mensais</CardTitle>
          </div>
          <Button
            onClick={handlePullGlobalExpenses}
            variant="outline"
            size="sm"
            className="border-primary/30 hover:bg-primary/10 hover:border-primary"
            disabled={!user || isLoadingGlobalCosts || pullGlobalExpensesMutation.isPending || createMonthlyBillingMutation.isPending}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar Despesas Globais
          </Button>
        </div>
        <CardDescription>
          Visualize e gerencie as despesas para o mês selecionado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[80px] text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyExpenses && monthlyExpenses.length > 0 ? (
                monthlyExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>{expense.type === 'fixed' ? 'Fixo' : 'Variável'}</TableCell>
                    <TableCell className="text-right">R$ {expense.value.toFixed(2)}</TableCell>
                    <TableCell className="flex justify-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEditMonthlyExpense(expense)} className="text-muted-foreground hover:text-primary hover:bg-white">
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
                              Esta ação não pode ser desfeita. Isso excluirá permanentemente a despesa "{expense.description}" deste mês.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteMonthlyExpense(expense.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Nenhuma despesa registrada para este mês.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-border/50">
          <span className="text-lg font-bold text-foreground">Total de Despesas:</span>
          <span className="text-2xl font-bold text-destructive">R$ {totalExpenses.toFixed(2)}</span>
        </div>

        <Button
          onClick={handleAddMonthlyExpense}
          className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
          disabled={!monthlyBillingId}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Nova Despesa
        </Button>
      </CardContent>

      <MonthlyExpenseFormDialog
        isOpen={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
        monthlyBillingId={monthlyBillingId}
        expense={editingExpense}
      />
    </Card>
  );
};