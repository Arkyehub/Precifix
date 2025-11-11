import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, BarChart3, CalendarCheck, Loader2, Plus } from 'lucide-react';
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
  accepted: { text: 'Aceito', color: 'text-green-500', bg: 'bg-green-500/20', compactBg: 'bg-green-500', compactText: 'text-white' },
  pending: { text: 'Em Aberto', color: 'text-yellow-500', bg: 'bg-yellow-500/20', compactBg: 'bg-yellow-500', compactText: 'text-white' },
  rejected: { text: 'Cancelado', color: 'text-destructive', bg: 'bg-destructive/20', compactBg: 'bg-destructive', compactText: 'text-white' },
  closed: { text: 'Concluído', color: 'text-blue-500', bg: 'bg-blue-500/20', compactBg: 'bg-blue-500', compactText: 'text-white' },
};

// Componente auxiliar para renderizar o status (modo detalhado)
const StatusPill = ({ count, statusKey }: { count: number, statusKey: keyof typeof statusColors }) => {
  if (count === 0) return null;
  const status = statusColors[statusKey];
  
  // Para 'pending' e 'accepted', usamos o mesmo rótulo 'Em Aberto'.
  // Para evitar duplicidade, só renderizamos se for 'pending' OU se for 'accepted' e 'pending' for 0.
  // REMOVIDO: Lógica de agrupamento de pending e accepted
  // if (statusKey === 'accepted' && summaryColors.pending.count > 0) return null;
  // if (statusKey === 'pending' && summaryColors.accepted.count > 0) return null;

  // Se for 'pending' ou 'accepted', somamos as contagens para exibir o total 'Em Aberto'
  // REMOVIDO: Lógica de soma de contagens
  // let displayCount = count;
  // if (statusKey === 'pending' || statusKey === 'accepted') {
  //   displayCount = summaryColors.pending.count + summaryColors.accepted.count;
  //   if (statusKey === 'accepted' && summaryColors.pending.count > 0) return null; // Evita duplicidade
  //   if (statusKey === 'pending' && summaryColors.accepted.count > 0) return null; // Evita duplicidade
  // }

  return (
    <div 
      className={cn(
        "flex items-center justify-center px-2 py-1 rounded-md text-xs font-bold leading-none", 
        status.compactBg, 
        status.compactText // Usando a cor de texto compacta (branca)
      )}
    >
      {count} {status.text}
    </div>
  );
};

// Componente auxiliar para renderizar o status compacto (a caixa arredondada)
const CompactStatusPill = ({ count, statusKey }: { count: number, statusKey: keyof typeof statusColors }) => {
  if (count === 0) return null;
  const status = statusColors[statusKey];
  
  // Usar as classes compactBg e compactText para o fundo e a cor do texto
  return (
    <div 
      className={cn(
        "h-6 w-6 flex items-center justify-center rounded-md text-sm font-bold leading-none", 
        status.compactBg, 
        status.compactText
      )}
      title={`${count} ${status.text}`}
    >
      {count}
    </div>
  );
};

// Mapeamento de status para o dia atual (usado dentro do loop)
const getDailySummaryColors = (summary: DailySummary | undefined) => {
  if (!summary) return {
    accepted: { count: 0, status: statusColors.accepted },
    pending: { count: 0, status: statusColors.pending },
    rejected: { count: 0, status: statusColors.rejected },
    closed: { count: 0, status: statusColors.closed },
  };

  return {
    accepted: { count: summary.accepted, status: statusColors.accepted },
    pending: { count: summary.pending, status: statusColors.pending },
    rejected: { count: summary.rejected, status: statusColors.rejected },
    closed: { count: summary.closed, status: statusColors.closed },
  };
};


export const MonthlyCalendarView = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const isMobile = useIsMobile(); // Usar o hook de mobile
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

  const startOfCurrentMonth = startOfMonth(currentMonth);
  const endOfCurrentMonth = endOfMonth(currentMonth);

  // Fetch all quotes that have a service_date defined for the current month
  const { data: quotes, isLoading, error } = useQuery<Quote[]>({
    queryKey: ['monthlyScheduledQuotes', user?.id, format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('id, status, service_date, total_price')
        .eq('user_id', user.id)
        .not('service_date', 'is', null)
        .gte('service_date', format(startOfCurrentMonth, 'yyyy-MM-dd'))
        .lte('service_date', format(endOfCurrentMonth, 'yyyy-MM-dd'));
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const calendarData = useMemo(() => {
    const dataMap = new Map<string, DailySummary>();
    const monthlySummary = {
      total: 0,
      accepted: 0,
      pending: 0,
      rejected: 0,
      closed: 0, // Adicionado
      totalValue: 0,
      acceptedValue: 0,
      pendingValue: 0,
      rejectedValue: 0,
      closedValue: 0, // Adicionado
    };

    quotes?.forEach(quote => {
      if (!quote.service_date) return;

      const dateKey = quote.service_date; // YYYY-MM-DD
      const summary = dataMap.get(dateKey) || { accepted: 0, pending: 0, rejected: 0, closed: 0, total: 0 };

      summary.total++;
      monthlySummary.total++;
      monthlySummary.totalValue += quote.total_price;

      if (quote.status === 'accepted') {
        summary.accepted++;
        monthlySummary.accepted++;
        monthlySummary.acceptedValue += quote.total_price;
      } else if (quote.status === 'pending') {
        summary.pending++;
        monthlySummary.pending++;
        monthlySummary.pendingValue += quote.total_price;
      } else if (quote.status === 'rejected') {
        summary.rejected++;
        monthlySummary.rejected++;
        monthlySummary.rejectedValue += quote.total_price;
      } else if (quote.status === 'closed') { // Novo status
        summary.closed++;
        monthlySummary.closed++;
        monthlySummary.closedValue += quote.total_price;
      }
      dataMap.set(dateKey, summary);
    });

    return { dataMap, monthlySummary };
  }, [quotes]);

  const daysInMonth = useMemo(() => {
    const start = startOfCurrentMonth;
    const end = endOfCurrentMonth;
    
    // Encontrar o primeiro dia da semana que contém o início do mês
    const firstDayOfWeek = startOfMonth(start);
    const startDay = subDays(firstDayOfWeek, getDay(firstDayOfWeek));

    // Encontrar o último dia da semana que contém o fim do mês
    const lastDayOfWeek = endOfMonth(end);
    const endDay = addDays(lastDayOfWeek, 6 - getDay(lastDayOfWeek));

    return eachDayOfInterval({ start: startDay, end: endDay });
  }, [currentMonth, startOfCurrentMonth, endOfCurrentMonth]);

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  const handleDayClick = (date: Date) => {
    // Navegar para a página de agenda diária, passando a data como parâmetro
    navigate(`/agenda/daily?date=${format(date, 'yyyy-MM-dd')}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Carregando calendário...</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive">Erro ao carregar dados do calendário: {error.message}</p>;
  }

  const { dataMap, monthlySummary } = calendarData;

  return (
    <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
      <CardHeader className="relative">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
            <CalendarCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-foreground">Calendário de Agendamentos</CardTitle>
            <CardDescription>
              Visualize o resumo mensal e os agendamentos por dia.
            </CardDescription>
          </div>
        </div>
        <Button
          variant="default"
          size="sm"
          className="absolute top-4 right-4"
          onClick={() => navigate('/generate-quote')}
        >
          <Plus className="mr-2 h-4 w-4" />
          Criar Orçamento
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Navegação Mensal */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border/50">
          <Button variant="ghost" size="icon" onClick={() => handleMonthChange('prev')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h3 className="text-xl font-bold text-foreground">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <Button variant="ghost" size="icon" onClick={() => handleMonthChange('next')}>
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Resumo do Período */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">Resumo do período</h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4"> {/* Alterado para 5 colunas */}
            <SummaryBox title="Total" count={monthlySummary.total} value={monthlySummary.totalValue} color="text-foreground" valueColor="text-primary-strong" />
            <SummaryBox title="Concluídos" count={monthlySummary.closed} value={monthlySummary.closedValue} color="text-blue-500" valueColor="text-blue-500" /> {/* Adicionado Concluídos */}
            <SummaryBox title="Aceitos" count={monthlySummary.accepted} value={monthlySummary.acceptedValue} color="text-green-500" valueColor="text-green-500" /> {/* NOVO */}
            <SummaryBox title="Em Aberto" count={monthlySummary.pending} value={monthlySummary.pendingValue} color="text-yellow-500" valueColor="text-yellow-500" /> {/* Alterado para apenas pending */}
            <SummaryBox title="Cancelados" count={monthlySummary.rejected} value={monthlySummary.rejectedValue} color="text-destructive" valueColor="text-destructive" /> {/* Nomenclatura atualizada */}
          </div>
        </div>

        {/* Calendário */}
        <div className="grid grid-cols-7 border border-border/50 rounded-lg overflow-hidden">
          {/* Cabeçalho dos dias da semana */}
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="p-2 text-center text-sm font-semibold text-muted-foreground bg-muted/50 border-b border-border/50">
              {day}
            </div>
          ))}

          {/* Células do Calendário */}
          {daysInMonth.map((date, index) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const summary = dataMap.get(dateKey);
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isDayToday = isToday(date);
            const hasQuotes = !!summary && summary.total > 0;

            const summaryColors = getDailySummaryColors(summary);

            const statusList = [
              { key: 'closed', count: summaryColors.closed.count, status: statusColors.closed },
              { key: 'accepted', count: summaryColors.accepted.count, status: statusColors.accepted }, // Não agrupa mais
              { key: 'pending', count: summaryColors.pending.count, status: statusColors.pending }, // Separado
              { key: 'rejected', count: summaryColors.rejected.count, status: statusColors.rejected },
            ].filter(s => s.count > 0);

            // Lógica de visualização:
            // 1. Se for mobile, sempre usa o modo compacto.
            // 2. Se não for mobile, usa o modo compacto se houver mais de 2 status ativos.
            const useCompactView = isMobile || statusList.length > 2;

            // Dividir a lista de status em duas linhas (2 em cima, 2 em baixo)
            const firstRow = statusList.slice(0, 2);
            const secondRow = statusList.slice(2, 4);

            return (
              <div
                key={index}
                className={cn(
                  "h-32 p-2 border border-border/50 cursor-pointer transition-colors flex flex-col", // Adicionado flex flex-col
                  isCurrentMonth ? 'bg-background hover:bg-muted/50' : 'bg-muted/20 text-muted-foreground/70',
                  isDayToday && 'border-2 border-primary shadow-inner'
                )}
                onClick={() => handleDayClick(date)}
              >
                <div className={cn("text-lg font-bold mb-1", !isCurrentMonth && 'text-muted-foreground/50')}>
                  {format(date, 'd')}
                </div>
                
                {hasQuotes && (
                  <div className="flex flex-col gap-1 mt-auto">
                    {useCompactView ? (
                      <>
                        {/* Primeira linha: 2 indicadores */}
                        <div className="flex gap-1 justify-start">
                          {firstRow.map(s => (
                            <CompactStatusPill key={s.key} count={s.count} statusKey={s.key as keyof typeof statusColors} />
                          ))}
                        </div>
                        {/* Segunda linha: 2 indicadores */}
                        {secondRow.length > 0 && (
                          <div className="flex gap-1 justify-start">
                            {secondRow.map(s => (
                              <CompactStatusPill key={s.key} count={s.count} statusKey={s.key as keyof typeof statusColors} />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Modo Detalhado: Renderiza apenas os status relevantes */}
                        <StatusPill count={summaryColors.closed.count} statusKey="closed" />
                        <StatusPill count={summaryColors.accepted.count} statusKey="accepted" />
                        <StatusPill count={summaryColors.pending.count} statusKey="pending" />
                        <StatusPill count={summaryColors.rejected.count} statusKey="rejected" />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

interface SummaryBoxProps {
  title: string;
  count: number;
  value: number;
  color: string;
  valueColor: string;
}

const SummaryBox = ({ title, count, value, color, valueColor }: SummaryBoxProps) => (
  <div className="p-4 rounded-lg border bg-background/50 shadow-sm">
    <h5 className={cn("text-sm font-medium", color)}>{title} {count !== undefined && `(${count})`}</h5>
    <p className={cn("text-xl font-bold mt-1", valueColor)}>R$ {value.toFixed(2)}</p>
  </div>
);