import React from 'react';
import { Card } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DailySummary {
  total: number;
  accepted: number;
  pending: number;
  rejected: number;
  closed: number;
  totalValue: number;
  acceptedValue: number;
  pendingValue: number;
  rejectedValue: number;
  closedValue: number;
}

interface AgendaSummaryProps {
  summary: DailySummary;
}

interface SummaryCardProps {
  title: string;
  count: number;
  value: number;
  color: string;
  valueColor: string;
}

const SummaryCard = ({ title, count, value, color, valueColor }: SummaryCardProps) => (
  <Card className="p-4 bg-background border-border/50 shadow-sm">
    <div className="flex items-center justify-between">
      <h5 className={cn("text-sm font-medium", color)}>{title} ({count})</h5>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
          </TooltipTrigger>
          <TooltipContent className="bg-card text-foreground border border-border/50 p-2 rounded-lg shadow-md">
            <p className="text-xs">Total de orçamentos com data de serviço agendada.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
    <p className={cn("text-xl font-bold mt-1", valueColor)}>R$ {value.toFixed(2)}</p>
  </Card>
);

export const AgendaSummary = ({ summary }: AgendaSummaryProps) => {
  const openCount = summary.accepted + summary.pending;
  const openValue = summary.acceptedValue + summary.pendingValue;

  return (
    <div className="space-y-4 pt-4 border-t border-border/50">
      <h4 className="text-lg font-semibold text-foreground">Resumo da Agenda (Dia)</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard
          title="Total"
          count={summary.total}
          value={summary.totalValue}
          color="text-foreground"
          valueColor="text-primary-strong"
        />
        <SummaryCard
          title="Concluídos"
          count={summary.closed}
          value={summary.closedValue}
          color="text-blue-500"
          valueColor="text-blue-500"
        />
        <SummaryCard
          title="Em Aberto"
          count={openCount}
          value={openValue}
          color="text-yellow-500"
          valueColor="text-yellow-500"
        />
        <SummaryCard
          title="Cancelados"
          count={summary.rejected}
          value={summary.rejectedValue}
          color="text-destructive"
          valueColor="text-destructive"
        />
      </div>
    </div>
  );
};