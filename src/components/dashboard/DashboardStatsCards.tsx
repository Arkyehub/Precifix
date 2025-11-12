import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, CheckCircle, Car, TrendingUp, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DashboardStatsCardsProps {
  selectedDate: Date;
}

export const DashboardStatsCards = ({ selectedDate }: DashboardStatsCardsProps) => {
  const { user } = useSession();
  const startOfSelectedMonth = startOfMonth(selectedDate);
  const endOfSelectedMonth = endOfMonth(selectedDate);
  const startOfPreviousMonth = startOfMonth(subMonths(selectedDate, 1));
  const endOfPreviousMonth = endOfMonth(subMonths(selectedDate, 1));

  // Query para Faturamento do Mês Atual
  const { data: currentMonthRevenue, isLoading: isLoadingCurrentRevenue } = useQuery<number>({
    queryKey: ['dashboardCurrentMonthRevenue', user?.id, format(selectedDate, 'yyyy-MM')],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from('quotes')
        .select('total_price')
        .eq('user_id', user.id)
        .eq('is_sale', true)
        .in('status', ['accepted', 'closed'])
        .gte('created_at', startOfSelectedMonth.toISOString())
        .lte('created_at', endOfSelectedMonth.toISOString());
      if (error) throw error;
      return data.reduce((sum, sale) => sum + sale.total_price, 0);
    },
    enabled: !!user,
  });

  // Query para Faturamento do Mês Anterior (para comparação)
  const { data: previousMonthRevenue, isLoading: isLoadingPreviousRevenue } = useQuery<number>({
    queryKey: ['dashboardPreviousMonthRevenue', user?.id, format(subMonths(selectedDate, 1), 'yyyy-MM')],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from('quotes')
        .select('total_price')
        .eq('user_id', user.id)
        .eq('is_sale', true)
        .in('status', ['accepted', 'closed'])
        .gte('created_at', startOfPreviousMonth.toISOString())
        .lte('created_at', endOfPreviousMonth.toISOString());
      if (error) throw error;
      return data.reduce((sum, sale) => sum + sale.total_price, 0);
    },
    enabled: !!user,
  });

  // Query para Despesas do Mês Atual
  const { data: currentMonthExpenses, isLoading: isLoadingCurrentExpenses } = useQuery<number>({
    queryKey: ['dashboardCurrentMonthExpenses', user?.id, format(selectedDate, 'yyyy-MM')],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from('operational_cost_payments')
        .select('paid_value')
        .eq('user_id', user.id)
        .gte('due_date', startOfSelectedMonth.toISOString())
        .lte('due_date', endOfSelectedMonth.toISOString());
      if (error) throw error;
      return data.reduce((sum, payment) => sum + payment.paid_value, 0);
    },
    enabled: !!user,
  });

  // Query para Serviços Concluídos
  const { data: completedServicesCount, isLoading: isLoadingCompletedServices } = useQuery<number>({
    queryKey: ['dashboardCompletedServicesCount', user?.id, format(selectedDate, 'yyyy-MM')],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('quotes')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('status', 'closed')
        .gte('service_date', startOfSelectedMonth.toISOString())
        .lte('service_date', endOfSelectedMonth.toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  // Query para Carros Atendidos (contagem de quotes com status 'closed')
  const { data: carsServicedCount, isLoading: isLoadingCarsServiced } = useQuery<number>({
    queryKey: ['dashboardCarsServicedCount', user?.id, format(selectedDate, 'yyyy-MM')],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('quotes')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('status', 'closed')
        .gte('service_date', startOfSelectedMonth.toISOString())
        .lte('service_date', endOfSelectedMonth.toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const netRevenue = (currentMonthRevenue || 0) - (currentMonthExpenses || 0);
  const revenueComparison = (currentMonthRevenue || 0) - (previousMonthRevenue || 0);
  const isRevenueUp = revenueComparison >= 0;

  const renderLoader = () => <Loader2 className="h-5 w-5 animate-spin text-primary" />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Faturamento do Mês */}
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Faturamento do Mês</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingCurrentRevenue ? renderLoader() : `R$ ${(currentMonthRevenue || 0).toFixed(2)}`}
          </div>
          <p className={cn("text-xs text-muted-foreground flex items-center gap-1 mt-1", isRevenueUp ? "text-green-600" : "text-destructive")}>
            <TrendingUp className={cn("h-3 w-3", !isRevenueUp && "rotate-180")} />
            {isLoadingCurrentRevenue || isLoadingPreviousRevenue ? renderLoader() : `R$ ${Math.abs(revenueComparison).toFixed(2)} ${isRevenueUp ? 'a mais' : 'a menos'} que o mês anterior`}
          </p>
        </CardContent>
      </Card>

      {/* Receita Líquida */}
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Receita Líquida</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingCurrentRevenue || isLoadingCurrentExpenses ? renderLoader() : `R$ ${netRevenue.toFixed(2)}`}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Faturamento - Despesas</p>
        </CardContent>
      </Card>

      {/* Serviços Concluídos */}
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Serviços Concluídos</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingCompletedServices ? renderLoader() : completedServicesCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total de serviços finalizados</p>
        </CardContent>
      </Card>

      {/* Carros Atendidos */}
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Carros Atendidos</CardTitle>
          <Car className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingCarsServiced ? renderLoader() : carsServicedCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Veículos com serviços concluídos</p>
        </CardContent>
      </Card>
    </div>
  );
};