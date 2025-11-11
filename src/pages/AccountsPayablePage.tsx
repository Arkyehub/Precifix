import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { OperationalCost } from '@/types/costs';
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

interface ExpenseInstance {
  id: string; // ID único para a instância (pode ser o original ou gerado)
  original_cost_id: string; // ID do custo operacional original
  description: string;
  value: number;
  due_date: Date;
  status: 'Paga' | 'Em aberto' | 'Atrasada';
  is_paid: boolean; // Indica se esta instância específica foi paga
  paid_date?: Date; // Data de pagamento desta instância
}

const generateExpenseInstances = (costs: OperationalCost[], today: Date): ExpenseInstance[] => {
  const instances: ExpenseInstance[] = [];
  const startOfToday = startOfDay(today);

  costs.forEach(cost => {
    if (!cost.expense_date) return;

    const initialDueDate = new Date(cost.expense_date);

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
        paid_date: cost.paid_date ? new Date(cost.paid_date) : undefined,
      });
    } else {
      // Custo recorrente
      const recurrenceEndDate = cost.recurrence_end_date ? new Date(cost.recurrence_end_date) : new Date(today.getFullYear() + 10, 0, 1); // Default to 10 years if no end date

      let currentDueDate = initialDueDate;
      let instanceCount = 0;

      while (currentDueDate <= recurrenceEndDate && currentDueDate <= addMonths(startOfToday, 12)) { // Limit to 12 months in the future for performance
        const instanceId = `${cost.id}-${format(currentDueDate, 'yyyyMMdd')}`; // Unique ID for each instance

        // For recurring costs, we assume 'Em aberto' or 'Atrasada' for now,
        // as marking individual instances as paid requires a separate tracking mechanism.
        const status: ExpenseInstance['status'] = isPast(currentDueDate) && !isToday(currentDueDate)
          ? 'Atrasada'
          : 'Em aberto';

        instances.push({
          id: instanceId,
          original_cost_id: cost.id,
          description: cost.description,
          value: cost.value,
          due_date: currentDueDate,
          status,
          is_paid: false, // Recurring instances are not marked as paid in the template
          paid_date: undefined,
        });

        // Move to the next due date
        if (cost.recurrence_frequency === 'daily') {
          currentDueDate = addDays(currentDueDate, 1);
        } else if (cost.recurrence_frequency === 'weekly') {
          currentDueDate = addWeeks(currentDueDate, 1);
        } else if (cost.recurrence_frequency === 'monthly') {
          currentDueDate = addMonths(currentDueDate, 1);
        } else {
          break; // Should not happen with 'none' handled above
        }
        instanceCount++;
        if (instanceCount > 365 * 10) break; // Safety break for extremely long recurrences
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

  const markAsPaidMutation = useMutation({
    mutationFn: async (costId: string) => {
      if (!user) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from('operational_costs')
        .update({ is_paid: true, paid_date: format(new Date(), 'yyyy-MM-dd') })
        .eq('id', costId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operationalCosts', user?.id] });
      toast({
        title: "Custo marcado como pago!",
        description: "O custo foi atualizado com sucesso.",
      });
    },
    onError: (err) => {
      toast({
        title: "Erro ao marcar custo como pago",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const allExpenseInstances = useMemo(() => {
    if (!operationalCosts) return [];
    return generateExpenseInstances(operationalCosts, new Date());
  }, [operationalCosts]);

  const filteredExpenses = useMemo(() => {
    let filtered = allExpenseInstances;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(expense =>
        expense.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(expense => expense.status === statusFilter);
    }

    // Filter by date range
    if (dateRange.from) {
      filtered = filtered.filter(expense =>
        expense.due_date >= startOfDay(dateRange.from!)
      );
    }
    if (dateRange.to) {
      filtered = filtered.filter(expense =>
        expense.due_date <= endOfDay(dateRange.to!)
      );
    }

    return filtered;
  }, [allExpenseInstances, searchQuery, statusFilter, dateRange]);

  if (isLoading) return <div>Carregando contas a pagar...</div>;
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
              <TableHead>Valor</TableHead>
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
                    {!expense.is_paid && expense.status !== 'Atrasada' && ( // Only allow marking as paid if not already paid and not overdue
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markAsPaidMutation.mutate(expense.original_cost_id)}
                        disabled={markAsPaidMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Pagar
                      </Button>
                    )}
                    {expense.status === 'Atrasada' && !expense.is_paid && (
                      <Button variant="destructive" size="sm" disabled>
                        <XCircle className="h-4 w-4 mr-2" /> Atrasada
                      </Button>
                    )}
                    {expense.is_paid && (
                      <Button variant="ghost" size="sm" disabled>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> Paga
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Nenhuma despesa encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AccountsPayablePage;