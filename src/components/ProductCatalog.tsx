import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Package, Trash2, Plus, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ProductFormDialog, CatalogProduct } from "@/components/ProductFormDialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNavigate } from "react-router-dom";

// Utility function to format dilution ratio for display
const formatDilutionRatio = (ratio: number): string => {
  return ratio > 0 ? `1:${ratio}` : 'N/A';
};

interface OperationalCost {
  id: string;
  description: string;
  value: number;
  type: 'fixed' | 'variable';
  user_id: string;
  created_at: string;
}

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

  // Query para verificar a existência de "Produtos Gastos no Mês"
  const { data: productsMonthlyCostItem, isLoading: isLoadingMonthlyCost, refetch: refetchMonthlyCostItem } = useQuery<OperationalCost | null>({
    queryKey: ['productsMonthlyCostItem', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('operational_costs')
        .select('*')
        .eq('user_id', user.id)
        .eq('description', 'Produtos Gastos no Mês')
        .single();
      if (error && (error as any).code !== 'PGRST116') { // PGRST116 means no rows found
        console.error("Error fetching products monthly cost item:", error);
        throw error;
      }
      return data;
    },
    enabled: !!user,
  });

  // Estado derivado para o método de cálculo
  const productCostCalculationMethod = productsMonthlyCostItem ? 'monthly-average' : 'per-service';

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

  const addProductsMonthlyCostMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        .from('operational_costs')
        .insert({
          description: 'Produtos Gastos no Mês',
          value: 0, // Valor inicial 0
          type: 'variable',
          user_id: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operationalCosts', user?.id] }); // Invalida custos operacionais
      refetchMonthlyCostItem(); // Refetch para atualizar o estado do radio
      toast({
        title: "Item de custo de produtos adicionado!",
        description: "Um item 'Produtos Gastos no Mês' foi adicionado aos seus custos variáveis.",
      });
    },
    onError: (err) => {
      console.error("Error adding products monthly cost item:", err);
      toast({
        title: "Erro ao adicionar custo de produtos",
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

  const handleCalculationMethodChange = async (value: 'per-service' | 'monthly-average') => {
    if (!user) {
      toast({
        title: "Erro de autenticação",
        description: "Você precisa estar logado para alterar o método de cálculo.",
        variant: "destructive",
      });
      return;
    }

    if (value === 'monthly-average') {
      if (!productsMonthlyCostItem) {
        // Se o item não existe, adiciona e depois navega
        await addProductsMonthlyCostMutation.mutateAsync(user.id);
        navigate('/manage-costs', {
          state: {
            openAddCostDialog: true,
            defaultDescription: 'Produtos Gastos no Mês',
            defaultType: 'variable',
          },
        });
      } else {
        // Se o item já existe, apenas navega
        navigate('/manage-costs', {
          state: {
            openAddCostDialog: true,
            defaultDescription: 'Produtos Gastos no Mês',
            defaultType: 'variable',
          },
        });
      }
    } else {
      // Se o usuário seleciona "Cálculo Detalhado por Serviço", não faz nada além de atualizar o estado local
      // A remoção do "Produtos Gastos no Mês" deve ser feita manualmente na página de custos.
      // O estado do radio button será atualizado automaticamente pela query `productsMonthlyCostItem`
      // quando o item for removido da tabela `operational_costs`.
    }
  };

  if (isLoading || isLoadingMonthlyCost) return <p>Carregando catálogo...</p>;
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
                  className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border border-border/50"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.size}L - R$ {product.price.toFixed(2)}
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
                      className="text-primary hover:bg-primary/10"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
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

        {/* Nova Seção: Método de Cálculo de Custo de Produtos */}
        <div className="space-y-6 pt-6 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-foreground">Método de Cálculo de Custo de Produtos</CardTitle>
              <CardDescription>
                Escolha como você deseja que o sistema calcule o custo dos produtos utilizados em seus serviços.
              </CardDescription>
            </div>
          </div>

          <RadioGroup
            value={productCostCalculationMethod}
            onValueChange={handleCalculationMethodChange}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="flex items-center space-x-3 p-4 rounded-lg border bg-background/50 hover:bg-muted/50 transition-colors cursor-pointer">
              <RadioGroupItem value="per-service" id="per-service" />
              <Label htmlFor="per-service" className="flex-1 cursor-pointer">
                <h4 className="font-medium text-foreground">Cálculo Detalhado por Serviço</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Atribua produtos específicos do seu catálogo e suas respectivas diluições a cada serviço. Ideal para uma precificação exata e controle minucioso.
                </p>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-4 rounded-lg border bg-background/50 hover:bg-muted/50 transition-colors cursor-pointer">
              <RadioGroupItem value="monthly-average" id="monthly-average" />
              <Label htmlFor="monthly-average" className="flex-1 cursor-pointer">
                <h4 className="font-medium text-foreground">Cálculo Médio Mensal</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Informe o valor total gasto com produtos por mês. O sistema calculará um custo médio por serviço com base nos seus custos operacionais e horas trabalhadas. Perfeito para simplificar a gestão.
                </p>
              </Label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>

      <ProductFormDialog
        isOpen={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
        product={editingProduct}
      />
    </Card>
  );
};