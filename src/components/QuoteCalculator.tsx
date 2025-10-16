import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { Car, Package, DollarSign, FileText, Percent, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery } from "@tanstack/react-query";
import { LoadHourlyCostButton } from './LoadHourlyCostButton';
import { QuoteGenerator } from './QuoteGenerator';
import { calculateProductCost, formatDilutionRatio, ProductForCalculation, formatMinutesToHHMM, parseHHMMToMinutes } from "@/lib/cost-calculations";
import { QuoteServiceFormDialog, QuotedService } from './QuoteServiceFormDialog'; // Importar o novo diálogo e interface

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  labor_cost_per_hour: number;
  execution_time_minutes: number;
  other_costs: number;
  user_id: string;
  products?: { 
    id: string; 
    name: string; 
    size: number; 
    price: number; 
    type: 'diluted' | 'ready-to-use'; 
    dilution_ratio: number; 
    usage_per_vehicle: number;
    container_size: number;
  }[];
}

interface OperationalCost {
  id: string;
  description: string;
  value: number;
  type: 'fixed' | 'variable';
  user_id: string;
  created_at: string;
}

export const QuoteCalculator = () => {
  const { user } = useSession();
  const { toast } = useToast();

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [quotedServices, setQuotedServices] = useState<QuotedService[]>([]); // Estado para serviços com overrides
  const [otherCostsGlobal, setOtherCostsGlobal] = useState(0); // Outros custos globais, se houver
  const [profitMargin, setProfitMargin] = useState(40);

  const [isServiceFormDialogOpen, setIsServiceFormDialogOpen] = useState(false);
  const [serviceToEditInDialog, setServiceToEditInDialog] = useState<QuotedService | null>(null);

  // Fetch all services with their linked products
  const { data: allServices, isLoading: isLoadingServices } = useQuery<Service[]>({
    queryKey: ['allServicesWithProducts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('user_id', user.id);
      if (servicesError) throw servicesError;

      const servicesWithProducts = await Promise.all(servicesData.map(async (service) => {
        const { data: linksData, error: linksError } = await supabase
          .from('service_product_links')
          .select('product_id, usage_per_vehicle, dilution_ratio, container_size')
          .eq('service_id', service.id);
        if (linksError) {
          console.error(`Error fetching product links for service ${service.id}:`, linksError);
          return { ...service, products: [] };
        }

        const productIds = linksData.map(link => link.product_id);

        if (productIds.length > 0) {
          const { data: productsData, error: productsError } = await supabase
            .from('product_catalog_items')
            .select('id, name, size, price, type, dilution_ratio')
            .in('id', productIds);
          if (productsError) {
            console.error(`Error fetching products for service ${service.id}:`, productsError);
            return { ...service, products: [] };
          }
          const productsWithUsageAndDilution = productsData.map(product => {
            const link = linksData.find(link => link.product_id === product.id);
            return { 
              ...product, 
              usage_per_vehicle: link?.usage_per_vehicle || 0,
              dilution_ratio: link?.dilution_ratio || 0,
              container_size: link?.container_size || 0,
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

  // Fetch products monthly cost item to determine calculation method
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

  // Efeito para sincronizar selectedServiceIds com quotedServices
  useEffect(() => {
    if (!allServices) return;

    const newQuotedServices: QuotedService[] = [];
    const currentQuotedServiceIds = new Set(quotedServices.map(s => s.id));

    selectedServiceIds.forEach(id => {
      const existingQuotedService = quotedServices.find(qs => qs.id === id);
      if (existingQuotedService) {
        newQuotedServices.push(existingQuotedService);
      } else {
        const serviceFromAll = allServices.find(s => s.id === id);
        if (serviceFromAll) {
          newQuotedServices.push({ ...serviceFromAll }); // Adiciona uma cópia para permitir overrides
        }
      }
    });

    setQuotedServices(newQuotedServices);
  }, [selectedServiceIds, allServices]); // eslint-disable-line react-hooks/exhaustive-deps

  // Função para abrir o diálogo de edição de serviço
  const handleEditServiceForQuote = (service: QuotedService) => {
    setServiceToEditInDialog(service);
    setIsServiceFormDialogOpen(true);
  };

  // Função para salvar as alterações de um serviço no orçamento
  const handleSaveQuotedService = (updatedService: QuotedService) => {
    setQuotedServices(prev => 
      prev.map(s => (s.id === updatedService.id ? updatedService : s))
    );
    toast({
      title: "Serviço atualizado para o orçamento!",
      description: `${updatedService.name} foi configurado para este orçamento.`,
    });
  };

  // Calculate total execution time
  const totalExecutionTime = quotedServices.reduce((sum, service) => 
    sum + (service.quote_execution_time_minutes ?? service.execution_time_minutes), 0);

  // Calculate total products cost
  const totalProductsCost = quotedServices.reduce((sum, service) => {
    let serviceProductCost = 0;
    if (productCostCalculationMethod === 'per-service') {
      const productsToUse = service.quote_products ?? service.products;
      productsToUse?.forEach(product => {
        const productForCalc: ProductForCalculation = {
          gallonPrice: product.price,
          gallonVolume: product.size * 1000, // Convert liters to ml
          dilutionRatio: product.dilution_ratio,
          usagePerVehicle: product.usage_per_vehicle,
          type: product.type,
        };
        serviceProductCost += calculateProductCost(productForCalc);
      });
    }
    return sum + serviceProductCost;
  }, 0);

  // Calculate total labor cost across all selected services
  const totalLaborCost = quotedServices.reduce((sum, service) => {
    const laborCostPerHour = service.quote_labor_cost_per_hour ?? service.labor_cost_per_hour;
    const executionTimeMinutes = service.quote_execution_time_minutes ?? service.execution_time_minutes;
    return sum + (executionTimeMinutes / 60) * laborCostPerHour;
  }, 0);

  // Calculate total other costs across all selected services
  const totalOtherCosts = quotedServices.reduce((sum, service) => 
    sum + (service.quote_other_costs ?? service.other_costs), 0);

  // Calculate total cost
  const totalCost = totalProductsCost + totalLaborCost + totalOtherCosts + otherCostsGlobal;

  // Calculate final price
  const finalPrice = profitMargin > 0 ? totalCost / (1 - profitMargin / 100) : totalCost;

  const serviceOptions = allServices?.map(s => ({ label: s.name, value: s.id })) || [];

  if (isLoadingServices || isLoadingMonthlyCost) {
    return <p className="text-center py-8">Carregando serviços...</p>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)] mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-foreground">Gerar Orçamento Detalhado</CardTitle>
              <CardDescription>
                Selecione os serviços, ajuste os custos e gere um orçamento profissional.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="select-services">Adicionar Serviços *</Label> {/* Nome alterado aqui */}
            <MultiSelect
              options={serviceOptions}
              selected={selectedServiceIds}
              onSelectChange={setSelectedServiceIds}
              placeholder="Selecione os serviços para o orçamento"
            />
            {selectedServiceIds.length === 0 && (
              <p className="text-sm text-destructive mt-2">Por favor, selecione pelo menos um serviço.</p>
            )}
          </div>

          {quotedServices.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-border/50">
              <h3 className="text-sm font-medium text-foreground">Serviços Selecionados para Orçamento</h3>
              <div className="grid grid-cols-1 gap-3">
                {quotedServices.map(service => (
                  <div key={service.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{service.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Valor: R$ {(service.quote_price ?? service.price).toFixed(2)} | Tempo: {formatMinutesToHHMM(service.quote_execution_time_minutes ?? service.execution_time_minutes)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditServiceForQuote(service)}
                      className="text-primary hover:bg-primary/10"
                      title={`Editar ${service.name} para este orçamento`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Custo da Mão de Obra/Hora removido daqui */}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="other-costs-global" className="text-sm">Outros Custos Globais (R$)</Label>
              <Input
                id="other-costs-global"
                type="number"
                step="0.01"
                value={otherCostsGlobal.toFixed(2) || ""}
                onChange={(e) => setOtherCostsGlobal(parseFloat(e.target.value) || 0)}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">Custos adicionais que se aplicam a todo o orçamento, não a um serviço específico.</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="profit-margin" className="text-sm">Margem de Lucro Desejada (%)</Label>
              <Input
                id="profit-margin"
                type="number"
                step="0.1"
                value={profitMargin.toFixed(2) || ""}
                onChange={(e) => setProfitMargin(parseFloat(e.target.value) || 0)}
                className="bg-background text-lg font-semibold"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border/50 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Tempo Total de Execução:</span>
              <span className="font-medium text-foreground">{formatMinutesToHHMM(totalExecutionTime)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Custo de Produtos (estimado):</span>
              <span className="font-medium text-foreground">R$ {totalProductsCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Custo de Mão de Obra:</span>
              <span className="font-medium text-foreground">R$ {totalLaborCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Outros Custos por Serviço:</span>
              <span className="font-medium text-foreground">R$ {totalOtherCosts.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Outros Custos Globais:</span>
              <span className="font-medium text-foreground">R$ {otherCostsGlobal.toFixed(2)}</span>
            </div>
            <div className="p-4 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg border border-primary/30 mt-4">
              <div className="flex justify-between items-center">
                <span className="font-medium text-foreground">Custo Total da Operação:</span>
                <span className="text-2xl font-bold text-primary">R$ {totalCost.toFixed(2)}</span>
              </div>
            </div>
            <div className="p-4 bg-gradient-to-r from-accent/20 to-accent/10 rounded-lg border border-accent/30 mt-2">
              <div className="flex justify-between items-center">
                <span className="font-medium text-foreground">Preço Sugerido ao Cliente:</span>
                <span className="text-3xl font-bold text-accent">R$ {finalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {quotedServices.length > 0 && (
        <QuoteGenerator
          selectedServices={quotedServices.map(s => s.name)} // Passando apenas os nomes para o gerador de PDF
          totalCost={totalCost}
          finalPrice={finalPrice}
          executionTime={totalExecutionTime}
        />
      )}

      {serviceToEditInDialog && (
        <QuoteServiceFormDialog
          isOpen={isServiceFormDialogOpen}
          onClose={() => setIsServiceFormDialogOpen(false)}
          service={serviceToEditInDialog}
          onSave={handleSaveQuotedService}
          productCostCalculationMethod={productCostCalculationMethod}
        />
      )}
    </div>
  );
};