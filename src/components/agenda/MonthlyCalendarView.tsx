import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, BarChart3, CalendarCheck, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, subMonths, addMonths, getDay, subDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile'; // Importar o hook de mobile

interface Quote {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'closed';
  service_date: string | null;
  total_price: number;
}

interface DailySummary {
  accepted: number;
  pending: number;
  rejected: number;
  closed: number; // Adicionado
  total: number;
}

const statusColors = {
  accepted: { text: 'aprovado', color: 'text-success', bg: 'bg-success/20', compactBg: 'bg-success', compactText: 'text-white' }, // Aceito (Verde)
  pending: { text: 'pendente', color: 'text-primary-strong', bg: 'bg-primary-strong/20', compactBg: 'bg-primary-strong', compactText: 'text-white' }, // Pendente (Laranja Forte)
  rejected: { text: 'cancelado', color: 'text-destructive', bg: 'bg-destructive/20', compactBg: 'bg-destructive', compactText: 'text-white' }, // Cancelado (Vermelho)
  closed: { text: 'concluído', color: 'text-info', bg: 'bg-info/20', compactBg: 'bg-info', compactText: 'text-white' }, // Concluído (Azul)
};

export const MonthlyCalendarView = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);

  // Fetch all quotes that have a service_date defined for the current month
  const { data: quotes, isLoading, error } = useQuery<Quote[]>({
    queryKey: ['monthlyScheduledQuotes', user?.id, format(start, 'yyyy-MM')],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('id, status, service_date, total_price')
        .eq('user_id', user.id)
        .not('service_date', 'is', null)
        .gte('service_date', format(start, 'yyyy-MM-dd'))
        .lte('service_date', format(end, 'yyyy-MM-dd'));
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const quotesByDay = useMemo(() => {
    const map = new Map<string, DailySummary>();
    quotes?.forEach(quote => {
      if (!quote.service_date) return;
      const dateKey = quote.service_date; // YYYY-MM-DD

      const summary = map.get(dateKey) || {
        total: 0,
        accepted: 0,
        pending: 0,
        rejected: 0,
        closed: 0,
      };

      summary.total++;
      if (quote.status === 'accepted') summary.accepted++;
      if (quote.status === 'pending') summary.pending++;
      if (quote.status === 'rejected') summary.rejected++;
      if (quote.status === 'closed') summary.closed++;

      map.set(dateKey, summary);
    });
    return map;
  }, [quotes]);

  const daysInMonth = useMemo(() => {
    const startDay = startOfMonth(currentMonth);
    const endDay = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: startDay, end: endDay });

    // Adicionar dias do mês anterior para preencher a primeira semana
    const firstDayOfWeek = getDay(startDay); // 0 = Sunday, 1 = Monday
    const startPadding = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Se for domingo, 6 dias antes (se a semana começar na segunda)
    
    let paddedDays = [];
    for (let i = 0; i < startPadding; i++) {
      paddedDays.unshift(subDays(startDay, i + 1));
    }
    paddedDays = paddedDays.sort((a, b) => a.getTime() - b.getTime());
    
    // Adicionar os dias do mês atual
    paddedDays.push(...days);

    // Adicionar dias do próximo mês para preencher a última semana
    const totalCells = Math.ceil(paddedDays.length / 7) * 7;
    const endPadding = totalCells - paddedDays.length;
    
    for (let i = 0; i < endPadding; i++) {
      paddedDays.push(addDays(endDay, i + 1));
    }

    return paddedDays;
  }, [currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleDayClick = (date: Date) => {
    navigate(`/agenda/daily?date=${format(date, 'yyyy-MM-dd')}`);
  };

  const renderDayCell = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const summary = quotesByDay.get(dateKey);
    const isCurrentMonth = isSameMonth(date, currentMonth);
    const isTodayDate = isToday(date);

    return (
      <div
        key={dateKey}
        className={cn(
          "p-2 border border-border/50 h-24 flex flex-col cursor-pointer transition-colors",
          isCurrentMonth ? "bg-background hover:bg-muted/50" : "bg-muted/30 text-muted-foreground",
          isTodayDate && "border-2 border-primary shadow-md"
        )}
        onClick={() => handleDayClick(date)}
      >
        <span className={cn("text-sm font-semibold", isTodayDate && "text-primary")}>
          {format(date, 'd')}
        </span>
        
        {summary && summary.total > 0 && (
          <div className="mt-1 space-y-0.5 overflow-hidden">
            {summary.closed > 0 && (
              <div className={cn("text-xs font-medium px-1 rounded-sm flex items-center justify-between", statusColors.closed.bg, statusColors.closed.color)}>
                <span className="truncate">Concluídos</span>
                <span>{summary.closed}</span>
              </div>
            )}
            {summary.accepted > 0 && (
              <div className={cn("text-xs font-medium px-1 rounded-sm flex items-center justify-between", statusColors.accepted.bg, statusColors.accepted.color)}>
                <span className="truncate">Aceitos</span>
                <span>{summary.accepted}</span>
              </div>
            )}
            {summary.pending > 0 && (
              <div className={cn("text-xs font-medium px-1 rounded-sm flex items-center justify-between", statusColors.pending.bg, statusColors.pending.color)}>
                <span className="truncate">Pendentes</span>
                <span>{summary.pending}</span>
              </div>
            )}
            {summary.rejected > 0 && (
              <div className={cn("text-xs font-medium px-1 rounded-sm flex items-center justify-between", statusColors.rejected.bg, statusColors.rejected.color)}>
                <span className="truncate">Cancelados</span>
                <span>{summary.rejected}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
            <CalendarCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-foreground">Agenda Mensal</CardTitle>
            <CardDescription>
              Visualize seus agendamentos e vendas por mês.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4 p-2 rounded-lg bg-muted/50 border border-border/50">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-xl font-bold text-foreground">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Carregando agendamentos...</p>
          </div>
        ) : error ? (
          <p className="text-destructive">Erro ao carregar agendamentos: {error.message}</p>
        ) : (
          <div className="grid grid-cols-7 border border-border/50 rounded-lg overflow-hidden">
            {/* Cabeçalho dos dias da semana */}
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-bold text-primary-strong bg-muted border-b border-border/50">
                {day}
              </div>
            ))}

            {/* Células do calendário */}
            {daysInMonth.map(renderDayCell)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};