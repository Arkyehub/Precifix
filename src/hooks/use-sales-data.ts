import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';

// Mapeamento de status do DB para rótulos de Venda
export type QuoteStatus = 'pending' | 'accepted' | 'rejected' | 'closed' | 'awaiting_payment';

export interface Sale {
  id: string;
  sale_number: string | null;
  client_name: string;
  total_price: number;
  created_at: string;
  services_summary: any[];
  status: QuoteStatus;
  payment_method_id: string | null;
  installments: number | null;
  vehicle: string | null;
}

export interface PaymentMethod {
  id: string;
  name: string;
}

export interface ActiveTextFilter {
  type: 'client' | 'saleNumber' | 'status' | 'service' | 'paymentMethod' | 'vehicle';
  value: string;
}

export const useSalesData = (activeTextFilters: ActiveTextFilter[], dateRange: DateRange | undefined) => {
  const { user } = useSession();

  // Fetch all sales (quotes with is_sale: true)
  const { data: sales, isLoading: isLoadingSales, error: salesError } = useQuery<Sale[]>({
    queryKey: ['closedSales', user?.id, JSON.stringify(activeTextFilters), dateRange],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase
        .from('quotes')
        .select('id, sale_number, client_name, total_price, created_at, services_summary, status, payment_method_id, installments, vehicle')
        .eq('user_id', user.id)
        .eq('is_sale', true);

      if (dateRange?.from) {
        const start = startOfDay(dateRange.from).toISOString();
        query = query.gte('created_at', start);
      }
      if (dateRange?.to) {
        const end = endOfDay(dateRange.to).toISOString();
        query = query.lte('created_at', end);
      }

      // Aplicar filtros de texto do activeTextFilters (server-side)
      const clientFilters = activeTextFilters.filter(f => f.type === 'client');
      const saleNumberFilters = activeTextFilters.filter(f => f.type === 'saleNumber');
      const statusFilters = activeTextFilters.filter(f => f.type === 'status');
      const vehicleFilters = activeTextFilters.filter(f => f.type === 'vehicle');

      if (clientFilters.length > 0) {
        const clientOrConditions = clientFilters.map(f => `client_name.ilike.%${f.value}%`).join(',');
        query = query.or(clientOrConditions);
      }
      if (saleNumberFilters.length > 0) {
        const saleNumberOrConditions = saleNumberFilters.map(f => `sale_number.ilike.%${f.value}%`).join(',');
        query = query.or(saleNumberOrConditions);
      }
      if (statusFilters.length > 0) {
        const statusOrConditions = statusFilters.map(f => `status.eq.${f.value}`).join(','); // Assuming value is the actual status key
        if (statusOrConditions) query = query.or(statusOrConditions);
      }
      if (vehicleFilters.length > 0) {
        const vehicleOrConditions = vehicleFilters.map(f => `vehicle.ilike.%${f.value}%`).join(',');
        query = query.or(vehicleOrConditions);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      
      let currentSales = data as Sale[];

      // Aplicar filtros de texto do activeTextFilters (client-side)
      const serviceFilters = activeTextFilters.filter(f => f.type === 'service');
      const paymentMethodFilters = activeTextFilters.filter(f => f.type === 'paymentMethod');

      if (serviceFilters.length > 0) {
        currentSales = currentSales.filter(sale =>
          serviceFilters.some(filter =>
            sale.services_summary?.some((service: any) =>
              service.name.toLowerCase().includes(filter.value.toLowerCase())
            )
          )
        );
      }

      if (paymentMethodFilters.length > 0) {
        // This part needs paymentMethods to be loaded first.
        // For now, we'll assume paymentMethods are available or handle it in the component.
        // A better approach might be to fetch paymentMethods inside this queryFn if they are always needed together.
        // Or, pass paymentMethods as an argument to this hook if they are fetched elsewhere.
        // For modularity, let's fetch them here as well.
        const { data: pMethods } = await supabase.from('payment_methods').select('id, name');
        const paymentMethodsMap = new Map(pMethods?.map(pm => [pm.id, pm.name]));

        currentSales = currentSales.filter(sale =>
          paymentMethodFilters.some(filter => {
            if (!sale.payment_method_id) return false;
            const methodName = paymentMethodsMap.get(sale.payment_method_id);
            return methodName?.toLowerCase().includes(filter.value.toLowerCase());
          })
        );
      }

      return currentSales;
    },
    enabled: !!user,
  });

  // Fetch payment methods for client-side filtering and display
  const { data: paymentMethods, isLoading: isLoadingPaymentMethods, error: paymentMethodsError } = useQuery<PaymentMethod[]>({
    queryKey: ['paymentMethods', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, name');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return {
    sales,
    isLoadingSales,
    salesError,
    paymentMethods,
    isLoadingPaymentMethods,
    paymentMethodsError,
  };
};