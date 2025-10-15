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
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false); // Novo estado para o diálogo de confirmação

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

  // A mutação addProductsMonthlyCostMutation não será mais chamada diretamente daqui.
  // A criação do item 'Produtos Gastos no Mês' será feita pelo formulário na ManageCostsPage.

  // Nova mutação para deletar o custo mensal de produtos
  const deleteProductsMonthlyCostMutation = useMutation({
    mutationFn: async (costId: string) => {
      if (!user) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from('operational_costs')
        .delete()
        .eq('id', costId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operationalCosts', user?.id] });
      refetchMonthlyCostItem(); // Atualiza o estado do radio button
      toast({
        title: "Fórmula de cálculo alterada!",
        description: "O custo 'Produtos Gastos no Mês' foi removido da tabela de custos variáveis.",
      });
      setIsConfirmDialogOpen(false); // Fecha o diálogo de confirmação
    },
    onError: (err) => {
      console.error("Error deleting products monthly cost item:", err);
      toast({
        title: "Erro ao alterar fórmula de cálculo",
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

  const handleConfirmSwitchToPerService = () => {
    if (productsMonthlyCostItem?.id) {
      deleteProductsMonthlyCostMutation.mutate(productsMonthlyCostItem.id);
    }
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
      if (productsMonthlyCostItem) {
        // Se o item já existe, navega para editar
        navigate('/manage-costs', {
          state: {
            editingCostId: productsMonthlyCostItem.id,
          },
        });
      } else {
        // Se o item não existe, navega para adicionar com defaults
        navigate('/manage-costs', {
          state: {
            openAddCostDialog: true,
            defaultDescription: 'Produtos Gastos no Mês',
            defaultType: 'variable',
          },
        });
      }
    } else { // Tentando mudar para 'per-service'
      if (productsMonthlyCostItem) {
        // Se 'Produtos Gastos no Mês' existe, abre o diálogo de confirmação
        setIsConfirmDialogOpen(true);
      }
      // Se não existe, o estado já é 'per-service', nenhuma ação é necessária.
      // O estado derivado `productCostCalculationMethod` já lida com a atualização visual.
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
                <h4 className="font-medium text-foreground"><strong>Cálculo Detalhado</strong> (Para cada Serviço)</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Atribua produtos específicos do seu catálogo e suas respectivas diluições a cada serviço. Ideal para uma precificação exata e controle minucioso.
                </p>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-4 rounded-lg border bg-background/50 hover:bg-muted/50 transition-colors cursor-pointer">
              <RadioGroupItem value="monthly-average" id="monthly-average" />
              <Label htmlFor="monthly-average" className="flex-1 cursor-pointer">
                <h4 className="font-medium text-foreground"><strong>Cálculo Simplificado</strong> (Média Mensal)</h4>
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

      {/* Diálogo de Confirmação para mudar para Cálculo Detalhado por Serviço */}
      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alteração da Fórmula de Cálculo?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao mudar para "Cálculo Detalhado por Serviço", o registro "Produtos Gastos no Mês" será
              <span className="font-bold text-destructive"> permanentemente apagado</span> da sua tabela de custos variáveis.
              Você realmente deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProductsMonthlyCostMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmSwitchToPerService} 
              disabled={deleteProductsMonthlyCostMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProductsMonthlyCostMutation.isPending ? "Continuando..." : "Continuar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};