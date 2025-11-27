import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Info, Loader2, MoreVertical, CreditCard, Pencil, Trash2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sale, QuoteStatus, SortConfig } from '@/hooks/use-sales-data';

interface SalesListTableProps {
  sales: Sale[];
  isLoadingMutations: boolean;
  updateSaleStatusMutation: any; // Use specific type if available
  deleteSaleMutation: any; // Use specific type if available
  onOpenDetails: (saleId: string) => void;
  onStatusChange: (id: string, newStatus: QuoteStatus) => void;
  onEditSale: (saleId: string) => void;
  onOpenPaymentDialog: (sale: Sale) => void;
  onDeleteSale: (saleId: string) => void;
  sortConfig?: SortConfig;
  onSort?: (key: string) => void;
}

const AwaitingPaymentLabel = () => (
  <div className="flex flex-col items-center leading-none">
    <span>Aguardando</span>
    <span>Pagamento</span>
  </div>
);

const statusLabels: Record<QuoteStatus, { label: string | React.ReactNode; color: string }> = {
  closed: { label: 'Atendida', color: 'bg-success/20 text-success' },
  rejected: { label: 'Cancelada', color: 'bg-destructive/20 text-destructive' },
  accepted: { label: 'Aceita', color: 'bg-primary/20 text-primary-strong' },
  pending: { label: 'Em Aberto', color: 'bg-orange-500/20 text-orange-500' },
  awaiting_payment: { label: <AwaitingPaymentLabel />, color: 'bg-info/20 text-info' },
  deleted: { label: 'Excluída', color: 'bg-gray-500/20 text-gray-500' },
};

const selectableStatuses: { key: QuoteStatus; label: string }[] = [
  { key: 'closed', label: 'Atendida' },
  { key: 'accepted', label: 'Aceita' },
  { key: 'pending', label: 'Em Aberto' },
  { key: 'rejected', label: 'Cancelada' },
  { key: 'awaiting_payment', label: 'Aguardando Pagamento' },
];

const formatDateSafe = (dateString: string | null) => {
  if (!dateString) return '-';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return dateString;
};

// Componente auxiliar para cabeçalho ordenável
const SortableHead = ({ 
  label, 
  sortKey, 
  currentSort, 
  onSort, 
  className 
}: { 
  label: string; 
  sortKey: string; 
  currentSort?: SortConfig; 
  onSort?: (key: string) => void; 
  className?: string;
}) => {
  const isActive = currentSort?.key === sortKey;
  
  return (
    <TableHead 
      className={cn("cursor-pointer hover:bg-muted/50 transition-colors select-none", className)} 
      onClick={() => onSort && onSort(sortKey)}
      title={`Ordenar por ${label}`}
    >
      <div className={cn("flex items-center gap-1", className?.includes("text-right") ? "justify-end" : "justify-start")}>
        {label}
        {isActive && (
          currentSort.direction === 'asc' 
            ? <ChevronUp className="h-4 w-4 text-primary" /> 
            : <ChevronDown className="h-4 w-4 text-primary" />
        )}
      </div>
    </TableHead>
  );
};

export const SalesListTable = ({
  sales,
  isLoadingMutations,
  updateSaleStatusMutation,
  deleteSaleMutation,
  onOpenDetails,
  onStatusChange,
  onEditSale,
  onOpenPaymentDialog,
  onDeleteSale,
  sortConfig,
  onSort,
}: SalesListTableProps) => {
  return (
    <div className="rounded-md border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead 
              label="Número" 
              sortKey="sale_number" 
              currentSort={sortConfig} 
              onSort={onSort} 
              className="w-[100px]" 
            />
            <SortableHead 
              label="Data do Serviço" 
              sortKey="service_date" 
              currentSort={sortConfig} 
              onSort={onSort} 
              className="w-[140px]" 
            />
            <SortableHead 
              label="Cliente" 
              sortKey="client_name" 
              currentSort={sortConfig} 
              onSort={onSort} 
            />
            <SortableHead 
              label="Serviços/Produtos" 
              sortKey="services_summary" 
              currentSort={sortConfig} 
              onSort={onSort} 
            />
            <SortableHead 
              label="Valor" 
              sortKey="total_price" 
              currentSort={sortConfig} 
              onSort={onSort} 
              className="text-right" 
            />
            <SortableHead 
              label="Status" 
              sortKey="status" 
              currentSort={sortConfig} 
              onSort={onSort} 
            />
            <TableHead className="w-[100px] text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales && sales.length > 0 ? (
            sales.map((sale) => {
              const statusInfo = statusLabels[sale.status] || statusLabels.pending;
              const isUpdating = updateSaleStatusMutation.isPending;
              const isDeleting = deleteSaleMutation.isPending && deleteSaleMutation.variables === sale.id;

              const isDeleted = sale.status === 'deleted';
              const canEdit = !isDeleted && (sale.status === 'pending' || sale.status === 'accepted');
              const canChangePayment = !isDeleted && (sale.status === 'closed' || sale.status === 'awaiting_payment');
              
              const displayDate = sale.service_date || sale.quote_date;

              return (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium text-primary-strong">
                    {sale.sale_number || `#${sale.id.substring(0, 8)}`}
                  </TableCell>
                  <TableCell>
                    {formatDateSafe(displayDate)}
                  </TableCell>
                  <TableCell className="font-medium">{sale.client_name}</TableCell>
                  <TableCell>{sale.services_summary.length} serviço(s)</TableCell>
                  <TableCell className="text-right font-bold">R$ {sale.total_price.toFixed(2)}</TableCell>
                  <TableCell>
                    {isDeleted ? (
                      <span 
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-semibold inline-block text-center cursor-not-allowed opacity-80",
                          statusInfo.color
                        )}
                        title="Venda excluída (não editável)"
                      >
                        {statusInfo.label}
                      </span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <span 
                            className={cn(
                              "px-2 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors hover:opacity-80 inline-block text-center",
                              statusInfo.color
                            )}
                            title="Clique para mudar o status"
                          >
                            {statusInfo.label}
                          </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 bg-card">
                          <DropdownMenuLabel>Mudar Status da Venda</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {selectableStatuses.map(({ key, label }) => (
                            <DropdownMenuItem 
                              key={key} 
                              onClick={() => onStatusChange(sale.id, key)}
                              disabled={sale.status === key || isUpdating}
                              className={cn(
                                "cursor-pointer",
                                sale.status === key && "bg-muted/50 font-bold"
                              )}
                            >
                              {label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                  <TableCell className="text-center flex justify-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onOpenDetails(sale.id)} 
                      title="Ver Detalhes e Lucratividade"
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                    
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
                        
                        <DropdownMenuItem 
                          onClick={() => canChangePayment && onOpenPaymentDialog(sale)}
                          disabled={!canChangePayment || isLoadingMutations}
                          className={cn("cursor-pointer", !canChangePayment && "opacity-50 cursor-not-allowed")}
                        >
                          {isLoadingMutations ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4 text-info" />}
                          Alterar Forma de Pagamento
                        </DropdownMenuItem>

                        <DropdownMenuItem 
                          onClick={() => canEdit && onEditSale(sale.id)}
                          disabled={!canEdit}
                          className={cn("cursor-pointer", !canEdit && "opacity-50 cursor-not-allowed")}
                        >
                          <Pencil className="mr-2 h-4 w-4 text-primary" />
                          Editar
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {isDeleted ? (
                          <DropdownMenuItem 
                            onClick={() => onStatusChange(sale.id, 'pending')}
                            disabled={isUpdating}
                            className={cn("cursor-pointer text-success focus:text-success", isUpdating && "opacity-50 cursor-not-allowed")}
                          >
                             {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                             Restaurar
                          </DropdownMenuItem>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem 
                                onSelect={(e) => e.preventDefault()}
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
                                  Esta ação excluirá a venda "{sale.sale_number || `#${sale.id.substring(0, 8)}`}". Ela poderá ser restaurada posteriormente através do filtro de "Excluídas".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => onDeleteSale(sale.id)} 
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  disabled={isDeleting}
                                >
                                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                Nenhuma venda encontrada.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};