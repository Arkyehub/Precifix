import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Package, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { OperationalCost } from '@/components/CostFormDialog'; // Importar o tipo

export const ProductCostCalculationMethod = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isConfirmSwitchToPerServiceDialogOpen, setIsConfirmSwitchToPerServiceDialogOpen] = useState(false);
  const [isConfirmSwitchToMonthlyDialogOpen, setIsConfirmSwitchToMonthlyDialogOpen] = useState(false);
  const [isClearingLinks, setIsClearingLinks] = useState(false);

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

  // Query para verificar se existem produtos vinculados a serviços
  const { data: hasLinkedProducts, isLoading: isLoadingLinkedProducts } = useQuery<boolean>({
    queryKey: ['hasLinkedProducts', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data: userServices, error: fetchServicesError } = await supabase
        .from('services')
        .select('id')
        .eq('user_id', user.id);

      if (fetchServicesError) {
        console.error("Error fetching user services to check for linked products:", fetchServicesError);
        return false;
      }

      const serviceIds = userServices.map(s => s.id);

      if (serviceIds.length === 0) return false;

      const { count, error } = await supabase
        .from('service_product_links')
        .select('id', { count: 'exact', head: true })
        .in('service_id', serviceIds)
        .limit(1);
      
      if (error) {
        console.error("Error checking for linked products:", error);
        return false;
      }
      return (count || 0) > 0;
    },
    enabled: !!user,
  });

  // Estado derivado para o método de cálculo
  const productCostCalculationMethod = productsMonthlyCostItem ? 'monthly-average' : 'per-service';

  // Mutação para deletar o custo mensal de produtos (usado ao mudar para 'per-service')
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
      setIsConfirmSwitchToPerServiceDialogOpen(false); // Fecha o diálogo de confirmação
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

  // Mutação para limpar todos os vínculos de produtos (usado ao mudar para 'monthly-average')
  const clearAllProductLinksForMonthlyModeMutation = useMutation({
    mutationFn: async (userId: string) => {
      setIsClearingLinks(true); // Inicia o carregamento
      const { data: userServices, error: fetchError } = await supabase
        .from('services')
        .select('id')
        .eq('user_id', userId);

      if (fetchError) throw fetchError;

      const serviceIds = userServices.map(s => s.id);

      if (serviceIds.length > 0) {
        const { error: deleteLinksError } = await supabase
          .from('service_product_links')
          .delete()
          .in('service_id', serviceIds);
        if (deleteLinksError) throw deleteLinksError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['hasLinkedProducts', user?.id] }); // Invalidar a query de verificação de links
      toast({
        title: "Vínculos de produtos limpos!",
        description: "Todos os produtos foram desvinculados dos seus serviços.",
      });
      setIsConfirmSwitchToMonthlyDialogOpen(false); // Fecha o diálogo de confirmação
      setIsClearingLinks(false); // Finaliza o carregamento
      // Agora navega para gerenciar custos
      if (productsMonthlyCostItem) {
        navigate('/manage-costs', {
          state: {
            editingCostId: productsMonthlyCostItem.id,
          },
        });
      } else {
        navigate('/manage-costs', {
          state: {
            openAddCostDialog: true,
            defaultDescription: 'Produtos Gastos no Mês',
            defaultType: 'variable',
          },
        });
      }
    },
    onError: (err) => {
      console.error("Error clearing product links for monthly mode:", err);
      toast({
        title: "Erro ao limpar vínculos de produtos",
        description: err.message,
        variant: "destructive",
      });
      setIsClearingLinks(false); // Finaliza o carregamento
    },
  });

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

    if (isLoadingLinkedProducts || isLoadingMonthlyCost) {
      toast({
        title: "Carregando dados",
        description: "Aguarde enquanto verificamos os vínculos de produtos e custos mensais.",
        // variant: "info", // Removido a variante "info"
      });
      return;
    }

    if (value === 'monthly-average') {
      // Se houver produtos vinculados, abre o diálogo de confirmação
      if (hasLinkedProducts) {
        setIsConfirmSwitchToMonthlyDialogOpen(true);
      } else {
        // Se não houver produtos vinculados, informa o usuário e procede
        toast({
          title: "Método de cálculo alterado!",
          description: "Você está usando o cálculo simplificado. Agora, defina o custo mensal de produtos.",
        });
        if (productsMonthlyCostItem) {
          navigate('/manage-costs', {
            state: {
              editingCostId: productsMonthlyCostItem.id,
            },
          });
        } else {
          navigate('/manage-costs', {
            state: {
              openAddCostDialog: true,
              defaultDescription: 'Produtos Gastos no Mês',
              defaultType: 'variable',
            },
          });
        }
      }
    } else { // Tentando mudar para 'per-service'
      if (productsMonthlyCostItem) {
        // Se 'Produtos Gastos no Mês' existe, abre o diálogo de confirmação existente
        setIsConfirmSwitchToPerServiceDialogOpen(true);
      }
      // Se não existe, o estado já é 'per-service', nenhuma ação é necessária.
    }
  };

  if (isLoadingMonthlyCost || isLoadingLinkedProducts) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Método de Cálculo de Custo de Produtos</CardTitle>
          </div>
          <CardDescription>
            Carregando configurações...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">Método de Cálculo de Custo de Produtos</CardTitle>
        </div>
        <CardDescription>
          Escolha como você deseja que o sistema calcule o custo dos produtos utilizados em seus serviços.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={productCostCalculationMethod}
          onValueChange={handleCalculationMethodChange}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="flex items-center space-x-3 p-4 rounded-lg border bg-background/50 hover:bg-muted/50 transition-colors cursor-pointer">
            <RadioGroupItem 
              value="per-service" 
              id="per-service" 
              disabled={isLoadingMonthlyCost || isLoadingLinkedProducts} 
            />
            <Label htmlFor="per-service" className="flex-1 cursor-pointer">
              <h4 className="font-medium text-foreground"><strong>Cálculo Detalhado</strong> (Para cada Serviço)</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Atribua produtos específicos do seu catálogo e suas respectivas diluições a cada serviço. Ideal para uma precificação exata e controle minucioso.
              </p>
            </Label>
          </div>

          <div className="flex items-center space-x-3 p-4 rounded-lg border bg-background/50 hover:bg-muted/50 transition-colors cursor-pointer">
            <RadioGroupItem 
              value="monthly-average" 
              id="monthly-average" 
              disabled={isLoadingMonthlyCost || isLoadingLinkedProducts} 
            />
            <Label htmlFor="monthly-average" className="flex-1 cursor-pointer">
              <h4 className="font-medium text-foreground"><strong>Cálculo Simplificado</strong> (Média Mensal)</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Informe o valor total gasto com produtos por mês. O sistema calculará um custo médio por serviço com base nos seus custos operacionais e horas trabalhadas. Perfeito para simplificar a gestão.
              </p>
            </Label>
          </div>
        </RadioGroup>
      </CardContent>

      {/* Diálogo de Confirmação para mudar para Cálculo Detalhado por Serviço */}
      <AlertDialog open={isConfirmSwitchToPerServiceDialogOpen} onOpenChange={setIsConfirmSwitchToPerServiceDialogOpen}>
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

      {/* Diálogo de Confirmação para mudar para Cálculo Simplificado (Mensal) */}
      <AlertDialog open={isConfirmSwitchToMonthlyDialogOpen} onOpenChange={setIsConfirmSwitchToMonthlyDialogOpen}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alteração da Fórmula de Cálculo?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao mudar para "Cálculo Simplificado (Média Mensal)", todos os produtos vinculados aos seus serviços serão
              <span className="font-bold text-destructive"> permanentemente apagados</span>.
              Você realmente deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingLinks}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => user && clearAllProductLinksForMonthlyModeMutation.mutate(user.id)} 
              disabled={isClearingLinks}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearingLinks ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Continuar e Apagar Vínculos"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};