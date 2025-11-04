import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileText, Clock, Car, DollarSign, Link as LinkIcon, Trash2, Pencil, CheckCheck, X, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Quote {
  id: string;
  client_name: string;
  vehicle: string;
  total_price: number;
  status: 'pending' | 'accepted' | 'rejected' | 'closed';
  service_date: string | null;
  service_time: string | null;
  notes: string | null;
}

interface QuoteListItemProps {
  quote: Quote;
  isDeleting: boolean;
  isMarkingNotRealized: boolean;
  isClosingSale: boolean;
  onCopyLink: (quoteId: string) => void;
  onEditQuote: (quoteId: string) => void;
  onOpenCloseSaleDialog: (quote: Quote) => void;
  onMarkAsNotRealized: (quoteId: string) => void;
  onOpenDetailsDrawer: (quoteId: string) => void;
  onDeleteQuote: (quoteId: string) => void;
}

const statusColors = {
  accepted: { text: 'Aceito', color: 'text-success', bg: 'bg-success/10', border: 'border-success/50' },
  pending: { text: 'Pendente', color: 'text-primary-strong', bg: 'bg-primary-strong/10', border: 'border-primary-strong/50' }, // Alterado para primary-strong
  rejected: { text: 'Cancelados', color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/50' },
  closed: { text: 'Concluído', color: 'text-info', bg: 'bg-info/10', border: 'border-info/50' },
};

export const QuoteListItem = ({
  quote,
  isDeleting,
  isMarkingNotRealized,
  isClosingSale,
  onCopyLink,
  onEditQuote,
  onOpenCloseSaleDialog,
  onMarkAsNotRealized,
  onOpenDetailsDrawer,
  onDeleteQuote,
}: QuoteListItemProps) => {
  const currentStatus = statusColors[quote.status] || statusColors.pending;
  const isActionDisabled = isDeleting || isMarkingNotRealized || isClosingSale;

  return (
    <div className={cn(
      "flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border shadow-sm transition-all",
      currentStatus.bg,
      currentStatus.border,
      isActionDisabled && "opacity-60 pointer-events-none"
    )}>
      <div className="flex-1 space-y-1 sm:space-y-0 sm:pr-4">
        <div className="flex items-center gap-2">
          <Clock className={cn("h-4 w-4", currentStatus.color)} />
          <span className="text-sm font-semibold text-foreground">
            {quote.service_time || 'Hora a combinar'}
          </span>
          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", currentStatus.color, currentStatus.bg)}>
            {currentStatus.text}
          </span>
        </div>
        <p className="text-lg font-bold text-foreground">{quote.client_name}</p>
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <Car className="h-4 w-4" />
          {quote.vehicle}
        </p>
        <p className="text-xl font-bold text-primary-strong flex items-center gap-1">
          <DollarSign className="h-5 w-5" />
          R$ {quote.total_price.toFixed(2)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mt-3 sm:mt-0 sm:ml-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => onOpenDetailsDrawer(quote.id)}
                title="Ver Detalhes"
              >
                <Info className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ver Detalhes</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {quote.status === 'accepted' && (
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => onOpenCloseSaleDialog(quote)}
            className="bg-success hover:bg-success/90"
            disabled={isActionDisabled}
          >
            {isClosingSale ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4 mr-2" />}
            Concluir Venda
          </Button>
        )}

        {quote.status !== 'closed' && quote.status !== 'rejected' && (
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => onEditQuote(quote.id)}
            title="Editar Agendamento"
            disabled={isActionDisabled}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}

        {quote.status === 'accepted' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="text-destructive hover:bg-destructive/10"
                title="Marcar como Não Realizado"
                disabled={isActionDisabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card">
              <AlertDialogHeader>
                <AlertDialogTitle>Marcar como Cancelado?</AlertDialogTitle>
                <AlertDialogDescription>
                  O agendamento para "{quote.client_name}" será marcado como Cancelado. Esta ação pode ser desfeita editando o orçamento.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onMarkAsNotRealized(quote.id)} 
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isActionDisabled}
                >
                  {isMarkingNotRealized ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Cancelamento'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => onCopyLink(quote.id)}
                title="Copiar Link do Orçamento"
                disabled={isActionDisabled}
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copiar Link</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Excluir Orçamento"
              disabled={isActionDisabled}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação excluirá permanentemente o agendamento/orçamento para "{quote.client_name}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => onDeleteQuote(quote.id)} 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isActionDisabled}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};