import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface CatalogProduct {
  id: string;
  name: string;
  size: number; // em litros
  price: number; // em R$
  user_id: string;
  type: 'diluted' | 'ready-to-use'; // Novo campo
  dilution_ratio: number; // Novo campo
}

interface ProductFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product?: CatalogProduct; // Opcional para edição
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
const formatDilutionRatio = (ratio: number): string => {
  return ratio > 0 ? `1:${ratio}` : ''; // Retorna vazio se 0 para não preencher o input
};

export const ProductFormDialog = ({ isOpen, onClose, product }: ProductFormDialogProps) => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState(product?.name || '');
  const [size, setSize] = useState(product?.size.toFixed(2) || '');
  const [price, setPrice] = useState(product?.price.toFixed(2) || '');
  const [type, setType] = useState<'diluted' | 'ready-to-use'>(product?.type || 'diluted');
  const [dilutionRatioInput, setDilutionRatioInput] = useState(product?.dilution_ratio ? formatDilutionRatio(product.dilution_ratio) : '');

  useEffect(() => {
    if (product) {
      setName(product.name);
      setSize(product.size.toFixed(2));
      setPrice(product.price.toFixed(2));
      setType(product.type);
      setDilutionRatioInput(product.dilution_ratio ? formatDilutionRatio(product.dilution_ratio) : '');
    } else {
      setName('');
      setSize('');
      setPrice('');
      setType('diluted');
      setDilutionRatioInput('');
    }
  }, [product, isOpen]);

  const upsertProductMutation = useMutation({
    mutationFn: async (newProduct: Omit<CatalogProduct, 'id' | 'created_at'> & { id?: string }) => {
      if (!user) throw new Error("Usuário não autenticado.");

      // A diluição já foi parseada para número no handleSubmit, então usamos diretamente newProduct.dilution_ratio
      const finalDilutionRatio = newProduct.type === 'diluted' ? newProduct.dilution_ratio : 0;

      let productData;
      if (newProduct.id) {
        // Update existing product
        const { data, error } = await supabase
          .from('product_catalog_items')
          .update({ 
            name: newProduct.name, 
            size: newProduct.size, 
            price: newProduct.price,
            type: newProduct.type,
            dilution_ratio: finalDilutionRatio, // Usando o valor já numérico
          })
          .eq('id', newProduct.id)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        productData = data;
      } else {
        // Insert new product
        const { data, error } = await supabase
          .from('product_catalog_items')
          .insert({ 
            name: newProduct.name, 
            size: newProduct.size, 
            price: newProduct.price, 
            type: newProduct.type,
            dilution_ratio: finalDilutionRatio, // Usando o valor já numérico
            user_id: user.id 
          })
          .select()
          .single();
        if (error) throw error;
        productData = data;
      }
      return productData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['productCatalog', user?.id] });
      toast({
        title: product ? "Produto atualizado!" : "Produto adicionado!",
        description: `${data.name} foi ${product ? 'atualizado' : 'adicionado'} com sucesso.`,
      });
      onClose();
    },
    onError: (err) => {
      toast({
        title: product ? "Erro ao atualizar produto" : "Erro ao adicionar produto",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!name || !size || !price) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome, Tamanho e Preço do produto são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    if (isNaN(parseFloat(size)) || parseFloat(size) <= 0) {
      toast({
        title: "Tamanho inválido",
        description: "O tamanho deve ser um número positivo.",
        variant: "destructive",
      });
      return;
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      toast({
        title: "Preço inválido",
        description: "O preço deve ser um número positivo.",
        variant: "destructive",
      });
      return;
    }
    const parsedDilution = parseDilutionRatioInput(dilutionRatioInput);
    if (type === 'diluted' && (!dilutionRatioInput || parsedDilution <= 0)) {
      toast({
        title: "Diluição inválida",
        description: "A proporção de diluição deve ser um número positivo (Ex: 1:100 ou 100).",
        variant: "destructive",
      });
      return;
    }

    upsertProductMutation.mutate({
      id: product?.id,
      name,
      size: parseFloat(size),
      price: parseFloat(price),
      type,
      dilution_ratio: parsedDilution, // Aqui a diluição é parseada para número
      user_id: user!.id,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Produto' : 'Adicionar Novo Produto'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Produto *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="size">Tamanho (Litros) *</Label>
            <Input id="size" type="number" step="0.01" value={size} onChange={(e) => setSize(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Preço (R$) *</Label>
            <Input id="price" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-type" className="text-sm">Tipo de Produto</Label>
            <Select 
              value={type} 
              onValueChange={(value: 'diluted' | 'ready-to-use') => {
                setType(value);
                if (value === 'ready-to-use') {
                  setDilutionRatioInput(''); // Limpa a diluição se for pronto para uso
                }
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diluted">Produto Diluído</SelectItem>
                <SelectItem value="ready-to-use">Produto Pronto Uso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === 'diluted' && (
            <div className="space-y-2">
              <Label htmlFor="dilution-ratio">Proporção de Diluição (1:X) *</Label>
              <Input
                id="dilution-ratio"
                type="text"
                placeholder="Ex: 1:100 ou 100"
                value={dilutionRatioInput}
                onChange={(e) => setDilutionRatioInput(e.target.value)}
                className="bg-background"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={upsertProductMutation.isPending}>
            {upsertProductMutation.isPending ? (product ? "Salvando..." : "Adicionando...") : (product ? "Salvar Alterações" : "Adicionar Produto")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};