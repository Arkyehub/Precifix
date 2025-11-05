import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, DollarSign, Clock, Target } from "lucide-react";
import { formatMinutesToHHMM } from "@/lib/cost-calculations";

interface QuoteCalculationSummaryProps {
  totalExecutionTime: number;
  totalProductsCost: number;
  totalLaborCost: number;
  totalOtherCosts: number;
  otherCostsGlobal: number;
  calculatedCommission: number; // NOVO
  totalCost: number;
  totalServiceValue: number;
  currentProfitMarginPercentage: number;
  profitMargin: number;
  displayProfitMargin: string;
  onProfitMarginChange: (value: number) => void;
  onDisplayProfitMarginChange: (value: string) => void;
  suggestedPriceBasedOnDesiredMargin: number;
  selectedPaymentMethodId: string | null;
  paymentFee: number;
  finalPriceWithFee: number; // Valor a Receber (receita)
  valueAfterDiscount: number;
  netProfit: number; // Lucro Líquido
}

export const QuoteCalculationSummary = ({
  totalExecutionTime,
  totalProductsCost,
  totalLaborCost,
  totalOtherCosts,
  otherCostsGlobal,
  calculatedCommission, // NOVO
  totalCost,
  totalServiceValue,
  currentProfitMarginPercentage,
  profitMargin,
  displayProfitMargin,
  onProfitMarginChange,
  onDisplayProfitMarginChange,
  suggestedPriceBasedOnDesiredMargin,
  selectedPaymentMethodId,
  paymentFee,
  finalPriceWithFee,
  valueAfterDiscount,
  netProfit,
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
      
      {/* NOVO: Comissão */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground font-bold text-destructive">Comissão (Custo):</span>
        <span className="font-bold text-destructive">R$ {calculatedCommission.toFixed(2)}</span>
      </div>

      {/* Custo Total da Operação */}
      <div className="p-4 bg-background rounded-lg border border-border/50 border-l-4 border-primary shadow-md mt-4">
        <div className="flex justify-between items-center">
          <span className="font-medium text-foreground">Custo Total da Operação:</span>
          <span className="text-2xl font-bold text-primary">R$ {totalCost.toFixed(2)}</span>
        </div>
      </div>

      {/* Valor do Serviço (antes do desconto) */}
      <div className="p-4 bg-background rounded-lg border border-border/50 border-l-4 border-accent shadow-md mt-4">
        <div className="flex justify-between items-center">
          <span className="font-medium text-foreground">Valor do Serviço (antes do desconto):</span>
          <span className="text-3xl font-bold text-accent">R$ {totalServiceValue.toFixed(2)}</span>
        </div>
      </div>

      {/* Demonstrativo da Taxa da Forma de Pagamento */}
      {selectedPaymentMethodId && paymentFee > 0 && (
        <div className="p-4 bg-background rounded-lg border border-border/50 border-l-4 border-info shadow-md mt-4">
          <div className="flex justify-between items-center">
            <span className="font-medium text-foreground">Taxa da Forma de Pagamento (dedução):</span>
            <span className="text-xl font-bold text-info">- R$ {paymentFee.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Novo item para Valor a Receber (final) */}
      <div className="flex justify-between items-center text-sm pt-4 border-t border-border/50">
        <span className="font-medium text-foreground">Valor a Receber (final):</span>
        <span className="text-xl font-bold text-success">R$ {finalPriceWithFee.toFixed(2)}</span>
      </div>

      {/* Lucro Líquido & Margem de Lucro Real */}
      <div className="p-4 bg-background rounded-lg border border-border/50 border-l-4 border-success shadow-md mt-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-medium text-foreground">Lucro Líquido:</span>
          <span className="text-3xl font-bold text-success">R$ {netProfit.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-success/30">
          <span className="font-medium text-foreground">Margem de Lucro Real:</span>
          <span className="text-xl font-bold text-purple-500">{currentProfitMarginPercentage.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};