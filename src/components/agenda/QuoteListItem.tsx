import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileText, Clock, Car, DollarSign, Link as LinkIcon, Trash2, Pencil, CheckCheck, X, Info, Loader2, MoreVertical, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
  pending: { text: 'Pendente', color: 'text-primary-strong', bg: 'bg-primary/10', border: 'border-primary/50' },
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

  // Lógica de desabilitação
  const canEdit = quote.status === 'pending';
  const canConclude = quote.status === 'pending' || quote.status === 'accepted';
  const canDelete = true; // Excluir funciona para todos

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
          
          {/* Botão de Info (mantido fora do dropdown para acesso rápido) */}
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

          {/* Dropdown de Ações */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:bg-background"
                title="Mais ações"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-card" align="end">
              
              {/* 1. Concluir Tarefa (Marcar como Concluído) */}
              <DropdownMenuItem 
                onClick={() => canConclude && onOpenCloseSaleDialog(quote)}
                disabled={!canConclude || isClosingSale}
                className={cn("cursor-pointer", !canConclude && "opacity-50 cursor-not-allowed")}
              >
                {isClosingSale ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4 text-success" />}
                Concluir Tarefa
              </DropdownMenuItem>

              {/* 2. Copiar Link */}
              <DropdownMenuItem 
                onClick={() => onCopyLink(quote.id)}
                className="cursor-pointer"
              >
                <LinkIcon className="mr-2 h-4 w-4 text-primary" />
                Copiar Link
              </DropdownMenuItem>

              {/* 3. Editar Orçamento */}
              <DropdownMenuItem 
                onClick={() => canEdit && onEditQuote(quote.id)}
                disabled={!canEdit}
                className={cn("cursor-pointer", !canEdit && "opacity-50 cursor-not-allowed")}
              >
                <Pencil className="mr-2 h-4 w-4 text-info" />
                Editar Orçamento
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* 4. Excluir Orçamento (Usando AlertDialog para confirmação) */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem 
                    onSelect={(e) => e.preventDefault()} // Previne o fechamento do Dropdown ao abrir o AlertDialog
                    disabled={isDeleting}
                    className={cn("cursor-pointer text-destructive focus:text-destructive", isDeleting && "opacity-50 cursor-not-allowed")}
                  >
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Excluir
                  </DropdownMenuItem>
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
              
              {/* Opção extra: Marcar como Cancelado (apenas se Aceito) */}
              {quote.status === 'accepted' && (
                <DropdownMenuItem 
                  onClick={() => onMarkAsNotRealized(quote.id)}
                  disabled={isMarkingNotRealized}
                  className="cursor-pointer text-destructive"
                >
                  {isMarkingNotRealized ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                  Marcar como Cancelado
                </DropdownMenuItem>
              )}

            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};