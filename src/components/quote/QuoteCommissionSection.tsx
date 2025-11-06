import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

interface QuoteCommissionSectionProps {
  commissionValueInput: string;
  onCommissionValueInputChange: (value: string) => void;
  onCommissionValueInputBlur: (value: string) => void;
  commissionType: 'amount' | 'percentage';
  onCommissionTypeChange: (type: 'amount' | 'percentage') => void;
  calculatedCommission: number;
}

export const QuoteCommissionSection = ({
  commissionValueInput,
  onCommissionValueInputChange,
  onCommissionValueInputBlur,
  commissionType,
  onCommissionTypeChange,
  calculatedCommission,
}: QuoteCommissionSectionProps) => {
  return (
    <div className="space-y-2 pt-4 border-t border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-4 w-4 text-primary" />
        <Label htmlFor="commission-value" className="text-sm font-medium">Comissão (Custo Variável)</Label>
      </div>
      <div className="flex gap-2">
        <Input
          id="commission-value"
          type="text"
          step="0.01"
          value={commissionValueInput}
          onChange={(e) => onCommissionValueInputChange(e.target.value)}
          onBlur={(e) => onCommissionValueInputBlur(e.target.value)}
          className="flex-1 bg-background"
          placeholder="0,00"
        />
        <Select value={commissionType} onValueChange={onCommissionTypeChange}>
          <SelectTrigger className="w-[120px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="amount">Valor (R$)</SelectItem>
            <SelectItem value="percentage">Porcentagem (%)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Espaçador para alinhar com a descrição do Custos Globais */}
      <div className="h-10"> 
        {calculatedCommission > 0 && (
          <p className="text-sm text-muted-foreground mt-2">Comissão aplicada: R$ {calculatedCommission.toFixed(2)}</p>
        )}
      </div>
    </div>
  );
};