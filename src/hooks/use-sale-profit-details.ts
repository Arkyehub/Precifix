import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { calculateProductCost, ProductForCalculation } from '@/lib/cost-calculations';
import { PaymentMethod } from '@/components/PaymentMethodFormDialog'; // Importar PaymentMethod

interface Sale {
  id: string;
  sale_number: string | null;
  client_name: string;
  vehicle: string; // Adicionado
  total_price: number;
  created_at: string;
  services_summary: { 
    id: string; // Este é o ID do serviço original do catálogo
    name: string; 
    price: number; 
    execution_time_minutes: number; 
  }[];
  status: 'pending' | 'accepted' | 'rejected' | 'closed' | 'awaiting_payment';
  service_date: string | null;
  service_time: string | null;
  notes: string | null;
  client_id: string | null; // Adicionado
  vehicle_id: string | null; // Adicionado
  commission_value: number | null; // NOVO
  commission_type: 'amount' | 'percentage' | null; // NOVO
  payment_method_id: string | null; // NOVO
  installments: number | null; // NOVO
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
  calculatedCommission: number; // NOVO
  totalCost: number;
  netProfit: number;
  profitMarginPercentage: number;
  totalExecutionTime: number;
  paymentFee: number; // NOVO
}

export const useSaleProfitDetails = (saleId: string | null) => {
  const { user } = useSession();

  // 1. Fetch all necessary data for calculation
  const { data: calculationData, isLoading: isLoadingDetails, error: queryError } = useQuery({
    queryKey: ['saleProfitDetails', saleId, user?.id],
    queryFn: async () => {
      if (!saleId || !user) return null;

      // Fetch the sale details (we need the full quote record for service details)
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('services_summary, total_price, client_id, vehicle_id, notes, service_date, service_time, id, sale_number, client_name, created_at, status, vehicle, commission_value, commission_type, payment_method_id, installments') // Incluindo comissão e pagamento
        .eq('id', saleId)
        .single();
      
      if (quoteError) {
        console.error("Error fetching quote data:", quoteError);
        // Se o orçamento não for encontrado, retornamos null para que o componente pai exiba o erro.
        if ((quoteError as any).code === 'PGRST116') return null; 
        throw new Error("Falha ao buscar dados do orçamento.");
      }

      const servicesSummary = quoteData.services_summary as { id: string }[];
      // Usamos os IDs do serviço original para buscar os detalhes de custo
      const serviceIds = servicesSummary.map(s => s.id).filter(Boolean);
      
      let serviceDetails: ServiceDetails[] = [];
      let productLinks: ServiceProductLink[] = [];
      let catalogProducts: CatalogProduct[] = [];
      let paymentMethod: PaymentMethod | undefined = undefined; // Alterado para buscar um único objeto

      if (serviceIds.length > 0) {
        // Fetch full service details (labor cost, other costs)
        const { data: detailsData, error: serviceDetailsError } = await supabase
          .from('services')
          .select('id, labor_cost_per_hour, other_costs')
          .in('id', serviceIds)
        // Não lançamos erro se a busca de detalhes falhar, apenas logamos e usamos o que temos.
        if (serviceDetailsError) {
          console.warn("Warning: Error fetching service details (original services might be deleted):", serviceDetailsError);
        } else {
          serviceDetails = detailsData as ServiceDetails[];
        }

        // Fetch product links
        const { data: linksData, error: linksError } = await supabase
          .from('service_product_links')
          .select('service_id, product_id, usage_per_vehicle, dilution_ratio, container_size')
          .in('service_id', serviceIds);
        if (linksError) throw linksError;
        productLinks = linksData;

        // Fetch catalog products
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

      // Fetch payment method with installments (if payment method is set)
      if (quoteData.payment_method_id) {
        const { data: methodsData, error: methodsError } = await supabase
          .from('payment_methods')
          .select('*, installments:payment_method_installments(*)')
          .eq('user_id', user.id)
          .eq('id', quoteData.payment_method_id)
          .single(); // Usar single() para buscar um único objeto
        if (methodsError && (methodsError as any).code !== 'PGRST116') throw methodsError;
        paymentMethod = methodsData as PaymentMethod;
      }

      // Fetch global operational costs (to check for 'Produtos Gastos no Mês')
      const { data: operationalCosts, error: costsError } = await supabase
        .from('operational_costs')
        .select('id, description, value, type')
        .eq('user_id', user.id);
      if (costsError) throw costsError;

      const productsMonthlyCostItem = operationalCosts.find(c => c.description === 'Produtos Gastos no Mês');
      const productCostCalculationMethod = productsMonthlyCostItem ? 'monthly-average' : 'per-service';

      return {
        quoteData: {
          ...quoteData,
          client_id: quoteData.client_id,
          vehicle_id: quoteData.vehicle_id,
          commission_value: quoteData.commission_value, // NOVO
          commission_type: quoteData.commission_type, // NOVO
          payment_method_id: quoteData.payment_method_id, // NOVO
          installments: quoteData.installments, // NOVO
        } as Sale,
        serviceDetails,
        productLinks,
        catalogProducts,
        operationalCosts,
        productCostCalculationMethod,
        paymentMethod, // Alterado para um único objeto
      };
    },
    enabled: !!saleId && !!user,
  });

  // 2. Calculate profitability
  const profitDetails = React.useMemo<SaleProfitDetails | null>(() => {
    if (!calculationData || !calculationData.quoteData) return null;

    const { quoteData, serviceDetails, productLinks, catalogProducts, operationalCosts, productCostCalculationMethod, paymentMethod } = calculationData;
    
    let totalProductsCost = 0;
    let totalLaborCost = 0;
    let totalOtherCosts = 0;
    let totalExecutionTime = 0;
    const totalServiceValue = quoteData.total_price;

    const servicesSummary = quoteData.services_summary as { id: string; price: number; execution_time_minutes: number }[];

    // Map service details for quick lookup
    const serviceDetailsMap = new Map(serviceDetails.map(d => [d.id, d]));

    servicesSummary.forEach(summary => {
      // Usamos o ID do serviço original (summary.id) para buscar os detalhes
      const details = serviceDetailsMap.get(summary.id);
      
      // Se o serviço original foi encontrado, usamos seus custos de mão de obra e outros custos.
      // Caso contrário, usamos 0 para evitar que o cálculo falhe.
      const laborCostPerHour = details?.labor_cost_per_hour || 0;
      const otherCosts = details?.other_costs || 0;
      
      // Usamos o tempo de execução salvo no summary, pois ele é o valor real do orçamento.
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
    
    // E. Comissão (Calculada sobre o total_price)
    let calculatedCommission = 0;
    const commissionValue = quoteData.commission_value || 0;
    const commissionType = quoteData.commission_type || 'amount';

    if (commissionValue > 0) {
      if (commissionType === 'percentage') {
        calculatedCommission = totalServiceValue * (commissionValue / 100);
      } else {
        calculatedCommission = commissionValue;
      }
    }

    // F. Taxa de Pagamento
    let paymentFee = 0;
    
    if (paymentMethod) {
      if (paymentMethod.type === 'debit_card') {
        paymentFee = totalServiceValue * (paymentMethod.rate / 100);
      } else if (paymentMethod.type === 'credit_card') {
        const rateToApply = quoteData.installments 
          ? paymentMethod.installments?.find(inst => inst.installments === quoteData.installments)?.rate || 0
          : paymentMethod.installments?.find(inst => inst.installments === 1)?.rate || 0;
        paymentFee = totalServiceValue * (rateToApply / 100);
      }
    }

    // Custo Total da Operação (incluindo a comissão e taxa de pagamento como custo)
    const totalCost = totalProductsCost + totalLaborCost + totalOtherCosts + calculatedCommission + paymentFee;
    
    // Lucro Líquido (Valor Total - Custo Total)
    const netProfit = totalServiceValue - totalCost;
    const profitMarginPercentage = totalServiceValue > 0 ? (netProfit / totalServiceValue) * 100 : 0;

    return {
      totalProductsCost,
      totalLaborCost,
      totalOtherCosts,
      calculatedCommission,
      totalCost,
      netProfit,
      profitMarginPercentage,
      totalExecutionTime,
      paymentFee, // NOVO
    };
  }, [calculationData]);

  return {
    saleDetails: calculationData?.quoteData as Sale | undefined,
    profitDetails,
    isLoadingDetails,
    queryError, // Retornar o erro da query para debug
    paymentMethodDetails: calculationData?.paymentMethod, // Retornar o objeto único
  };
};