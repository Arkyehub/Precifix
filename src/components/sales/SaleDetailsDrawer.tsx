import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText, Clock, DollarSign, Car, Users, Tag, Package, Percent, Receipt, Loader2, XCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatMinutesToHHMM } from '@/lib/cost-calculations';

// Reutilizando a interface Sale (que agora pode ser um Quote/Agendamento)
interface Sale {
  id: string;
  sale_number: string | null;
  client_name: string;
  vehicle: string; // Adicionado
  total_price: number;
  created_at: string;
  services_summary: { name: string; price: number; execution_time_minutes: number }[];
  status: 'pending' | 'accepted' | 'rejected' | 'closed' | 'awaiting_payment';
  service_date: string | null;
  service_time: string | null;
  notes: string | null;
}

// Interface para os detalhes de custo e lucro (calculados no hook)
interface SaleProfitDetails {
  totalProductsCost: number;
  totalLaborCost: number;
  totalOtherCosts: number;
  totalCost: number;
  netProfit: number;
  profitMarginPercentage: number;
  totalExecutionTime: number;
}

interface SaleDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  profitDetails: SaleProfitDetails | null;
  isLoadingDetails: boolean;
}

const statusColors = {
  accepted: { text: 'Aceito', color: 'text-success', bg: 'bg-success/20', icon: CheckCircle },
  pending: { text: 'Pendente', color: 'text-primary-strong', bg: 'bg-primary-strong/20', icon: Clock },
  rejected: { text: 'Cancelado', color: 'text-destructive', bg: 'bg-destructive/20', icon: XCircle },
  closed: { text: 'Concluído', color: 'text-info', bg: 'bg-info/20', icon: CheckCircle },
  awaiting_payment: { text: 'Aguardando Pagamento', color: 'text-info', bg: 'bg-info/20', icon: DollarSign },
};

export const SaleDetailsDrawer = ({ isOpen, onClose, sale, profitDetails, isLoadingDetails }: SaleDetailsDrawerProps) => {
  
  // Usar o hook novamente para acessar o erro da query, se necessário
  // Nota: O hook useSaleProfitDetails já está sendo chamado no componente pai (AgendaView/SalesPage)
  // e os resultados (sale, profitDetails, isLoadingDetails) estão sendo passados via props.
  // Se o erro for na query inicial, o sale será null.

  const currentStatus = sale ? statusColors[sale.status] || statusColors.pending : null;
  const saleDate = sale ? new Date(sale.created_at) : null;

  // Se o Sheet estiver fechado, não renderiza nada
  if (!isOpen) return null;

  // Renderiza o estado de carregamento ou erro dentro do SheetContent
  const renderContent = () => {
    if (isLoadingDetails) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Carregando detalhes do agendamento...</p>
        </div>
      );
    }

    if (!sale) {
      // Se sale for null, exibe a mensagem de erro genérica (que você viu na imagem)
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <XCircle className="h-8 w-8 text-destructive" />
          <p className="mt-4 text-destructive font-semibold">Erro ao carregar detalhes.</p>
          <p className="text-sm text-muted-foreground">O agendamento pode ter sido excluído ou o ID é inválido.</p>
        </div>
      );
    }

    // Conteúdo normal da venda/agendamento
    return (
      <>
        <SheetHeader className="p-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 text-xl font-bold">
            <FileText className="h-6 w-6 text-primary" />
            Detalhes do Agendamento {sale.sale_number || `#${sale.id.substring(0, 8)}`}
          </SheetTitle>
          <SheetDescription className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Cliente: {sale.client_name}
            </span>
            {currentStatus && (
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1", currentStatus.color, currentStatus.bg)}>
                <currentStatus.icon className="h-3 w-3" />
                {currentStatus.text}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            
            {/* Seção de Informações Básicas */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Informações Gerais
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p className="text-muted-foreground">Data de Criação:</p>
                <p className="font-medium text-right">{format(saleDate!, 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                
                {sale.service_date && (
                  <>
                    <p className="text-muted-foreground">Data do Serviço:</p>
                    <p className="font-medium text-right">{format(new Date(sale.service_date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                  </>
                )}
                {sale.service_time && (
                  <>
                    <p className="text-muted-foreground">Hora do Serviço:</p>
                    <p className="font-medium text-right">{sale.service_time}</p>
                  </>
                )}
                <p className="text-muted-foreground">Veículo:</p>
                <p className="font-medium text-right">{sale.vehicle}</p>

                <p className="text-muted-foreground">Valor Total:</p>
                <p className="font-bold text-primary-strong text-right text-xl">R$ {sale.total_price.toFixed(2)}</p>
              </div>
            </div>

            <Separator />

            {/* Seção de Serviços */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Car className="h-5 w-5 text-primary" />
                Serviços Contratados
              </h3>
              <div className="space-y-2">
                {sale.services_summary.map((service, index) => (
                  <div key={index} className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                    <p className="text-sm font-medium">{service.name}</p>
                    <div className="text-right text-xs">
                      <p className="font-semibold">R$ {service.price.toFixed(2)}</p>
                      <p className="text-muted-foreground">{formatMinutesToHHMM(service.execution_time_minutes)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Seção de Análise de Lucro */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Análise de Lucro
              </h3>
              {profitDetails ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2 p-3 rounded-lg bg-primary-strong/10 border border-primary-strong/50"> {/* Alterado para primary-strong */}
                    <p className="text-primary-strong font-medium flex items-center gap-1">
                      <Package className="h-4 w-4" /> Custo de Produtos:
                    </p>
                    <p className="font-bold text-primary-strong text-right">R$ {profitDetails.totalProductsCost.toFixed(2)}</p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-primary-strong/10 border border-primary-strong/50"> {/* Alterado para primary-strong */}
                    <p className="text-primary-strong font-medium flex items-center gap-1">
                      <Clock className="h-4 w-4" /> Custo Mão de Obra:
                    </p>
                    <p className="font-bold text-primary-strong text-right">R$ {profitDetails.totalLaborCost.toFixed(2)}</p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/50">
                    <p className="text-destructive font-medium flex items-center gap-1">
                      <Receipt className="h-4 w-4" /> Outros Custos:
                    </p>
                    <p className="font-bold text-destructive text-right">R$ {profitDetails.totalOtherCosts.toFixed(2)}</p>
                  </div>

                  <div className="col-span-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                    <p className="font-bold text-foreground">Custo Total da Operação:</p>
                    <p className="font-bold text-primary-strong text-right text-xl">R$ {profitDetails.totalCost.toFixed(2)}</p>
                  </div>

                  <div className="col-span-2 p-3 rounded-lg bg-success/10 border border-success/50">
                    <p className="font-bold text-success flex items-center gap-1">
                      <DollarSign className="h-4 w-4" /> Lucro Líquido:
                    </p>
                    <p className="font-bold text-success text-right text-xl">R$ {profitDetails.netProfit.toFixed(2)}</p>
                    <p className="font-bold text-purple-500 flex items-center justify-end gap-1 mt-1">
                      <Percent className="h-4 w-4" /> Margem Real: {profitDetails.profitMarginPercentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Detalhes de custo não disponíveis. Verifique se os serviços originais ainda existem no seu catálogo.</p>
              )}
            </div>
            
            {sale.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Observações
                  </h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap p-3 rounded-md border bg-muted/50">
                    {sale.notes}
                  </p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="flex flex-col">
        {renderContent()}
      </SheetContent>
    </Sheet>
  );
};