import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Percent } from 'lucide-react';
import { PaymentMethodInstallment } from './PaymentMethodFormDialog';
import { cn } from '@/lib/utils'; // Importar cn para aplicar as classes do shadcn/ui

interface CreditCardInstallmentRatesProps {
  initialInstallmentRates: PaymentMethodInstallment[];
  onRatesChange: (rates: PaymentMethodInstallment[]) => void;
}

interface LocalInstallmentRate extends PaymentMethodInstallment {
  // Não precisamos mais de inputValue no estado local, pois o input será não controlado.
  // O valor será lido diretamente do evento onBlur.
}

export const CreditCardInstallmentRates = ({ initialInstallmentRates, onRatesChange }: CreditCardInstallmentRatesProps) => {
  const [rates, setRates] = useState<LocalInstallmentRate[]>([]);

  // Usamos um ref para armazenar o estado interno dos inputs não controlados
  const inputRefs = React.useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    if (initialInstallmentRates.length === 0) {
      const defaultRates: LocalInstallmentRate[] = Array.from({ length: 12 }, (_, i) => ({
        id: `new-${i + 1}`,
        payment_method_id: '',
        installments: i + 1,
        rate: 0.00,
        created_at: new Date().toISOString(),
      }));
      setRates(defaultRates);
    } else {
      const existingInstallmentsMap = new Map(initialInstallmentRates.map(item => [item.installments, item]));
      const fullRates: LocalInstallmentRate[] = Array.from({ length: 12 }, (_, i) => {
        const installmentNum = i + 1;
        const existing = existingInstallmentsMap.get(installmentNum);
        return {
          id: existing?.id || `new-${installmentNum}`,
          payment_method_id: existing?.payment_method_id || initialInstallmentRates[0]?.payment_method_id || '',
          installments: installmentNum,
          rate: existing?.rate || 0.00,
          created_at: existing?.created_at || new Date().toISOString(),
        };
      });
      setRates(fullRates);
    }
  }, [initialInstallmentRates]);

  const handleBlur = (installmentNum: number, event: React.FocusEvent<HTMLInputElement>) => {
    const value = event.target.value;
    console.log(`Input para ${installmentNum}x (onBlur):`, value); // Log do valor bruto de entrada

    const newRates = rates.map(item => {
      if (item.installments === installmentNum) {
        const parsedValueString = value.replace(',', '.');
        const parsedValue = parseFloat(parsedValueString);
        
        return {
          ...item,
          rate: isNaN(parsedValue) ? 0 : parsedValue,
        };
      }
      return item;
    });
    setRates(newRates);
    onRatesChange(newRates); // Passa os objetos PaymentMethodInstallment reais para o pai
  };

  // Função para formatar o valor para exibição no defaultValue
  const formatRateForDisplay = (rate: number): string => {
    return (rate === 0 || rate === undefined) ? '' : rate.toFixed(2).replace('.', ',');
  };

  return (
    <Card className="bg-background/50 border-border/50 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-primary" />
          <CardTitle className="text-lg text-foreground">Taxas de Parcelamento (Crédito)</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">Defina a taxa para cada número de parcelas.</p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3">
        {rates.map((item) => (
          <div key={item.installments} className="flex items-center space-x-2">
            <Label htmlFor={`installments-${item.installments}`} className="w-10 text-right">
              {item.installments}x:
            </Label>
            <input // Usando input nativo do HTML e tornando-o não controlado
              id={`installments-${item.installments}`}
              type="text" 
              key={item.id} // Adicionar key para garantir que o defaultValue seja atualizado corretamente
              defaultValue={formatRateForDisplay(item.rate)} // Usa defaultValue
              onBlur={(e) => handleBlur(item.installments, e)} // Atualiza no onBlur
              ref={el => (inputRefs.current[item.installments] = el)} // Armazena a referência
              className={cn( // Aplicando as classes de estilo do shadcn/ui
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                "flex-1 bg-background" // Classes específicas do componente
              )}
            />
            <span className="text-muted-foreground">%</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};