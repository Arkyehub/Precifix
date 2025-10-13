import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Car, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ServiceFormDialog, Service } from "@/components/ServiceFormDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const DEFAULT_SERVICES_TO_ADD = [
  { name: "Lavagem Simples", description: "Limpeza externa básica do veículo.", price: 0 },
  { name: "Lavagem Detalhada", description: "Limpeza completa externa e interna, com atenção aos detalhes.", price: 0 },
  { name: "Higienização", description: "Limpeza profunda e desinfecção do interior do veículo.", price: 0 },
  { name: "Polimento", description: "Remoção de riscos superficiais e restauração do brilho da pintura.", price: 0 },
  { name: "Vitrificação", description: "Aplicação de camada protetora para maior durabilidade e brilho da pintura.", price: 0 },
];

const ServicesPage = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | undefined>(undefined);
  const hasAddedDefaultServicesRef = useRef(false); // Usar useRef para controlar a adição única

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
      console.log("Services fetched from DB (inside queryFn):", servicesData); // Log para ver o que o DB retorna
      
      // Fetch associated products for each service
      const servicesWithProducts = await Promise.all(servicesData.map(async (service) => {
        const { data: linksData, error: linksError } = await supabase
          .from('service_product_links')
          .select('product_id')
          .eq('service_id', service.id);
        if (linksError) {
          console.error(`Error fetching product links for service ${service.id}:`, linksError);
          throw linksError;
        }

        const productIds = linksData.map(link => link.product_id);

        if (productIds.length > 0) {
          const { data: productsData, error: productsError } = await supabase
            .from('product_catalog_items')
            .select('id, name')
            .in('id', productIds);
          if (productsError) {
            console.error(`Error fetching products for service ${service.id}:`, productsError);
            throw productsError;
          }
          return { ...service, products: productsData };
        }
        return { ...service, products: [] };
      }));
      
      return servicesWithProducts;
    },
    enabled: !!user,
  });

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
      console.log("Default services added successfully. Data:", data); // Log para confirmar a adição
      queryClient.invalidateQueries({ queryKey: ['services', user?.id] });
      toast({
        title: "Serviços de exemplo adicionados!",
        description: "Você pode editá-los ou adicionar novos.",
      });
    },
    onError: (err) => {
      console.error("Error adding default services:", err); // Log de erro na mutação
      toast({
        title: "Erro ao adicionar serviços de exemplo",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    // Log current state for debugging
    console.log("--- ServicesPage useEffect Debug ---");
    console.log("User:", user?.id);
    console.log("isLoading (query):", isLoading);
    console.log("error (query):", error);
    console.log("services (data):", services);
    console.log("services.length:", services?.length);
    console.log("addDefaultServicesMutation.isPending:", addDefaultServicesMutation.isPending);
    console.log("hasAddedDefaultServicesRef.current (before check):", hasAddedDefaultServicesRef.current);

    // Condition to add default services
    const shouldAddDefaults =
      user &&
      !isLoading && // Query is not loading
      !error && // No error in query
      services && // Services data is available
      services.length === 0 && // No services found for the user
      !addDefaultServicesMutation.isPending && // Mutation is not already running
      !hasAddedDefaultServicesRef.current; // We haven't attempted to add defaults in this component instance

    if (shouldAddDefaults) {
      console.log("Condition met: Attempting to add default services for user:", user.id);
      hasAddedDefaultServicesRef.current = true; // Set ref to true immediately to prevent re-triggering in this mount
      addDefaultServicesMutation.mutate(user.id);
    } else {
      console.log("Condition NOT met. Skipping default service addition.");
    }

    console.log("hasAddedDefaultServicesRef.current (after check):", hasAddedDefaultServicesRef.current);
    console.log("----------------------------------");

  }, [user, isLoading, error, services, addDefaultServicesMutation.isPending, addDefaultServicesMutation]);

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id); // Ensure user can only delete their own services
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
      console.error("Error deleting service:", err); // Log de erro na exclusão
      toast({
        title: "Erro ao remover serviço",
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

  if (isLoading || addDefaultServicesMutation.isPending) return <p>Carregando serviços...</p>;
  if (error) return <p>Erro ao carregar serviços: {error.message}</p>;

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
        <CardHeader>
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
        </CardHeader>
        <CardContent className="space-y-6">
          {services && services.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Serviços Cadastrados</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> {/* Layout em duas colunas */}
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border border-border/50"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{service.name}</p>
                      {service.description && (
                        <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
                      )}
                      <p className="text-sm text-primary font-semibold mt-1">R$ {service.price.toFixed(2)}</p>
                      {service.products && service.products.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {service.products.map(product => (
                            <span key={product.id} className="text-xs px-2 py-0.5 rounded-full bg-muted-foreground/10 text-muted-foreground">
                              {product.name}
                            </span>
                          ))}
                        </div>
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
        </CardContent>
      </Card>

      <ServiceFormDialog
        isOpen={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
        service={editingService}
      />
    </div>
  );
};

export default ServicesPage;