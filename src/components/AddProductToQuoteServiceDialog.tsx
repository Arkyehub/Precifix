import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { formatDilutionRatio } from '@/lib/cost-calculations';
import { QuotedProductForQuote } from './QuoteServiceFormDialog'; // Importar a interface

interface CatalogProduct {
  id: string;
  name: string;
  size: number; // em litros
  price: number; // em R$
  type: 'diluted' | 'ready-to-use';
  dilution_ratio: number;
}

interface AddProductToQuoteServiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: QuotedProductForQuote) => void;
  existingProductIds: string[]; // Para evitar adicionar o mesmo produto duas vezes
}

// Utility function to parse dilution ratio from "1:X" or "X" format
const parseDilutionRatioInput = (input: string): number => {
  const parts = input.split(':');
  if (parts.length === 2 && parts[0].trim() === '1') {
    return parseFloat(parts[1].trim()) || 0;
  }
  return parseFloat(input.trim()) || 0; // Fallback if not in "1:X" format
};

// Utility function to format dilution ratio for display
const formatDilutionRatioForInput = (ratio: number): string => {
  return ratio > 0 ? `1:${ratio}` : ''; // Retorna vazio se 0 para não preencher o input
};

export const AddProductToQuoteServiceDialog = ({ isOpen, onClose, onAdd, existingProductIds }: AddProductToQuoteServiceDialogProps) => {
  const { user } = useSession();
  const { toast } = useToast();

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [usagePerVehicle, setUsagePerVehicle] = useState('');
  const [selectedProductDetails, setSelectedProductDetails] = useState<CatalogProduct | null>(null);
  const [editableDilutionRatioInput, setEditableDilutionRatioInput] = useState('');
  const [containerSize, setContainerSize] = useState('');

  // Fetch product catalog
  const { data: catalogProducts, isLoading: isLoadingCatalog } = useQuery<CatalogProduct[]>({
    queryKey: ['productCatalogForQuoteAdd', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('product_catalog_items')
        .select('id, name, size, price, type, dilution_ratio')
        .eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!isOpen) {
      // Reset state when dialog closes
      setSelectedProductId('');
      setUsagePerVehicle('');
      setSelectedProductDetails(null);
      setEditableDilutionRatioInput('');
      setContainerSize('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedProductId && catalogProducts) {
      const product = catalogProducts.find(p => p.id === selectedProductId);
      setSelectedProductDetails(product || null);
      if (product) {
        setEditableDilutionRatioInput(formatDilutionRatioForInput(product.dilution_ratio));
        setUsagePerVehicle('');
        setContainerSize('');
      } else {
        setEditableDilutionRatioInput('');
        setUsagePerVehicle('');
        setContainerSize('');
      }
    } else {
      setSelectedProductDetails(null);
      setEditableDilutionRatioInput('');
      setUsagePerVehicle('');
      setContainerSize('');
    }
  }, [selectedProductId, catalogProducts]);

  const handleAdd = () => {
    if (!selectedProductDetails || !usagePerVehicle) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione um produto e informe a quantidade usada.",
        variant: "destructive",
      });
      return;
    }
    if (existingProductIds.includes(selectedProductDetails.id)) {
      toast({
        title: "Produto já adicionado",
        description: "Este produto já está vinculado a este serviço no orçamento. Edite-o diretamente.",
        variant: "destructive",
      });
      return;
    }

    const parsedUsage = parseFloat(usagePerVehicle);
    if (isNaN(parsedUsage) || parsedUsage <= 0) {
      toast({
        title: "Quantidade inválida",
        description: "A quantidade usada deve ser um número positivo.",
        variant: "destructive",
      });
      return;
    }

    const parsedDilution = parseDilutionRatioInput(editableDilutionRatioInput);
    if (selectedProductDetails.type === 'diluted' && (!editableDilutionRatioInput || parsedDilution <= 0)) {
      toast({
        title: "Diluição inválida",
        description: "A proporção de diluição deve ser um número positivo (Ex: 1:100 ou 100).",
        variant: "destructive",
      });
      return;
    }

    const parsedContainerSize = parseFloat(containerSize);
    if (selectedProductDetails.type === 'diluted' && (!containerSize || isNaN(parsedContainerSize) || parsedContainerSize <= 0)) {
      toast({
        title: "Tamanho do recipiente inválido",
        description: "O tamanho do recipiente deve ser um número positivo.",
        variant: "destructive",
      });
      return;
    }

    const newQuotedProduct: QuotedProductForQuote = {
      id: selectedProductDetails.id, // Usar o ID do produto do catálogo
      name: selectedProductDetails.name,
      size: selectedProductDetails.size,
      price: selectedProductDetails.price,
      type: selectedProductDetails.type,
      dilution_ratio: selectedProductDetails.type === 'diluted' ? parsedDilution : 0,
      usage_per_vehicle: parsedUsage,
      container_size: selectedProductDetails.type === 'diluted' ? parsedContainerSize : 0,
      original_product_id: selectedProductDetails.id, // Manter referência ao original
    };

    onAdd(newQuotedProduct);
    onClose();
  };

  const availableProducts = catalogProducts?.filter(p => !existingProductIds.includes(p.id)) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card">
        <DialogHeader>
          <DialogTitle>Adicionar Produto ao Serviço</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="product-select">Selecionar Produto *</Label>
            <Select 
              value={selectedProductId} 
              onValueChange={setSelectedProductId} 
              disabled={isLoadingCatalog || availableProducts.length === 0}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Escolha um produto do catálogo" />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.length > 0 ? (
                  availableProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-products" disabled>
                    Nenhum produto disponível para adicionar
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {isLoadingCatalog && <p className="text-sm text-muted-foreground">Carregando produtos...</p>}
            {!isLoadingCatalog && availableProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">Todos os produtos já foram adicionados ou não há produtos no catálogo.</p>
            )}
          </div>

          {selectedProductDetails && (
            <div className="space-y-2 p-3 border rounded-md bg-muted/20">
              <p className="text-sm font-medium text-foreground">Detalhes do Produto:</p>
              <p className="text-xs text-muted-foreground">
                Tamanho: {selectedProductDetails.size.toFixed(2)} L ({selectedProductDetails.size * 1000} ml)
              </p>
              <p className="text-xs text-muted-foreground">
                Preço: R$ {selectedProductDetails.price.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Tipo: {selectedProductDetails.type === 'diluted' ? 'Diluído' : 'Pronto Uso'}
              </p>
            </div>
          )}

          {selectedProductDetails?.type === 'diluted' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="dilution-ratio">Proporção de Diluição (1:X) *</Label>
                <Input
                  id="dilution-ratio"
                  type="text"
                  placeholder="Ex: 1:100 ou 100"
                  value={editableDilutionRatioInput}
                  onChange={(e) => setEditableDilutionRatioInput(e.target.value)}
                  className="bg-background"
                  disabled={!selectedProductId}
                />
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
                  disabled={!selectedProductId}
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
              disabled={!selectedProductId}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={handleAdd} 
            disabled={!selectedProductDetails || !usagePerVehicle || (selectedProductDetails.type === 'diluted' && (!editableDilutionRatioInput || !containerSize))}
          >
            Adicionar Produto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};