import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, CreditCard, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { PaymentMethod } from '../PaymentMethodFormDialog'; // Reutilizar a interface

interface Quote {
  id: string;
  client_name: string;
  total_price: number;
}

interface ConfirmPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quote;
  onConfirm: (paymentMethodId: string, installments: number | null) => void;
  isProcessing: boolean;
}

export const ConfirmPaymentDialog = ({ isOpen, onClose, quote, onConfirm, isProcessing }: ConfirmPaymentDialogProps) => {
  const { user } = useSession();
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');
  const [selectedInstallments, setSelectedInstallments] = useState<number | null>(null);

  // Fetch payment methods
  const { data: paymentMethods, isLoading: isLoadingPaymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ['paymentMethodsForSaleConfirmation', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: methodsData, error: methodsError } = await supabase
        .from('payment_methods')
        .select('*, installments:payment_method_installments(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (methodsError) throw methodsError;
      return methodsData;
    },
    enabled: !!user && isOpen,
  });

  const currentPaymentMethod = paymentMethods?.find(pm => pm.id === selectedPaymentMethodId);

  useEffect(() => {
    if (isOpen) {
      // Tenta pré-selecionar o primeiro método de pagamento
      if (paymentMethods && paymentMethods.length > 0) {
        setSelectedPaymentMethodId(paymentMethods[0].id);
        if (paymentMethods[0].type === 'credit_card' && paymentMethods[0].installments?.length) {
          // Seleciona 1x por padrão para crédito
          setSelectedInstallments(1);
        } else {
          setSelectedInstallments(null);
        }
      }
    }
  }, [isOpen, paymentMethods]);

  useEffect(() => {
    if (currentPaymentMethod?.type === 'credit_card' && currentPaymentMethod.installments?.length) {
      // Se mudar para crédito, garante que 1x esteja selecionado
      if (!selectedInstallments) {
        setSelectedInstallments(1);
      }
    } else {
      // Se mudar para outro tipo, limpa as parcelas
      setSelectedInstallments(null);
    }
  }, [currentPaymentMethod, selectedInstallments]);

  const handlePaymentMethodChange = (value: string) => {
    setSelectedPaymentMethodId(value);
    const method = paymentMethods?.find(pm => pm.id === value);
    if (method?.type === 'credit_card' && method.installments?.length) {
      setSelectedInstallments(1);
    } else {
      setSelectedInstallments(null);
    }
  };

  const handleInstallmentsChange = (value: string) => {
    setSelectedInstallments(parseInt(value, 10));
  };

  const handleConfirmClick = () => {
    if (selectedPaymentMethodId) {
      onConfirm(selectedPaymentMethodId, selectedInstallments);
    }
  };

  const isCreditCard = currentPaymentMethod?.type === 'credit_card';
  const isInstallmentsRequired = isCreditCard && currentPaymentMethod?.installments?.length;
  const isFormValid = selectedPaymentMethodId && (!isInstallmentsRequired || selectedInstallments !== null);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Confirmar Pagamento
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
            <p className="text-sm font-medium text-foreground">Cliente: {quote.client_name}</p>
            <p className="text-xl font-bold text-primary flex items-center gap-1 mt-1">
              <DollarSign className="h-5 w-5" />
              R$ {quote.total_price.toFixed(2)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-method-select">Forma de Pagamento *</Label>
            <Select 
              value={selectedPaymentMethodId} 
              onValueChange={handlePaymentMethodChange}
              disabled={isLoadingPaymentMethods || isProcessing}
            >
              <SelectTrigger id="payment-method-select" className="bg-background">
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingPaymentMethods ? (
                  <SelectItem value="loading" disabled>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando...
                  </SelectItem>
                ) : paymentMethods?.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    {method.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isCreditCard && currentPaymentMethod.installments && (
            <div className="space-y-2">
              <Label htmlFor="installments-select">Número de Parcelas *</Label>
              <Select
                value={selectedInstallments?.toString() || ''}
                onValueChange={handleInstallmentsChange}
                disabled={isProcessing}
              >
                <SelectTrigger id="installments-select" className="bg-background">
                  <SelectValue placeholder="Selecione as parcelas" />
                </SelectTrigger>
                <SelectContent>
                  {currentPaymentMethod.installments.map((inst) => (
                    <SelectItem key={inst.installments} value={inst.installments.toString()}>
                      {inst.installments}x ({inst.rate.toFixed(2)}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>Cancelar</Button>
          <Button 
            onClick={handleConfirmClick} 
            disabled={!isFormValid || isProcessing}
            className="bg-success hover:bg-success/90"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finalizando Venda...
              </>
            ) : (
              "Confirmar e Concluir"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};