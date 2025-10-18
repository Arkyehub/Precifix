import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { OperationalCost } from '@/types/costs';

interface VariableCostsTableProps {
  costs: OperationalCost[];
  onEdit: (cost: OperationalCost) => void;
  onDelete: (id: string) => void;
}

export const VariableCostsTable = ({ costs, onEdit, onDelete }: VariableCostsTableProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Custos Variáveis</h3>
      <div className="rounded-md border bg-background"> {/* Alterado bg-background/50 para bg-background */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[80px] text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costs.length > 0 ? (
              costs.map((cost) => (
                <TableRow key={cost.id}>
                  <TableCell className={cost.description === 'Produtos Gastos no Mês' ? 'font-medium text-primary-strong' : 'font-medium'}>
                    {cost.description}
                  </TableCell>
                  <TableCell className={cost.description === 'Produtos Gastos no Mês' ? 'text-right text-primary-strong font-bold' : 'text-right'}>
                    R$ {cost.value.toFixed(2)}
                  </TableCell>
                  <TableCell className="flex justify-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(cost)} className="text-muted-foreground hover:text-primary hover:bg-white"> {/* Alterado hover:bg-background para hover:bg-white */}
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-white"> {/* Alterado hover:bg-background para hover:bg-white */}
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso excluirá permanentemente o custo "{cost.description}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(cost.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  Nenhum custo variável cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default VariableCostsTable;