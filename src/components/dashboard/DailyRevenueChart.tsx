import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart2, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, getDate, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { getYear, getMonth } from 'date-fns';

interface DailyRevenueChartProps {
  selectedDate: Date;
}

interface DailyData {
  date: string;
  day: number;
  currentMonthRevenue: number;
  previousMonthRevenue: number;
}

export const DailyRevenueChart = ({ selectedDate }: DailyRevenueChartProps) => {
  const { user } = useSession();
  const startOfCurrentMonth = startOfMonth(selectedDate);
  const endOfCurrentMonth = endOfMonth(selectedDate);
  const startOfPreviousMonth = startOfMonth(subMonths(selectedDate, 1));
  const endOfPreviousMonth = endOfMonth(subMonths(selectedDate, 1));

  // Fetch current month sales
  const { data: currentMonthSales, isLoading: isLoadingCurrentSales } = useQuery<any[]>({
    queryKey: ['dailyRevenueCurrentMonthSales', user?.id, format(selectedDate, 'yyyy-MM')],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('total_price, created_at')
        .eq('user_id', user.id)
        .eq('is_sale', true)
        .in('status', ['accepted', 'closed'])
        .gte('created_at', startOfCurrentMonth.toISOString())
        .lte('created_at', endOfCurrentMonth.toISOString());
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch previous month sales
  const { data: previousMonthSales, isLoading: isLoadingPreviousSales } = useQuery<any[]>({
    queryKey: ['dailyRevenuePreviousMonthSales', user?.id, format(subMonths(selectedDate, 1), 'yyyy-MM')],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('total_price, created_at')
        .eq('user_id', user.id)
        .eq('is_sale', true)
        .in('status', ['accepted', 'closed'])
        .gte('created_at', startOfPreviousMonth.toISOString())
        .lte('created_at', endOfPreviousMonth.toISOString());
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const chartData = React.useMemo(() => {
    const daysInCurrentMonth = eachDayOfInterval({ start: startOfCurrentMonth, end: endOfCurrentMonth });
    const dataMap = new Map<string, DailyData>();

    daysInCurrentMonth.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      dataMap.set(dateKey, {
        date: dateKey,
        day: getDate(day),
        currentMonthRevenue: 0,
        previousMonthRevenue: 0,
      });
    });

    currentMonthSales?.forEach(sale => {
      const saleDate = new Date(sale.created_at);
      const dateKey = format(saleDate, 'yyyy-MM-dd');
      if (dataMap.has(dateKey)) {
        dataMap.get(dateKey)!.currentMonthRevenue += sale.total_price;
      }
    });

    previousMonthSales?.forEach(sale => {
      const saleDate = new Date(sale.created_at);
      // Map previous month's day to current month's day for comparison
      const dayOfMonth = getDate(saleDate);
      const correspondingCurrentMonthDate = new Date(getYear(selectedDate), getMonth(selectedDate), dayOfMonth);
      const dateKey = format(correspondingCurrentMonthDate, 'yyyy-MM-dd');
      if (dataMap.has(dateKey)) {
        dataMap.get(dateKey)!.previousMonthRevenue += sale.total_price;
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => a.day - b.day);
  }, [currentMonthSales, previousMonthSales, startOfCurrentMonth, endOfCurrentMonth, selectedDate]);

  if (isLoadingCurrentSales || isLoadingPreviousSales) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BarChart2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Faturamento Diário</CardTitle>
          </div>
          <CardDescription>
            Comparativo do faturamento diário com o mês anterior.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <BarChart2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">Faturamento Diário</CardTitle>
        </div>
        <CardDescription>
          Comparativo do faturamento diário com o mês anterior.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis
              dataKey="day"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `R$${value}`}
            />
            <Tooltip
              formatter={(value: number) => `R$${value.toFixed(2)}`}
              labelFormatter={(label: number) => `Dia ${label}`}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend />
            <Bar dataKey="currentMonthRevenue" name={`Faturamento ${format(selectedDate, 'MMM', { locale: ptBR })}`} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="previousMonthRevenue" name={`Faturamento ${format(subMonths(selectedDate, 1), 'MMM', { locale: ptBR })}`} fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};