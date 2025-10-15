import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package, Car, Trash2 } from "lucide-react";
import { Service } from "@/components/ServiceFormDialog"; // Assumindo que Service type é exportado
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useToast } from '@/hooks/use-toast';
import { formatDilutionRatio } from '@/lib/cost-calculations'; // Importar formatDilutionRatio

interface ServiceProductManagerProps {
  services: Service[];
  onAddProductToService: (serviceId: string) => void;
}

export const ServiceProductManager = ({ services, onAddProductToService }: ServiceProductManagerProps) => {
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
            {services.map((service) => (
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
                  <ul className="list-disc list-inside text-sm text-muted-foreground ml-4 space-y-1">
                    {service.products.map(product => (
                      <li key={product.id} className="flex items-center justify-between group">
                        <span>
                          {product.name} ({product.usage_per_vehicle} ml)
                          {product.dilution_ratio > 0 && ` | Diluição: ${formatDilutionRatio(product.dilution_ratio)}`}
                        </span>
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
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic ml-4">Nenhum produto vinculado.</p>
                )}
              </div>
            ))}
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