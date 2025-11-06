import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QuoteGlobalCostsInputProps {
  otherCostsGlobal: number;
  onOtherCostsGlobalChange: (value: number) => void;
}

export const QuoteGlobalCostsInput = ({
  otherCostsGlobal,
  onOtherCostsGlobalChange,
}: QuoteGlobalCostsInputProps) => {
  const [displayValue, setDisplayValue] = useState(otherCostsGlobal.toFixed(2).replace('.', ','));

  useEffect(() => {
    // Update displayValue if otherCostsGlobal changes from parent
    setDisplayValue(otherCostsGlobal.toFixed(2).replace('.', ','));
  }, [otherCostsGlobal]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value);
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const parsedValueString = rawValue.replace(',', '.'); // Replace comma with dot for parseFloat
    const parsedValue = parseFloat(parsedValueString) || 0;
    onOtherCostsGlobalChange(parsedValue); // Update parent state with number
    setDisplayValue(parsedValue.toFixed(2).replace('.', ',')); // Reformat for display with comma
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="other-costs-global" className="text-sm">Outros Custos Globais (R$)</Label>
      <Input
        id="other-costs-global"
        type="text" // Changed to text
        value={displayValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        className="bg-background"
        placeholder="0,00"
      />
      {/* Contêiner de altura fixa (h-10) para a descrição */}
      <div className="h-10">
        <p className="text-xs text-muted-foreground">Custos adicionais que se aplicam a todo o orçamento, não a um serviço específico.</p>
      </div>
    </div>
  );
};