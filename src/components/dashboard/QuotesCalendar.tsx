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
        .order('quote_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const quotesByDate = React.useMemo(() => {
    const map = new Map<string, Quote[]>();
    quotes?.forEach(quote => {
      const dateKey = format(new Date(quote.quote_date), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)?.push(quote);
    });
    return map;
  }, [quotes]);

  const modifiers = {
    hasQuotes: (date: Date) => quotesByDate.has(format(date, 'yyyy-MM-dd')),
    today: new Date(), // Definir 'today' como um modificador
  };

  const modifiersClassNames = {
    hasQuotes: 'bg-primary text-primary-foreground rounded-full',
    today: 'bg-background border border-primary text-foreground', // Estilo para a data de hoje: fundo branco, contorno amarelo
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
            <CardTitle className="text-foreground">Orçamentos no Calendário</CardTitle>
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
            <CardTitle className="text-foreground">Orçamentos no Calendário</CardTitle>
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
          <CardTitle className="text-foreground">Orçamentos no Calendário</CardTitle>
        </div>
        <CardDescription>
          Visualize os orçamentos gerados por data.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            modifiers={modifiers}
            modifiersClassNames={modifiersClassNames}
            className="rounded-md border bg-background shadow-md"
            locale={ptBR}
            classNames={{
              // O hover geral já está definido em src/components/ui/calendar.tsx
              // O day_selected também usará o hover geral
            }}
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
      </CardContent>
    </Card>
  );
};