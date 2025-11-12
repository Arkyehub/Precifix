import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Loader2, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PopularServicesChartProps {
  selectedDate: Date;
}

interface ServiceData {
  name: string;
  count: number;
  value: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19B8'];

export const PopularServicesChart = ({ selectedDate }: PopularServicesChartProps) => {
  const { user } = useSession();
  const startOfSelectedMonth = startOfMonth(selectedDate);
  const endOfSelectedMonth = endOfMonth(selectedDate);

  const { data: popularServices, isLoading } = useQuery<ServiceData[]>({
    queryKey: ['popularServices', user?.id, format(selectedDate, 'yyyy-MM')],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('services_summary')
        .eq('user_id', user.id)
        .eq('status', 'closed')
        .gte('service_date', startOfSelectedMonth.toISOString())
        .lte('service_date', endOfSelectedMonth.toISOString());

      if (error) throw error;

      const serviceCounts: { [key: string]: { count: number; value: number } } = {};

      data.forEach(quote => {
        if (quote.services_summary && Array.isArray(quote.services_summary)) {
          quote.services_summary.forEach((service: any) => {
            const serviceName = service.name || 'Serviço Desconhecido';
            if (!serviceCounts[serviceName]) {
              serviceCounts[serviceName] = { count: 0, value: 0 };
            }
            serviceCounts[serviceName].count++;
            serviceCounts[serviceName].value += service.price || 0;
          });
        }
      });

      return Object.entries(serviceCounts)
        .map(([name, { count, value }]) => ({ name, count, value }))
        .sort((a, b) => b.count - a.count); // Sort by most popular
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Star className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Serviços Mais Populares</CardTitle>
          </div>
          <CardDescription>
            Serviços mais concluídos no mês de {format(selectedDate, 'MMMM', { locale: ptBR })}.
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
          <Star className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">Serviços Mais Populares</CardTitle>
        </div>
        <CardDescription>
          Serviços mais concluídos no mês de {format(selectedDate, 'MMMM', { locale: ptBR })}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {popularServices && popularServices.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={popularServices}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
                nameKey="name"
                labelLine={false}
              >
                {popularServices.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string, props: any) => [`${value} (${(props.payload.value / popularServices.reduce((sum, s) => sum + s.count, 0) * 100).toFixed(1)}%)`, props.payload.name]}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-muted-foreground italic">Nenhum serviço concluído neste mês.</p>
        )}
      </CardContent>
    </Card>
  );
};