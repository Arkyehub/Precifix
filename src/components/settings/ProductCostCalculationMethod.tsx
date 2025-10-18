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
  const [isConfirmSwitchToMonthlyAverageInfoDialog, setIsConfirmSwitchToMonthlyAverageInfoDialog] = useState(false); // Novo estado para o diálogo de informação

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

  const handleConfirmSwitchToPerService = () => {
    if (productsMonthlyCostItem?.id) {
      deleteProductsMonthlyCostMutation.mutate(productsMonthlyCostItem.id);
    }
  };

  const handleConfirmMonthlyAverageInfo = () => {
    setIsConfirmSwitchToMonthlyAverageInfoDialog(false); // Fecha o diálogo de informação
    // Agora navega para gerenciar custos para adicionar/editar o custo mensal
    const latestProductsMonthlyCostItem = queryClient.getQueryData<OperationalCost | null>(['productsMonthlyCostItem', user?.id]);
    if (latestProductsMonthlyCostItem) {
      navigate('/manage-costs', {
        state: {
          editingCostId: latestProductsMonthlyCostItem.id,
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

    // Trigger refetch for productsMonthlyCostItem and await its completion
    await refetchMonthlyCostItem();

    // Get the latest data directly from the query client's cache after refetch
    const latestProductsMonthlyCostItem = queryClient.getQueryData<OperationalCost | null>(['productsMonthlyCostItem', user?.id]);

    console.log("Latest productsMonthlyCostItem (after refetch):", latestProductsMonthlyCostItem);

    if (value === 'monthly-average') {
      // User wants to switch TO 'monthly-average'
      if (!latestProductsMonthlyCostItem) {
        // If 'Produtos Gastos no Mês' does NOT exist, it means they are currently in 'per-service' mode.
        // Show an informational dialog before redirecting to add the cost.
        setIsConfirmSwitchToMonthlyAverageInfoDialog(true); 
      } else {
        // If 'Produtos Gastos no Mês' DOES exist, it means they are already in 'monthly-average' mode
        // or switching from 'per-service' but the item was somehow created.
        // Just navigate to edit the existing cost.
        toast({
          title: "Método de cálculo alterado!",
          description: "Você está usando o cálculo simplificado. Agora, defina o custo mensal de produtos.",
        });
        navigate('/manage-costs', {
          state: {
            editingCostId: latestProductsMonthlyCostItem.id,
          },
        });
      }
    } else { // User wants to switch TO 'per-service'
      if (latestProductsMonthlyCostItem) {
        // If 'Produtos Gastos no Mês' DOES exist, it means they are currently in 'monthly-average' mode.
        // Ask for confirmation to delete it.
        setIsConfirmSwitchToPerServiceDialogOpen(true);
      }
      // If 'Produtos Gastos no Mês' does NOT exist, they are already in 'per-service' mode, no action needed.
    }
  };

  if (isLoadingMonthlyCost) {
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
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={productCostCalculationMethod}
          onValueChange={handleCalculationMethodChange}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="flex items-center space-x-3 p-4 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer">
            <RadioGroupItem 
              value="per-service" 
              id="per-service" 
              disabled={isLoadingMonthlyCost} 
            />
            <Label htmlFor="per-service" className="flex-1 cursor-pointer">
              <h4 className="font-medium text-foreground"><strong>Cálculo Detalhado</strong> (Para cada Serviço)</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Atribua produtos específicos do seu catálogo e suas respectivas diluições a cada serviço. Ideal para uma precificação exata e controle minucioso.
              </p>
            </Label>
          </div>

          <div className="flex items-center space-x-3 p-4 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer">
            <RadioGroupItem 
              value="monthly-average" 
              id="monthly-average" 
              disabled={isLoadingMonthlyCost} 
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

      {/* Diálogo de Confirmação para mudar para Cálculo Detalhado por Serviço (apaga custo mensal) */}
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

      {/* NOVO Diálogo de Informação para mudar para Cálculo Simplificado (redireciona para adicionar custo mensal) */}
      <AlertDialog open={isConfirmSwitchToMonthlyAverageInfoDialog} onOpenChange={setIsConfirmSwitchToMonthlyAverageInfoDialog}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar Método de Cálculo?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está mudando para o "Cálculo Simplificado (Média Mensal)".
              O custo dos produtos será calculado com base em um valor mensal que você definirá.
              Você será redirecionado para a página "Gerenciar Custos" para configurar este valor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMonthlyAverageInfo}>
              Entendi, Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};