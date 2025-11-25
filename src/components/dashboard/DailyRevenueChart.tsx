import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart2, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, getDate, isSameDay, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { getYear, getMonth } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface DailyRevenueChartProps {
  selectedDate: Date;
}

interface DailyData {
  date: string;
  day: number;
  currentMonthRevenue: number;
  comparisonRevenue: number;
}

export const DailyRevenueChart = ({ selectedDate }: DailyRevenueChartProps) => {
  const { user } = useSession();
  const [comparisonType, setComparisonType] = React.useState<'monthly' | 'annual'>('monthly');

  const startOfCurrentPeriod = startOfMonth(selectedDate);
  const endOfCurrentPeriod = endOfMonth(selectedDate);

  const comparisonDate = comparisonType === 'monthly' ? subMonths(selectedDate, 1) : subYears(selectedDate, 1);
  const startOfComparisonPeriod = startOfMonth(comparisonDate);
  const endOfComparisonPeriod = endOfMonth(comparisonDate);

  // Use format(date, 'yyyy-MM-dd') for database comparisons with quote_date (which is a date column)
  const currentStartStr = format(startOfCurrentPeriod, 'yyyy-MM-dd');
  const currentEndStr = format(endOfCurrentPeriod, 'yyyy-MM-dd');
  const comparisonStartStr = format(startOfComparisonPeriod, 'yyyy-MM-dd');
  const comparisonEndStr = format(endOfComparisonPeriod, 'yyyy-MM-dd');

  // Fetch current month sales
  const { data: currentMonthSales, isLoading: isLoadingCurrentSales } = useQuery<any[]>({
    queryKey: ['dailyRevenueCurrentMonthSales', user?.id, format(selectedDate, 'yyyy-MM')],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('total_price, quote_date')
        .eq('user_id', user.id)
        .eq('is_sale', true)
        .in('status', ['accepted', 'closed'])
        .gte('quote_date', currentStartStr)
        .lte('quote_date', currentEndStr);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch comparison period sales (previous month or previous year's same month)
  const { data: comparisonPeriodSales, isLoading: isLoadingComparisonSales } = useQuery<any[]>({
    queryKey: [
      'dailyRevenueComparisonSales',
      user?.id,
      comparisonType,
      format(comparisonDate, 'yyyy-MM'),
    ],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('total_price, quote_date')
        .eq('user_id', user.id)
        .eq('is_sale', true)
        .in('status', ['accepted', 'closed'])
        .gte('quote_date', comparisonStartStr)
        .lte('quote_date', comparisonEndStr);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const chartData = React.useMemo(() => {
    const daysInCurrentMonth = eachDayOfInterval({ start: startOfCurrentPeriod, end: endOfCurrentPeriod });
    const dataMap = new Map<string, DailyData>();

    daysInCurrentMonth.forEach(day => {
      // Create keys based on local date string YYYY-MM-DD
      const dateKey = format(day, 'yyyy-MM-dd');
      dataMap.set(dateKey, {
        date: dateKey,
        day: getDate(day),
        currentMonthRevenue: 0,
        comparisonRevenue: 0,
      });
    });

    currentMonthSales?.forEach(sale => {
      // quote_date is already 'YYYY-MM-DD', so no timezone conversion needed
      const dateKey = sale.quote_date; 
      if (dataMap.has(dateKey)) {
        dataMap.get(dateKey)!.currentMonthRevenue += sale.total_price;
      }
    });

    comparisonPeriodSales?.forEach(sale => {
      // For comparison, we map the comparison date's day to the current month's day
      // We parse the quote_date string to get the day
      const [year, month, day] = sale.quote_date.split('-').map(Number);
      const dayOfMonth = day; // This is the day of month (1-31)
      
      // Construct the key for the CURRENT month with THIS day
      const correspondingCurrentMonthDate = new Date(getYear(selectedDate), getMonth(selectedDate), dayOfMonth);
      
      // Handle edge cases (e.g., trying to map day 31 to a month with 30 days)
      if (getMonth(correspondingCurrentMonthDate) === getMonth(selectedDate)) {
          const dateKey = format(correspondingCurrentMonthDate, 'yyyy-MM-dd');
          if (dataMap.has(dateKey)) {
            dataMap.get(dateKey)!.comparisonRevenue += sale.total_price;
          }
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => a.day - b.day);
  }, [currentMonthSales, comparisonPeriodSales, startOfCurrentPeriod, endOfCurrentPeriod, selectedDate]);

  if (isLoadingCurrentSales || isLoadingComparisonSales) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BarChart2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Faturamento Diário</CardTitle>
          </div>
          <CardDescription>
            {comparisonType === 'monthly'
              ? 'Comparativo do faturamento diário com o mês anterior.'
              : 'Comparativo do faturamento diário com o mesmo mês do ano anterior.'}
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Faturamento Diário</CardTitle>
          </div>
          <RadioGroup
            defaultValue="monthly"
            value={comparisonType}
            onValueChange={(value: 'monthly' | 'annual') => setComparisonType(value)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="monthly" id="monthly-comparison" />
              <Label htmlFor="monthly-comparison">Mensal</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="annual" id="annual-comparison" />
              <Label htmlFor="annual-comparison">Anual</Label>
            </div>
          </RadioGroup>
        </div>
        <CardDescription>
          {comparisonType === 'monthly'
            ? 'Comparativo do faturamento diário com o mês anterior.'
            : 'Comparativo do faturamento diário com o mesmo mês do ano anterior.'}
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
            <Bar dataKey="currentMonthRevenue" name={`Faturamento ${format(selectedDate, 'MMM yyyy', { locale: ptBR })}`} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="comparisonRevenue"
              name={
                comparisonType === 'monthly'
                  ? `Faturamento ${format(subMonths(selectedDate, 1), 'MMM yyyy', { locale: ptBR })}`
                  : `Faturamento ${format(subYears(selectedDate, 1), 'MMM yyyy', { locale: ptBR })}`
              }
              fill="hsl(var(--muted-foreground))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};