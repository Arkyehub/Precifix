import React from 'react';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { ServiceProfitabilityChart } from '@/components/dashboard/ServiceProfitabilityChart';
import { QuotesCalendar } from '@/components/dashboard/QuotesCalendar';
import { DashboardAnnualSummary } from '@/components/dashboard/DashboardAnnualSummary'; // Importar o novo componente
import { Gauge } from 'lucide-react';

const Dashboard = () => {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <Gauge className="h-6 w-6 text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Painel Principal</h1>
      </div>

      <DashboardStats />
      <ServiceProfitabilityChart />
      <DashboardAnnualSummary /> {/* Adicionado o novo componente aqui */}
      <QuotesCalendar />
    </div>
  );
};

export default Dashboard;