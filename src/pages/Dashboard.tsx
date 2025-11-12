import React, { useState, useEffect, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { ServiceProfitabilityChart } from '@/components/dashboard/ServiceProfitabilityChart';
import { QuotesCalendar } from '@/components/dashboard/QuotesCalendar';
import { DashboardAnnualSummary } from '@/components/dashboard/DashboardAnnualSummary';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { DraggableCollapsibleSection } from '@/components/DraggableCollapsibleSection'; // Importar o novo componente
import { Gauge, BarChart2, DollarSign, FileText, Car } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react'; // Importar Loader2
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, getMonth, getYear, setMonth, setYear, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';

// Novos componentes que serão criados
import { DashboardStatsCards } from '@/components/dashboard/DashboardStatsCards';
import { DailyRevenueChart } from '@/components/dashboard/DailyRevenueChart';
import { PopularServicesChart } from '@/components/dashboard/PopularServicesChart';
import { AppointmentSummaryCard } from '@/components/dashboard/AppointmentSummaryCard';
import { UpcomingAppointmentsList } from '@/components/dashboard/UpcomingAppointmentsList';

interface UserPreference {
  id: string;
  user_id: string;
  preference_key: string;
  preference_value: { order?: string[]; isOpen?: boolean }; // Atualizado para permitir 'order'
}

const DEFAULT_SECTION_ORDER = [
  'dashboardStats',
  'serviceProfitabilityChart',
  'dashboardAnnualSummary',
  'quotesCalendar',
];

const sectionComponents: { [key: string]: { component: React.ElementType; title: string; icon: React.ElementType; defaultOpen: boolean } } = {
  dashboardStats: { component: DashboardStats, title: "Estatísticas Rápidas", icon: BarChart2, defaultOpen: true },
  serviceProfitabilityChart: { component: ServiceProfitabilityChart, title: "Lucratividade dos Serviços", icon: DollarSign, defaultOpen: true },
  dashboardAnnualSummary: { component: DashboardAnnualSummary, title: "Resultado Anual", icon: BarChart2, defaultOpen: true },
  quotesCalendar: { component: QuotesCalendar, title: "Orçamentos no Calendário", icon: FileText, defaultOpen: true },
};

const Dashboard = () => {
  const { user } = useSession();
  const { toast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date()); // Estado para o mês/ano selecionado

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  const handleMonthSelect = (monthIndex: number) => {
    setCurrentDate(prev => setMonth(prev, monthIndex));
  };

  const handleYearSelect = (year: number) => {
    setCurrentDate(prev => setYear(prev, year));
  };

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(2000, i, 1), 'MMMM', { locale: ptBR }),
  }));

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i); // Últimos 2 anos, ano atual, próximos 2 anos

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Carregando usuário...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Gauge className="h-6 w-6 text-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Painel Principal - {format(currentDate, 'MMMM yyyy', { locale: ptBR })}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleMonthChange('prev')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Select
            value={getMonth(currentDate).toString()}
            onValueChange={(value) => handleMonthSelect(parseInt(value, 10))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value.toString()}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={getYear(currentDate).toString()}
            onValueChange={(value) => handleYearSelect(parseInt(value, 10))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => handleMonthChange('next')}>
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Cards Superiores */}
      <DashboardStatsCards selectedDate={currentDate} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {/* Gráfico de Faturamento Diário */}
          <DailyRevenueChart selectedDate={currentDate} />
        </div>
        <div className="lg:col-span-1">
          {/* Gráfico de Serviços Mais Populares */}
          <PopularServicesChart selectedDate={currentDate} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          {/* Resumo de Agendamentos */}
          <AppointmentSummaryCard selectedDate={currentDate} />
        </div>
        <div>
          {/* Próximos Agendamentos */}
          <UpcomingAppointmentsList selectedDate={currentDate} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;