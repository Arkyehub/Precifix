import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, ArrowLeft, ArrowRight, Search } from 'lucide-react';

interface AgendaHeaderProps {
  selectedDate: Date;
  searchTerm: string;
  formattedDate: string;
  onDateChange: (direction: 'prev' | 'next') => void;
  onSearchChange: (term: string) => void;
  onTodayClick: () => void;
  quoteCount: number;
}

export const AgendaHeader = ({
  selectedDate,
  searchTerm,
  formattedDate,
  onDateChange,
  onSearchChange,
  onTodayClick,
  quoteCount,
}: AgendaHeaderProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-8 w-8 text-foreground" />
          <div>
            <h2 className="text-xl font-bold text-foreground">Agenda Diária</h2>
            <p className="text-sm text-muted-foreground">
              {quoteCount > 0 ? `${quoteCount} agendamento(s) encontrado(s)` : 'Nenhum agendamento cadastrado para esta data'}
            </p>
          </div>
        </div>
        <Button onClick={onTodayClick} variant="outline" size="sm">
          Hoje
        </Button>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border/50">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onDateChange('prev')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold text-foreground min-w-[200px] text-center">
            {formattedDate}
          </h3>
          <Button variant="outline" size="icon" onClick={() => onDateChange('next')}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative flex-1 w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por agendamento..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-background w-full"
          />
        </div>
      </div>
    </div>
  );
};