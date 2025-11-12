import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CalendarCheck, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AppointmentSummaryCardProps {
  selectedDate: Date;
}

interface QuoteStatusCount {
  status: 'pending' | 'accepted' | 'rejected' | 'closed';
  count: number;
}

export const AppointmentSummaryCard = ({ selectedDate }: AppointmentSummaryCardProps) => {
  const { user } = useSession();
  const startOfSelectedMonth = startOfMonth(selectedDate);
  const endOfSelectedMonth = endOfMonth(selectedDate);

  const { data: statusCounts, isLoading } = useQuery<QuoteStatusCount[]>({
    queryKey: ['appointmentStatusCounts', user?.id, format(selectedDate, 'yyyy-MM')],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('status', { count: 'exact' })
        .eq('user_id', user.id)
        .gte('service_date', startOfSelectedMonth.toISOString())
        .lte('service_date', endOfSelectedMonth.toISOString());

      if (error) throw error;

      const counts: { [key: string]: number } = {
        pending: 0,
        accepted: 0,
        rejected: 0,
        closed: 0,
      };

      data.forEach((item: any) => {
        if (item.status in counts) {
          counts[item.status]++;
        }
      });

      return Object.entries(counts).map(([status, count]) => ({
        status: status as 'pending' | 'accepted' | 'rejected' | 'closed',
        count,
      }));
    },
    enabled: !!user,
  });

  const getCount = (status: 'pending' | 'accepted' | 'rejected' | 'closed') => {
    return statusCounts?.find(s => s.status === status)?.count || 0;
  };

  const totalAppointments = statusCounts?.reduce((sum, s) => sum + s.count, 0) || 0;

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Resumo de Agendamentos</CardTitle>
          </div>
          <CardDescription>
            Status dos agendamentos para o mês de {format(selectedDate, 'MMMM', { locale: ptBR })}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">Resumo de Agendamentos</CardTitle>
        </div>
        <CardDescription>
          Status dos agendamentos para o mês de {format(selectedDate, 'MMMM', { locale: ptBR })}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 h-[332px]">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-green-600">Concluídos:</span>
          <span className="text-lg font-bold text-green-600">{getCount('closed')}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-yellow-600">Em Aberto (Pendentes/Aceitos):</span>
          <span className="text-lg font-bold text-yellow-600">{getCount('pending') + getCount('accepted')}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-destructive">Cancelados:</span>
          <span className="text-lg font-bold text-destructive">{getCount('rejected')}</span>
        </div>
        <div className="pt-2 border-t border-border/50 mt-2 flex justify-between items-center">
          <span className="text-base font-semibold text-foreground">Total de Agendamentos:</span>
          <span className="text-xl font-bold text-primary">{totalAppointments}</span>
        </div>
      </CardContent>
    </Card>
  );
};