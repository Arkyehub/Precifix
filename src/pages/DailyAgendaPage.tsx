import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { CalendarCheck } from 'lucide-react';
import { AgendaView } from '@/components/AgendaView';
import { useSearchParams } from 'react-router-dom';
import { parseISO, startOfDay, format } from 'date-fns';

const DailyAgendaPage = () => {
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  
  // Inicializa a data com o parâmetro da URL ou com a data atual
  const initialDate = dateParam ? startOfDay(parseISO(dateParam)) : startOfDay(new Date());

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
              <CalendarCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-foreground">Agenda Diária</CardTitle>
              <CardDescription>
                Visualize e gerencie o status dos orçamentos e agendamentos para o dia selecionado.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Passamos a data inicial para o AgendaView */}
          <AgendaView initialDate={initialDate} />
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyAgendaPage;