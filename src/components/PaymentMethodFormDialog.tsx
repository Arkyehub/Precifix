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
import { CreditCardInstallmentRates } from './CreditCardInstallmentRates'; // Importar o novo componente

export interface PaymentMethodInstallment {
  id: string;
  payment_method_id: string;
  installments: number;
  rate: number;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  user_id: string;
  name: string;
  type: 'cash' | 'pix' | 'credit_card' | 'debit_card';
  rate: number; // Base rate
  created_at: string;
  installments?: PaymentMethodInstallment[]; // Only for credit_card type
}

interface PaymentMethodFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  paymentMethod?: PaymentMethod; // Optional for editing
}

export const PaymentMethodFormDialog = ({ isOpen, onClose, paymentMethod }: PaymentMethodFormDialogProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState(paymentMethod?.name || '');
  const [type, setType] = useState<'cash' | 'pix' | 'credit_card' | 'debit_card'>(paymentMethod?.type || 'cash');
  const [baseRate, setBaseRate] = useState(paymentMethod?.rate.toFixed(2) || '0.00');
  const [installmentRates, setInstallmentRates] = useState<PaymentMethodInstallment[]>(paymentMethod?.installments || []);

  useEffect(() => {
    if (paymentMethod) {
      setName(paymentMethod.name);
      setType(paymentMethod.type);
      setBaseRate(paymentMethod.rate.toFixed(2));
      setInstallmentRates(paymentMethod.installments || []);
    } else {
      setName('');
      setType('cash');
      setBaseRate('0.00');
      setInstallmentRates([]);
    }
  }, [paymentMethod, isOpen]);

  const upsertPaymentMethodMutation = useMutation({
    mutationFn: async (newMethod: Omit<PaymentMethod, 'id' | 'created_at' | 'installments'> & { id?: string, installmentsToSave?: PaymentMethodInstallment[] }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      let methodData: PaymentMethod;
      if (newMethod.id) {
        // Update existing payment method
        const { data, error } = await supabase
          .from('payment_methods')
          .update({ 
            name: newMethod.name, 
            type: newMethod.type, 
            rate: newMethod.rate,
          })
          .eq('id', newMethod.id)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        methodData = data;
      } else {
        // Insert new payment method
        const { data, error } = await supabase
          .from('payment_methods')
          .insert({ 
            name: newMethod.name, 
            type: newMethod.type, 
            rate: newMethod.rate,
            user_id: user.id 
          })
          .select()
          .single();
        if (error) throw error;
        methodData = data;
      }

      // Handle installments if it's a credit card
      if (methodData.type === 'credit_card' && newMethod.installmentsToSave) {
        const installmentUpserts = newMethod.installmentsToSave.map(inst => ({
          ...inst,
          payment_method_id: methodData.id,
        }));

        const { error: upsertInstallmentsError } = await supabase
          .from('payment_method_installments')
          .upsert(installmentUpserts, { onConflict: 'payment_method_id, installments' });
        
        if (upsertInstallmentsError) throw upsertInstallmentsError;
      } else if (methodData.type !== 'credit_card' && newMethod.id) {
        // If type changed from credit_card to something else, delete old installments
        const { error: deleteInstallmentsError } = await supabase
          .from('payment_method_installments')
          .delete()
          .eq('payment_method_id', methodData.id);
        if (deleteInstallmentsError) console.error("Error deleting old installments:", deleteInstallmentsError);
      }

      return methodData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods', user?.id] });
      toast({
        title: paymentMethod ? "Forma de pagamento atualizada!" : "Forma de pagamento adicionada!",
        description: `${data.name} foi ${paymentMethod ? 'atualizada' : 'adicionada'} com sucesso.`,
      });
      onClose();
    },
    onError: (err) => {
      console.error("Error upserting payment method:", err);
      toast({
        title: paymentMethod ? "Erro ao atualizar forma de pagamento" : "Erro ao adicionar forma de pagamento",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!name || !type) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e Tipo da forma de pagamento são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    // Only validate baseRate if it's not 'cash'
    if (type !== 'cash' && (isNaN(parseFloat(baseRate)) || parseFloat(baseRate) < 0)) {
      toast({
        title: "Taxa inválida",
        description: "A taxa deve ser um número positivo ou zero.",
        variant: "destructive",
      });
      return;
    }

    // Validate installment rates for credit card
    if (type === 'credit_card') {
      const invalidInstallment = installmentRates.find(inst => isNaN(inst.rate) || inst.rate < 0);
      if (invalidInstallment) {
        toast({
          title: "Taxa de parcelamento inválida",
          description: `A taxa para ${invalidInstallment.installments}x deve ser um número positivo ou zero.`,
          variant: "destructive",
        });
        return;
      }
    }

    upsertPaymentMethodMutation.mutate({
      id: paymentMethod?.id,
      name,
      type,
      rate: type === 'cash' ? 0 : parseFloat(baseRate), // Set rate to 0 for cash
      user_id: user!.id,
      installmentsToSave: type === 'credit_card' ? installmentRates : undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card">
        <DialogHeader>
          <DialogTitle>{paymentMethod ? 'Editar Forma de Pagamento' : 'Adicionar Nova Forma de Pagamento'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type" className="text-sm">Tipo de Pagamento *</Label>
            <Select 
              value={type} 
              onValueChange={(value: 'cash' | 'pix' | 'credit_card' | 'debit_card') => setType(value)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type !== 'credit_card' && type !== 'cash' && ( // Condição atualizada aqui
            <div className="space-y-2">
              <Label htmlFor="base-rate">Taxa (%) *</Label>
              <Input id="base-rate" type="number" step="0.01" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} className="bg-background" />
            </div>
          )}

          {type === 'credit_card' && (
            <CreditCardInstallmentRates 
              initialInstallmentRates={installmentRates} 
              onRatesChange={setInstallmentRates} 
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={upsertPaymentMethodMutation.isPending}>
            {upsertPaymentMethodMutation.isPending ? (paymentMethod ? "Salvando..." : "Adicionando...") : (paymentMethod ? "Salvar Alterações" : "Adicionar Forma de Pagamento")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};