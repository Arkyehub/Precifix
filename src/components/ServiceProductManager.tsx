import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package, Car, Trash2 } from "lucide-react"; // Removido DollarSign e Percent
import { Service } from "@/components/ServiceFormDialog"; // Assumindo que Service type é exportado
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useToast } from '@/hooks/use-toast';
import { formatDilutionRatio, calculateProductCost, calculateProductCostPerContainer, ProductForCalculation } from '@/lib/cost-calculations'; // Importar formatDilutionRatio e as novas funções de cálculo

interface ServiceProductManagerProps {
  services: Service[];
  onAddProductToService: (serviceId: string, productId?: string) => void;
  // showDetails: boolean; // Prop removida
}

export const ServiceProductManager = ({ services, onAddProductToService }: ServiceProductManagerProps) => { // showDetails removido dos props
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteProductLinkMutation = useMutation({
    mutationFn: async ({ serviceId, productId }: { serviceId: string; productId: string }) => {
      if (!user) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from('service_product_links')
        .delete()
        .eq('service_id', serviceId)
        .eq('product_id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['hasLinkedProducts', user?.id] }); // Invalidate hasLinkedProducts
      toast({
        title: "Produto desvinculado!",
        description: "O produto foi removido do serviço.",
      });
    },
    onError: (err) => {
      toast({
        title: "Erro ao desvincular produto",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-foreground">Produtos Utilizados nos Serviços</CardTitle>
            <CardDescription>
              Visualize e adicione produtos do seu catálogo a cada serviço.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {services.length > 0 ? (
          <div className="space-y-4">
            {services.map((service) => {
              return (
                <div key={service.id} className="p-4 rounded-lg border bg-background/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      {service.name}
                    </h4>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onAddProductToService(service.id)}
                      className="text-primary hover:bg-primary/10"
                      title={`Adicionar produtos a ${service.name}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {service.products && service.products.length > 0 ? (
                    <ul className="list-none space-y-3 ml-4">
                      {service.products.map(product => {
                        const productForCalc: ProductForCalculation = {
                          gallonPrice: product.price,
                          gallonVolume: product.size * 1000, // Convert liters to ml
                          dilutionRatio: product.dilution_ratio,
                          usagePerVehicle: product.usage_per_vehicle,
                          type: product.type,
                          containerSize: product.container_size, // Passar container_size
                        };
                        const costPerApplication = calculateProductCost(productForCalc);
                        const costPerContainer = calculateProductCostPerContainer(productForCalc);
                        
                        // Cálculos baseados no container_size
                        const concentratedProductInContainer = product.type === 'diluted' && product.dilution_ratio > 0 && product.container_size > 0
                          ? (product.container_size / product.dilution_ratio)
                          : 0;
                        const waterNeededInContainer = product.type === 'diluted' && product.dilution_ratio > 0 && product.container_size > 0
                          ? (product.container_size - concentratedProductInContainer)
                          : 0;

                        return (
                          <li key={product.id} className="flex flex-col p-3 rounded-md bg-muted/20 border border-border/50 relative group">
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 
                                  className="font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                                  onClick={() => onAddProductToService(service.id, product.id)}
                                >
                                  {product.name}
                                  <span className={`ml-2 text-xs px-2 py-0.5 rounded bg-primary/20 ${product.type === 'ready-to-use' ? 'text-blue-800' : 'text-primary-strong'}`}>
                                    {product.type === 'ready-to-use' ? 'Pronto Uso' : 'Diluído'}
                                  </span>
                                </h5>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                                  <span>Preço: R$ {product.price.toFixed(2)}</span>
                                  <span>Volume Concentrado: {(product.size * 1000).toFixed(0)} ml</span>
                                  {product.type === 'diluted' && (
                                    <>
                                      <span>Diluição: {formatDilutionRatio(product.dilution_ratio)}</span>
                                      {product.container_size > 0 && (
                                        <>
                                          <span>Tamanho do Recipiente: {product.container_size.toFixed(0)} ml</span>
                                          <span>Quantidade do produto no Recipiente: {concentratedProductInContainer.toFixed(0)} ml</span>
                                          <span>Quantidade de água no Recipiente: {waterNeededInContainer.toFixed(0)} ml</span>
                                        </>
                                      )}
                                    </>
                                  )}
                                  {product.type === 'ready-to-use' && (
                                    <span>Uso: {product.usage_per_vehicle.toFixed(0)} ml</span>
                                  )}
                                </div>
                                <div className="mt-2 space-y-1">
                                  {product.type === 'diluted' && product.container_size > 0 && (
                                    <p className="text-sm text-primary-strong font-medium">
                                      Custo/Recipiente diluído: R$ {costPerContainer.toFixed(2)}
                                    </p>
                                  )}
                                  <p className="text-sm text-primary-strong font-bold">
                                    Custo/aplicação: R$ {costPerApplication.toFixed(2)}{" "}
                                    <span className="text-xs text-muted-foreground">(Ref. a quantidade: {product.usage_per_vehicle.toFixed(0)}ml)</span>
                                  </p>
                                </div>
                              </div>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={`Remover ${product.name} de ${service.name}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-card">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. Isso desvinculará permanentemente o produto "{product.name}" do serviço "{service.name}".
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => deleteProductLinkMutation.mutate({ serviceId: service.id, productId: product.id })} 
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Desvincular
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground italic ml-4">Nenhum produto vinculado.</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center italic py-4">
            Nenhum serviço cadastrado para vincular produtos.
          </p>
        )}
      </CardContent>
    </Card>
  );
};