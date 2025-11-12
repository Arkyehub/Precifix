import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { OperationalCost, OperationalCostPayment } from '@/types/costs';
import { format, isPast, isToday, addDays, addWeeks, addMonths, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DateRange } from 'react-day-picker';
import { PaymentEditDialog } from '@/components/costs/PaymentEditDialog';
import { Card, CardContent } from '@/components/ui/card';

// Importar os novos componentes e o utilitário
import { AccountsPayableHeader } from '../components/accounts-payable/AccountsPayableHeader';
import { AccountsPayableFilterBar } from '../components/accounts-payable/AccountsPayableFilterBar';
import { AccountsPayableTable } from '../components/accounts-payable/AccountsPayableTable';
import { generateExpenseInstances, ExpenseInstance } from '@/lib/expense-utils';
import { useNotifications } from '@/hooks/use-notifications';

const AccountsPayablePage = () => {
  const { user } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { createNotificationMutation } = useNotifications();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Paga' | 'Em aberto' | 'Atrasada'>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseInstance | null>(null);

  const notifiedExpenses = useRef(new Set<string>()); // Adiciona um ref para controlar as despesas já notificadas

  const { data: operationalCosts, isLoading, error } = useQuery<OperationalCost[]>({
    queryKey: ['operationalCosts', user?.id],
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

  const { data: operationalCostPayments, isLoading: isLoadingPayments } = useQuery<OperationalCostPayment[]>({
    queryKey: ['operationalCostPayments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('operational_cost_payments')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async ({
      originalCostId,
      dueDate,
      paidValue,
      isPaid,
      isRecurring,
      paymentRecordId,
    }: {
      originalCostId: string;
      dueDate: Date;
      paidValue: number;
      isPaid: boolean;
      isRecurring: boolean;
      paymentRecordId?: string;
    }) => {
      if (!user) throw new Error('Usuário não autenticado.');

      if (isRecurring) {
        const paymentData = {
          user_id: user.id,
          operational_cost_id: originalCostId,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          paid_value: paidValue,
          paid_date: format(new Date(), 'yyyy-MM-dd'),
          is_paid: isPaid,
        };

        if (paymentRecordId && isPaid) {
          const { error } = await supabase
            .from('operational_cost_payments')
            .update(paymentData)
            .eq('id', paymentRecordId)
            .eq('user_id', user.id);
          if (error) throw error;
        } else if (isPaid) {
          const { error } = await supabase
            .from('operational_cost_payments')
            .insert(paymentData);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('operational_cost_payments')
            .delete()
            .eq('operational_cost_id', originalCostId)
            .eq('due_date', format(dueDate, 'yyyy-MM-dd'))
            .eq('user_id', user.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from('operational_costs')
          .update({
            is_paid: isPaid,
            paid_date: isPaid ? format(new Date(), 'yyyy-MM-dd') : null,
            value: paidValue,
          })
          .eq('id', originalCostId)
          .eq('user_id', user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operationalCosts', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['operationalCostPayments', user?.id] });
      toast({
        title: 'Custo atualizado!',
        description: 'O status e/ou valor do custo foi atualizado com sucesso.',
      });
    },
    onError: err => {
      toast({
        title: 'Erro ao atualizar custo',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const allExpenseInstances = useMemo(() => {
    if (!operationalCosts || !operationalCostPayments) return [];
    return generateExpenseInstances(operationalCosts, operationalCostPayments, new Date());
  }, [operationalCosts, operationalCostPayments]);

  const filteredExpenses = useMemo(() => {
    let filtered = allExpenseInstances;

    if (searchQuery) {
      filtered = filtered.filter(expense =>
        expense.description.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(expense => expense.status === statusFilter);
    }

    const { from, to } = dateRange || {};

    if (from) {
      filtered = filtered.filter(expense => expense.due_date >= startOfDay(from));
    }
    if (to) {
      filtered = filtered.filter(expense => expense.due_date <= endOfDay(to));
    }

    return filtered;
  }, [allExpenseInstances, searchQuery, statusFilter, dateRange]);

  const handleOpenPaymentDialog = (expense: ExpenseInstance) => {
    setSelectedExpense(expense);
    setIsPaymentDialogOpen(true);
  };

  const handleConfirmPayment = (
    originalCostId: string,
    dueDate: Date,
    paidValue: number,
    isPaid: boolean,
    isRecurring: boolean,
    paymentRecordId?: string,
  ) => {
    markAsPaidMutation.mutate({
      originalCostId,
      dueDate,
      paidValue,
      isPaid,
      isRecurring,
      paymentRecordId,
    });
  };

  if (isLoading || isLoadingPayments) return <div>Carregando contas a pagar...</div>;
  if (error) return <div>Erro ao carregar contas a pagar: {error.message}</div>;

  return (
    <div className="flex flex-col space-y-6 p-4">
      <AccountsPayableHeader />

      <Card>
        <CardContent className="p-6">
          <AccountsPayableFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />

          <AccountsPayableTable
            expenses={filteredExpenses}
            onOpenPaymentDialog={handleOpenPaymentDialog}
            isMutationPending={markAsPaidMutation.isPending}
          />
        </CardContent>
      </Card>

      {selectedExpense && (
        <PaymentEditDialog
          isOpen={isPaymentDialogOpen}
          onClose={() => setIsPaymentDialogOpen(false)}
          expense={selectedExpense}
          onConfirm={handleConfirmPayment}
          isRecurring={selectedExpense.is_recurring}
        />
      )}
    </div>
  );
};

export default AccountsPayablePage;