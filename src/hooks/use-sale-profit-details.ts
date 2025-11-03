import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { calculateProductCost, ProductForCalculation } from '@/lib/cost-calculations';

interface Sale {
  id: string;
  sale_number: string | null;
  client_name: string;
  total_price: number;
  created_at: string;
  services_summary: { 
    id: string; 
    name: string; 
    price: number; 
    execution_time_minutes: number; 
  }[];
  status: 'pending' | 'accepted' | 'rejected' | 'closed' | 'awaiting_payment';
  service_date: string | null;
  service_time: string | null;
  notes: string | null;
  client_id: string | null; // Added to match query
  vehicle_id: string | null; // Added to match query
}

interface OperationalCost {
  id: string;
  description: string;
  value: number;
  type: 'fixed' | 'variable';
}

interface ServiceProductLink {
  service_id: string;
  product_id: string;
  usage_per_vehicle: number;
  dilution_ratio: number;
  container_size: number;
}

interface CatalogProduct {
  id: string;
  name: string;
  size: number; // em litros
  price: number; // em R$
  type: 'diluted' | 'ready-to-use';
  dilution_ratio: number;
}

interface ServiceDetails {
  id: string;
  labor_cost_per_hour: number;
  other_costs: number;
}

export interface SaleProfitDetails {
  totalProductsCost: number;
  totalLaborCost: number;
  totalOtherCosts: number;
  totalCost: number;
  netProfit: number;
  profitMarginPercentage: number;
  totalExecutionTime: number;
}

export const useSaleProfitDetails = (saleId: string | null) => {
  const { user } = useSession();

  // 1. Fetch all necessary data for calculation
  const { data: calculationData, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['saleProfitDetails', saleId, user?.id],
    queryFn: async () => {
      if (!saleId || !user) return null;

      // Fetch the sale details (we need the full quote record for service details)
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('services_summary, total_price, client_id, vehicle_id, notes, service_date, service_time, id, sale_number, client_name, created_at, status') // Adicionado campos necessários para o Drawer
        .eq('id', saleId)
        .single();
      if (quoteError) throw quoteError;

      const serviceIds = (quoteData.services_summary as any[]).map(s => s.id).filter(Boolean);

      // Fetch full service details (labor cost, other costs)
      const { data: serviceDetails, error: serviceDetailsError } = await supabase
        .from('services')
        .select('id, labor_cost_per_hour, other_costs')
        .in('id', serviceIds)
        .eq('user_id', user.id);
      if (serviceDetailsError) throw serviceDetailsError;

      // Fetch global operational costs (to check for 'Produtos Gastos no Mês')
      const { data: operationalCosts, error: costsError } = await supabase
        .from('operational_costs')
        .select('id, description, value, type')
        .eq('user_id', user.id);
      if (costsError) throw costsError;

      const productsMonthlyCostItem = operationalCosts.find(c => c.description === 'Produtos Gastos no Mês');
      const productCostCalculationMethod = productsMonthlyCostItem ? 'monthly-average' : 'per-service';

      let productLinks: ServiceProductLink[] = [];
      let catalogProducts: CatalogProduct[] = [];

      if (productCostCalculationMethod === 'per-service') {
        // Fetch product links and catalog items only if needed
        const { data: linksData, error: linksError } = await supabase
          .from('service_product_links')
          .select('service_id, product_id, usage_per_vehicle, dilution_ratio, container_size')
          .in('service_id', serviceIds);
        if (linksError) throw linksError;
        productLinks = linksData;

        const productIds = Array.from(new Set(linksData.map(l => l.product_id)));
        if (productIds.length > 0) {
          const { data: productsData, error: productsError } = await supabase
            .from('product_catalog_items')
            .select('id, name, size, price, type, dilution_ratio')
            .in('id', productIds);
          if (productsError) throw productsError;
          catalogProducts = productsData;
        }
      }

      return {
        quoteData: {
          ...quoteData,
          client_id: quoteData.client_id,
          vehicle_id: quoteData.vehicle_id,
        } as Sale, // Explicitly cast to Sale after ensuring all fields are present
        serviceDetails: serviceDetails as ServiceDetails[],
        productLinks,
        catalogProducts,
        operationalCosts,
        productCostCalculationMethod,
      };
    },
    enabled: !!saleId && !!user,
  });

  // 2. Calculate profitability
  const profitDetails = React.useMemo<SaleProfitDetails | null>(() => {
    if (!calculationData) return null;

    const { quoteData, serviceDetails, productLinks, catalogProducts, operationalCosts, productCostCalculationMethod } = calculationData;
    
    let totalProductsCost = 0;
    let totalLaborCost = 0;
    let totalOtherCosts = 0;
    let totalExecutionTime = 0;
    const totalServiceValue = quoteData.total_price;

    const servicesSummary = quoteData.services_summary as { id: string; price: number; execution_time_minutes: number }[];

    // Map service details for quick lookup
    const serviceDetailsMap = new Map(serviceDetails.map(d => [d.id, d]));

    servicesSummary.forEach(summary => {
      const details = serviceDetailsMap.get(summary.id);
      
      // Use values from the service catalog if available, otherwise default to 0
      const laborCostPerHour = details?.labor_cost_per_hour || 0;
      const otherCosts = details?.other_costs || 0;
      const executionTimeMinutes = summary.execution_time_minutes;

      // A. Labor Cost
      totalLaborCost += (executionTimeMinutes / 60) * laborCostPerHour;
      totalExecutionTime += executionTimeMinutes;

      // B. Other Costs (per service)
      totalOtherCosts += otherCosts;

      // C. Product Costs (only if per-service method is active)
      if (productCostCalculationMethod === 'per-service') {
        const links = productLinks.filter(l => l.service_id === summary.id);
        links.forEach(link => {
          const product = catalogProducts.find(p => p.id === link.product_id);
          if (product) {
            const productForCalc: ProductForCalculation = {
              gallonPrice: product.price,
              gallonVolume: product.size * 1000,
              dilutionRatio: link.dilution_ratio,
              usagePerVehicle: link.usage_per_vehicle,
              type: product.type,
              containerSize: link.container_size,
            };
            totalProductsCost += calculateProductCost(productForCalc);
          }
        });
      }
    });

    // D. Global Operational Costs (Fixed + Variable, excluding 'Produtos Gastos no Mês')
    // NOTA: Não estamos incluindo custos globais aqui, pois eles já estão embutidos no labor_cost_per_hour.
    // Se o usuário quiser incluir custos globais adicionais, eles devem ser adicionados como 'otherCostsGlobal' no QuoteCalculator.
    // Para esta análise de venda, vamos considerar apenas os custos diretos (Produtos, Mão de Obra, Outros Custos por Serviço).
    
    const totalCost = totalProductsCost + totalLaborCost + totalOtherCosts;
    const netProfit = totalServiceValue - totalCost;
    const profitMarginPercentage = totalServiceValue > 0 ? (netProfit / totalServiceValue) * 100 : 0;

    return {
      totalProductsCost,
      totalLaborCost,
      totalOtherCosts,
      totalCost,
      netProfit,
      profitMarginPercentage,
      totalExecutionTime,
    };
  }, [calculationData]);

  return {
    saleDetails: calculationData?.quoteData as Sale | undefined,
    profitDetails,
    isLoadingDetails,
  };
};