import { useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { OperationalCost, OperationalCostPayment } from '@/types/costs';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateExpenseInstances } from '@/lib/expense-utils';
import { useNotifications } from '@/hooks/use-notifications';

export const useExpenseNotifications = () => {
  const { user } = useSession();
  const { createNotificationMutation } = useNotifications();
  const notifiedExpenses = useRef(new Set<string>());

  const { data: operationalCosts } = useQuery<OperationalCost[]>({
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

  const { data: operationalCostPayments } = useQuery<OperationalCostPayment[]>({
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

  const allExpenseInstances = useMemo(() => {
    if (!operationalCosts || !operationalCostPayments) return [];
    return generateExpenseInstances(operationalCosts, operationalCostPayments, new Date());
  }, [operationalCosts, operationalCostPayments]);

  useEffect(() => {
    if (!allExpenseInstances || allExpenseInstances.length === 0) return;

    allExpenseInstances.forEach(expense => {
      // Notificação para "Vencendo Hoje"
      if (isToday(expense.due_date) && expense.status === 'Em aberto' && !notifiedExpenses.current.has(`due-today-${expense.id}`)) {
        createNotificationMutation.mutate({
          message: `A despesa "${expense.description}" no valor de ${expense.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} vence hoje.`,
          type: 'expense_due_today',
          quote_id: null,
        });
        notifiedExpenses.current.add(`due-today-${expense.id}`);
      }

      // Notificação para "Atrasada"
      if (expense.status === 'Atrasada' && !notifiedExpenses.current.has(`overdue-${expense.id}`)) {
        createNotificationMutation.mutate({
          message: `A despesa "${expense.description}" no valor de ${expense.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} está atrasada desde ${format(expense.due_date, 'dd/MM/yyyy', { locale: ptBR })}.`,
          type: 'expense_overdue',
          quote_id: null,
        });
        notifiedExpenses.current.add(`overdue-${expense.id}`);
      }
    });
  }, [allExpenseInstances, createNotificationMutation]);
};