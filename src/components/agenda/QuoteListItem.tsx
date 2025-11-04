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
  pending: { text: 'Pendente', color: 'text-primary-strong', bg: 'bg-primary/10', border: 'border-primary/50' }, // CORRIGIDO AQUI
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
  const status = statusColors[quote.status];

  return (
    <div 
      key={quote.id} 
      className={cn(
        "p-4 rounded-lg border-l-4 shadow-sm transition-shadow hover:shadow-md",
        status.border,
        status.bg
      )}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="font-bold text-foreground">{quote.client_name}</p>
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", status.color, status.bg)}>
              {status.text}
            </span>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1 ml-6">
            <Car className="h-4 w-4" />
            {quote.vehicle}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1 ml-6">
            <Clock className="h-4 w-4" />
            {quote.service_time || 'Hora a combinar'}
          </p>
          <p className="text-lg font-bold flex items-center gap-1 ml-6" style={{ color: status.color }}>
            <DollarSign className="h-5 w-5" />
            R$ {quote.total_price.toFixed(2)}
          </p>
        </div>
        <div className="flex gap-1 items-center">
          
          {/* Botão de Tarefa Concluída (Apenas para Aceito) */}
          {quote.status === 'accepted' && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onOpenCloseSaleDialog(quote)}
                      className="text-success hover:bg-success/10"
                      title="Marcar como Concluído (Lançar Venda)"
                      disabled={isClosingSale}
                    >
                      <CheckCheck className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Marcar como Concluído</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* Botão Cancelados */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onMarkAsNotRealized(quote.id)}
                      className="text-destructive hover:bg-destructive/10"
                      title="Marcar como Cancelado"
                      disabled={isMarkingNotRealized}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Marcar como Cancelado</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}

          {/* Botões de Ação para Pendente */}
          {quote.status === 'pending' && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onCopyLink(quote.id)}
                      className="text-primary hover:bg-primary/10"
                      title="Copiar Link do Orçamento"
                    >
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copiar Link</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onEditQuote(quote.id)}
                      className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                      title="Editar Orçamento"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Editar Orçamento</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}

          {/* Botão de Info (para todos os status) */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-muted-foreground hover:bg-background"
                  onClick={() => onOpenDetailsDrawer(quote.id)}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-card text-foreground border border-border/50 p-3 rounded-lg shadow-md max-w-xs">
                <p className="font-semibold mb-1">Ver Detalhes</p>
                <p className="text-sm">Clique para ver os detalhes completos do orçamento e a análise de lucro.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Botão de Excluir (Apenas para Pendente) */}
          {quote.status === 'pending' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:bg-destructive/10"
                  title="Excluir Orçamento"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card">
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação excluirá permanentemente o orçamento de "{quote.client_name}" e seu link de visualização.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onDeleteQuote(quote.id)} 
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
};