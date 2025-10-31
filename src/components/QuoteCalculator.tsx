import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery } from "@tanstack/react-query";
import { calculateProductCost } from "@/lib/cost-calculations";
import { QuoteGenerator } from './QuoteGenerator';
import { QuoteServiceFormDialog, QuotedService } from './QuoteServiceFormDialog';
import { PaymentMethod } from './PaymentMethodFormDialog';
import { QuoteServiceSelection } from '@/components/quote/QuoteServiceSelection';
import { QuoteSelectedServicesList } from '@/components/quote/QuoteSelectedServicesList';
import { QuoteGlobalCostsInput } from '@/components/quote/QuoteGlobalCostsInput';
import { QuoteDiscountSection } from '@/components/quote/QuoteDiscountSection';
import { QuotePaymentMethodSection } from '@/components/quote/QuotePaymentMethodSection';
import { QuoteCalculationSummary } from '@/components/quote/QuoteCalculationSummary';
import { Client } from '@/types/clients'; // Importar Client
import { useSearchParams } from 'react-router-dom'; // Importar useSearchParams

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

// Interface para o resultado da contagem de orçamentos
interface ServiceQuoteCount {
  service_id: string;
  count: number;
}

interface QuoteDataForEdit {
  id: string;
  client_id: string | null;
  client_name: string;
  vehicle_id: string | null;
  total_price: number;
  services_summary: QuotedService[];
  notes: string | null;
  service_date: string | null;
  service_time: string | null;
}

export const QuoteCalculator = () => {
  const { user } = useSession();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const quoteIdToEdit = searchParams.get('quoteId');

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [quotedServices, setQuotedServices] = useState<QuotedService[]>([]);
  const [otherCostsGlobal, setOtherCostsGlobal] = useState(0);
  const [profitMargin, setProfitMargin] = useState(40);
  const [displayProfitMargin, setDisplayProfitMargin] = useState('40,00');

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [selectedInstallments, setSelectedInstallments] = useState<number | null>(null);
  const [paymentFee, setPaymentFee] = useState(0);

  const [discountValueInput, setDiscountValueInput] = useState('0,00');
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [calculatedDiscount, setCalculatedDiscount] = useState(0);

  const [isServiceFormDialogOpen, setIsServiceFormDialogOpen] = useState(false);
  const [serviceToEditInDialog, setServiceToEditInDialog] = useState<QuotedService | null>(null);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | undefined>(undefined);
  
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Novos estados para agendamento
  const [serviceDate, setServiceDate] = useState('');
  const [isTimeDefined, setIsTimeDefined] = useState(false);
  const [serviceTime, setServiceTime] = useState('');
  const [observations, setObservations] = useState(''); // Adicionado estado de observações

  // Query para buscar o orçamento para edição
  const { data: quoteToEdit, isLoading: isLoadingQuoteToEdit } = useQuery<QuoteDataForEdit | null>({
    queryKey: ['quoteToEdit', quoteIdToEdit],
    queryFn: async () => {
      if (!quoteIdToEdit || !user) return null;
      const { data, error } = await supabase
        .from('quotes')
        .select('id, client_id, client_name, vehicle_id, total_price, services_summary, notes, service_date, service_time')
        .eq('id', quoteIdToEdit)
        .eq('user_id', user.id)
        .single();
      if (error) {
        if ((error as any).code !== 'PGRST116') console.error("Error fetching quote for edit:", error);
        return null;
      }
      return data as QuoteDataForEdit;
    },
    enabled: !!quoteIdToEdit && !!user,
  });

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

  // Efeito para preencher o formulário quando o orçamento para edição é carregado
  useEffect(() => {
    if (quoteToEdit && allServices) {
      // 1. Cliente e Veículo
      setSelectedClientId(quoteToEdit.client_id);
      setSelectedVehicleId(quoteToEdit.vehicle_id);
      
      // 2. Serviços
      const servicesFromQuote: QuotedService[] = quoteToEdit.services_summary.map(s => {
        // Tenta encontrar o serviço original no catálogo para preencher os custos
        const originalService = allServices.find(as => as.id === s.id);
        
        return {
          ...s,
          id: s.id || `temp-${Math.random()}`, // Garante que cada serviço tenha um ID para o estado
          price: originalService?.price ?? s.price,
          labor_cost_per_hour: originalService?.labor_cost_per_hour ?? 0,
          execution_time_minutes: originalService?.execution_time_minutes ?? s.execution_time_minutes,
          other_costs: originalService?.other_costs ?? 0,
          user_id: user!.id,
          // Sobrescreve com os valores do orçamento (se existirem)
          quote_price: s.price,
          quote_execution_time_minutes: s.execution_time_minutes,
          // Produtos e outros detalhes de custo não são salvos no summary, então usamos os defaults do catálogo
          products: originalService?.products,
          quote_products: originalService?.products, // Inicializa quote_products com os produtos do catálogo
        };
      });
      
      setQuotedServices(servicesFromQuote);
      setSelectedServiceIds([]); // IMPORTANTE: Limpar o MultiSelect para que ele não mostre os IDs temporários/reconstruídos

      // 3. Agendamento e Observações
      setServiceDate(quoteToEdit.service_date || '');
      setServiceTime(quoteToEdit.service_time || '');
      setIsTimeDefined(!!quoteToEdit.service_time);
      setObservations(quoteToEdit.notes || '');

      // 4. Preço Final (para fins de cálculo, o valor original do serviço é o total_price)
      // Como o total_price é o valor final, e não temos o valor original,
      // vamos assumir que o valor original do serviço é o total_price para fins de edição
      // e o desconto é 0, a menos que o usuário o ajuste.
      // Para simplificar, vamos apenas definir o valor final e deixar o usuário recalcular.
      
      toast({
        title: "Orçamento carregado para edição",
        description: `Orçamento #${quoteIdToEdit.substring(0, 8)} carregado.`,
      });
    }
  }, [quoteToEdit, allServices, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // NOVA QUERY: Fetch service quote counts
  const { data: serviceQuoteCounts, isLoading: isLoadingQuoteCounts } = useQuery<ServiceQuoteCount[]>({
    queryKey: ['serviceQuoteCounts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Esta query usa uma função do Supabase para contar ocorrências de service_id
      // dentro do JSONB services_summary de todos os orçamentos do usuário.
      // Como não temos uma função de agregação complexa no RLS, faremos uma busca simples
      // e a contagem será feita no cliente, ou assumiremos que o DB tem uma view/função
      // para isso (simulando a chamada de uma view/função que retorna a contagem).
      
      // Para simplificar e evitar complexidade de DB, vamos buscar todos os orçamentos
      // e calcular a contagem no cliente.
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('services_summary')
        .eq('user_id', user.id);

      if (quotesError) throw quotesError;

      const counts: { [serviceId: string]: number } = {};
      
      quotesData.forEach(quote => {
        const servicesSummary = quote.services_summary as { id: string }[];
        if (Array.isArray(servicesSummary)) {
          servicesSummary.forEach(service => {
            if (service.id) {
              counts[service.id] = (counts[service.id] || 0) + 1;
            }
          });
        }
      });

      return Object.entries(counts).map(([service_id, count]) => ({ service_id, count }));
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

  // Fetch client details when selectedClientId changes
  const { data: clientDetails, isLoading: isLoadingClientDetails } = useQuery<Client | null>({
    queryKey: ['clientDetails', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId || !user) return null;
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', selectedClientId)
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClientId && !!user,
  });

  useEffect(() => {
    if (selectedClientId && clientDetails) {
      setSelectedClient(clientDetails);
    } else {
      setSelectedClient(undefined);
      setSelectedVehicleId(null);
    }
  }, [selectedClientId, clientDetails]);

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
          newQuotedServices.push({ ...serviceFromAll });
        }
      }
    });

    const filteredQuotedServices = newQuotedServices.filter(qs => selectedServiceIds.includes(qs.id));

    setQuotedServices(filteredQuotedServices);
  }, [selectedServiceIds, allServices]);

  useEffect(() => {
    setDisplayProfitMargin(profitMargin.toFixed(2).replace('.', ','));
  }, [profitMargin]);

  const handleEditServiceForQuote = (service: QuotedService) => {
    setServiceToEditInDialog(service);
    setIsServiceFormDialogOpen(true);
  };

  const handleSaveQuotedService = (updatedService: QuotedService) => {
    setQuotedServices(prev => 
      prev.map(s => (s.id === updatedService.id ? updatedService : s))
    );
    toast({
      title: "Serviço atualizado para o orçamento!",
      description: `${updatedService.name} foi configurado para este orçamento.`,
    });
  };

  const handleClientSelect = (clientId: string | null) => {
    setSelectedClientId(clientId);
  };

  const handleClientSaved = (client: Client) => {
    setSelectedClientId(client.id);
  };

  const totalExecutionTime = quotedServices.reduce((sum, service) => 
    sum + (service.quote_execution_time_minutes ?? service.execution_time_minutes), 0);

  const totalProductsCost = quotedServices.reduce((sum, service) => {
    let serviceProductCost = 0;
    if (productCostCalculationMethod === 'per-service') {
      const productsToUse = service.quote_products ?? service.products;
      productsToUse?.forEach(product => {
        const productForCalc = {
          gallonPrice: product.price,
          gallonVolume: product.size * 1000,
          dilutionRatio: product.dilution_ratio,
          usagePerVehicle: product.usage_per_vehicle,
          type: product.type,
          containerSize: product.container_size,
        };
        serviceProductCost += calculateProductCost(productForCalc);
      });
    }
    return sum + serviceProductCost;
  }, 0);

  const totalLaborCost = quotedServices.reduce((sum, service) => {
    const laborCostPerHour = service.quote_labor_cost_per_hour ?? service.labor_cost_per_hour;
    const executionTimeMinutes = service.quote_execution_time_minutes ?? service.execution_time_minutes;
    return sum + (executionTimeMinutes / 60) * laborCostPerHour;
  }, 0);

  const totalOtherCosts = quotedServices.reduce((sum, service) => 
    sum + (service.quote_other_costs ?? service.other_costs), 0);

  const totalCost = totalProductsCost + totalLaborCost + totalOtherCosts + otherCostsGlobal;

  const totalServiceValue = quotedServices.reduce((sum, service) => 
    sum + (service.quote_price ?? service.price), 0);

  useEffect(() => {
    const parsedDiscountValue = parseFloat(discountValueInput.replace(',', '.')) || 0;
    let newCalculatedDiscount = 0;

    if (discountType === 'amount') {
      newCalculatedDiscount = parsedDiscountValue;
    } else {
      newCalculatedDiscount = totalServiceValue * (parsedDiscountValue / 100);
    }
    setCalculatedDiscount(Math.min(newCalculatedDiscount, totalServiceValue));
  }, [discountValueInput, discountType, totalServiceValue]);

  const valueAfterDiscount = totalServiceValue - calculatedDiscount;

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
        : method.installments?.find(inst => inst.installments === 1)?.rate || 0;
      calculatedFee = valueAfterDiscount * (rateToApply / 100);
    }
    setPaymentFee(calculatedFee);
  }, [valueAfterDiscount, selectedPaymentMethodId, selectedInstallments, paymentMethods]);

  const finalPriceWithFee = valueAfterDiscount - paymentFee;
  const netProfit = finalPriceWithFee - totalCost;
  const currentProfitMarginPercentage = finalPriceWithFee > 0 ? (netProfit / finalPriceWithFee) * 100 : 0;
  const suggestedPriceBasedOnDesiredMargin = profitMargin > 0 ? totalCost / (1 - profitMargin / 100) : totalCost;
  
  // Lógica de ordenação dos serviços
  const serviceOptions = React.useMemo(() => {
    if (!allServices) return [];

    const countsMap = new Map(serviceQuoteCounts?.map(c => [c.service_id, c.count]) || []);

    const sortedServices = [...allServices].sort((a, b) => {
      const countA = countsMap.get(a.id) || 0;
      const countB = countsMap.get(b.id) || 0;
      // Ordenação decrescente (mais popular primeiro)
      return countB - countA;
    });

    return sortedServices.map(s => ({ label: s.name, value: s.id }));
  }, [allServices, serviceQuoteCounts]);

  const currentPaymentMethod = paymentMethods?.find(pm => pm.id === selectedPaymentMethodId);

  if (isLoadingServices || isLoadingMonthlyCost || isLoadingPaymentMethods || isLoadingQuoteCounts || isLoadingQuoteToEdit) {
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
              <CardTitle className="text-foreground">
                {quoteIdToEdit ? `Editar Orçamento #${quoteIdToEdit.substring(0, 8)}` : 'Gerar Orçamento Detalhado'}
              </CardTitle>
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
            finalPriceWithFee={finalPriceWithFee}
            valueAfterDiscount={valueAfterDiscount}
            netProfit={netProfit}
          />
        </CardContent>
      </Card>

      {quotedServices.length > 0 && (
        <QuoteGenerator
          selectedServices={quotedServices}
          totalCost={totalCost}
          finalPrice={valueAfterDiscount}
          executionTime={totalExecutionTime}
          calculatedDiscount={calculatedDiscount}
          currentPaymentMethod={currentPaymentMethod}
          selectedInstallments={selectedInstallments}
          selectedClient={selectedClient}
          onClientSelect={handleClientSelect}
          onClientSaved={handleClientSaved}
          selectedVehicleId={selectedVehicleId}
          setSelectedVehicleId={setSelectedVehicleId}
          serviceDate={serviceDate}
          serviceTime={isTimeDefined ? serviceTime : ''}
          quoteIdToEdit={quoteIdToEdit} // Passar o ID para o gerador
          observations={observations} // Passar observações
          setObservations={setObservations} // Passar setter de observações
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