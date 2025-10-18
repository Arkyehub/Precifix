import React from 'react';
import { BarChart3, CalendarDays, Clock } from 'lucide-react';

interface CostAnalysisSummaryProps {
  sumFixedCosts: number;
  sumVariableCosts: number;
  totalMonthlyExpenses: number;
  dailyCost: number;
  hourlyCost: number;
  totalWorkingDaysInMonth: number;
  averageDailyWorkingHours: number;
}

export const CostAnalysisSummary = ({
  sumFixedCosts,
  sumVariableCosts,
  totalMonthlyExpenses,
  dailyCost,
  hourlyCost,
  totalWorkingDaysInMonth,
  averageDailyWorkingHours,
}: CostAnalysisSummaryProps) => {
  return (
    <div className="space-y-4 pt-6 border-t border-border/50">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h3 className="text-xl font-semibold text-foreground">Análise dos Custos</h3>
      </div>
      <div className="p-4 bg-background rounded-lg border border-border/50 shadow-md space-y-2"> {/* Fundo branco, borda e sombra */}
        <p className="text-sm font-medium text-foreground">
          Total de Gastos no Mês (sem produtos):
        </p>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Despesas Fixas:</span>
          <span className="font-medium text-foreground">R$ {sumFixedCosts.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Despesas Variáveis:</span>
          <span className="font-medium text-foreground">R$ {sumVariableCosts.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-border/50">
          <span className="font-bold text-foreground">Total Mensal:</span>
          <span className="text-lg font-bold text-primary-strong">R$ {totalMonthlyExpenses.toFixed(2)}</span> {/* Cor primary-strong */}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-background border border-success/50 shadow-md"> {/* Fundo branco, borda verde e sombra */}
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-success" />
            <span className="text-sm text-success/80 font-medium">Custo Diário</span>
          </div>
          <p className="text-2xl font-bold text-success">R$ {dailyCost.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Baseado em {totalWorkingDaysInMonth} dias trabalhados/mês
          </p>
        </div>

        <div className="p-4 rounded-lg bg-background border border-info/50 shadow-md"> {/* Fundo branco, borda azul e sombra */}
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-info" />
            <span className="text-sm text-info/80 font-medium">Custo por Hora</span>
          </div>
          <p className="text-2xl font-bold text-info">R$ {hourlyCost.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Considerando {averageDailyWorkingHours.toFixed(1)}h líquidas/dia
          </p>
        </div>
      </div>
    </div>
  );
};