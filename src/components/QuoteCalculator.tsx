import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { Car, Package, DollarSign, FileText, Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery } from "@tanstack/react-query";
import { LoadHourlyCostButton } from './LoadHourlyCostButton';
import { QuoteGenerator } from './QuoteGenerator';
import { calculateProductCost, formatDilutionRatio, ProductForCalculation, formatMinutesToHHMM, parseHHMMToMinutes } from "@/lib/cost-calculations";

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  labor_cost_per_hour: number;
  execution_time_minutes: number;
  user_id: string;
  products?: { id: string; name: string; size: number; price: number; type: 'diluted' | 'ready-to-use'; dilution_ratio: number; usage_per_vehicle: number }[];
}

interface CatalogProduct {
  id: string;
  name: string;
  size: number; // em litros
  price: number; // em R$
  type: 'diluted' | 'ready-to-use';
  dilution_ratio: number;
}

export const QuoteCalculator = () => {
  const { user } = useSession();
  const { toast } = useToast();

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [laborCostPerHour, setLaborCostPerHour] = useState(0);
  const [otherCosts, setOtherCosts] = useState(0);
  const [profitMargin, setProfitMargin] = useState(40);

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
          .select('product_id')
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
          // For now, we don't have usage_per_vehicle stored per service-product link,
          // so we'll need to assume a default or add it to the link table if needed for precise calculation.
          // For simplicity, we'll assume a generic usage for now or rely on service price.
          // If product cost is to be calculated, we need usage_per_vehicle.
          // For this implementation, we'll use the service's defined price and labor cost.
          return { ...service, products: productsData.map(p => ({ ...p, usage_per_vehicle: 0 })) }; // Placeholder usage
        }
        return { ...service, products: [] };
      }));
      return servicesWithProducts;
    },
    enabled: !!user,
  });

  const selectedServices = allServices?.filter(service => selectedServiceIds.includes(service.id)) || [];

  // Calculate total execution time
  const totalExecutionTime = selectedServices.reduce((sum, service) => sum + service.execution_time_minutes, 0);

  // Calculate total products cost (this is a simplified approach, ideally needs product usage per service)
  // For now, we'll assume the service's price already accounts for product cost,
  // or we'd need a more complex structure to define product usage per service.
  // Let's use the sum of service prices as a base for now, and allow 'otherCosts' for additional product costs.
  // If detailed product cost calculation is needed, the `service_product_links` table would need a `quantity` or `usage_ml` column.
  const totalProductsCost = selectedServices.reduce((sum, service) => {
    // This part is tricky. If a service has a fixed price, it might already include product cost.
    // If we want to calculate product cost dynamically, we need `usage_per_vehicle` for each product linked to a service.
    // For now, let's sum the `price` of the service itself as the "product cost" component,
    // and allow `otherCosts` to cover additional product expenses not baked into service price.
    // A more robust solution would involve a `service_product_links` table having a `quantity_used_ml` column.
    // For simplicity, let's assume `otherCosts` covers product costs for now, or the service price is comprehensive.
    // Let's make a simple assumption: the `price` of the service is the revenue, and `labor_cost_per_hour` is the direct labor cost.
    // We need a way to get the *actual* product cost for selected services.
    // Re-evaluating: The `ProductDilution` component on the `Index` page calculates `productsCost`.
    // To replicate this here, we need to know which products are used for which service and their quantities.
    // This data is not directly in the `services` table. It's in `service_product_links` and `product_catalog_items`.

    let serviceProductCost = 0;
    service.products?.forEach(product => {
      // Assuming a default usage for calculation if not specified per service link
      // This is a simplification. A real system would need `usage_per_vehicle` in `service_product_links`
      const assumedUsagePerVehicleMl = 100; // Example: 100ml per service if not specified
      const productForCalc: ProductForCalculation = {
        gallonPrice: product.price,
        gallonVolume: product.size * 1000, // Convert liters to ml
        dilutionRatio: product.dilution_ratio,
        usagePerVehicle: assumedUsagePerVehicleMl, // This needs to be dynamic
        type: product.type,
      };
      serviceProductCost += calculateProductCost(productForCalc);
    });
    return sum + serviceProductCost;
  }, 0);


  // Calculate labor cost
  const laborCost = (totalExecutionTime / 60) * laborCostPerHour;

  // Calculate total cost
  const totalCost = totalProductsCost + laborCost + otherCosts;

  // Calculate final price
  const finalPrice = profitMargin > 0 ? totalCost / (1 - profitMargin / 100) : totalCost;

  const serviceOptions = allServices?.map(s => ({ label: s.name, value: s.id })) || [];

  if (isLoadingServices) {
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
            <Label htmlFor="select-services">Serviços a Orçar *</Label>
            <MultiSelect
              options={serviceOptions}
              selected={selectedServiceIds}
              onSelectChange={setSelectedServiceIds}
              placeholder="Selecione os serviços para o orçamento"
            />
            {selectedServices.length === 0 && (
              <p className="text-sm text-destructive mt-2">Por favor, selecione pelo menos um serviço.</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="labor-cost-per-hour" className="text-sm">Custo da Mão de Obra/Hora (R$)</Label>
              <div className="flex gap-2">
                <Input
                  id="labor-cost-per-hour"
                  type="number"
                  step="0.01"
                  value={laborCostPerHour || ""}
                  onChange={(e) => setLaborCostPerHour(parseFloat(e.target.value) || 0)}
                  className="flex-1 bg-background"
                />
                <LoadHourlyCostButton onLoad={(cost) => setLaborCostPerHour(cost)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="other-costs" className="text-sm">Outros Custos Variáveis (R$)</Label>
              <Input
                id="other-costs"
                type="number"
                step="0.01"
                value={otherCosts || ""}
                onChange={(e) => setOtherCosts(parseFloat(e.target.value) || 0)}
                className="bg-background"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="profit-margin" className="text-sm">Margem de Lucro Desejada (%)</Label>
              <Input
                id="profit-margin"
                type="number"
                step="0.1"
                value={profitMargin}
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
              <span className="font-medium text-foreground">R$ {laborCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Outros Custos:</span>
              <span className="font-medium text-foreground">R$ {otherCosts.toFixed(2)}</span>
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

      {selectedServices.length > 0 && (
        <QuoteGenerator
          selectedServices={selectedServices.map(s => s.name)}
          totalCost={totalCost}
          finalPrice={finalPrice}
          executionTime={totalExecutionTime}
        />
      )}
    </div>
  );
};