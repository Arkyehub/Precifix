import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Percent } from 'lucide-react';
import { PaymentMethodInstallment } from './PaymentMethodFormDialog';

interface CreditCardInstallmentRatesProps {
  initialInstallmentRates: PaymentMethodInstallment[];
  onRatesChange: (rates: PaymentMethodInstallment[]) => void;
}

export const CreditCardInstallmentRates = ({ initialInstallmentRates, onRatesChange }: CreditCardInstallmentRatesProps) => {
  const [rates, setRates] = useState<PaymentMethodInstallment[]>([]);

  useEffect(() => {
    // Initialize with default 1-12 installments if no initial rates are provided
    if (initialInstallmentRates.length === 0) {
      const defaultRates: PaymentMethodInstallment[] = Array.from({ length: 12 }, (_, i) => ({
        id: `new-${i + 1}`, // Temporary ID for new entries
        payment_method_id: '', // Will be filled on save
        installments: i + 1,
        rate: 0.00,
        created_at: new Date().toISOString(),
      }));
      setRates(defaultRates);
    } else {
      // Ensure all 1-12 installments exist, fill missing with 0.00
      const existingInstallmentsMap = new Map(initialInstallmentRates.map(item => [item.installments, item]));
      const fullRates: PaymentMethodInstallment[] = Array.from({ length: 12 }, (_, i) => {
        const installmentNum = i + 1;
        return existingInstallmentsMap.get(installmentNum) || {
          id: `new-${installmentNum}`,
          payment_method_id: initialInstallmentRates[0]?.payment_method_id || '', // Use existing payment_method_id if available
          installments: installmentNum,
          rate: 0.00,
          created_at: new Date().toISOString(),
        };
      });
      setRates(fullRates);
    }
  }, [initialInstallmentRates]);

  const handleRateChange = (installmentNum: number, value: string) => {
    const newRates = rates.map(item =>
      item.installments === installmentNum
        ? { ...item, rate: parseFloat(value) || 0 }
        : item
    );
    setRates(newRates);
    onRatesChange(newRates);
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
            <Input
              id={`installments-${item.installments}`}
              type="number"
              step="0.01"
              value={item.rate.toFixed(2)}
              onChange={(e) => handleRateChange(item.installments, e.target.value)}
              className="flex-1 bg-background"
            />
            <span className="text-muted-foreground">%</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};