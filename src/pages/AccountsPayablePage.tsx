import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { OperationalCost, OperationalCostPayment } from '@/types/costs';
import { format, isPast, isToday, addDays, addWeeks, addMonths, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, ChevronDown, Search, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DateRange } from 'react-day-picker';
import { PaymentEditDialog } from '@/components/costs/PaymentEditDialog';

interface ExpenseInstance {
  id: string; // ID único para a instância (pode ser o original ou gerado)
  original_cost_id: string; // ID do custo operacional original
  description: string;
  value: number; // Valor original do custo
  due_date: Date;
  status: 'Paga' | 'Em aberto' | 'Atrasada';
  is_paid: boolean; // Indica se esta instância específica foi paga
  paid_value?: number; // Valor efetivamente pago para esta instância
  paid_date?: Date; // Data de pagamento desta instância
  is_recurring: boolean; // Adicionar para saber se é recorrente
  payment_record_id?: string; // NOVO: ID do registro na tabela operational_cost_payments, se existir
}

const generateExpenseInstances = (
  costs: OperationalCost[],
  payments: OperationalCostPayment[],
  today: Date,
): ExpenseInstance[] => {
  const instances: ExpenseInstance[] = [];
  const startOfToday = startOfDay(today);

  const paymentMap = new Map<string, OperationalCostPayment>();
  payments.forEach(payment => {
    paymentMap.set(`${payment.operational_cost_id}-${payment.due_date}`, payment);
  });

  costs.forEach(cost => {
    if (!cost.expense_date) return;

    // Parse the date string to a local Date object to avoid timezone issues
    const [year, month, day] = cost.expense_date.split('-').map(Number);
    const initialDueDate = new Date(year, month - 1, day);

    if (!cost.is_recurring || cost.recurrence_frequency === 'none') {
      // Custo não recorrente
      const status: ExpenseInstance['status'] = cost.is_paid
        ? 'Paga'
        : isPast(initialDueDate) && !isToday(initialDueDate)
          ? 'Atrasada'
          : 'Em aberto';

      instances.push({
        id: cost.id,
        original_cost_id: cost.id,
        description: cost.description,
        value: cost.value,
        due_date: initialDueDate,
        status,
        is_paid: cost.is_paid || false,
        paid_value: cost.is_paid ? cost.value : undefined, // Para custos não recorrentes, o valor pago é o valor original
        paid_date: cost.paid_date ? new Date(cost.paid_date) : undefined,
        is_recurring: false,
        payment_record_id: undefined, // Não há registro de pagamento separado para custos não recorrentes
      });
    } else {
      // Custo recorrente
      const recurrenceEndDate = cost.recurrence_end_date
        ? new Date(
            Number(cost.recurrence_end_date.split('-')[0]),
            Number(cost.recurrence_end_date.split('-')[1]) - 1,
            Number(cost.recurrence_end_date.split('-')[2]),
          )
        : new Date(today.getFullYear() + 10, 0, 1); // Default to 10 years if no end date

      let currentDueDate = initialDueDate;
      let instanceCount = 0;

      while (currentDueDate <= recurrenceEndDate && currentDueDate <= addMonths(startOfToday, 12)) {
        const instanceKey = `${cost.id}-${format(currentDueDate, 'yyyy-MM-dd')}`;
        const payment = paymentMap.get(instanceKey);

        let instanceIsPaid = false;
        let instancePaidValue: number | undefined;
        let instancePaidDate: Date | undefined;
        let instanceStatus: ExpenseInstance['status'];
        let paymentRecordId: string | undefined; // Variável para armazenar o ID do registro de pagamento

        if (payment && payment.is_paid) {
          instanceIsPaid = true;
          instancePaidValue = payment.paid_value;
          instancePaidDate = new Date(payment.paid_date);
          instanceStatus = 'Paga';
          paymentRecordId = payment.id; // Armazena o ID real do registro de pagamento
        } else {
          instanceIsPaid = false;
          instancePaidValue = undefined;
          instancePaidDate = undefined;
          instanceStatus =
            isPast(currentDueDate) && !isToday(currentDueDate) ? 'Atrasada' : 'Em aberto';
          paymentRecordId = undefined;
        }

        instances.push({
          id: instanceKey, // Usar a chave como ID para instâncias recorrentes
          original_cost_id: cost.id,
          description: cost.description,
          value: cost.value,
          due_date: currentDueDate,
          status: instanceStatus,
          is_paid: instanceIsPaid,
          paid_value: instancePaidValue,
          paid_date: instancePaidDate,
          is_recurring: true,
          payment_record_id: paymentRecordId, // Adiciona o ID do registro de pagamento
        });

        if (cost.recurrence_frequency === 'daily') {
          currentDueDate = addDays(currentDueDate, 1);
        } else if (cost.recurrence_frequency === 'weekly') {
          currentDueDate = addWeeks(currentDueDate, 1);
        } else if (cost.recurrence_frequency === 'monthly') {
          currentDueDate = addMonths(currentDueDate, 1);
        } else {
          break;
        }
        instanceCount++;
        if (instanceCount > 365 * 10) break;
      }
    }
  });

  return instances.sort((a, b) => a.due_date.getTime() - b.due_date.getTime());
};

const AccountsPayablePage = () => {
  const { user } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Paga' | 'Em aberto' | 'Atrasada'>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseInstance | null>(null);

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
      paymentRecordId, // Renomeado de paymentId para paymentRecordId
    }: {
      originalCostId: string;
      dueDate: Date;
      paidValue: number;
      isPaid: boolean;
      isRecurring: boolean;
      paymentRecordId?: string; // NOVO: ID do registro de pagamento
    }) => {
      if (!user) throw new Error('Usuário não autenticado.');

      if (isRecurring) {
        // Para custos recorrentes, insere/atualiza na tabela operational_cost_payments
        const paymentData = {
          user_id: user.id,
          operational_cost_id: originalCostId,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          paid_value: paidValue,
          paid_date: format(new Date(), 'yyyy-MM-dd'),
          is_paid: isPaid,
        };

        if (paymentRecordId && isPaid) { // Se já existe e está sendo editado para pago
          const { error } = await supabase
            .from('operational_cost_payments')
            .update(paymentData)
            .eq('id', paymentRecordId) // Usa o paymentRecordId real
            .eq('user_id', user.id);
          if (error) throw error;
        } else if (isPaid) { // Se não existe e está sendo marcado como pago
          const { error } = await supabase
            .from('operational_cost_payments')
            .insert(paymentData);
          if (error) throw error;
        } else { // Se está sendo marcado como não pago, deleta o registro de pagamento
          const { error } = await supabase
            .from('operational_cost_payments')
            .delete()
            .eq('operational_cost_id', originalCostId)
            .eq('due_date', format(dueDate, 'yyyy-MM-dd'))
            .eq('user_id', user.id);
          if (error) throw error;
        }
      } else {
        // Para custos não recorrentes, atualiza na tabela operational_costs
        const { error } = await supabase
          .from('operational_costs')
          .update({
            is_paid: isPaid,
            paid_date: isPaid ? format(new Date(), 'yyyy-MM-dd') : null,
            value: paidValue, // Atualiza o valor original para custos não recorrentes
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

    if (dateRange.from) {
      filtered = filtered.filter(expense => expense.due_date >= startOfDay(dateRange.from!));
    }
    if (dateRange.to) {
      filtered = filtered.filter(expense => expense.due_date <= endOfDay(dateRange.to!));
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
    paymentRecordId?: string, // Renomeado de paymentId para paymentRecordId
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
      <h1 className="text-3xl font-bold">Contas a Pagar</h1>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-full sm:w-1/3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar despesa..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              Status: {statusFilter === 'all' ? 'Todos' : statusFilter} <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter('all')}>Todos</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('Paga')}>Paga</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('Em aberto')}>Em aberto</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('Atrasada')}>Atrasada</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-full sm:w-[300px] justify-start text-left font-normal",
                !dateRange.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y", { locale: ptBR })} -{" "}
                    {format(dateRange.to, "LLL dd, y", { locale: ptBR })}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y", { locale: ptBR })
                )
              ) : (
                <span>Filtrar por data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor Original</TableHead>
              <TableHead>Valor Pago</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExpenses.length > 0 ? (
              filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{expense.description}</TableCell>
                  <TableCell>{format(expense.due_date, 'dd/MM/yyyy')}</TableCell>
                  <TableCell>R$ {expense.value.toFixed(2)}</TableCell>
                  <TableCell>
                    {expense.is_paid && expense.paid_value !== undefined
                      ? `R$ ${expense.paid_value.toFixed(2)}`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-semibold",
                      expense.status === 'Paga' && "bg-green-100 text-green-800",
                      expense.status === 'Em aberto' && "bg-yellow-100 text-yellow-800",
                      expense.status === 'Atrasada' && "bg-red-100 text-red-800"
                    )}>
                      {expense.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {!expense.is_paid ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenPaymentDialog(expense)}
                        disabled={markAsPaidMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Pagar
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenPaymentDialog(expense)}
                        disabled={markAsPaidMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Editar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Nenhuma despesa encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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