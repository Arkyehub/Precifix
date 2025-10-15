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
}

export const AddProductToServiceDialog = ({ isOpen, onClose, serviceId }: AddProductToServiceDialogProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [usagePerVehicle, setUsagePerVehicle] = useState('');
  const [selectedProductDetails, setSelectedProductDetails] = useState<CatalogProduct | null>(null);

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
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedProductId && catalogProducts) {
      const product = catalogProducts.find(p => p.id === selectedProductId);
      setSelectedProductDetails(product || null);
    } else {
      setSelectedProductDetails(null);
    }
  }, [selectedProductId, catalogProducts]);

  const addProductLinkMutation = useMutation({
    mutationFn: async ({ serviceId, productId, usage }: { serviceId: string; productId: string; usage: number }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      // Check if link already exists
      const { data: existingLink, error: fetchError } = await supabase
        .from('service_product_links')
        .select('id')
        .eq('service_id', serviceId)
        .eq('product_id', productId)
        .single();

      if (fetchError && (fetchError as any).code !== 'PGRST116') { // PGRST116 means no rows found
        throw fetchError;
      }

      if (existingLink) {
        // Update existing link
        const { data, error } = await supabase
          .from('service_product_links')
          .update({ usage_per_vehicle: usage })
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
          .insert({ service_id: serviceId, product_id: productId, usage_per_vehicle: usage })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', user?.id] }); // Invalidate services to refetch product links
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

    addProductLinkMutation.mutate({
      serviceId,
      productId: selectedProductId,
      usage: parsedUsage,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card">
        <DialogHeader>
          <DialogTitle>Adicionar Produtos ao Serviço</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="product-select">Selecionar Produto *</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId} disabled={isLoadingCatalog}>
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
                Tamanho: {selectedProductDetails.size} L ({selectedProductDetails.size * 1000} ml)
              </p>
              <p className="text-xs text-muted-foreground">
                Preço: R$ {selectedProductDetails.price.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Tipo: {selectedProductDetails.type === 'diluted' ? 'Diluído' : 'Pronto Uso'}
                {selectedProductDetails.type === 'diluted' && ` | Diluição: ${formatDilutionRatio(selectedProductDetails.dilution_ratio)}`}
              </p>
            </div>
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
          <Button onClick={handleSubmit} disabled={addProductLinkMutation.isPending || !selectedProductId || !usagePerVehicle}>
            {addProductLinkMutation.isPending ? "Vinculando..." : "Vincular Produto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};