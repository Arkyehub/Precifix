import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ExpenseInstance } from '@/lib/expense-utils';

interface AccountsPayableTableProps {
  expenses: ExpenseInstance[];
  onOpenPaymentDialog: (expense: ExpenseInstance) => void;
  isMutationPending: boolean;
}

export const AccountsPayableTable: React.FC<AccountsPayableTableProps> = ({
  expenses,
  onOpenPaymentDialog,
  isMutationPending,
}) => {
  return (
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
          {expenses.length > 0 ? (
            expenses.map((expense) => (
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
                      onClick={() => onOpenPaymentDialog(expense)}
                      disabled={isMutationPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Pagar
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenPaymentDialog(expense)}
                      disabled={isMutationPending}
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
  );
};