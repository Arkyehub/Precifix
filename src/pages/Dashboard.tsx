import React from 'react';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { ServiceProfitabilityChart } from '@/components/dashboard/ServiceProfitabilityChart';
import { QuotesCalendar } from '@/components/dashboard/QuotesCalendar';
import { DashboardAnnualSummary } from '@/components/dashboard/DashboardAnnualSummary';
import { CollapsibleSection } from '@/components/CollapsibleSection'; // Importar o novo componente
import { Gauge, BarChart2, DollarSign, FileText, Car } from 'lucide-react'; // Importar ícones necessários

const Dashboard = () => {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <Gauge className="h-6 w-6 text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Painel Principal</h1>
      </div>

      <CollapsibleSection title="Estatísticas Rápidas" preferenceKey="dashboardStats" icon={BarChart2} defaultOpen={true}>
        <DashboardStats />
      </CollapsibleSection>

      <CollapsibleSection title="Lucratividade dos Serviços" preferenceKey="serviceProfitabilityChart" icon={DollarSign} defaultOpen={true}>
        <ServiceProfitabilityChart />
      </CollapsibleSection>

      <CollapsibleSection title="Resultado Anual" preferenceKey="dashboardAnnualSummary" icon={BarChart2} defaultOpen={true}>
        <DashboardAnnualSummary />
      </CollapsibleSection>
      
      <CollapsibleSection title="Orçamentos no Calendário" preferenceKey="quotesCalendar" icon={FileText} defaultOpen={true}>
        <QuotesCalendar />
      </CollapsibleSection>
    </div>
  );
};

export default Dashboard;