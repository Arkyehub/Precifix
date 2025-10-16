import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, DollarSign, Clock, Target } from "lucide-react";
import React, { useState, useEffect } from "react"; // Importar React e hooks

interface ResultsProps {
  totalCost: number;
  profitMargin: number;
  executionTime: number;
  onMarginChange: (margin: number) => void;
}

export function Results({ totalCost, profitMargin, executionTime, onMarginChange }: ResultsProps) {
  const [displayProfitMargin, setDisplayProfitMargin] = useState(profitMargin.toFixed(2).replace('.', ',')); // Estado para o valor do input como string

  // Efeito para manter displayProfitMargin sincronizado com a prop profitMargin
  useEffect(() => {
    setDisplayProfitMargin(profitMargin.toFixed(2).replace('.', ','));
  }, [profitMargin]);

  const finalPrice = totalCost / (1 - profitMargin / 100);
  const netProfit = finalPrice - totalCost;
  const profitPercentage = (netProfit / finalPrice) * 100;
  const profitabilityPerHour = executionTime > 0 ? (netProfit / (executionTime / 60)) : 0;

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-[var(--shadow-elegant)] border-border/50">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">Resultados e Precificação</h2>
      </div>

      <div className="space-y-4 mb-6">
        <div className="space-y-2">
          <Label htmlFor="profit-margin" className="text-sm">Margem de Lucro Desejada (%)</Label>
          <Input
            id="profit-margin"
            type="text" // Alterado para type="text"
            step="0.1"
            value={displayProfitMargin} // Usar o estado de string
            onChange={(e) => setDisplayProfitMargin(e.target.value)} // Atualizar o estado de string
            onBlur={(e) => { // No blur, parsear e atualizar o estado numérico e reformatar a string
              const rawValue = e.target.value.replace(',', '.'); // Substituir vírgula por ponto para parseFloat
              const parsedValue = parseFloat(rawValue) || 0;
              onMarginChange(parsedValue); // Chamar o handler do pai
              setDisplayProfitMargin(parsedValue.toFixed(2).replace('.', ',')); // Reformatar com vírgula
            }}
            className="bg-background text-lg font-semibold"
          />
          <p className="text-xs text-muted-foreground">
            Ajuste a margem em tempo real e veja o impacto no preço final
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Custo Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">R$ {totalCost.toFixed(2)}</p>
        </div>

        <div className="p-4 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary/80 font-medium">Preço Sugerido ao Cliente</span>
          </div>
          <p className="text-3xl font-bold text-primary">R$ {finalPrice.toFixed(2)}</p>
        </div>

        <div className="p-4 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 border border-accent/30">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            <span className="text-sm text-accent/80 font-medium">Lucro Líquido</span>
          </div>
          <p className="text-2xl font-bold text-accent">R$ {netProfit.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {profitPercentage.toFixed(1)}% do preço final
          </p>
        </div>

        <div className="p-4 rounded-lg bg-gradient-to-br from-secondary/20 to-secondary/10 border border-secondary/30">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-secondary" />
            <span className="text-sm text-secondary/80 font-medium">Rentabilidade/Hora</span>
          </div>
          <p className="text-2xl font-bold text-secondary">R$ {profitabilityPerHour.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tempo total: {executionTime} min
          </p>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 rounded-lg border border-primary/20">
        <p className="text-sm text-center text-foreground font-medium">
          💡 Preço justo, lucro certo — o sucesso começa na precificação.
        </p>
      </div>
    </Card>
  );
}