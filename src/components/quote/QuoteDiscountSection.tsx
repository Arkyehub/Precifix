import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag } from "lucide-react";

interface QuoteDiscountSectionProps {
  discountValueInput: string;
  onDiscountValueInputChange: (value: string) => void;
  onDiscountValueInputBlur: (value: string) => void;
  discountType: 'amount' | 'percentage';
  onDiscountTypeChange: (type: 'amount' | 'percentage') => void;
  calculatedDiscount: number;
}

export const QuoteDiscountSection = ({
  discountValueInput,
  onDiscountValueInputChange,
  onDiscountValueInputBlur,
  discountType,
  onDiscountTypeChange,
  calculatedDiscount,
}: QuoteDiscountSectionProps) => {
  return (
    <div className="space-y-2 pt-4 border-t border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <Tag className="h-4 w-4 text-primary" />
        <Label htmlFor="discount-value" className="text-sm font-medium">Desconto</Label>
      </div>
      <div className="flex gap-2">
        <Input
          id="discount-value"
          type="text"
          step="0.01"
          value={discountValueInput}
          onChange={(e) => onDiscountValueInputChange(e.target.value)}
          onBlur={(e) => onDiscountValueInputBlur(e.target.value)}
          className="flex-1 bg-background"
          placeholder="0,00"
        />
        <Select value={discountType} onValueChange={onDiscountTypeChange}>
          <SelectTrigger className="w-[120px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="amount">Valor (R$)</SelectItem>
            <SelectItem value="percentage">Porcentagem (%)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {calculatedDiscount > 0 && (
        <p className="text-sm text-muted-foreground mt-2">Desconto aplicado: R$ {calculatedDiscount.toFixed(2)}</p>
      )}
    </div>
  );
};