import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDilutionRatio } from '@/lib/cost-calculations';
import { RefreshCw } from 'lucide-react'; // Importar o ícone de refresh

interface CatalogProduct {
  id: string;
  name: string;
  size: number; // em litros
  price: number; // em R$
  type: 'diluted' | 'ready-to-use';
  dilution_ratio: number;
}

interface AddProductToServiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string | null;
  productId: string | null; // Novo prop para o ID do produto a ser editado
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

export const AddProductToServiceDialog = ({ isOpen, onClose, serviceId, productId }: AddProductToServiceDialogProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [usagePerVehicle, setUsagePerVehicle] = useState('');
  const [selectedProductDetails, setSelectedProductDetails] = useState<CatalogProduct | null>(null);
  const [editableDilutionRatioInput, setEditableDilutionRatioInput] = useState(''); // New state for editable dilution
  const [containerSize, setContainerSize] = useState(''); // Novo estado para container_size

  // Fetch product catalog
  const { data: catalogProducts, isLoading: isLoadingCatalog } = useQuery<CatalogProduct[]>({
    queryKey: ['productCatalogForSelect', user?.id],
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
      setEditableDilutionRatioInput(''); // Reset editable dilution
      setContainerSize(''); // Reset container size
    } else if (productId && serviceId) {
      // Se estamos editando um vínculo existente
      setSelectedProductId(productId);
      // A lógica de carregar os detalhes do vínculo será disparada pelo useEffect abaixo
    } else {
      // Se estamos adicionando um novo, garantir que os campos estejam limpos
      setSelectedProductId('');
      setUsagePerVehicle('');
      setSelectedProductDetails(null);
      setEditableDilutionRatioInput('');
      setContainerSize('');
    }
  }, [isOpen, productId, serviceId]);

  useEffect(() => {
    if (selectedProductId && catalogProducts) {
      const product = catalogProducts.find(p => p.id === selectedProductId);
      setSelectedProductDetails(product || null);
      if (product) {
        // Definir a diluição padrão do catálogo
        setEditableDilutionRatioInput(formatDilutionRatioForInput(product.dilution_ratio));
        
        // Se serviceId e productId estão presentes, tentar carregar os valores do vínculo
        if (serviceId && productId === selectedProductId) { // Verificar se o productId corresponde ao selecionado
          supabase
            .from('service_product_links')
            .select('usage_per_vehicle, dilution_ratio, container_size')
            .eq('service_id', serviceId)
            .eq('product_id', product.id)
            .single()
            .then(({ data, error }) => {
              if (data) {
                setUsagePerVehicle(data.usage_per_vehicle?.toFixed(0) || ''); // Usage per vehicle can be integer
                setEditableDilutionRatioInput(formatDilutionRatioForInput(data.dilution_ratio || 0));
                setContainerSize(data.container_size?.toFixed(0) || ''); // Set container size
              } else if (error && (error as any).code !== 'PGRST116') {
                console.error("Error fetching existing product link details:", error);
              }
            });
        } else {
          // Se não é um vínculo existente ou o produto selecionado mudou, limpar os campos de uso e diluição
          setUsagePerVehicle('');
          setContainerSize(''); // Clear container size
          // A diluição já foi definida para o padrão do catálogo acima
        }
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
  }, [selectedProductId, catalogProducts, serviceId, productId]);

  const addProductLinkMutation = useMutation({
    mutationFn: async ({ serviceId, productId, usage, dilution, containerSize }: { serviceId: string; productId: string; usage: number; dilution: number; containerSize: number }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      // Check if link already exists using the composite key
      const { data: existingLink, error: fetchError } = await supabase
        .from('service_product_links')
        .select('service_id, product_id') // Select composite key columns
        .eq('service_id', serviceId)
        .eq('product_id', productId)
        .single();

      if (fetchError && (fetchError as any).code !== 'PGRST116') { // PGRST116 means no rows found
        throw fetchError;
      }

      if (existingLink) {
        // Update existing link using the composite key
        const { data, error } = await supabase
          .from('service_product_links')
          .update({ usage_per_vehicle: usage, dilution_ratio: dilution, container_size: containerSize }) // Update dilution_ratio and container_size
          .eq('service_id', serviceId)
          .eq('product_id', productId)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Insert new link
        const { data, error } = await supabase
          .from('service_product_links')
          .insert({ service_id: serviceId, product_id: productId, usage_per_vehicle: usage, dilution_ratio: dilution, container_size: containerSize }) // Insert dilution_ratio and container_size
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', user?.id] }); // Invalidate services to refetch product links
      queryClient.invalidateQueries({ queryKey: ['hasLinkedProducts', user?.id] }); // Invalidate hasLinkedProducts
      toast({
        title: "Produto vinculado!",
        description: "O produto foi adicionado/atualizado no serviço.",
      });
      onClose();
    },
    onError: (err) => {
      toast({
        title: "Erro ao vincular produto",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!serviceId || !selectedProductId || !usagePerVehicle) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione um produto e informe a quantidade usada.",
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
    if (selectedProductDetails?.type === 'diluted' && (!editableDilutionRatioInput || parsedDilution <= 0)) {
      toast({
        title: "Diluição inválida",
        description: "A proporção de diluição deve ser um número positivo (Ex: 1:100 ou 100).",
        variant: "destructive",
      });
      return;
    }

    const parsedContainerSize = parseFloat(containerSize);
    if (selectedProductDetails?.type === 'diluted' && (!containerSize || isNaN(parsedContainerSize) || parsedContainerSize <= 0)) {
      toast({
        title: "Tamanho do recipiente inválido",
        description: "O tamanho do recipiente deve ser um número positivo.",
        variant: "destructive",
      });
      return;
    }

    addProductLinkMutation.mutate({
      serviceId,
      productId: selectedProductId,
      usage: parsedUsage,
      dilution: selectedProductDetails?.type === 'diluted' ? parsedDilution : 0, // Only save dilution if product is diluted
      containerSize: selectedProductDetails?.type === 'diluted' ? parsedContainerSize : 0, // Only save container size if product is diluted
    });
  };

  const handleResetDilution = () => {
    if (selectedProductDetails) {
      setEditableDilutionRatioInput(formatDilutionRatioForInput(selectedProductDetails.dilution_ratio));
      toast({
        title: "Diluição restaurada!",
        description: "O valor padrão de diluição do catálogo foi restaurado.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card">
        <DialogHeader>
          <DialogTitle>{productId ? 'Editar Produto Vinculado' : 'Adicionar Produtos ao Serviço'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="product-select">Selecionar Produto *</Label>
            <Select 
              value={selectedProductId} 
              onValueChange={setSelectedProductId} 
              disabled={isLoadingCatalog || !!productId} // Desabilitar se estiver editando um vínculo existente
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Escolha um produto do catálogo" />
              </SelectTrigger>
              <SelectContent>
                {catalogProducts?.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isLoadingCatalog && <p className="text-sm text-muted-foreground">Carregando produtos...</p>}
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
                <div className="flex"> {/* Adicionado flex container */}
                  <Input
                    id="dilution-ratio"
                    type="text"
                    placeholder="Ex: 1:100 ou 100"
                    value={editableDilutionRatioInput}
                    onChange={(e) => setEditableDilutionRatioInput(e.target.value)}
                    className="flex-1 bg-background rounded-r-none border-r-0" /* Estilo para input anexado */
                    disabled={!selectedProductId}
                  />
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    onClick={handleResetDilution}
                    disabled={!selectedProductId || !selectedProductDetails}
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
          <Button onClick={handleSubmit} disabled={addProductLinkMutation.isPending || !selectedProductId || !usagePerVehicle || (selectedProductDetails?.type === 'diluted' && (!editableDilutionRatioInput || !containerSize))}>
            {addProductLinkMutation.isPending ? "Salvando..." : (productId ? "Salvar Alterações" : "Vincular Produto")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};