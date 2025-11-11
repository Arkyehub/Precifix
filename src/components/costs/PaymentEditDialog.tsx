import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';

interface PaymentEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  expense: {
    id: string;
    original_cost_id: string;
    description: string;
    value: number;
    due_date: Date;
    is_paid: boolean;
    paid_value?: number;
    paid_date?: Date;
    payment_record_id?: string; // Adicionado para passar o ID do registro de pagamento
  };
  onConfirm: (
    originalCostId: string,
    dueDate: Date,
    paidValue: number,
    isPaid: boolean,
    isRecurring: boolean,
    paymentRecordId?: string, // Renomeado de paymentId para paymentRecordId
  ) => void;
  isRecurring: boolean;
}

export const PaymentEditDialog: React.FC<PaymentEditDialogProps> = ({
  isOpen,
  onClose,
  expense,
  onConfirm,
  isRecurring,
}) => {
  const [paidValue, setPaidValue] = useState<string>(expense.paid_value ? expense.paid_value.toFixed(2) : expense.value.toFixed(2));
  const [isPaid, setIsPaid] = useState<boolean>(expense.is_paid);

  useEffect(() => {
    if (isOpen) {
      setPaidValue(expense.paid_value ? expense.paid_value.toFixed(2) : expense.value.toFixed(2));
      setIsPaid(expense.is_paid);
    }
  }, [isOpen, expense]);

  const handleConfirm = () => {
    const value = parseFloat(paidValue);
    if (isNaN(value) || value <= 0) {
      // Optionally show a toast error
      return;
    }
    onConfirm(
      expense.original_cost_id,
      expense.due_date,
      value,
      isPaid,
      isRecurring,
      expense.payment_record_id // Passa o payment_record_id
    );
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{expense.is_paid ? 'Editar Pagamento' : 'Registrar Pagamento'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Descrição
            </Label>
            <Input id="description" value={expense.description} className="col-span-3" disabled />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="dueDate" className="text-right">
              Vencimento
            </Label>
            <Input
              id="dueDate"
              value={format(expense.due_date, 'dd/MM/yyyy')}
              className="col-span-3"
              disabled
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="paidValue" className="text-right">
              Valor Pago
            </Label>
            <Input
              id="paidValue"
              type="number"
              value={paidValue}
              onChange={(e) => setPaidValue(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="isPaid" className="text-right">
              Pago
            </Label>
            <Checkbox
              id="isPaid"
              checked={isPaid}
              onCheckedChange={(checked) => setIsPaid(checked as boolean)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};