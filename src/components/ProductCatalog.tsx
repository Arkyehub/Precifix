import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Package, Trash2, Plus, Pencil, Loader2 } from "lucide-react"; // Importar Loader2
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ProductFormDialog, CatalogProduct } from "@/components/ProductFormDialog";
import { useNavigate } from "react-router-dom";

// Utility function to format dilution ratio for display
const formatDilutionRatio = (ratio: number): string => {
  return ratio > 0 ? `1:${ratio}` : 'N/A';
};

export const ProductCatalog = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | undefined>(undefined);

  // Query para buscar os produtos do catálogo
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

  const removeProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_catalog_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);
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
    setEditingProduct(undefined);
    setIsFormDialogOpen(true);
  };

  const handleEditProduct = (product: CatalogProduct) => {
    setEditingProduct(product);
    setIsFormDialogOpen(true);
  };

  const handleDeleteProduct = (id: string) => {
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
        {catalogProducts && catalogProducts.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Produtos Cadastrados</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {catalogProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/50 border-l-4 border-primary"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.size.toFixed(2)}L - R$ {product.price.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tipo: {product.type === 'diluted' ? 'Diluído' : 'Pronto Uso'}
                      {product.type === 'diluted' && ` | Diluição: ${formatDilutionRatio(product.dilution_ratio)}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditProduct(product)}
                      className="text-muted-foreground hover:text-primary hover:bg-background"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive hover:bg-background"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso excluirá permanentemente o produto "{product.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteProduct(product.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center italic py-4">
            Nenhum produto cadastrado ainda. Adicione produtos para facilitar seus cálculos!
          </p>
        )}

        <Button
          onClick={handleAddProduct}
          className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Novo Produto
        </Button>
      </CardContent>

      <ProductFormDialog
        isOpen={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
        product={editingProduct}
      />
    </Card>
  );
};