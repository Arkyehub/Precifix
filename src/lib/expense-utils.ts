import { OperationalCost, OperationalCostPayment } from '@/types/costs';
import { format, isPast, isToday, addDays, addWeeks, addMonths, startOfDay, endOfDay } from 'date-fns';

export interface ExpenseInstance {
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

export const generateExpenseInstances = (
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