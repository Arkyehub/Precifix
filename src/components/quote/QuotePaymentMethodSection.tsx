import React from 'react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard } from "lucide-react";
import { PaymentMethod } from '../PaymentMethodFormDialog'; // Importar a interface

interface QuotePaymentMethodSectionProps {
  paymentMethods: PaymentMethod[] | undefined;
  isLoadingPaymentMethods: boolean;
  selectedPaymentMethodId: string | null;
  onPaymentMethodSelectChange: (value: string) => void;
  selectedInstallments: number | null;
  onInstallmentsSelectChange: (value: string) => void;
  currentPaymentMethod: PaymentMethod | undefined;
}

export const QuotePaymentMethodSection = ({
  paymentMethods,
  isLoadingPaymentMethods,
  selectedPaymentMethodId,
  onPaymentMethodSelectChange,
  selectedInstallments,
  onInstallmentsSelectChange,
  currentPaymentMethod,
}: QuotePaymentMethodSectionProps) => {
  return (
    <div className="space-y-2 pt-4 border-t border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="h-4 w-4 text-primary" />
        <Label htmlFor="payment-method-select" className="text-sm font-medium">Forma de Pagamento</Label>
      </div>
      <Select 
        value={selectedPaymentMethodId || ''} 
        onValueChange={onPaymentMethodSelectChange}
        disabled={isLoadingPaymentMethods}
      >
        <SelectTrigger id="payment-method-select" className="bg-background">
          <SelectValue placeholder="Selecione a forma de pagamento" />
        </SelectTrigger>
        <SelectContent>
          {paymentMethods?.map((method) => (
            <SelectItem key={method.id} value={method.id}>
              {method.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isLoadingPaymentMethods && <p className="text-sm text-muted-foreground mt-2">Carregando formas de pagamento...</p>}

      {/* Seleção de Parcelas para Cartão de Crédito */}
      {currentPaymentMethod?.type === 'credit_card' && currentPaymentMethod.installments && currentPaymentMethod.installments.length > 0 && (
        <div className="space-y-2 mt-4">
          <Label htmlFor="installments-select" className="text-sm">Número de Parcelas</Label>
          <Select
            value={selectedInstallments?.toString() || ''}
            onValueChange={onInstallmentsSelectChange}
          >
            <SelectTrigger id="installments-select" className="bg-background">
              <SelectValue placeholder="Selecione as parcelas" />
            </SelectTrigger>
            <SelectContent>
              {currentPaymentMethod.installments
                .filter(inst => inst.rate > 0)
                .map((inst) => (
                  <SelectItem key={inst.installments} value={inst.installments.toString()}>
                    {inst.installments}x ({inst.rate.toFixed(2)}%)
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};