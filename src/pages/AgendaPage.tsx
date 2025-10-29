import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { CalendarCheck } from 'lucide-react';
import { AgendaView } from '@/components/AgendaView';

const AgendaPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
              <CalendarCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-foreground">Agenda de Orçamentos</CardTitle>
              <CardDescription>
                Visualize e gerencie o status dos orçamentos e agendamentos.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AgendaView />
        </CardContent>
      </Card>
    </div>
  );
};

export default AgendaPage;