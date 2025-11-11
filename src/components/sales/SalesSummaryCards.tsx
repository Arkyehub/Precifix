import React from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SummaryItemProps {
  title: string;
  value: string;
  count?: number;
  color: string;
  tooltip: string;
}

const SummaryItem = ({ title, value, count, color, tooltip }: SummaryItemProps) => (
  <div className="p-4 rounded-lg border bg-background/50 shadow-sm">
    <div className="flex items-center justify-between">
      <h5 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
        {title} {count !== undefined && `(${count})`}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
            </TooltipTrigger>
            <TooltipContent className="bg-card text-foreground border border-border/50 p-2 rounded-lg shadow-md">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </h5>
    </div>
    <p className={cn("text-xl font-bold mt-1", color)}>{value}</p>
  </div>
);

interface SalesSummaryProps {
  summary: {
    totalSales: number;
    attendedCount: number;
    totalRevenue: number;
    awaitingPaymentCount: number;
    awaitingPaymentValue: number;
    openSalesCount: number;
    openValue: number;
    acceptedSalesCount: number;
    acceptedValue: number;
    canceledCount: number;
    ticketMedio: number;
  };
}

export const SalesSummaryCards = ({ summary }: SalesSummaryProps) => {
  return (
    <div className="space-y-2">
      <h4 className="text-lg font-semibold text-foreground">Resumo do Período</h4>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryItem 
          title="Total Vendas" 
          count={summary.totalSales}
          value={`R$ ${(summary.totalRevenue + summary.awaitingPaymentValue + summary.openValue + summary.acceptedValue + summary.openValue).toFixed(2)}`} 
          color="text-primary-strong"
          tooltip="Valor total de todas as vendas (Atendidas + Aguardando Pagamento + Em Aberto + Aceitas) no período."
        />
        <SummaryItem 
          title="Atendidas" 
          count={summary.attendedCount}
          value={`R$ ${summary.totalRevenue.toFixed(2)}`} 
          color="text-success"
          tooltip="Vendas concluídas e pagas."
        />
        <SummaryItem 
          title="Aguardando Pagamento" 
          count={summary.awaitingPaymentCount}
          value={`R$ ${summary.awaitingPaymentValue.toFixed(2)}`} 
          color="text-info"
          tooltip="Vendas finalizadas, mas o pagamento ainda está pendente (ex: boleto, PIX agendado)."
        />
        <SummaryItem 
          title="Aceitas" 
          count={summary.acceptedSalesCount}
          value={`R$ ${summary.acceptedValue.toFixed(2)}`} 
          color="text-primary-strong"
          tooltip="Vendas aceitas pelo cliente, aguardando execução."
        />
        <SummaryItem 
          title="Em Aberto" 
          count={summary.openSalesCount}
          value={`R$ ${summary.openValue.toFixed(2)}`} 
          color="text-orange-500"
          tooltip="Vendas lançadas, mas ainda não iniciadas ou em fase de negociação (status 'pending')."
        />
      </div>
    </div>
  );
};