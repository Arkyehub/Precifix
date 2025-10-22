import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ManageYearsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availableYears: number[];
  onYearsUpdate: (updatedYears: number[]) => void;
  selectedYear: number;
  onSelectYear: (year: number) => void;
}

export const ManageYearsDialog = ({
  isOpen,
  onClose,
  availableYears,
  onYearsUpdate,
  selectedYear,
  onSelectYear,
}: ManageYearsDialogProps) => {
  const { toast } = useToast();
  const [newYearInput, setNewYearInput] = useState('');
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!isOpen) {
      setNewYearInput(''); // Reset input when dialog closes
    }
  }, [isOpen]);

  const handleAddYear = () => {
    const yearToAdd = parseInt(newYearInput, 10);

    if (isNaN(yearToAdd) || yearToAdd < 1900 || yearToAdd > 2100) { // Basic year validation
      toast({
        title: "Ano inválido",
        description: "Por favor, insira um ano válido (ex: 2023).",
        variant: "destructive",
      });
      return;
    }

    if (availableYears.includes(yearToAdd)) {
      toast({
        title: "Ano já existe",
        description: `O ano ${yearToAdd} já está na lista.`,
        variant: "default",
      });
      setNewYearInput('');
      onSelectYear(yearToAdd); // Select existing year if user tries to add it again
      onClose();
      return;
    }

    const updatedYears = [...availableYears, yearToAdd].sort((a, b) => b - a);
    onYearsUpdate(updatedYears);
    onSelectYear(yearToAdd);
    setNewYearInput('');
    toast({
      title: "Ano adicionado!",
      description: `O ano ${yearToAdd} foi adicionado e selecionado.`,
    });
    onClose();
  };

  const handleDeleteYear = (yearToDelete: number) => {
    if (yearToDelete === currentYear) {
      toast({
        title: "Não é possível excluir o ano atual",
        description: "O ano corrente não pode ser removido da lista.",
        variant: "destructive",
      });
      return;
    }
    
    const updatedYears = availableYears.filter(year => year !== yearToDelete);
    onYearsUpdate(updatedYears);
    
    if (selectedYear === yearToDelete) {
      // If the deleted year was selected, select the latest available year
      const newSelectedYear = updatedYears.length > 0 ? Math.max(...updatedYears) : currentYear;
      onSelectYear(newSelectedYear);
    }
    toast({
      title: "Ano removido!",
      description: `O ano ${yearToDelete} foi excluído da lista.`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card">
        <DialogHeader>
          <DialogTitle>Gerenciar Anos</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-year">Adicionar Novo Ano</Label>
            <div className="flex gap-2">
              <Input
                id="new-year"
                type="number"
                value={newYearInput}
                onChange={(e) => setNewYearInput(e.target.value)}
                className="bg-background"
                placeholder="Ex: 2024"
              />
              <Button onClick={handleAddYear} variant="outline" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-border/50">
            <Label className="text-sm font-medium">Anos Disponíveis</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {availableYears.length > 0 ? (
                availableYears.map((year) => (
                  <div key={year} className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/50">
                    <span className="font-medium text-foreground">{year}</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-destructive hover:bg-white"
                          disabled={year === currentYear} // Disable deleting current year
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso excluirá o ano "{year}" da sua lista.
                            Se houver dados de faturamento ou despesas para este ano, eles não serão mais acessíveis através do seletor.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteYear(year)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhum ano disponível.</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};