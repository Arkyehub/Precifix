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
import { QuoteDiscountSection } from '@/components/quote/QuoteDiscountSection';
import { QuotePaymentMethodSection } from '@/components/quote/QuotePaymentMethodSection';
import { QuoteCalculationSummary } from '@/components/quote/QuoteCalculationSummary';
import { Client } from '@/types/clients'; // Importar Client
import { useSearchParams } from 'react-router-dom'; // Importar useSearchParams
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { QuoteClientSection } from '@/components/quote/QuoteClientSection'; // Adicionado importação
import { QuoteCostInputs } from '@/components/quote/QuoteCostInputs'; // NOVO: Importar componente de agrupamento de custos

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
  vehicle: string; // Adicionado campo vehicle para edição
  total_price: number;
  services_summary: QuotedService[];
  notes: string | null;
  service_date: string | null;
  service_time: string | null;
  commission_value?: number; // NOVO
  commission_type?: 'amount' | 'percentage'; // NOVO
  payment_method_id?: string; // NOVO: Adicionado para armazenar o ID da forma de pagamento
  installments?: number; // NOVO: Adicionado para armazenar o número de parcelas
}

interface QuoteCalculatorProps {
  isSale?: boolean; // Nova prop para diferenciar Venda de Orçamento
}

export const QuoteCalculator = ({ isSale = false }: QuoteCalculatorProps) => {
  const { user } = useSession();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const quoteIdToEdit = searchParams.get('quoteId');

  // serviceIdToAdd é o estado controlado do MultiSelect.
  // Ele será limpo após a adição para evitar que as tags apareçam.
  const [serviceIdToAdd, setServiceIdToAdd] = useState<string[]>([]);
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

  // NOVOS ESTADOS PARA COMISSÃO
  const [commissionValueInput, setCommissionValueInput] = useState('0,00');
  const [commissionType, setCommissionType] = useState<'amount' | 'percentage'>('amount');
  const [calculatedCommission, setCalculatedCommission] = useState(0);

  const [isServiceFormDialogOpen, setIsServiceFormDialogOpen] = useState(false);
  const [serviceToEditInDialog, setServiceToEditInDialog] = useState<QuotedService | null>(null);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | undefined>(undefined);
  
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [manualVehicleInput, setManualVehicleInput] = useState(''); // NOVO ESTADO PARA VEÍCULO MANUAL

  // ESTADO LOCAL PARA O NOME DO CLIENTE (PERMITE DIGITAÇÃO)
  // Inicializa como 'Consumidor Final' se for venda rápida e não estiver editando
  const [clientNameInput, setClientNameInput] = useState(
    isSale && !quoteIdToEdit ? 'Consumidor Final' : ''
  );

  // Novos estados para endereço detalhado
  const [addressNumber, setAddressNumber] = useState('');
  const [complement, setComplement] = useState('');

  // Novos estados para agendamento
  const [serviceDate, setServiceDate] = useState('');
  const [isTimeDefined, setIsTimeDefined] = useState(false);
  const [serviceTime, setServiceTime] = useState('');
  const [observations, setObservations] = useState(''); // Adicionado estado de observações
  
  // NOVO ESTADO: Se o cliente é obrigatório (apenas para isSale)
  const [isClientRequired, setIsClientRequired] = useState(!isSale);

  // Fetch all services with their linked products (MOVIDO PARA CIMA)
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

  // Query para buscar o orçamento para edição
  const { data: quoteToEdit, isLoading: isLoadingQuoteToEdit } = useQuery<QuoteDataForEdit | null>({
    queryKey: ['quoteToEdit', quoteIdToEdit],
    queryFn: async () => {
      if (!quoteIdToEdit || !user) return null;
      const { data, error } = await supabase
        .from('quotes')
        .select('id, client_id, client_name, vehicle_id, vehicle, total_price, services_summary, notes, service_date, service_time, commission_value, commission_type, payment_method_id, installments')
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

  // Efeito para preencher o formulário quando o orçamento para edição é carregado
  useEffect(() => {
    if (quoteToEdit && allServices) {
      // 1. Cliente e Veículo
      setSelectedClientId(quoteToEdit.client_id);
      setSelectedVehicleId(quoteToEdit.vehicle_id);
      setClientNameInput(quoteToEdit.client_name); // Inicializa o input com o nome do orçamento
      
      // Se for edição de um orçamento sem cliente/veículo vinculado (venda rápida antiga), preenche o manual
      if (!quoteToEdit.client_id && quoteToEdit.vehicle) {
        setManualVehicleInput(quoteToEdit.vehicle);
        setIsClientRequired(false); // Se não tem client_id, assume que é venda rápida
      } else {
        setIsClientRequired(true);
      }
      
      // 2. Serviços
      const servicesFromQuote: QuotedService[] = quoteToEdit.services_summary.map(s => {
        // Tenta encontrar o serviço original no catálogo para preencher os custos
        const originalService = allServices?.find(as => as.id === s.id);
        
        return {
          ...s,
          // Gerar um ID único para a instância do serviço no orçamento
          id: `temp-${Math.random()}-${Date.now()}-${s.id}`, 
          original_service_id: s.id, // USAR O ID SALVO NO SUMMARY COMO ID ORIGINAL
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
      setServiceIdToAdd([]); // Limpa o MultiSelect

      // 3. Agendamento e Observações
      setServiceDate(quoteToEdit.service_date || '');
      setServiceTime(quoteToEdit.service_time || '');
      setIsTimeDefined(!!quoteToEdit.service_time);
      setObservations(quoteToEdit.notes || '');

      // 4. Comissão
      const commissionValue = quoteToEdit.commission_value || 0;
      const commissionType = quoteToEdit.commission_type || 'amount';
      setCommissionValueInput(commissionValue.toFixed(2).replace('.', ','));
      setCommissionType(commissionType);
      
      // 6. Forma de Pagamento e Parcelas (NOVO)
      if (quoteToEdit.payment_method_id) {
        setSelectedPaymentMethodId(quoteToEdit.payment_method_id);
        setSelectedInstallments(quoteToEdit.installments || null);
      } else {
        setSelectedPaymentMethodId(null);
        setSelectedInstallments(null);
      }
      
      // 7. Preço Final (para fins de cálculo, o valor original do serviço é o total_price)
      
      toast({
        title: "Orçamento carregado para edição",
        description: `Orçamento #${quoteIdToEdit.substring(0, 8)} carregado.`,
      });
    }
  }, [quoteToEdit, allServices, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Efeito para sincronizar clientNameInput quando selectedClient muda (após seleção no autocomplete)
  useEffect(() => {
    if (selectedClient) {
      setClientNameInput(selectedClient.name);
      // Atualiza os novos campos de endereço
      setAddressNumber(selectedClient.address_number || '');
      setComplement(selectedClient.complement || '');
    } else if (!quoteIdToEdit) {
      // Se deselecionado e não estiver editando, limpa os campos de endereço detalhado
      setAddressNumber('');
      setComplement('');
    }
  }, [selectedClient, quoteIdToEdit]);


  // NOVA QUERY: Fetch service quote counts
  const { data: serviceQuoteCounts, isLoading: isLoadingQuoteCounts } = useQuery<ServiceQuoteCount[]>({
    queryKey: ['serviceQuoteCounts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('services_summary');

      if (quotesError) throw quotesError;

      const counts: { [serviceId: string]: number } = {};
      
      quotesData.forEach(quote => {
        // Tipagem corrigida para acessar original_service_id
        const servicesSummary = quote.services_summary as { id: string; original_service_id?: string }[];
        if (Array.isArray(servicesSummary)) {
          servicesSummary.forEach(service => {
            // Usamos o ID do serviço original, que agora deve estar no summary
            const originalId = service.original_service_id || service.id; 
            if (originalId) {
              counts[originalId] = (counts[originalId] || 0) + 1;
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

  // Lógica de adição/remoção de serviços
  const handleServiceSelectChange = (newSelectedIds: string[]) => {
    const currentQuotedIds = quotedServices.map(s => s.id);
    
    // IDs que estavam no MultiSelect antes, mas não estão mais (tentativa de remoção)
    const removedIds = serviceIdToAdd.filter(id => !newSelectedIds.includes(id));
    
    // IDs que estão no MultiSelect agora, mas não estavam antes (tentativa de adição)
    const addedIds = newSelectedIds.filter(id => !serviceIdToAdd.includes(id));

    let newQuotedServices = [...quotedServices];

    // Adicionar novos serviços (permitindo duplicação)
    addedIds.forEach(addedId => {
      const serviceFromAll = allServices?.find(s => s.id === addedId);
      if (serviceFromAll) {
        // Criar uma nova instância com um ID único para o orçamento
        const newService: QuotedService = { 
          ...serviceFromAll,
          id: `temp-${serviceFromAll.id}-${Date.now()}-${Math.random()}`, // ID único para a instância
          original_service_id: serviceFromAll.id, // NOVO: Salvar o ID original
        };
        newQuotedServices.push(newService);
        toast({
          title: "Serviço adicionado!",
          description: `${serviceFromAll.name} foi adicionado ao orçamento.`,
        });
      }
    });

    // Remover serviços (se o usuário desmarcou uma tag no MultiSelect, o que não deve acontecer aqui)
    // Como removemos o filtro de opções, o MultiSelect agora pode ser usado para remover.
    // No entanto, como limpamos serviceIdToAdd logo abaixo, a remoção não funcionará de forma intuitiva.
    // Para simplificar e focar na adição duplicada, vamos ignorar a remoção via MultiSelect.
    
    // Se o usuário clicar em um item que já está na lista quotedServices, ele será adicionado novamente.
    // Isso é o que o usuário pediu (duplicação).
    
    setQuotedServices(newQuotedServices);
    
    // Limpar o MultiSelect para que ele não exiba tags, forçando o usuário a ver a lista de serviços cotados.
    setServiceIdToAdd([]);
  };

  // NOVO HANDLER: Excluir serviço do orçamento
  const handleDeleteServiceFromQuote = (serviceId: string) => {
    setQuotedServices(prev => prev.filter(s => s.id !== serviceId));
    toast({
      title: "Serviço removido!",
      description: "O serviço foi removido deste orçamento.",
    });
  };

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
      description: `${updatedService.name} foi configurado para este serviço no orçamento.`,
    });
  };

  const handleClientSelect = (clientId: string | null) => {
    setSelectedClientId(clientId);
  };

  const handleClientSaved = (client: Client) => {
    setSelectedClientId(client.id);
    setClientNameInput(client.name); // Atualiza o input com o nome do cliente salvo
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

  // --- DEFINIÇÕES DE VALORES TOTAIS ---
  const totalServiceValue = quotedServices.reduce((sum, service) => 
    sum + (service.quote_price ?? service.price), 0);
  // ------------------------------------

  // Lógica de cálculo da Comissão
  useEffect(() => {
    const parsedCommissionValue = parseFloat(commissionValueInput.replace(',', '.')) || 0;
    let newCalculatedCommission = 0;

    if (commissionType === 'amount') {
      newCalculatedCommission = parsedCommissionValue;
    } else {
      // A comissão é calculada sobre o valor total do serviço (antes do desconto)
      newCalculatedCommission = totalServiceValue * (parsedCommissionValue / 100);
    }
    setCalculatedCommission(newCalculatedCommission);
  }, [commissionValueInput, commissionType, totalServiceValue]); // totalServiceValue agora está definido

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

  // Custo Total da Operação (incluindo a comissão como custo)
  const totalCost = totalProductsCost + totalLaborCost + totalOtherCosts + otherCostsGlobal + calculatedCommission;

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
        {/* Renderiza o CardHeader apenas se não for uma nova venda (isSale=true e sem quoteIdToEdit) */}
        {(!isSale || quoteIdToEdit) && (
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
                <FileText className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-foreground">
                  {isSale ? 'Lançar Venda' : (quoteIdToEdit ? `Editar Orçamento #${quoteIdToEdit.substring(0, 8)}` : 'Gerar Orçamento Detalhado')}
                </CardTitle>
                <CardDescription>
                  {isSale ? 'Registre os detalhes da venda finalizada.' : 'Selecione os serviços, ajuste os custos e gere um orçamento profissional.'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        )}
        <CardContent className="space-y-6">
          
          <QuoteClientSection
            selectedClient={selectedClient}
            onClientSelect={handleClientSelect}
            onClientSaved={handleClientSaved}
            clientNameInput={clientNameInput} // Usar o estado local
            setClientNameInput={setClientNameInput} // Passar o setter
            quoteDate={''} // Não usado aqui, mas mantido para compatibilidade
            setQuoteDate={() => {}} // Não usado aqui, mas mantido para compatibilidade
            rawPhoneNumber={selectedClient?.phone_number || ''}
            setRawPhoneNumber={() => {}} // Não permitir alteração direta do telefone
            address={selectedClient?.address || ''}
            setAddress={() => {}} // Não permitir alteração direta do endereço
            addressNumber={addressNumber} // NOVO
            setAddressNumber={setAddressNumber} // NOVO
            complement={complement} // NOVO
            setComplement={setComplement} // NOVO
            observations={observations}
            setObservations={setObservations}
            selectedVehicleId={selectedVehicleId}
            setSelectedVehicleId={setSelectedVehicleId}
            manualVehicleInput={manualVehicleInput} // NOVO: Passar o input manual
            setManualVehicleInput={setManualVehicleInput} // NOVO: Passar o setter manual
            serviceDate={serviceDate}
            setServiceDate={setServiceDate}
            isTimeDefined={isTimeDefined}
            setIsTimeDefined={setIsTimeDefined}
            serviceTime={serviceTime}
            setServiceTime={setServiceTime}
            isSale={isSale}
            isClientRequired={isClientRequired}
            setIsClientRequired={setIsClientRequired}
          />

          <QuoteServiceSelection
            serviceOptions={serviceOptions}
            selectedServiceIds={serviceIdToAdd} // Usar o estado de buffer (sempre vazio após a ação)
            onSelectChange={handleServiceSelectChange} // Usar a nova função de manipulação
            existingServiceIds={quotedServices.map(s => s.id)} // Passar IDs existentes (não usado para filtrar opções agora)
          />

          <QuoteSelectedServicesList
            quotedServices={quotedServices}
            onEditServiceForQuote={handleEditServiceForQuote}
            onDeleteServiceFromQuote={handleDeleteServiceFromQuote} // Passar o novo handler
          />

          {/* NOVO COMPONENTE DE AGRUPAMENTO DE CUSTOS */}
          <QuoteCostInputs
            otherCostsGlobal={otherCostsGlobal}
            onOtherCostsGlobalChange={setOtherCostsGlobal}
            commissionValueInput={commissionValueInput}
            onCommissionValueInputChange={setCommissionValueInput}
            onCommissionValueInputBlur={(value) => {
              const rawValue = value.replace(',', '.');
              const parsedValue = parseFloat(rawValue) || 0;
              setCommissionValueInput(parsedValue.toFixed(2).replace('.', ','));
            }}
            commissionType={commissionType}
            onCommissionTypeChange={setCommissionType}
            calculatedCommission={calculatedCommission}
          />
          {/* FIM NOVO COMPONENTE */}

          {/* NOVO LAYOUT: Forma de Pagamento (Esquerda) e Desconto (Direita) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <QuotePaymentMethodSection
              paymentMethods={paymentMethods}
              isLoadingPaymentMethods={isLoadingPaymentMethods}
              selectedPaymentMethodId={selectedPaymentMethodId}
              onPaymentMethodSelectChange={(value) => {
                setSelectedPaymentMethodId(value);
                const method = paymentMethods?.find(pm => pm.id === value);
                if (method?.type === 'credit_card' && method.installments && method.installments.length > 0) {
                  const firstValidInstallment = method.installments.find(inst => inst.installments === 1);
                  setSelectedInstallments(firstValidInstallment ? firstValidInstallment.installments : 1);
                } else {
                  setSelectedInstallments(null);
                }
              }}
              selectedInstallments={selectedInstallments}
              onInstallmentsSelectChange={(value) => setSelectedInstallments(parseInt(value, 10))}
              currentPaymentMethod={currentPaymentMethod}
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
          </div>
          {/* FIM NOVO LAYOUT */}

          <QuoteCalculationSummary
            totalExecutionTime={totalExecutionTime}
            totalProductsCost={totalProductsCost}
            totalLaborCost={totalLaborCost}
            totalOtherCosts={totalOtherCosts}
            otherCostsGlobal={otherCostsGlobal}
            calculatedCommission={calculatedCommission}
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
          
          {/* Observações Finais (Movidas para o final) */}
          <div className="space-y-2 pt-4 border-t border-border/50">
            <Label htmlFor="observations">Observações Adicionais</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Informações extras, condições de pagamento, garantia, etc."
              className="bg-background/50 min-h-[100px]"
            />
          </div>
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
          manualVehicleInput={manualVehicleInput} // <-- Adicionado aqui
          serviceDate={serviceDate}
          serviceTime={isTimeDefined ? serviceTime : ''}
          quoteIdToEdit={quoteIdToEdit} // Passar o ID para o gerador
          observations={observations} // Passar observações
          setObservations={setObservations} // Passar setter de observações
          isSale={isSale} // Passar a nova prop
          isClientRequired={isClientRequired} // Passar a nova prop
          addressNumber={addressNumber} // NOVO: Passado para o gerador
          complement={complement} // NOVO: Passado para o gerador
          calculatedCommission={calculatedCommission} // NOVO
          commissionType={commissionType} // NOVO
          commissionValueInput={commissionValueInput} // NOVO
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