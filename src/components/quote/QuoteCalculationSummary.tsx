import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Percent, Clock, Target } from "lucide-react";
import { formatMinutesToHHMM } from "@/lib/cost-calculations";

interface QuoteCalculationSummaryProps {
  totalExecutionTime: number;
  totalProductsCost: number;
  totalLaborCost: number;
  totalOtherCosts: number;
  otherCostsGlobal: number;
  totalCost: number;
  totalServiceValue: number; // Renamed from totalChargedValue
  currentProfitMarginPercentage: number;
  profitMargin: number;
  displayProfitMargin: string;
  onProfitMarginChange: (value: number) => void;
  onDisplayProfitMarginChange: (value: string) => void;
  suggestedPriceBasedOnDesiredMargin: number;
  selectedPaymentMethodId: string | null;
  paymentFee: number;
  finalPriceWithFee: number;
  valueAfterDiscount: number; // Added to pass the value after discount
}

export const QuoteCalculationSummary = ({
  totalExecutionTime,
  totalProductsCost,
  totalLaborCost,
  totalOtherCosts,
  otherCostsGlobal,
  totalCost,
  totalServiceValue, // Renamed
  currentProfitMarginPercentage,
  profitMargin,
  displayProfitMargin,
  onProfitMarginChange,
  onDisplayProfitMarginChange,
  suggestedPriceBasedOnDesiredMargin,
  selectedPaymentMethodId,
  paymentFee,
  finalPriceWithFee,
  valueAfterDiscount, // Added
}: QuoteCalculationSummaryProps) => {

  const handleProfitMarginBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(',', '.');
    const parsedValue = parseFloat(rawValue) || 0;
    onProfitMarginChange(parsedValue);
    onDisplayProfitMarginChange(parsedValue.toFixed(2).replace('.', ','));
  };

  return (
    <div className="pt-4 border-t border-border/50 space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Tempo Total de Execução:</span>
        <span className="font-medium text-foreground">{formatMinutesToHHMM(totalExecutionTime)}</span>
      </div>
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Custo de Produtos (estimado):</span>
        <span className="font-medium text-foreground">R$ {totalProductsCost.toFixed(2)}</span>
      </div>
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Custo de Mão de Obra:</span>
        <span className="font-medium text-foreground">R$ {totalLaborCost.toFixed(2)}</span>
      </div>
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Outros Custos por Serviço:</span>
        <span className="font-medium text-foreground">R$ {totalOtherCosts.toFixed(2)}</span>
      </div>
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Outros Custos Globais:</span>
        <span className="font-medium text-foreground">R$ {otherCostsGlobal.toFixed(2)}</span>
      </div>
      <div className="p-4 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg border border-primary/30 mt-4">
        <div className="flex justify-between items-center">
          <span className="font-medium text-foreground">Custo Total da Operação:</span>
          <span className="text-2xl font-bold text-primary">R$ {totalCost.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Nova estrutura para Comparativo de Margem de Lucro e Preço */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        {/* Coluna de Valores Atuais */}
        <div className="p-4 bg-gradient-to-r from-accent/20 to-accent/10 rounded-lg border border-accent/30">
          <div className="flex justify-between items-center">
            <span className="font-medium text-foreground">Valor do Serviço:</span> {/* Changed label */}
            <span className="text-3xl font-bold text-accent">R$ {totalServiceValue.toFixed(2)}</span> {/* Uses totalServiceValue */}
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="font-medium text-foreground">Margem de Lucro Atual:</span>
            <span className="text-xl font-bold text-accent">{currentProfitMarginPercentage.toFixed(1)}%</span>
          </div>
        </div>

        {/* Coluna de Margem Desejada e Preço Sugerido */}
        <div className="p-4 bg-gradient-to-br from-card to-card/80 rounded-lg border border-border/50">
          <div className="space-y-2">
            <Label htmlFor="profit-margin" className="text-sm">Margem de Lucro Desejada (%)</Label>
            <Input
              id="profit-margin"
              type="text"
              step="0.1"
              value={displayProfitMargin}
              onChange={(e) => onDisplayProfitMarginChange(e.target.value)}
              onBlur={handleProfitMarginBlur}
              className="bg-background text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Ajuste a margem para ver um preço sugerido.
            </p>
          </div>
          <div className="flex justify-between items-center mt-4">
            <span className="font-medium text-foreground">Preço Sugerido (com margem desejada):</span>
            <span className="text-xl font-bold text-primary">R$ {suggestedPriceBasedOnDesiredMargin.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Demonstrativo da Taxa da Forma de Pagamento */}
      {selectedPaymentMethodId && paymentFee > 0 && (
        <div className="p-4 bg-gradient-to-r from-blue-500/10 to-blue-500/5 rounded-lg border border-blue-500/30 mt-4">
          <div className="flex justify-between items-center">
            <span className="font-medium text-foreground">Taxa da Forma de Pagamento:</span>
            <span className="text-xl font-bold text-blue-500">R$ {paymentFee.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Preço Final com Taxa */}
      <div className="p-4 bg-gradient-to-r from-green-500/20 to-green-500/10 rounded-lg border border-green-500/30 mt-4">
        <div className="flex justify-between items-center">
          <span className="font-medium text-foreground">Valor a Receber (com desconto e taxa):</span> {/* Changed label */}
          <span className="text-3xl font-bold text-green-500">R$ {finalPriceWithFee.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};