import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CalendarClock, Loader2, Clock, Car, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UpcomingAppointmentsListProps {
  selectedDate: Date; // Usado para o contexto do mês, mas a lista é para hoje/amanhã
}

interface Appointment {
  id: string;
  client_name: string;
  vehicle: string;
  service_date: string;
  service_time: string;
  status: 'pending' | 'accepted' | 'rejected' | 'closed';
}

const statusColors = {
  accepted: { text: 'Aceito', color: 'text-green-500', bg: 'bg-green-500/10' },
  pending: { text: 'Em Aberto', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  rejected: { text: 'Cancelado', color: 'text-destructive', bg: 'bg-destructive/10' },
  closed: { text: 'Concluído', color: 'text-blue-500', bg: 'bg-blue-500/10' },
};

export const UpcomingAppointmentsList = ({ selectedDate }: UpcomingAppointmentsListProps) => {
  const { user } = useSession();

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ['upcomingAppointments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const today = format(new Date(), 'yyyy-MM-dd');
      const tomorrow = format(new Date().setDate(new Date().getDate() + 1), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('quotes')
        .select('id, client_name, vehicle, service_date, service_time, status')
        .eq('user_id', user.id)
        .not('service_date', 'is', null)
        .in('status', ['pending', 'accepted']) // Apenas agendamentos em aberto ou aceitos
        .or(`service_date.eq.${today},service_date.eq.${tomorrow}`)
        .order('service_date', { ascending: true })
        .order('service_time', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Próximos Agendamentos</CardTitle>
          </div>
          <CardDescription>
            Seus agendamentos para hoje e amanhã.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const todayAppointments = appointments?.filter(app => isToday(parseISO(app.service_date))) || [];
  const tomorrowAppointments = appointments?.filter(app => isTomorrow(parseISO(app.service_date))) || [];

  return (
    <Card className="bg-gradient-to-br from-card to-card/80 border-border/50 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">Próximos Agendamentos</CardTitle>
        </div>
        <CardDescription>
          Seus agendamentos para hoje e amanhã.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {todayAppointments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Hoje ({format(new Date(), 'dd/MM', { locale: ptBR })})</h3>
                <div className="space-y-3">
                  {todayAppointments.map(app => (
                    <div key={app.id} className={cn("p-3 rounded-lg border-l-4", statusColors[app.status].bg, `border-${statusColors[app.status].color.split('-')[1]}-500`)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{app.service_time || 'Hora a definir'}</span>
                        </div>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", statusColors[app.status].color, statusColors[app.status].bg)}>
                          {statusColors[app.status].text}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{app.client_name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{app.vehicle}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tomorrowAppointments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Amanhã ({format(new Date().setDate(new Date().getDate() + 1), 'dd/MM', { locale: ptBR })})</h3>
                <div className="space-y-3">
                  {tomorrowAppointments.map(app => (
                    <div key={app.id} className={cn("p-3 rounded-lg border-l-4", statusColors[app.status].bg, `border-${statusColors[app.status].color.split('-')[1]}-500`)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{app.service_time || 'Hora a definir'}</span>
                        </div>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", statusColors[app.status].color, statusColors[app.status].bg)}>
                          {statusColors[app.status].text}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{app.client_name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{app.vehicle}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {todayAppointments.length === 0 && tomorrowAppointments.length === 0 && (
              <p className="text-center text-muted-foreground italic py-4">Nenhum agendamento próximo.</p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};