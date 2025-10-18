import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';
import { formatDilutionRatio } from '@/lib/cost-calculations';
import { QuotedProductForQuote } from './QuoteServiceFormDialog'; // Importar a interface atualizada

interface QuoteProductFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: QuotedProductForQuote; // O produto a ser editado
  onSave: (updatedProduct: QuotedProductForQuote) => void;
  originalDilutionRatio: number; // Para o botão de reset
}

export const QuoteProductFormDialog = ({ isOpen, onClose, product, onSave, originalDilutionRatio }: QuoteProductFormDialogProps) => {
  const { toast } = useToast();

  const [usagePerVehicle, setUsagePerVehicle] = useState(product.usage_per_vehicle.toFixed(0));
  const [editableDilutionRatioInput, setEditableDilutionRatioInput] = useState(product.dilution_ratio ? formatDilutionRatio(product.dilution_ratio) : '');
  const [containerSize, setContainerSize] = useState(product.container_size.toFixed(0));

  useEffect(() => {
    if (product) {
      setUsagePerVehicle(product.usage_per_vehicle.toFixed(0));
      setEditableDilutionRatioInput(product.dilution_ratio ? formatDilutionRatio(product.dilution_ratio) : '');
      setContainerSize(product.container_size.toFixed(0));
    }
  }, [product, isOpen]);

  const parseDilutionRatioInput = (input: string): number => {
    const parts = input.split(':');
    if (parts.length === 2 && parts[0].trim() === '1') {
      return parseFloat(parts[1].trim()) || 0;
    }
    return parseFloat(input.trim()) || 0;
  };

  const handleSave = () => {
    const parsedUsage = parseFloat(usagePerVehicle);
    const parsedDilution = parseDilutionRatioInput(editableDilutionRatioInput);
    const parsedContainerSize = parseFloat(containerSize);

    if (isNaN(parsedUsage) || parsedUsage <= 0) {
      toast({ title: "Quantidade inválida", description: "A quantidade usada deve ser um número positivo.", variant: "destructive" });
      return;
    }
    if (product.type === 'diluted' && (!editableDilutionRatioInput || parsedDilution <= 0)) {
      toast({ title: "Diluição inválida", description: "A proporção de diluição deve ser um número positivo (Ex: 1:100 ou 100).", variant: "destructive" });
      return;
    }
    if (product.type === 'diluted' && (!containerSize || isNaN(parsedContainerSize) || parsedContainerSize <= 0)) {
      toast({ title: "Tamanho do recipiente inválido", description: "O tamanho do recipiente deve ser um número positivo.", variant: "destructive" });
      return;
    }

    const updatedProduct: QuotedProductForQuote = {
      ...product,
      usage_per_vehicle: parsedUsage,
      dilution_ratio: product.type === 'diluted' ? parsedDilution : 0,
      container_size: product.type === 'diluted' ? parsedContainerSize : 0,
    };
    onSave(updatedProduct);
    onClose();
  };

  const handleResetDilution = () => {
    setEditableDilutionRatioInput(formatDilutionRatio(originalDilutionRatio));
    toast({
      title: "Diluição restaurada!",
      description: "O valor padrão de diluição do catálogo foi restaurado.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card">
        <DialogHeader>
          <DialogTitle>Editar Produto para Orçamento: {product.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2 p-3 border rounded-md bg-muted/20">
            <p className="text-sm font-medium text-foreground">Detalhes do Produto Base:</p>
            <p className="text-xs text-muted-foreground">
              Tamanho: {product.size.toFixed(2)} L ({product.size * 1000} ml)
            </p>
            <p className="text-xs text-muted-foreground">
              Preço: R$ {product.price.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              Tipo: {product.type === 'diluted' ? 'Diluído' : 'Pronto Uso'}
            </p>
          </div>

          {product.type === 'diluted' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="dilution-ratio">Proporção de Diluição (1:X) *</Label>
                <div className="flex"> {/* Adicionado flex container */}
                  <Input
                    id="dilution-ratio"
                    type="text"
                    placeholder="Ex: 1:100 ou 100"
                    value={editableDilutionRatioInput}
                    onChange={(e) => setEditableDilutionRatioInput(e.target.value)}
                    className="flex-1 bg-background rounded-r-none border-r-0" /* Estilo para input anexado */
                  />
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    onClick={handleResetDilution}
                    title="Restaurar diluição padrão do catálogo"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="container-size">Tamanho do Recipiente (ml) *</Label>
                <Input
                  id="container-size"
                  type="number"
                  step="1"
                  value={containerSize}
                  onChange={(e) => setContainerSize(e.target.value)}
                  className="bg-background"
                  placeholder="Ex: 500 (para um borrifador de 500ml)"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="usage-per-vehicle">Quantidade Usada Por Veículo (ml) *</Label>
            <Input
              id="usage-per-vehicle"
              type="number"
              step="0.1"
              value={usagePerVehicle}
              onChange={(e) => setUsagePerVehicle(e.target.value)}
              className="bg-background"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar Alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};