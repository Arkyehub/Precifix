import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Car, Pencil, Trash2, Eraser, Clock, DollarSign as DollarIcon, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ServiceFormDialog, Service } from "@/components/ServiceFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ServiceProductManager } from "@/components/ServiceProductManager";
import { AddProductToServiceDialog } from '@/components/AddProductToServiceDialog';
import { calculateProductCostPerLiter } from '@/lib/cost-calculations'; // Importar a nova função de cálculo

// Utility function to format minutes to HH:MM
const formatMinutesToHHMM = (totalMinutes: number): string => {
  if (isNaN(totalMinutes) || totalMinutes < 0) return "00:00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const DEFAULT_SERVICES_TO_ADD = [
  { name: "Lavagem Simples", description: "Limpeza externa básica do veículo.", price: 50.00, labor_cost_per_hour: 30.00, execution_time_minutes: 30 },
  { name: "Lavagem Detalhada", description: "Limpeza completa externa e interna, com atenção aos detalhes.", price: 120.00, labor_cost_per_hour: 40.00, execution_time_minutes: 90 },
  { name: "Higienização Interna", description: "Limpeza profunda e desinfecção do interior do veículo.", price: 250.00, labor_cost_per_hour: 50.00, execution_time_minutes: 180 },
  { name: "Polimento Comercial", description: "Remoção de riscos superficiais e restauração do brilho da pintura.", price: 400.00, labor_cost_per_hour: 60.00, execution_time_minutes: 240 },
  { name: "Vitrificação de Pintura", description: "Aplicação de camada protetora para maior durabilidade e brilho da pintura.", price: 800.00, labor_cost_per_hour: 70.00, execution_time_minutes: 360 },
];

interface OperationalCost {
  id: string;
  description: string;
  value: number;
  type: 'fixed' | 'variable';
  user_id: string;
  created_at: string;
}

const ServicesPage = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | undefined>(undefined);
  const hasAddedDefaultServicesRef = useRef(false);
  const [showDetails, setShowDetails] = useState(false);

  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
  const [serviceIdForProductAdd, setServiceIdForProductAdd] = useState<string | null>(null);
  const [productIdForProductAdd, setProductIdForProductAdd] = useState<string | null>(null); // Novo estado para productId

  const { data: services, isLoading, error } = useQuery<Service[]>({
    queryKey: ['services', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('user_id', user.id);
      if (servicesError) {
        console.error("Error fetching services in queryFn:", servicesError);
        throw servicesError;
      }
      
      const servicesWithProducts = await Promise.all(servicesData.map(async (service) => {
        const { data: linksData, error: linksError } = await supabase
          .from('service_product_links')
          .select('product_id, usage_per_vehicle, dilution_ratio, container_size') // Buscar container_size
          .eq('service_id', service.id);
        if (linksError) {
          console.error(`Error fetching product links for service ${service.id}:`, linksError);
          throw linksError;
        }

        const productIds = linksData.map(link => link.product_id);

        if (productIds.length > 0) {
          const { data: productsData, error: productsError } = await supabase
            .from('product_catalog_items')
            .select('id, name, size, price, type, dilution_ratio') // Adicionado size, price, type, dilution_ratio
            .in('id', productIds);
          if (productsError) {
            console.error(`Error fetching products for service ${service.id}:`, productsError);
            throw productsError;
          }
          const productsWithUsageAndDilution = productsData.map(product => {
            const link = linksData.find(link => link.product_id === product.id);
            return { 
              ...product, 
              usage_per_vehicle: link?.usage_per_vehicle || 0,
              dilution_ratio: link?.dilution_ratio || 0,
              container_size: link?.container_size || 0, // Adicionado container_size
            };
          });
          return { ...service, products: productsWithUsageAndDilution };
        }
        return { ...service, products: [] };
      }));
      
      return servicesWithProducts;
    },
    enabled: !!user,
  });

  const { data: productsMonthlyCostItem, isLoading: isLoadingMonthlyCost } = useQuery<OperationalCost | null>({
    queryKey: ['productsMonthlyCostItem', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('operational_costs')
        .select('*')
        .eq('user_id', user.id)
        .eq('description', 'Produtos Gastos no Mês')
        .single();
      if (error && (error as any).code !== 'PGRST116') {
        console.error("Error fetching products monthly cost item:", error);
        throw error;
      }
      return data;
    },
    enabled: !!user,
  });

  const productCostCalculationMethod = productsMonthlyCostItem ? 'monthly-average' : 'per-service';

  const addDefaultServicesMutation = useMutation({
    mutationFn: async (userId: string) => {
      const servicesToInsert = DEFAULT_SERVICES_TO_ADD.map(service => ({
        ...service,
        user_id: userId,
      }));
      const { data, error } = await supabase
        .from('services')
        .insert(servicesToInsert)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['services', user?.id] });
      toast({
        title: "Serviços de exemplo adicionados!",
        description: "Você pode editá-los ou adicionar novos.",
      });
    },
    onError: (err) => {
      console.error("Error adding default services:", err);
      toast({
        title: "Erro ao adicionar serviços de exemplo",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // REMOVIDO: clearAllProductLinksMutation e seu useEffect, pois a lógica foi movida para ProductCatalog.tsx

  useEffect(() => {
    const shouldAddDefaults =
      user &&
      !isLoading &&
      !error &&
      services &&
      services.length === 0 &&
      !addDefaultServicesMutation.isPending &&
      !hasAddedDefaultServicesRef.current;

    if (shouldAddDefaults) {
      hasAddedDefaultServicesRef.current = true;
      addDefaultServicesMutation.mutate(user.id);
    }
  }, [user, isLoading, error, services, addDefaultServicesMutation.isPending, addDefaultServicesMutation]);

  // REMOVIDO: useEffect que disparava clearAllProductLinksMutation

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', user?.id] });
      toast({
        title: "Serviço removido",
        description: "O serviço foi excluído com sucesso.",
      });
    },
    onError: (err) => {
      console.error("Error deleting service:", err);
      toast({
        title: "Erro ao remover serviço",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const clearAllServicesMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado.");
      const { data: userServices, error: fetchError } = await supabase
        .from('services')
        .select('id')
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      const serviceIds = userServices.map(s => s.id);

      if (serviceIds.length > 0) {
        const { error: deleteLinksError } = await supabase
          .from('service_product_links')
          .delete()
          .in('service_id', serviceIds);
        if (deleteLinksError) throw deleteLinksError;
      }

      const { error } = await supabase
        .from('services')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', user?.id] });
      toast({
        title: "Serviços limpos!",
        description: "Todos os seus serviços foram removidos.",
      });
      hasAddedDefaultServicesRef.current = false;
    },
    onError: (err) => {
      console.error("Error clearing all services:", err);
      toast({
        title: "Erro ao limpar serviços",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleAddService = () => {
    setEditingService(undefined);
    setIsFormDialogOpen(true);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setIsFormDialogOpen(true);
  };

  const handleDeleteService = (id: string) => {
    deleteServiceMutation.mutate(id);
  };

  const handleClearAllServices = () => {
    clearAllServicesMutation.mutate();
  };

  const handleAddProductToService = (serviceId: string, productId: string | null = null) => {
    setServiceIdForProductAdd(serviceId);
    setProductIdForProductAdd(productId); // Definir o productId
    setIsAddProductDialogOpen(true);
  };

  if (isLoading || addDefaultServicesMutation.isPending || isLoadingMonthlyCost) { // Removido clearAllProductLinksMutation.isPending
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Carregando serviços...</p>
      </div>
    );
  }
  if (error) return <p>Erro ao carregar serviços: {error.message}</p>;

  const modeText = productCostCalculationMethod === 'per-service' ? 'Detalhado' : 'Simplificado';
  const modeTooltip = productCostCalculationMethod === 'per-service' 
    ? 'O custo dos produtos é calculado individualmente para cada serviço, com base nos produtos do catálogo vinculados.'
    : 'O custo dos produtos é uma média mensal, definida na página Gerenciar Custos, e distribuída pelos serviços.';

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
                <Car className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-foreground">Gerenciar Serviços</CardTitle>
                <CardDescription>
                  Adicione, edite ou remova os serviços que você oferece.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-sm font-medium bg-black text-primary px-2 py-1 rounded-md">
                      <Info className="h-4 w-4" />
                      <span>Modo: {modeText}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-card text-foreground border border-border/50 p-3 rounded-lg shadow-md max-w-xs">
                    <p>{modeTooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDetails(!showDetails)}
                className="text-muted-foreground hover:text-primary"
                title={showDetails ? "Ocultar detalhes" : "Mostrar detalhes"}
              >
                {showDetails ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {services && services.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Serviços Cadastrados</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border border-border/50"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{service.name}</p>
                      <p className="text-sm text-primary font-semibold mt-1">R$ {service.price.toFixed(2)}</p>
                      
                      {showDetails && (
                        <>
                          {service.description && (
                            <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <DollarIcon className="h-3 w-3" />
                            <span>Custo/Hora: R$ {service.labor_cost_per_hour.toFixed(2)}</span>
                            <Clock className="h-3 w-3 ml-2" />
                            <span>Tempo: {formatMinutesToHHMM(service.execution_time_minutes)}</span>
                          </div>
                          {productCostCalculationMethod === 'per-service' && service.products && service.products.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {service.products.map(product => (
                                <span key={product.id} className="text-xs px-2 py-0.5 rounded-full bg-muted-foreground/10 text-muted-foreground">
                                  {product.name} ({product.usage_per_vehicle.toFixed(0)} ml)
                                  {product.dilution_ratio > 0 && ` | Diluição: 1:${product.dilution_ratio.toFixed(0)}`}
                                  {product.container_size > 0 && ` | Recipiente: ${product.container_size.toFixed(0)} ml`}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditService(service)}
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
                              Esta ação não pode ser desfeita. Isso excluirá permanentemente o serviço "{service.name}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteService(service.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
              Nenhum serviço cadastrado ainda. Adicione seus serviços para começar!
            </p>
          )}

          <Button 
            onClick={handleAddService}
            className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Novo Serviço
          </Button>

          {services && services.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full mt-4 border-destructive text-destructive hover:bg-destructive/10"
                  disabled={clearAllServicesMutation.isPending}
                >
                  <Eraser className="mr-2 h-4 w-4" />
                  {clearAllServicesMutation.isPending ? "Limpando..." : "Limpar Todos os Serviços"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card">
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem certeza que deseja limpar TUDO?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é irreversível e excluirá permanentemente TODOS os seus serviços cadastrados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAllServices} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Sim, Limpar Tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>

      {/* Nova Seção: Produtos Utilizados nos Serviços - Renderização Condicional */}
      {productCostCalculationMethod === 'per-service' && (
        <div className="mt-8">
          <ServiceProductManager
            services={services || []}
            onAddProductToService={handleAddProductToService}
            showDetails={showDetails}
          />
        </div>
      )}

      <ServiceFormDialog
        isOpen={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
        service={editingService}
      />

      <AddProductToServiceDialog
        isOpen={isAddProductDialogOpen}
        onClose={() => {
          setIsAddProductDialogOpen(false);
          setServiceIdForProductAdd(null);
          setProductIdForProductAdd(null);
        }}
        serviceId={serviceIdForProductAdd}
        productId={productIdForProductAdd} // Passar o productId
      />
    </div>
  );
};

export default ServicesPage;