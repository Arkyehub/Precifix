import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Percent } from 'lucide-react';
import { PaymentMethodInstallment } from './PaymentMethodFormDialog';

interface CreditCardInstallmentRatesProps {
  initialInstallmentRates: PaymentMethodInstallment[];
  onRatesChange: (rates: PaymentMethodInstallment[]) => void;
}

interface LocalInstallmentRate extends PaymentMethodInstallment {
  inputValue: string;
}

export const CreditCardInstallmentRates = ({ initialInstallmentRates, onRatesChange }: CreditCardInstallmentRatesProps) => {
  const [rates, setRates] = useState<LocalInstallmentRate[]>([]);

  useEffect(() => {
    if (initialInstallmentRates.length === 0) {
      const defaultRates: LocalInstallmentRate[] = Array.from({ length: 12 }, (_, i) => ({
        id: `new-${i + 1}`,
        payment_method_id: '',
        installments: i + 1,
        rate: 0.00,
        created_at: new Date().toISOString(),
        inputValue: '',
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
          inputValue: (existing?.rate === 0 || existing?.rate === undefined) ? '' : (existing.rate).toString().replace('.', ','),
        };
      });
      setRates(fullRates);
    }
  }, [initialInstallmentRates]);

  const handleRateChange = (installmentNum: number, value: string) => {
    console.log(`Input para ${installmentNum}x:`, value);
    const newRates = rates.map(item => {
      if (item.installments === installmentNum) {
        const parsedValueString = value.replace(',', '.');
        const parsedValue = parseFloat(parsedValueString);
        
        return {
          ...item,
          rate: isNaN(parsedValue) ? 0 : parsedValue,
          inputValue: value,
        };
      }
      return item;
    });
    setRates(newRates);
    onRatesChange(newRates.map(({ inputValue, ...rest }) => rest));
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
            {item.installments === 1 ? ( // Torna o primeiro input não controlado para teste
              <input
                id={`installments-${item.installments}`}
                type="text"
                defaultValue={item.inputValue} // Usa defaultValue para input não controlado
                onBlur={(e) => handleRateChange(item.installments, e.target.value)} // Atualiza no onBlur
                style={{
                  flex: 1,
                  height: '40px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid hsl(var(--input))',
                  backgroundColor: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  fontSize: '14px',
                  outline: 'none',
                  boxShadow: 'none',
                }}
              />
            ) : ( // Mantém os outros inputs controlados
              <input
                id={`installments-${item.installments}`}
                type="text"
                value={item.inputValue}
                onChange={(e) => handleRateChange(item.installments, e.target.value)}
                style={{
                  flex: 1,
                  height: '40px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid hsl(var(--input))',
                  backgroundColor: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  fontSize: '14px',
                  outline: 'none',
                  boxShadow: 'none',
                }}
              />
            )}
            <span className="text-muted-foreground">%</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};