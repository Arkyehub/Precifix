import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery } from "@tanstack/react-query";
import { calculateProductCost, formatMinutesToHHMM, parseHHMMToMinutes } from "@/lib/cost-calculations";
import { QuoteGenerator } from './QuoteGenerator';
import { QuoteServiceFormDialog, QuotedService } from './QuoteServiceFormDialog';
import { PaymentMethod } from './PaymentMethodFormDialog';
import { QuoteServiceSelection } from '@/components/quote/QuoteServiceSelection';
import { QuoteSelectedServicesList } from '@/components/quote/QuoteSelectedServicesList';
import { QuoteGlobalCostsInput } from '@/components/quote/QuoteGlobalCostsInput';
import { QuoteDiscountSection } from '@/components/quote/QuoteDiscountSection';
import { QuotePaymentMethodSection } from '@/components/quote/QuotePaymentMethodSection';
import { QuoteCalculationSummary } from '@/components/quote/QuoteCalculationSummary';

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
  const [quotedServices, setQuotedServices] = useState<QuotedService[]>([]);
  const [otherCostsGlobal, setOtherCostsGlobal] = useState(0);
  const [profitMargin, setProfitMargin] = useState(40); // Esta será a margem de lucro DESEJADA
  const [displayProfitMargin, setDisplayProfitMargin] = useState('40,00');

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [selectedInstallments, setSelectedInstallments] = useState<number | null>(null);
  const [paymentFee, setPaymentFee] = useState(0);

  // Estados para o desconto
  const [discountValueInput, setDiscountValueInput] = useState('0,00'); // Valor digitado no input
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount'); // Tipo de desconto
  const [calculatedDiscount, setCalculatedDiscount] = useState(0); // Valor do desconto em R$

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

  // Fetch payment methods
  const { data: paymentMethods, isLoading: isLoadingPaymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ['paymentMethodsForQuote', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: methodsData, error: methodsError } = await supabase
        .from('payment_methods')
        .select('*, installments:payment_method_installments(*)') // Fetch related installments
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (methodsError) throw methodsError;
      return methodsData;
    },
    enabled: !!user,
  });

  // Efeito para sincronizar selectedServiceIds com quotedServices
  useEffect(() => {
    if (!allServices) return;

    const newQuotedServices: QuotedService[] = [];
    // Usar um Set para rastrear IDs de serviços já adicionados, evitando duplicatas
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

    // Remover serviços que foram desmarcados
    const filteredQuotedServices = newQuotedServices.filter(qs => selectedServiceIds.includes(qs.id));

    setQuotedServices(filteredQuotedServices);
  }, [selectedServiceIds, allServices]); // eslint-disable-line react-hooks/exhaustive-deps

  // Efeito para manter displayProfitMargin sincronizado com profitMargin
  useEffect(() => {
    setDisplayProfitMargin(profitMargin.toFixed(2).replace('.', ','));
  }, [profitMargin]);

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
        const productForCalc = {
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

  // Calculate total cost (soma de todos os custos operacionais e de produtos)
  const totalCost = totalProductsCost + totalLaborCost + totalOtherCosts + otherCostsGlobal;

  // Calcular o Valor do Serviço (soma dos preços de venda dos serviços)
  const totalServiceValue = quotedServices.reduce((sum, service) => 
    sum + (service.quote_price ?? service.price), 0);

  // Efeito para calcular o desconto
  useEffect(() => {
    const parsedDiscountValue = parseFloat(discountValueInput.replace(',', '.')) || 0;
    let newCalculatedDiscount = 0;

    if (discountType === 'amount') {
      newCalculatedDiscount = parsedDiscountValue;
    } else { // percentage
      newCalculatedDiscount = totalServiceValue * (parsedDiscountValue / 100);
    }
    // Garantir que o desconto não seja maior que o valor total
    setCalculatedDiscount(Math.min(newCalculatedDiscount, totalServiceValue));
  }, [discountValueInput, discountType, totalServiceValue]);

  // Valor após o desconto ser aplicado
  const valueAfterDiscount = totalServiceValue - calculatedDiscount;

  // Effect to calculate payment fee
  useEffect(() => {
    if (!selectedPaymentMethodId || !paymentMethods || valueAfterDiscount <= 0) {
      setPaymentFee(0);
      return;
    }

    const method = paymentMethods.find(pm => pm.id === selectedPaymentMethodId);
    if (!method) {
      setPaymentFee(0);
      return;
    }

    let calculatedFee = 0;
    if (method.type === 'cash' || method.type === 'pix') {
      calculatedFee = 0;
    } else if (method.type === 'debit_card') {
      calculatedFee = valueAfterDiscount * (method.rate / 100);
    } else if (method.type === 'credit_card') {
      const rateToApply = selectedInstallments 
        ? method.installments?.find(inst => inst.installments === selectedInstallments)?.rate || 0
        : method.installments?.find(inst => inst.installments === 1)?.rate || 0; // Default to 1x if no installments selected
      calculatedFee = valueAfterDiscount * (rateToApply / 100);
    }
    setPaymentFee(calculatedFee);
  }, [valueAfterDiscount, selectedPaymentMethodId, selectedInstallments, paymentMethods]);

  // Preço Final com Taxa (Valor a Receber) - AGORA SUBTRAI A TAXA
  const finalPriceWithFee = valueAfterDiscount - paymentFee; // Este é o Valor a Receber (receita)

  // Calcular o Lucro Líquido
  const netProfit = finalPriceWithFee - totalCost;

  // Calcular a Margem de Lucro Real (baseada no Lucro Líquido e no Valor a Receber (final))
  const currentProfitMarginPercentage = finalPriceWithFee > 0 ? (netProfit / finalPriceWithFee) * 100 : 0;

  // Calcular o Preço Sugerido com base na Margem de Lucro Desejada
  const suggestedPriceBasedOnDesiredMargin = profitMargin > 0 ? totalCost / (1 - profitMargin / 100) : totalCost;

  const serviceOptions = allServices?.map(s => ({ label: s.name, value: s.id })) || [];

  const currentPaymentMethod = paymentMethods?.find(pm => pm.id === selectedPaymentMethodId);

  if (isLoadingServices || isLoadingMonthlyCost || isLoadingPaymentMethods) {
    return <p className="text-center py-8">Carregando dados...</p>;
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
          <QuoteServiceSelection
            serviceOptions={serviceOptions}
            selectedServiceIds={selectedServiceIds}
            onSelectChange={setSelectedServiceIds}
          />

          <QuoteSelectedServicesList
            quotedServices={quotedServices}
            onEditServiceForQuote={handleEditServiceForQuote}
          />

          <QuoteGlobalCostsInput
            otherCostsGlobal={otherCostsGlobal}
            onOtherCostsGlobalChange={setOtherCostsGlobal}
          />

          <QuoteDiscountSection
            discountValueInput={discountValueInput}
            onDiscountValueInputChange={setDiscountValueInput}
            onDiscountValueInputBlur={(value) => {
              const rawValue = value.replace(',', '.');
              const parsedValue = parseFloat(rawValue) || 0;
              setDiscountValueInput(parsedValue.toFixed(2).replace('.', ','));
            }}
            discountType={discountType}
            onDiscountTypeChange={setDiscountType}
            calculatedDiscount={calculatedDiscount}
          />

          <QuotePaymentMethodSection
            paymentMethods={paymentMethods}
            isLoadingPaymentMethods={isLoadingPaymentMethods}
            selectedPaymentMethodId={selectedPaymentMethodId}
            onPaymentMethodSelectChange={(value) => {
              setSelectedPaymentMethodId(value);
              const method = paymentMethods?.find(pm => pm.id === value);
              if (method?.type === 'credit_card' && method.installments && method.installments.length > 0) {
                const firstValidInstallment = method.installments.find(inst => inst.rate > 0);
                setSelectedInstallments(firstValidInstallment ? firstValidInstallment.installments : 1);
              } else {
                setSelectedInstallments(null);
              }
            }}
            selectedInstallments={selectedInstallments}
            onInstallmentsSelectChange={(value) => setSelectedInstallments(parseInt(value, 10))}
            currentPaymentMethod={currentPaymentMethod}
          />

          <QuoteCalculationSummary
            totalExecutionTime={totalExecutionTime}
            totalProductsCost={totalProductsCost}
            totalLaborCost={totalLaborCost}
            totalOtherCosts={totalOtherCosts}
            otherCostsGlobal={otherCostsGlobal}
            totalCost={totalCost}
            totalServiceValue={totalServiceValue}
            currentProfitMarginPercentage={currentProfitMarginPercentage}
            profitMargin={profitMargin}
            displayProfitMargin={displayProfitMargin}
            onProfitMarginChange={setProfitMargin}
            onDisplayProfitMarginChange={setDisplayProfitMargin}
            suggestedPriceBasedOnDesiredMargin={suggestedPriceBasedOnDesiredMargin}
            selectedPaymentMethodId={selectedPaymentMethodId}
            paymentFee={paymentFee}
            finalPriceWithFee={finalPriceWithFee} // Passando a receita final
            valueAfterDiscount={valueAfterDiscount}
            netProfit={netProfit} // Passando o lucro líquido
          />
        </CardContent>
      </Card>

      {quotedServices.length > 0 && (
        <QuoteGenerator
          selectedServices={quotedServices} // Corrigido para passar o array de objetos QuotedService
          totalCost={totalCost}
          finalPrice={finalPriceWithFee} // O gerador de PDF usa o valor da receita final
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