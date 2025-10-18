import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { DollarSign, Loader2, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { calculateProductCost, ProductForCalculation } from '@/lib/cost-calculations';
import { Tooltip as ShadcnTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Service {
  id: string;
  name: string;
  price: number;
  labor_cost_per_hour: number;
  execution_time_minutes: number;
  other_costs: number;
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

export const ServiceProfitabilityChart = () => {
  const { user } = useSession();

  // Fetch all services with their linked products
  const { data: services, isLoading: isLoadingServices, error: servicesError } = useQuery<Service[]>({
    queryKey: ['dashboardServicesWithProducts', user?.id],
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
    queryKey: ['dashboardProductsMonthlyCostItem', user?.id],
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

  const chartData = React.useMemo(() => {
    if (!services) return [];

    return services.map(service => {
      const laborCost = (service.execution_time_minutes / 60) * service.labor_cost_per_hour;
      let productsCost = 0;

      if (productCostCalculationMethod === 'per-service') {
        service.products?.forEach(product => {
          const productForCalc: ProductForCalculation = {
            gallonPrice: product.price,
            gallonVolume: product.size * 1000, // Convert liters to ml
            dilutionRatio: product.dilution_ratio,
            usagePerVehicle: product.usage_per_vehicle,
            type: product.type,
            containerSize: product.container_size,
          };
          productsCost += calculateProductCost(productForCalc);
        });
      }
      // If 'monthly-average', product costs are implicitly covered by labor_cost_per_hour
      // so we don't add them separately here to avoid double-counting.

      const totalServiceCost = laborCost + productsCost + service.other_costs;
      const netProfit = service.price - totalServiceCost;
      const profitMargin = service.price > 0 ? (netProfit / service.price) * 100 : 0;

      return {
        name: service.name,
        profit: parseFloat(netProfit.toFixed(2)),
        margin: parseFloat(profitMargin.toFixed(1)),
      };
    }).sort((a, b) => b.profit - a.profit); // Sort by profit descending
  }, [services, productCostCalculationMethod]);

  if (isLoadingServices || isLoadingMonthlyCost) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Lucratividade dos Serviços</CardTitle>
          </div>
          <CardDescription>
            Carregando dados de lucratividade...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (servicesError) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Lucratividade dos Serviços</CardTitle>
          </div>
          <CardDescription className="text-destructive">
            Erro ao carregar dados de serviços: {servicesError.message}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!services || services.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Lucratividade dos Serviços</CardTitle>
          </div>
          <CardDescription>
            Nenhum serviço cadastrado para analisar a lucratividade.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Lucratividade dos Serviços</CardTitle>
          </div>
          <TooltipProvider> {/* Corrigido de ShadcnTooltipProvider */}
            <ShadcnTooltip> {/* Mantido o alias para evitar conflito com o Tooltip do Recharts */}
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-sm font-medium bg-black text-primary px-2 py-1 rounded-md">
                  <Info className="h-4 w-4" />
                  <span>Cálculo: {productCostCalculationMethod === 'per-service' ? 'Detalhado' : 'Simplificado'}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-card text-foreground border border-border/50 p-3 rounded-lg shadow-md max-w-xs">
                <p>
                  O cálculo de lucratividade considera o custo de mão de obra, outros custos por serviço e, se o método for "Detalhado", também os custos dos produtos vinculados.
                  No modo "Simplificado", os custos de produtos são considerados na taxa de mão de obra.
                </p>
              </TooltipContent>
            </ShadcnTooltip>
          </TooltipProvider> {/* Corrigido de ShadcnTooltipProvider */}
        </div>
        <CardDescription>
          Os serviços mais lucrativos do seu negócio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--foreground))" 
                tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
              />
              <YAxis 
                stroke="hsl(var(--foreground))" 
                tickFormatter={(value) => `R$ ${value.toFixed(0)}`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string, props: any) => {
                  if (name === 'profit') {
                    return [`R$ ${value.toFixed(2)}`, 'Lucro Líquido'];
                  }
                  if (name === 'margin') {
                    return [`${value.toFixed(1)}%`, 'Margem de Lucro'];
                  }
                  return value;
                }}
              />
              <Bar dataKey="profit" fill="hsl(var(--primary))" name="Lucro Líquido">
                <LabelList 
                  dataKey="margin" 
                  position="top" 
                  formatter={(value: number) => `${value.toFixed(1)}%`} 
                  fill="hsl(var(--foreground))"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};