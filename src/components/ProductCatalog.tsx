import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Package, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface CatalogProduct {
  id: string;
  name: string;
  size: number; // em litros
  price: number; // em R$
  user_id: string;
}

export const ProductCatalog = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [newProduct, setNewProduct] = useState({
    name: "",
    size: "",
    price: "",
  });
  const { toast } = useToast();

  const { data: catalogProducts, isLoading, error } = useQuery<CatalogProduct[]>({
    queryKey: ['productCatalog', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('product_catalog_items')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addProductMutation = useMutation({
    mutationFn: async (product: Omit<CatalogProduct, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('product_catalog_items')
        .insert(product)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['productCatalog', user?.id] });
      setNewProduct({ name: "", size: "", price: "" });
      toast({
        title: "Produto cadastrado!",
        description: `${data.name} foi adicionado ao catálogo.`,
      });
    },
    onError: (err) => {
      toast({
        title: "Erro ao adicionar produto",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const removeProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_catalog_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id); // Ensure user can only delete their own products
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productCatalog', user?.id] });
      toast({
        title: "Produto removido",
        description: "O produto foi excluído do catálogo.",
      });
    },
    onError: (err) => {
      toast({
        title: "Erro ao remover produto",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleAddProduct = () => {
    if (!user) {
      toast({
        title: "Erro de autenticação",
        description: "Você precisa estar logado para adicionar produtos.",
        variant: "destructive",
      });
      return;
    }
    if (!newProduct.name || !newProduct.size || !newProduct.price) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos do produto.",
        variant: "destructive",
      });
      return;
    }

    addProductMutation.mutate({
      name: newProduct.name,
      size: parseFloat(newProduct.size),
      price: parseFloat(newProduct.price),
      user_id: user.id,
    });
  };

  const handleRemoveProduct = (id: string) => {
    removeProductMutation.mutate(id);
  };

  if (isLoading) return <p>Carregando catálogo...</p>;
  if (error) return <p>Erro ao carregar catálogo: {error.message}</p>;

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-foreground">Catálogo de Produtos</CardTitle>
            <CardDescription>
              Cadastre seus produtos para reutilizar nos cálculos
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="productName">Nome do Produto</Label>
            <Input
              id="productName"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              placeholder="Ex: Shampoo Automotivo"
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productSize">Tamanho (Litros)</Label>
            <Input
              id="productSize"
              type="number"
              step="0.1"
              value={newProduct.size}
              onChange={(e) => setNewProduct({ ...newProduct, size: e.target.value })}
              placeholder="Ex: 5"
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productPrice">Preço (R$)</Label>
            <Input
              id="productPrice"
              type="number"
              step="0.01"
              value={newProduct.price}
              onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              placeholder="Ex: 89.90"
              className="bg-background/50"
            />
          </div>
        </div>

        <Button 
          onClick={handleAddProduct}
          className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
          disabled={addProductMutation.isPending}
        >
          {addProductMutation.isPending ? "Adicionando..." : <><Plus className="mr-2 h-4 w-4" /> Adicionar ao Catálogo</>}
        </Button>

        {catalogProducts && catalogProducts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Produtos Cadastrados</h3>
            <div className="space-y-2">
              {catalogProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border border-border/50"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.size}L - R$ {product.price.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveProduct(product.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={removeProductMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {catalogProducts && catalogProducts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center italic py-4">
            Nenhum produto cadastrado ainda. Adicione produtos para facilitar seus cálculos!
          </p>
        )}
      </CardContent>
    </Card>
  );
};