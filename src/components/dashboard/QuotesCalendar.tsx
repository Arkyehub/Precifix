import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar as CalendarIcon, Loader2, FileText } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Quote {
  id: string;
  client_name: string;
  vehicle: string;
  total_price: number;
  quote_date: string; // ISO date string
  services_summary: any[]; // JSONB field
}

export const QuotesCalendar = () => {
  const { user } = useSession();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const { data: quotes, isLoading, error } = useQuery<Quote[]>({
    queryKey: ['quotesCalendar', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('user_id', user.id)
        .order('quote_date', { ascending: false }); // Usar quote_date por enquanto
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const currentMonth = selectedDate ? selectedDate.getMonth() + 1 : new Date().getMonth() + 1;
  const currentYear = selectedDate ? selectedDate.getFullYear() : new Date().getFullYear();

  const { data: pendingQuotesCount, isLoading: isLoadingPending } = useQuery<number>({
    queryKey: ['pendingQuotesCount', user?.id, currentYear, currentMonth],
    queryFn: async () => {
      if (!user) return 0;
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
      const endOfMonth = new Date(currentYear, currentMonth, 1);
      const { count, error } = await supabase
        .from('quotes')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .gte('created_at', startOfMonth.toISOString())
        .lt('created_at', endOfMonth.toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: acceptedQuotesCount, isLoading: isLoadingAccepted } = useQuery<number>({
    queryKey: ['acceptedQuotesCount', user?.id, currentYear, currentMonth],
    queryFn: async () => {
      if (!user) return 0;
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
      const endOfMonth = new Date(currentYear, currentMonth, 1);
      const { count, error } = await supabase
        .from('quotes')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .gte('created_at', startOfMonth.toISOString())
        .lt('created_at', endOfMonth.toISOString());
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const quotesByDate = React.useMemo(() => {
    const map = new Map<string, Quote[]>();
    quotes?.forEach(quote => {
      // Usar quote_date por enquanto
      const dateToUse = quote.quote_date;
      if (!dateToUse) return;

      const [year, month, day] = dateToUse.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);
      const dateKey = format(localDate, 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)?.push(quote);
    });
    return map;
  }, [quotes]);

  const modifiers = {
    hasQuotes: (date: Date) => quotesByDate.has(format(date, 'yyyy-MM-dd')),
    today: new Date(),
  };

  const modifiersClassNames = {
    hasQuotes: 'bg-primary text-primary-foreground rounded-full',
    today: 'bg-background border border-primary text-foreground',
  };

  const selectedDayQuotes = selectedDate 
    ? quotesByDate.get(format(selectedDate, 'yyyy-MM-dd')) || []
    : [];

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Orçamentos</CardTitle>
          </div>
          <CardDescription>
            Carregando orçamentos...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Orçamentos</CardTitle>
          </div>
          <CardDescription className="text-destructive">
            Erro ao carregar orçamentos: {error.message}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-5 w-5 text-primary" />
          <CardTitle className="text-foreground">Orçamentos</CardTitle>
        </div>
        <CardDescription>
          Visualize os orçamentos gerados por data e estatísticas mensais.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calendar">Calendário</TabsTrigger>
            <TabsTrigger value="monthly">Orçamentos desse Mês</TabsTrigger>
          </TabsList>
          <TabsContent value="calendar" className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  modifiers={modifiers}
                  modifiersClassNames={modifiersClassNames}
                  className="rounded-md border bg-background shadow-md"
                  locale={ptBR}
                />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-3">
                  Orçamentos em {selectedDate ? format(selectedDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Nenhuma data selecionada'}
                </h3>
                {selectedDayQuotes.length > 0 ? (
                  <ScrollArea className="h-[200px] w-full rounded-md border bg-background p-4">
                    <div className="space-y-3">
                      {selectedDayQuotes.map(quote => (
                        <div key={quote.id} className="p-3 border rounded-md bg-muted/20">
                          <p className="font-medium text-foreground">{quote.client_name}</p>
                          <p className="text-sm text-muted-foreground">Veículo: {quote.vehicle}</p>
                          <p className="text-sm text-primary font-bold">Total: R$ {quote.total_price.toFixed(2)}</p>
                          {quote.services_summary && quote.services_summary.length > 0 && (
                            <Popover>
                              <PopoverTrigger className="text-xs text-blue-500 hover:underline mt-1">Ver Detalhes dos Serviços</PopoverTrigger>
                              <PopoverContent className="w-80 bg-card">
                                <h4 className="font-semibold mb-2">Serviços:</h4>
                                <ul className="list-disc list-inside text-sm">
                                  {quote.services_summary.map((service: any, index: number) => (
                                    <li key={index}>{service.name} - R$ {service.price.toFixed(2)}</li>
                                  ))}
                                </ul>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhum orçamento para esta data.</p>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="monthly" className="space-y-4">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {format(new Date(currentYear, currentMonth - 1, 1), 'MMMM yyyy', { locale: ptBR })}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                <FileText className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <h4 className="text-lg font-semibold text-yellow-800">Orçamentos Pendentes</h4>
                <p className="text-3xl font-bold text-yellow-600 mt-2">
                  {isLoadingPending ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : pendingQuotesCount}
                </p>
                <p className="text-sm text-yellow-700 mt-1">Aguardando aprovação do cliente</p>
              </div>
              <div className="text-center p-6 bg-green-50 border border-green-200 rounded-lg">
                <FileText className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <h4 className="text-lg font-semibold text-green-800">Orçamentos Aprovados</h4>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {isLoadingAccepted ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : acceptedQuotesCount}
                </p>
                <p className="text-sm text-green-700 mt-1">Aprovados pelos clientes</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};