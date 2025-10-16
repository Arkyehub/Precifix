import React from 'react';
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
  return (
    <div className="space-y-2 md:col-span-2">
      <Label htmlFor="other-costs-global" className="text-sm">Outros Custos Globais (R$)</Label>
      <Input
        id="other-costs-global"
        type="number"
        step="0.01"
        value={otherCostsGlobal.toFixed(2) || ""}
        onChange={(e) => onOtherCostsGlobalChange(parseFloat(e.target.value) || 0)}
        className="bg-background"
      />
      <p className="text-xs text-muted-foreground">Custos adicionais que se aplicam a todo o orçamento, não a um serviço específico.</p>
    </div>
  );
};