import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReceiptText, Loader2 } from 'lucide-react';
import { useSession } from "@/components/SessionContextProvider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MonthlyBillingCard } from '@/components/billing/MonthlyBillingCard';
import { MonthlyExpensesDisplay } from '@/components/billing/MonthlyExpensesDisplay';
import { AnnualResultSummary } from '@/components/billing/AnnualResultSummary'; // Importar o novo componente
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface MonthlyBilling {
  id: string;
  user_id: string;
  month: number;
  year: number;
  billing_amount: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyExpense {
  id: string;
  monthly_billing_id: string;
  description: string;
  value: number;
  type: 'fixed' | 'variable';
  source: 'global' | 'monthly_override';
  operational_cost_id: string | null;
  created_at: string;
  updated_at: string;
}

const BillingPage = () => {
  const { user } = useSession();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Fetch all monthly billing records for the user
  const { data: monthlyBillingRecords, isLoading: isLoadingBillingRecords, error: billingRecordsError } = useQuery<MonthlyBilling[]>({
    queryKey: ['monthlyBillingRecords', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('monthly_billing')
        .select('*')
        .eq('user_id', user.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const currentMonthlyBilling = monthlyBillingRecords?.find(
    (record) => record.month === selectedMonth && record.year === selectedYear
  );

  const availableYears = Array.from(new Set(monthlyBillingRecords?.map(r => r.year) || []));
  if (!availableYears.includes(currentYear)) {
    availableYears.push(currentYear);
  }
  availableYears.sort((a, b) => b - a); // Sort descending

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: format(new Date(2000, i, 1), 'MMMM', { locale: ptBR }),
  }));

  if (isLoadingBillingRecords) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Carregando dados de faturamento...</p>
      </div>
    );
  }

  if (billingRecordsError) {
    return <p className="text-destructive">Erro ao carregar faturamento: {billingRecordsError.message}</p>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-[var(--shadow-elegant)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
              <ReceiptText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-foreground">Gerenciar Faturamento Mensal</CardTitle>
              <CardDescription>
                Registre seu faturamento e despesas para cada mês.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 space-y-2">
              <label htmlFor="select-month" className="text-sm font-medium text-foreground">Mês</label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value, 10))}
              >
                <SelectTrigger id="select-month" className="bg-background">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <label htmlFor="select-year" className="text-sm font-medium text-foreground">Ano</label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value, 10))}
              >
                <SelectTrigger id="select-year" className="bg-background">
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <MonthlyBillingCard
            monthlyBilling={currentMonthlyBilling}
            month={selectedMonth}
            year={selectedYear}
          />

          <MonthlyExpensesDisplay
            monthlyBillingId={currentMonthlyBilling?.id}
            month={selectedMonth}
            year={selectedYear}
          />

          <AnnualResultSummary year={selectedYear} /> {/* Novo componente aqui */}
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingPage;